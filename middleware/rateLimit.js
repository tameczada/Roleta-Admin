// middleware/rateLimit.js
// Limitador de requisições simples, em memória e sem dependências.
// Usado nas rotas públicas que a roleta (frontend estático) precisa chamar sem token.
function rateLimit({ windowMs = 60_000, max = 30, message } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  setInterval(() => {
    const agora = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= agora) hits.delete(k);
  }, windowMs).unref();

  return function limitar(req, res, next) {
    const chave = req.ip || "desconhecido";
    const agora = Date.now();
    let e = hits.get(chave);
    if (!e || e.resetAt <= agora) {
      e = { count: 0, resetAt: agora + windowMs };
      hits.set(chave, e);
    }
    e.count++;
    if (e.count > max) {
      res.set("Retry-After", String(Math.ceil((e.resetAt - agora) / 1000)));
      return res.status(429).json({ ok: false, error: message || "Muitas requisições. Tente novamente em instantes." });
    }
    next();
  };
}

module.exports = { rateLimit };
