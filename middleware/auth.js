// middleware/auth.js
// Autenticação simples via Bearer token ou query param ?secret=...

const ADMIN_SECRET = process.env.ADMIN_SECRET || "dev_secret_inseguro";

function requireAuth(req, res, next) {
  // Aceita via header Authorization: Bearer <token>
  const authHeader = req.headers["authorization"] || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  // Aceita via cookie session ou query param (útil para testar no browser)
  const querySecret = req.query.secret || req.body?.secret;

  const token = bearerToken || querySecret;

  if (!token || token !== ADMIN_SECRET) {
    return res.status(401).json({ ok: false, error: "Não autorizado." });
  }

  next();
}

module.exports = { requireAuth };
