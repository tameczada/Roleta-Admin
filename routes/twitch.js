// routes/twitch.js
// Proxy para a API da Twitch — gera App Access Token e busca foto de perfil.
// O frontend não precisa expor o Client Secret.

const express = require("express");
const router  = express.Router();

const CLIENT_ID     = process.env.TWITCH_CLIENT_ID     || "x4qevszaoxnscv462g6913dzo3m71t";
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "sjd73juekqqsn4b9dqf8pgepma3bft";

// Cache do token em memória (expira em ~60 dias, renovado automaticamente)
let _token     = null;
let _tokenExp  = 0;

async function getAppToken() {
  if (_token && Date.now() < _tokenExp) return _token;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const json = await res.json();
  if (!json.access_token) throw new Error("Falha ao obter token Twitch: " + JSON.stringify(json));
  _token    = json.access_token;
  _tokenExp = Date.now() + (json.expires_in - 300) * 1000; // renova 5min antes
  return _token;
}

/**
 * GET /api/twitch/perfil?login=username1,username2,...
 * Retorna array de { login, display_name, profile_image_url }
 * Aceita até 100 logins por request.
 * Público — não precisa de auth (não expõe segredos).
 */
router.get("/perfil", async (req, res) => {
  const logins = (req.query.login || "").split(",").map(l => l.trim()).filter(Boolean);
  if (!logins.length) return res.status(400).json({ ok: false, error: "Informe ?login=username" });
  if (logins.length > 100) return res.status(400).json({ ok: false, error: "Máximo 100 logins por request." });

  try {
    const token  = await getAppToken();
    const params = logins.map(l => `login=${encodeURIComponent(l)}`).join("&");
    const apiRes = await fetch(`https://api.twitch.tv/helix/users?${params}`, {
      headers: {
        "Client-ID":     CLIENT_ID,
        "Authorization": `Bearer ${token}`,
      }
    });
    const json = await apiRes.json();
    const data = (json.data || []).map(u => ({
      login:              u.login,
      display_name:       u.display_name,
      profile_image_url:  u.profile_image_url,
    }));
    res.json({ ok: true, data });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

module.exports = router;
