// routes/imagens.js
// Bonecos e imagens estáticas agora ficam no Supabase Storage (buckets públicos
// "bonecos" e "imagens-estaticas") em vez do disco local do Render.
const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const { v4: uuidv4 } = require("uuid");
const store   = require("../store");
const supabase = require("../supabase/client");
const { requireAuth } = require("../middleware/auth");
const wrap = require("../middleware/asyncHandler");
const exigirSupabase = require("../middleware/needSupabase");
const { emit } = require("./events");

router.use(exigirSupabase); // 503 claro se o Supabase não estiver configurado

const BUCKET_BONECOS  = "bonecos";
const BUCKET_ESTATICAS = "imagens-estaticas";

// Slots reais — sem os backups (back2, leoeisa2, centr4o)
const STATIC_SLOTS = ["centro", "leoeisa", "back", "gato1", "will"];
const SLOT_LABELS  = {
  centro:  "Centro da roleta",
  leoeisa: "Fundo desfocado (leoeisa.png)",
  back:    "Fundo painel oculto (back.png)",
  gato1:   "Fundo do chat (gato1.png)",
  will:    "Favicon (will.png)",
};

// ── Cria os buckets públicos no Supabase Storage se ainda não existirem ──────
async function ensureBuckets() {
  for (const bucket of [BUCKET_BONECOS, BUCKET_ESTATICAS]) {
    try {
      const { data, error } = await supabase.storage.getBucket(bucket);
      if (error || !data) {
        const { error: createErr } = await supabase.storage.createBucket(bucket, { public: true });
        if (createErr && !/already exists/i.test(createErr.message)) throw createErr;
        console.log(`[imagens] Bucket "${bucket}" criado no Supabase Storage.`);
      }
    } catch (e) {
      console.error(`[imagens] Não foi possível garantir o bucket "${bucket}":`, e.message);
    }
  }
}
if (supabase) ensureBuckets();

// Só formatos raster conhecidos. A extensão vem do tipo MIME validado (não do nome
// enviado pelo cliente), para não gravar ".html"/".svg" em bucket público.
const EXT_POR_MIME = { "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp" };
const imagemFilter = (req, file, cb) => {
  if (!EXT_POR_MIME[file.mimetype]) return cb(new Error("Apenas imagens PNG, JPG, GIF ou WEBP."));
  cb(null, true);
};

// ── Multer em memória (o buffer vai direto para o Supabase Storage) ─────────
const uploadBoneco = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imagemFilter,
});
// Imagens estáticas (centro, fundos, favicon) também aceitam SVG.
const EXT_ESTATICAS = { ...EXT_POR_MIME, "image/svg+xml": ".svg" };
const uploadImg = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXT_ESTATICAS[file.mimetype]) return cb(new Error("Apenas imagens PNG, JPG, GIF, WEBP ou SVG."));
    cb(null, true);
  },
});

function publicUrl(bucket, filename) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

function buildSlotsResponse() {
  const { imagens } = store.get();
  const result = {};
  for (const slot of STATIC_SLOTS) {
    result[slot] = imagens[slot] ? publicUrl(BUCKET_ESTATICAS, imagens[slot]) : null;
  }
  return result;
}

// ═══ BONECOS ═════════════════════════════════════════════════════════════════

router.get("/bonecos", wrap(async (req, res) => {
  const { data, error } = await supabase.storage.from(BUCKET_BONECOS).list("", { limit: 1000 });
  if (error) return res.status(502).json({ ok: false, error: error.message });
  const files = (data || []).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name));
  res.json({ ok: true, data: files.map(f => ({ filename: f.name, url: publicUrl(BUCKET_BONECOS, f.name) })) });
}));

