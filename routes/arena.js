// routes/arena.js
const express = require("express");
const router  = express.Router();
const store   = require("../store");
const { requireAuth } = require("../middleware/auth");
const { emit } = require("./events");

router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().arena });
});

router.patch("/", requireAuth, (req, res) => {
  const posicoes  = ["frente","atras","desativado"];
  const modosCor  = ["aleatorio","fixo","desativado"];
  const animacoes = ["normal","queda","fade","bounce"];

  const allowed = [
    "userCooldown","globalCooldown","maxBonecos","posicaoBoneco",
    "nomeCores","nomeCorFixa","nomePaleta",
    "escala","velocidade","tempoVida",
    "nomeFonte","nomeTamanho",
    "animEntrada","comando",
    "modoTeste","testeIntervalo",
    "modoImagem","twitchClientId",
  ];

  const patch = {};
  for (const key of allowed) { if (key in req.body) patch[key] = req.body[key]; }

  // Validações
  if ("posicaoBoneco" in patch && !posicoes.includes(patch.posicaoBoneco))
    return res.status(400).json({ ok: false, error: `posicaoBoneco: ${posicoes.join(", ")}` });
  if ("nomeCores" in patch && !modosCor.includes(patch.nomeCores))
    return res.status(400).json({ ok: false, error: `nomeCores: ${modosCor.join(", ")}` });
  if ("animEntrada" in patch && !animacoes.includes(patch.animEntrada))
    return res.status(400).json({ ok: false, error: `animEntrada: ${animacoes.join(", ")}` });
  if ("modoImagem" in patch && !["boneco","perfil","aleatorio"].includes(patch.modoImagem))
    return res.status(400).json({ ok: false, error: "modoImagem: boneco | perfil | aleatorio" });
  if ("nomePaleta" in patch && !Array.isArray(patch.nomePaleta))
    return res.status(400).json({ ok: false, error: "nomePaleta deve ser array." });

  for (const num of ["userCooldown","globalCooldown","maxBonecos","nomeTamanho","tempoVida","testeIntervalo"]) {
    if (num in patch) { patch[num] = parseInt(patch[num]); }
  }
  for (const flt of ["escala","velocidade"]) {
    if (flt in patch) { patch[flt] = parseFloat(patch[flt]); }
  }

  const updated = store.patch("arena", patch);
  emit("arena", updated);
  res.json({ ok: true, data: updated });
});

// ── Modo teste: limpar arena ──────────────────────────────────────────────────
router.post("/limpar", requireAuth, (req, res) => {
  emit("arena_limpar", {});
  res.json({ ok: true });
});

module.exports = router;
