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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("audio/")) return cb(new Error("Apenas arquivos de áudio."));
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

// GET /api/musicas — lista a playlist (público, é o que a roleta consome)
router.get("/", (req, res) => {
  const playlist = store.get().playlist || [];
  res.json({ ok: true, data: playlist.map(t => ({ ...t, url: publicUrl(t.filename) })) });
});

// POST /api/musicas — upload de uma ou mais faixas (multipart, campo "files")
// Nomes customizados (opcional): campo "nomes" com um array JSON na mesma
// ordem dos arquivos, ex: '["Intro","Vitória"]'. Sem isso, usa o nome do arquivo.
router.post("/", requireAuth, upload.array("files", 20), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado." });

  let nomesCustom = [];
  if (req.body?.nomes) {
    try { nomesCustom = JSON.parse(req.body.nomes); } catch { nomesCustom = []; }
  }

  const novas = [];
  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const filename = `${uuidv4()}${path.extname(file.originalname) || ".mp3"}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, file.buffer, { contentType: file.mimetype });
    if (error) return res.status(502).json({ ok: false, error: `Falha ao enviar ${file.originalname}: ${error.message}` });
    const nome = (nomesCustom[i] && String(nomesCustom[i]).trim()) || nomeSemExtensao(file.originalname);
    novas.push({ id: uuidv4(), nome, filename });
  }

  // Relê o estado bem no momento de gravar (não antes do loop de upload, que é
  // assíncrono) e remove qualquer duplicata por id/filename como segurança.
  const state = store.get();
  const atual = state.playlist || [];
  state.playlist = dedupePlaylist([...atual, ...novas]);
  store.set(state);

  const data = state.playlist.map(t => ({ ...t, url: publicUrl(t.filename) }));
  emit("playlist", data);
  res.json({ ok: true, uploaded: novas.map(t => ({ ...t, url: publicUrl(t.filename) })), data });
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
