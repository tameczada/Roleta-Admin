// routes/participantes.js
// Gerencia a lista de participantes da roleta.
// Suporta importação via CSV (nomes linha por linha).

const express = require("express");
const router  = express.Router();
const store   = require("../store");
const { requireAuth } = require("../middleware/auth");
const { limparTexto } = require("../utils/sanitize");
const { emit } = require("./events");

const MAX_NOME = 50;
const MAX_TOTAL = 5000;

// GET /api/participantes — lista atual (público)
router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().participantes || [] });
});

// POST /api/participantes — adiciona nomes (array JSON)
// Body: { nomes: ["Nome1", "Nome2", ...] }
router.post("/", requireAuth, (req, res) => {
  const { nomes } = req.body || {};
  if (!Array.isArray(nomes) || !nomes.length)
    return res.status(400).json({ ok: false, error: "Envie { nomes: [...] }" });

  const state = store.get();
  const atuais = state.participantes || [];
  // Adiciona sem duplicatas (case-insensitive), com texto limpo e limitado
  const set = new Set(atuais.map(n => n.toLowerCase()));
  const novos = [];
  for (const bruto of nomes) {
    const n = limparTexto(bruto, MAX_NOME);
    if (!n || set.has(n.toLowerCase())) continue;
    if (atuais.length + novos.length >= MAX_TOTAL) break;
    set.add(n.toLowerCase());
    novos.push(n);
  }

  state.participantes = [...atuais, ...novos];
  store.set(state);
  emit("participantes", state.participantes);
  res.json({ ok: true, adicionados: novos.length, total: state.participantes.length, data: state.participantes });
});

// DELETE /api/participantes/nome/:nome — remove um nome
router.delete("/nome/:nome", requireAuth, (req, res) => {
  const nome = decodeURIComponent(req.params.nome).trim();
  const state = store.get();
  const antes = (state.participantes || []).length;
  state.participantes = (state.participantes || []).filter(n => n !== nome);
  store.set(state);
  emit("participantes", state.participantes);
  res.json({ ok: true, removidos: antes - state.participantes.length, total: state.participantes.length });
});

// DELETE /api/participantes — limpa toda a lista
router.delete("/", requireAuth, (req, res) => {
  const state = store.get();
  state.participantes = [];
  store.set(state);
  emit("participantes", []);
  res.json({ ok: true, message: "Lista limpa." });
});

module.exports = router;
