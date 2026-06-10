// routes/events.js
// Server-Sent Events — o painel admin faz push para a roleta em tempo real.
// Cada vez que um PATCH/POST salva algo, o backend emite um evento SSE.

const express = require("express");
const router = express.Router();

// Conjunto de clientes conectados
const clients = new Set();

/**
 * GET /api/events
 * A roleta conecta aqui e fica ouvindo eventos.
 * Público — não precisa de auth (dados são apenas configs, não segredos).
 */
router.get("/", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();

  // Heartbeat a cada 25s para manter a conexão viva
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);

  clients.add(res);
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

/**
 * Emite um evento SSE para todos os clientes conectados.
 * @param {string} event  Nome do evento (config, sons, arena, imagens, bonecos)
 * @param {object} data   Objeto a serializar como JSON
 */
function emit(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => {
    try { res.write(payload); } catch (_) { clients.delete(res); }
  });
}

module.exports = { router, emit };
