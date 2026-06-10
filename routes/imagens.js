// routes/imagens.js
const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { v4: uuidv4 } = require("uuid");
const store   = require("../store");
const { requireAuth } = require("../middleware/auth");
const { emit } = require("./events");

const UPLOAD_DIR  = path.join(__dirname, "..", "uploads");
const BONECOS_DIR = path.join(UPLOAD_DIR, "bonecos");
const IMG_DIR     = path.join(UPLOAD_DIR, "img");
[UPLOAD_DIR, BONECOS_DIR, IMG_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Slots reais — sem os backups (back2, leoeisa2, centr4o)
const STATIC_SLOTS = ["centro", "leoeisa", "back", "gato1", "will"];
const SLOT_LABELS  = {
  centro:  "Centro da roleta",
  leoeisa: "Fundo desfocado (leoeisa.png)",
  back:    "Fundo painel oculto (back.png)",
  gato1:   "Fundo do chat (gato1.png)",
  will:    "Favicon (will.png)",
};

// ── Multer bonecos ────────────────────────────────────────────────────────────
const storageBonecos = multer.diskStorage({
  destination: BONECOS_DIR,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname) || ".png"}`),
});
const uploadBoneco = multer({
  storage: storageBonecos,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Apenas imagens."));
    cb(null, true);
  },
});

// ── Multer imagens estáticas ──────────────────────────────────────────────────
const storageImg = multer.diskStorage({
  destination: IMG_DIR,
  filename: (req, file, cb) => cb(null, `${req.params.slot}${path.extname(file.originalname) || ".png"}`),
});
const uploadImg = multer({
  storage: storageImg,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Apenas imagens."));
    cb(null, true);
  },
});

function publicUrl(req, rel) {
  const base = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}${rel}`;
}

function buildSlotsResponse(req) {
  const { imagens } = store.get();
  const result = {};
  for (const slot of STATIC_SLOTS) {
    result[slot] = imagens[slot]
      ? publicUrl(req, `/uploads/img/${path.basename(imagens[slot])}`)
      : null;
  }
  return result;
}

// ═══ BONECOS ═════════════════════════════════════════════════════════════════

router.get("/bonecos", (req, res) => {
  const files = fs.existsSync(BONECOS_DIR)
    ? fs.readdirSync(BONECOS_DIR).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
    : [];
  res.json({ ok: true, data: files.map(f => ({ filename: f, url: publicUrl(req, `/uploads/bonecos/${f}`) })) });
});

router.post("/bonecos", requireAuth, uploadBoneco.array("files", 20), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado." });
  const all = fs.readdirSync(BONECOS_DIR).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
  store.patch("imagens", { bonecos: all });
  const uploaded = req.files.map(f => ({ filename: f.filename, url: publicUrl(req, `/uploads/bonecos/${f.filename}`) }));
  const allUrls  = all.map(f => ({ filename: f, url: publicUrl(req, `/uploads/bonecos/${f}`) }));
  emit("bonecos", allUrls);
  res.json({ ok: true, uploaded });
});

router.delete("/bonecos/:filename", requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(BONECOS_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ ok: false, error: "Arquivo não encontrado." });
  fs.unlinkSync(filepath);
  const remaining = fs.readdirSync(BONECOS_DIR).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
  store.patch("imagens", { bonecos: remaining });
  const remainingUrls = remaining.map(f => ({ filename: f, url: publicUrl(req, `/uploads/bonecos/${f}`) }));
  emit("bonecos", remainingUrls);
  res.json({ ok: true, deleted: filename, remaining });
});

// ═══ IMAGENS ESTÁTICAS ═══════════════════════════════════════════════════════

router.get("/estaticas", (req, res) => {
  res.json({ ok: true, data: buildSlotsResponse(req), slots: STATIC_SLOTS, labels: SLOT_LABELS });
});

router.post("/estaticas/:slot",
  requireAuth,
  (req, res, next) => {
    if (!STATIC_SLOTS.includes(req.params.slot))
      return res.status(400).json({ ok: false, error: `Slot inválido. Use: ${STATIC_SLOTS.join(", ")}` });
    next();
  },
  uploadImg.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado." });
    const slot = req.params.slot;
    store.patch("imagens", { [slot]: req.file.filename });
    const slots = buildSlotsResponse(req);
    emit("imagens", slots);  // push todos os slots atualizados
    res.json({ ok: true, slot, filename: req.file.filename, url: publicUrl(req, `/uploads/img/${req.file.filename}`) });
  }
);

router.delete("/estaticas/:slot", requireAuth, (req, res) => {
  const slot = req.params.slot;
  if (!STATIC_SLOTS.includes(slot)) return res.status(400).json({ ok: false, error: "Slot inválido." });
  const current = store.get().imagens[slot];
  if (current) {
    const filepath = path.join(IMG_DIR, path.basename(current));
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    store.patch("imagens", { [slot]: null });
  }
  const slots = buildSlotsResponse(req);
  emit("imagens", slots);
  res.json({ ok: true, slot, reset: true });
});

router.use((err, req, res, _next) => {
  res.status(400).json({ ok: false, error: err.message });
});

module.exports = router;
