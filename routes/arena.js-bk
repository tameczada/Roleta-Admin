// routes/arena.js
const express = require("express");
const router = express.Router();
const store = require("../store");
const { requireAuth } = require("../middleware/auth");
const { emit } = require("./events");

router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().arena });
});

router.patch("/", requireAuth, (req, res) => {
  const posicoes = ["frente","atras","desativado"];
  const patch = {};
  for (const key of ["userCooldown","globalCooldown","maxBonecos","posicaoBoneco"]) {
    if (key in req.body) patch[key] = req.body[key];
  }
  if ("posicaoBoneco" in patch && !posicoes.includes(patch.posicaoBoneco))
    return res.status(400).json({ ok: false, error: `posicaoBoneco deve ser: ${posicoes.join(", ")}` });
  for (const num of ["userCooldown","globalCooldown","maxBonecos"]) {
    if (num in patch) {
      const v = parseInt(patch[num]);
      if (isNaN(v) || v < 0) return res.status(400).json({ ok: false, error: `${num} deve ser >= 0.` });
      patch[num] = v;
    }
  }
  const updated = store.patch("arena", patch);
  emit("arena", updated);
  res.json({ ok: true, data: updated });
});

module.exports = router;