router.post("/bonecos", requireAuth, uploadBoneco.array("files", 20), wrap(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado." });

  const uploaded = [];
  for (const file of req.files) {
    const filename = `${uuidv4()}${EXT_POR_MIME[file.mimetype]}`;
    const { error } = await supabase.storage
      .from(BUCKET_BONECOS)
      .upload(filename, file.buffer, { contentType: file.mimetype });
    if (error) return res.status(502).json({ ok: false, error: `Falha ao enviar ${file.originalname}: ${error.message}` });
    uploaded.push({ filename, url: publicUrl(BUCKET_BONECOS, filename) });
  }

  const { data: listData } = await supabase.storage.from(BUCKET_BONECOS).list("", { limit: 1000 });
  const all = (listData || []).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)).map(f => f.name);
  store.patch("imagens", { bonecos: all });

  const allUrls = all.map(f => ({ filename: f, url: publicUrl(BUCKET_BONECOS, f) }));
  emit("bonecos", allUrls);
  res.json({ ok: true, uploaded });
}));

router.delete("/bonecos/:filename", requireAuth, wrap(async (req, res) => {
  const filename = path.basename(req.params.filename);
  const { error } = await supabase.storage.from(BUCKET_BONECOS).remove([filename]);
  if (error) return res.status(502).json({ ok: false, error: error.message });

  const { data: listData } = await supabase.storage.from(BUCKET_BONECOS).list("", { limit: 1000 });
  const remaining = (listData || []).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)).map(f => f.name);
  store.patch("imagens", { bonecos: remaining });

  const remainingUrls = remaining.map(f => ({ filename: f, url: publicUrl(BUCKET_BONECOS, f) }));
  emit("bonecos", remainingUrls);
  res.json({ ok: true, deleted: filename, remaining });
}));

// ═══ IMAGENS ESTÁTICAS ═══════════════════════════════════════════════════════

router.get("/estaticas", (req, res) => {
  res.json({ ok: true, data: buildSlotsResponse(), slots: STATIC_SLOTS, labels: SLOT_LABELS });
});

router.post("/estaticas/:slot",
  requireAuth,
  (req, res, next) => {
    if (!STATIC_SLOTS.includes(req.params.slot))
      return res.status(400).json({ ok: false, error: `Slot inválido. Use: ${STATIC_SLOTS.join(", ")}` });
    next();
  },
  uploadImg.single("file"),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado." });
    const slot = req.params.slot;
    const filename = `${slot}${EXT_ESTATICAS[req.file.mimetype]}`;

    const { error } = await supabase.storage
      .from(BUCKET_ESTATICAS)
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (error) return res.status(502).json({ ok: false, error: error.message });

    // Se o slot já tinha um arquivo com outra extensão (ex.: centro.png → centro.jpg), remove o antigo.
    const anterior = store.get().imagens[slot];
    if (anterior && anterior !== filename) {
      await supabase.storage.from(BUCKET_ESTATICAS).remove([anterior]).catch(() => {});
    }

    store.patch("imagens", { [slot]: filename });
    const slots = buildSlotsResponse();
    emit("imagens", slots);  // push todos os slots atualizados
    res.json({ ok: true, slot, filename, url: publicUrl(BUCKET_ESTATICAS, filename) });
  })
);

router.delete("/estaticas/:slot", requireAuth, wrap(async (req, res) => {
  const slot = req.params.slot;
  if (!STATIC_SLOTS.includes(slot)) return res.status(400).json({ ok: false, error: "Slot inválido." });
  const current = store.get().imagens[slot];
  if (current) {
    const { error } = await supabase.storage.from(BUCKET_ESTATICAS).remove([current]);
    if (error) return res.status(502).json({ ok: false, error: error.message });
    store.patch("imagens", { [slot]: null });
  }
  const slots = buildSlotsResponse();
  emit("imagens", slots);
  res.json({ ok: true, slot, reset: true });
}));

router.use((err, req, res, _next) => {
  const erroDeUpload = err instanceof multer.MulterError || /^Apenas imagens/.test(err.message);
  if (!erroDeUpload) console.error("[imagens]", err);
  res.status(erroDeUpload ? 400 : 500).json({ ok: false, error: erroDeUpload ? err.message : "Erro interno." });
});

module.exports = router;
