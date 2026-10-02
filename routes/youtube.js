// routes/youtube.js
// Proxy da busca do YouTube. A chave da API fica no servidor (env YOUTUBE_API_KEY)
// em vez de exposta no HTML público da roleta.
const express = require("express");
const router = express.Router();
const { rateLimit } = require("../middleware/rateLimit");
const wrap = require("../middleware/asyncHandler");
const { limparTexto } = require("../utils/sanitize");

const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 200;
const cache = new Map(); // q -> { at, items }

/**
 * GET /api/youtube/search?q=termo
 * Retorna { ok, items: [{ id, title }] } (até 10 vídeos). Público, limitado por IP.
 */
router.get("/search", rateLimit({ windowMs: 60_000, max: 20 }), wrap(async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return res.status(503).json({ ok: false, error: "YOUTUBE_API_KEY não configurada no servidor." });
  }
  const q = limparTexto(req.query.q, 100);
  if (!q) return res.status(400).json({ ok: false, error: "Informe q." });

  const chave = q.toLowerCase();
  const hit = cache.get(chave);
  if (hit && Date.now() - hit.at < CACHE_MS) return res.json({ ok: true, items: hit.items, cache: true });

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet", type: "video", maxResults: "10", q, key,
  }).toString();

  let json;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    json = await r.json();
    if (!r.ok) throw new Error(json?.error?.message || `YouTube retornou ${r.status}`);
  } catch (e) {
    return res.status(502).json({ ok: false, error: `Erro ao buscar no YouTube: ${e.message}` });
  }

  const items = (json.items || [])
    .filter(v => v?.id?.videoId && /^[\w-]{6,20}$/.test(v.id.videoId))
    .map(v => ({ id: v.id.videoId, title: String(v.snippet?.title || "") }));

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(chave, { at: Date.now(), items });
  res.json({ ok: true, items });
}));

module.exports = router;
