// routes/events.js
const express = require("express");
const router  = express.Router();
const { requireAuth } = require("../middleware/auth");

const MAX_CLIENTES = 300;
const clients = new Set();

router.get("/", (req, res) => {
  if (clients.size >= MAX_CLIENTES) {
    return res.status(503).json({ ok: false, error: "Muitas conexões em tempo real abertas." });
  }
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // evita buffer em proxies (nginx)
  res.flushHeaders();
  res.write("retry: 5000\n\n");

  const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch (_) {} }, 25000);
  clients.add(res);
  req.on("close", () => { clearInterval(heartbeat); clients.delete(res); });
});

// POST /api/events/reload — recarrega a roleta remotamente
router.post("/reload", requireAuth, (req, res) => {
  emit("reload", {});
  res.json({ ok: true, message: "Comando de reload enviado." });
});

function emit(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => {
    try { res.write(payload); } catch (_) { clients.delete(res); }
  });
}

module.exports = { router, emit };
