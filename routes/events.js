// routes/events.js
const express = require("express");
const router  = express.Router();
const { requireAuth } = require("../middleware/auth");

const clients = new Set();

router.get("/", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
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
