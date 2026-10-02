// routes/historico.js — histórico de vencedores
const express = require("express");
const router  = express.Router();
const store   = require("../store");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const { limparTexto } = require("../utils/sanitize");
const { emit } = require("./events");

// GET — lista histórico (público)
router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().historico || [] });
});

// POST — registra um vencedor (chamado pelo frontend da roleta, que é público e
// por isso não usa token). Mitigações: limite por IP + texto sanitizado/limitado.
router.post("/", rateLimit({ windowMs: 60_000, max: 10 }), (req, res) => {
  const nome = limparTexto(req.body?.nome, 50);
  const item = limparTexto(req.body?.item, 100);
  if (!nome) return res.status(400).json({ ok: false, error: "nome obrigatório." });
  const entrada = { nome, item, timestamp: new Date().toISOString() };
  const historico = store.pushHistorico(entrada);
  emit("historico", historico);
  res.json({ ok: true, data: entrada });
});

// DELETE — limpa histórico
router.delete("/", requireAuth, (req, res) => {
  const state = store.get();
  state.historico = [];
  store.set(state);
  emit("historico", []);
  res.json({ ok: true });
});

module.exports = router;
