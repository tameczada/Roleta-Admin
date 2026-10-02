// middleware/needSupabase.js
// Rotas que dependem do Supabase Storage respondem 503 (em vez de estourar
// TypeError) quando SUPABASE_URL / SUPABASE_SERVICE_KEY não estão configurados.
const supabase = require("../supabase/client");

module.exports = (req, res, next) => {
  if (!supabase) {
    return res.status(503).json({
      ok: false,
      error: "Supabase não configurado no servidor (SUPABASE_URL / SUPABASE_SERVICE_KEY).",
    });
  }
  next();
};
