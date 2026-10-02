// middleware/auth.js
// Autenticação por Bearer token (header Authorization: Bearer <ADMIN_SECRET>).
//
// - Comparação em tempo constante (crypto.timingSafeEqual sobre hashes SHA-256).
// - Sem "chave padrão": se ADMIN_SECRET não estiver definida, as rotas protegidas
//   respondem 503 em vez de aceitar um valor conhecido.
// - Não aceita mais ?secret= na URL nem no body (vazava em logs/histórico do navegador).
// - Limite de tentativas erradas por IP (10 a cada 10 min) para dificultar força bruta.
const crypto = require("crypto");

const JANELA_MS = 10 * 60 * 1000;
const MAX_FALHAS = 10;
const falhas = new Map(); // ip -> { count, resetAt }

setInterval(() => {
  const agora = Date.now();
  for (const [ip, e] of falhas) if (e.resetAt <= agora) falhas.delete(ip);
}, JANELA_MS).unref();

function iguais(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireAuth(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ ok: false, error: "ADMIN_SECRET não configurada no servidor." });
  }

  const ip = req.ip || "desconhecido";
  const agora = Date.now();
  const reg = falhas.get(ip);
  if (reg && reg.resetAt > agora && reg.count >= MAX_FALHAS) {
    res.set("Retry-After", String(Math.ceil((reg.resetAt - agora) / 1000)));
    return res.status(429).json({ ok: false, error: "Muitas tentativas inválidas. Aguarde alguns minutos." });
  }

  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token || !iguais(token, secret)) {
    const atual = reg && reg.resetAt > agora ? reg : { count: 0, resetAt: agora + JANELA_MS };
    atual.count++;
    falhas.set(ip, atual);
    return res.status(401).json({ ok: false, error: "Não autorizado." });
  }

  falhas.delete(ip);
  next();
}

module.exports = { requireAuth };
