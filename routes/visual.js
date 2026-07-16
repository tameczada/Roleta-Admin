// routes/visual.js — controle do blur/brilho do fundo
const express = require("express");
const router  = express.Router();
const store   = require("../store");
const { requireAuth } = require("../middleware/auth");
const { emit } = require("./events");

router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().visual });
});

router.patch("/", requireAuth, (req, res) => {
  const patch = {};
  if ("fundoBlur" in req.body) {
    const v = parseFloat(req.body.fundoBlur);
    if (isNaN(v) || v < 0 || v > 20) return res.status(400).json({ ok: false, error: "fundoBlur: 0–20" });
    patch.fundoBlur = v;
  }
  if ("fundoBrilho" in req.body) {
    const v = parseFloat(req.body.fundoBrilho);
    if (isNaN(v) || v < 0 || v > 1) return res.status(400).json({ ok: false, error: "fundoBrilho: 0–1" });
    patch.fundoBrilho = v;
  }
  const updated = store.patch("visual", patch);
  emit("visual", updated);
  res.json({ ok: true, data: updated });
});

module.exports = router;
