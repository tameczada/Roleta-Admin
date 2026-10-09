// routes/musicas.js
// Playlist de músicas: upload vai para o Supabase Storage (bucket público
// "musicas"), metadados (nome, ordem) ficam no estado (roleta_estado.playlist).
const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const { v4: uuidv4 } = require("uuid");
const store   = require("../store");
const supabase = require("../supabase/client");
const { requireAuth } = require("../middleware/auth");
const { emit } = require("./events");

const BUCKET = "musicas";

async function ensureBucket() {
  try {
    const { data, error } = await supabase.storage.getBucket(BUCKET);
    if (error || !data) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: "15MB",
      });
      if (createErr && !/already exists/i.test(createErr.message)) throw createErr;
      console.log(`[musicas] Bucket "${BUCKET}" criado no Supabase Storage.`);
    }
  } catch (e) {
    console.error(`[musicas] Não foi possível garantir o bucket "${BUCKET}":`, e.message);
  }
}
ensureBucket();

// Aceita por mimetype OU por extensão: alguns navegadores/SOs mandam um
// mimetype genérico ("application/octet-stream") para .m4a/.flac/.wav, e
// isso derrubava o lote inteiro (ver fileFilter abaixo).
const EXT_AUDIO = /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus|wma)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okMime = file.mimetype.startsWith("audio/");
    const okExt  = EXT_AUDIO.test(file.originalname);
    if (!okMime && !okExt) return cb(new Error(`"${file.originalname}" não parece um arquivo de áudio.`));
    cb(null, true);
  },
});

function publicUrl(filename) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

function nomeSemExtensao(originalname) {
  return path.basename(originalname, path.extname(originalname));
}

// Remove entradas duplicadas (mesmo id ou mesmo filename) mantendo a primeira ocorrência.
function dedupePlaylist(playlist) {
  const vistos = new Set();
  const vistosFile = new Set();
  return playlist.filter(t => {
    if (vistos.has(t.id) || vistosFile.has(t.filename)) return false;
    vistos.add(t.id);
    vistosFile.add(t.filename);
    return true;
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Envia um arquivo ao Supabase Storage. Uma retentativa automática (c/ pequena
// espera) antes de desistir — cobre falhas passageiras de rede/Storage, que são
// o motivo mais comum de "funciona 1 por vez, mas falha ao enviar várias juntas":
// antes, QUALQUER falha em QUALQUER arquivo do lote abortava o lote inteiro e
// descartava os que já tinham sido enviados com sucesso.
async function enviarUmaFaixa(file, nomeCustom) {
  const filename = `${uuidv4()}${path.extname(file.originalname) || ".mp3"}`;
  let ultimoErro;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, file.buffer, { contentType: file.mimetype || "audio/mpeg" });
    if (!error) {
      const nome = (nomeCustom && String(nomeCustom).trim()) || nomeSemExtensao(file.originalname);
      return { id: uuidv4(), nome, filename };
    }
    ultimoErro = error;
    if (tentativa === 1) await sleep(800);
  }
  throw new Error(`"${file.originalname}": ${ultimoErro.message}`);
}

// GET /api/musicas — lista a playlist (público, é o que a roleta consome)
router.get("/", (req, res) => {
  const playlist = store.get().playlist || [];
  res.json({ ok: true, data: playlist.map(t => ({ ...t, url: publicUrl(t.filename) })) });
});

// POST /api/musicas — upload de uma ou mais faixas (multipart, campo "files")
// Nomes customizados (opcional): campo "nomes" com um array JSON na mesma
// ordem dos arquivos, ex: '["Intro","Vitória"]'. Sem isso, usa o nome do arquivo.
//
// Os arquivos são enviados ao Supabase EM PARALELO (não um atrás do outro) e
// cada um é isolado: uma falha em um arquivo não derruba nem descarta os
// outros. A resposta sempre diz quantos entraram e, se algum falhou, qual e
// por quê — em vez de simplesmente "não funcionar" sem explicação.
router.post("/", requireAuth, upload.array("files", 20), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado." });

  let nomesCustom = [];
  if (req.body?.nomes) {
    try { nomesCustom = JSON.parse(req.body.nomes); } catch { nomesCustom = []; }
  }

  const resultados = await Promise.allSettled(
    req.files.map((file, i) => enviarUmaFaixa(file, nomesCustom[i]))
  );

  const novas  = resultados.filter(r => r.status === "fulfilled").map(r => r.value);
  const falhas = resultados.filter(r => r.status === "rejected").map(r => r.reason.message);

  if (novas.length) {
    // Relê o estado bem no momento de gravar (não antes dos uploads, que são
    // assíncronos) e remove qualquer duplicata por id/filename como segurança.
    const state = store.get();
    const atual = state.playlist || [];
    state.playlist = dedupePlaylist([...atual, ...novas]);
    store.set(state);
    emit("playlist", state.playlist.map(t => ({ ...t, url: publicUrl(t.filename) })));
  }

  const data = store.get().playlist.map(t => ({ ...t, url: publicUrl(t.filename) }));
  res.status(novas.length ? 200 : 502).json({
    ok: novas.length > 0,
    uploaded: novas.map(t => ({ ...t, url: publicUrl(t.filename) })),
    falhas,
    error: novas.length ? undefined : falhas.join(" | "),
    data,
  });
});

// PATCH /api/musicas/:id — renomeia uma faixa
router.patch("/:id", requireAuth, (req, res) => {
  const { nome } = req.body;
  if (!nome || !String(nome).trim()) return res.status(400).json({ ok: false, error: "nome obrigatório." });

  const state = store.get();
  const faixa = (state.playlist || []).find(t => t.id === req.params.id);
  if (!faixa) return res.status(404).json({ ok: false, error: "Faixa não encontrada." });

  faixa.nome = String(nome).trim();
  state.playlist = dedupePlaylist(state.playlist);
  store.set(state);

  const data = state.playlist.map(t => ({ ...t, url: publicUrl(t.filename) }));
  emit("playlist", data);
  res.json({ ok: true, data: { ...faixa, url: publicUrl(faixa.filename) } });
});

// DELETE /api/musicas/:id — remove uma faixa (storage + estado)
router.delete("/:id", requireAuth, async (req, res) => {
  const state = store.get();
  const playlist = state.playlist || [];
  const faixa = playlist.find(t => t.id === req.params.id);
  if (!faixa) return res.status(404).json({ ok: false, error: "Faixa não encontrada." });

  const { error } = await supabase.storage.from(BUCKET).remove([faixa.filename]);
  if (error) return res.status(502).json({ ok: false, error: error.message });

  state.playlist = playlist.filter(t => t.id !== req.params.id);
  store.set(state);

  const data = state.playlist.map(t => ({ ...t, url: publicUrl(t.filename) }));
  emit("playlist", data);
  res.json({ ok: true, deleted: faixa.id, data });
});

router.use((err, req, res, _next) => {
  res.status(400).json({ ok: false, error: err.message });
});

module.exports = router;
