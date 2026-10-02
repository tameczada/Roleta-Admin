// routes/filmes.js
const express = require("express");
const router = express.Router();
const store = require("../store");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const wrap = require("../middleware/asyncHandler");
const { limparTexto } = require("../utils/sanitize");
const { emit } = require("./events");

// Cache curto do proxy (evita bater na API de filmes a cada abertura do modal).
const CACHE_MS = 60_000;
let _cache = { url: "", at: 0, body: null };

/**
 * GET /api/filmes/config
 * Retorna configurações do modal de filmes (a roleta usa apiUrl e os padrões de tickets).
 * Público.
 */
router.get("/config", (req, res) => {
  res.json({ ok: true, data: store.get().filmes });
});

/**
 * PATCH /api/filmes/config
 * Atualiza configurações do sistema de filmes/tickets.
 * Protegido. Notifica a roleta em tempo real (evento SSE "filmes").
 *
 * Body (todos opcionais):
 *   apiUrl              string  (URL http/https da API de filmes)
 *   categoriaPadrao     string
 *   votosAtivo          boolean
 *   votosBase           number  (ex: 50 votos = 1 ticket)
 *   ticketsPorVotos     number
 *   ticketsMin          number
 *   ticketsMax          number
 */
router.patch("/config", requireAuth, (req, res) => {
  const b = req.body || {};
  const patch = {};

  if ("apiUrl" in b) {
    const url = String(b.apiUrl ?? "").trim();
    if (url) {
      let u;
      try { u = new URL(url); } catch { return res.status(400).json({ ok: false, error: "apiUrl inválida." }); }
      if (!["http:", "https:"].includes(u.protocol))
        return res.status(400).json({ ok: false, error: "apiUrl deve começar com http:// ou https://" });
    }
    patch.apiUrl = url;
  }
  if ("categoriaPadrao" in b) patch.categoriaPadrao = limparTexto(b.categoriaPadrao, 60);
  if ("votosAtivo" in b)      patch.votosAtivo = b.votosAtivo === true || b.votosAtivo === "true";

  // Validações numéricas
  for (const num of ["votosBase", "ticketsPorVotos", "ticketsMin", "ticketsMax"]) {
    if (num in b) {
      const v = parseInt(b[num], 10);
      if (isNaN(v) || v < 1) {
        return res.status(400).json({ ok: false, error: `${num} deve ser >= 1.` });
      }
      patch[num] = v;
    }
  }

  const atual = store.get().filmes;
  const min = patch.ticketsMin ?? atual.ticketsMin;
  const max = patch.ticketsMax ?? atual.ticketsMax;
  if (min > max) return res.status(400).json({ ok: false, error: "ticketsMin não pode ser maior que ticketsMax." });

  const updated = store.patch("filmes", patch);
  _cache = { url: "", at: 0, body: null };
  emit("filmes", updated);
  res.json({ ok: true, data: updated });
});

/**
 * GET /api/filmes/proxy
 * Faz proxy da lista de filmes da apiUrl configurada.
 * Evita CORS no frontend. Público (limitado por IP), com timeout e cache curto.
 */
router.get("/proxy", rateLimit({ windowMs: 60_000, max: 30 }), wrap(async (req, res) => {
  const { apiUrl } = store.get().filmes;
  if (!apiUrl) {
    return res.status(400).json({ ok: false, error: "apiUrl não configurada." });
  }
  if (_cache.body && _cache.url === apiUrl && Date.now() - _cache.at < CACHE_MS) {
    return res.json(_cache.body);
  }
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`API retornou ${response.status}`);
    const data = await response.json();
    _cache = { url: apiUrl, at: Date.now(), body: data };
    res.json(data);
  } catch (e) {
    res.status(502).json({ ok: false, error: `Erro ao buscar filmes: ${e.message}` });
  }
}));

module.exports = router;
