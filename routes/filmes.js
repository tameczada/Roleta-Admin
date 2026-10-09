// routes/filmes.js
const express = require("express");
const router = express.Router();
const store = require("../store");
const { requireAuth } = require("../middleware/auth");

/**
 * GET /api/filmes/config
 * Retorna configurações do modal de filmes.
 * Público.
 */
router.get("/config", (req, res) => {
  res.json({ ok: true, data: store.get().filmes });
});

/**
 * PATCH /api/filmes/config
 * Atualiza configurações do sistema de filmes/tickets.
 * Protegido.
 *
 * Body (todos opcionais):
 *   apiUrl              string  (URL da API de filmes)
 *   categoriaPadrao     string
 *   votosAtivo          boolean
 *   votosBase           number  (ex: 50 votos = 1 ticket)
 *   ticketsPorVotos     number
 *   ticketsMin          number
 *   ticketsMax          number
 */
router.patch("/config", requireAuth, (req, res) => {
  const allowed = [
    "apiUrl",
    "categoriaPadrao",
    "votosAtivo",
    "votosBase",
    "ticketsPorVotos",
    "ticketsMin",
    "ticketsMax",
  ];
  const patch = {};
  for (const key of allowed) {
    if (key in req.body) patch[key] = req.body[key];
  }

  // Validações numéricas
  for (const num of ["votosBase", "ticketsPorVotos", "ticketsMin", "ticketsMax"]) {
    if (num in patch) {
      const v = parseInt(patch[num]);
      if (isNaN(v) || v < 1) {
        return res.status(400).json({ ok: false, error: `${num} deve ser >= 1.` });
      }
      patch[num] = v;
    }
  }

  const updated = store.patch("filmes", patch);
  res.json({ ok: true, data: updated });
});

/**
 * GET /api/filmes/proxy
 * Faz proxy da lista de filmes da apiUrl configurada.
 * Evita CORS no frontend. Público.
 */
router.get("/proxy", async (req, res) => {
  const { apiUrl } = store.get().filmes;
  if (!apiUrl) {
    return res.status(400).json({ ok: false, error: "apiUrl não configurada." });
  }
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`API retornou ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ ok: false, error: `Erro ao buscar filmes: ${e.message}` });
  }
});

module.exports = router;
