// routes/musicas.js
// Gerenciador de músicas — URLs direto (.mp3/.ogg) ou YouTube
const express = require("express");
const router = express.Router();
const store = require("../store");
const { requireAuth } = require("../middleware/auth");
const { emit } = require("./events");

/**
 * Detecta se uma URL é do YouTube
 */
function isYouTubeUrl(url) {
  const ytPatterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  return ytPatterns.some(p => p.test(url));
}

/**
 * Extrai o video ID do YouTube
 */
function extractYouTubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

/**
 * GET /api/musicas
 * Retorna a lista de músicas
 */
router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().musicas });
});

/**
 * POST /api/musicas
 * Adiciona uma nova música
 * Body: { nome, url }
 * Backend detecta automaticamente se é YouTube ou URL direto
 */
router.post("/", requireAuth, (req, res) => {
  const { nome, url } = req.body;

  if (!nome || !url) {
    return res.status(400).json({ ok: false, error: "Nome e URL são obrigatórios." });
  }

  const nomeTrimmed = String(nome).trim();
  const urlTrimmed = String(url).trim();

  if (!nomeTrimmed || !urlTrimmed) {
    return res.status(400).json({ ok: false, error: "Nome e URL não podem estar vazios." });
  }

  // Detecta tipo (YouTube ou direto)
  let tipo = "direto";
  if (isYouTubeUrl(urlTrimmed)) {
    tipo = "youtube";
  }

  // Gera um ID único
  const id = Date.now().toString();

  // Cria o objeto
  const musica = {
    id,
    nome: nomeTrimmed,
    url: urlTrimmed,
    tipo,
  };

  // Adiciona ao array
  const state = store.get();
  state.musicas.push(musica);
  store.set(state);

  // Emite evento SSE
  emit("musicas", state.musicas);

  res.json({ ok: true, data: musica });
});

/**
 * DELETE /api/musicas/:id
 * Remove uma música pelo ID
 */
router.delete("/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const state = store.get();
  const index = state.musicas.findIndex(m => m.id === id);

  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Música não encontrada." });
  }

  state.musicas.splice(index, 1);
  store.set(state);

  // Emite evento SSE
  emit("musicas", state.musicas);

  res.json({ ok: true, message: "Música removida." });
});

/**
 * GET /api/musicas/preview/:id
 * Retorna o HTML pra reproduzir a música (helper para o admin preview)
 */
router.get("/preview/:id", (req, res) => {
  const { id } = req.params;
  const musicas = store.get().musicas;
  const musica = musicas.find(m => m.id === id);

  if (!musica) {
    return res.status(404).json({ ok: false, error: "Música não encontrada." });
  }

  let src = musica.url;

  // Se for YouTube, usa um embed ou proxy
  if (musica.tipo === "youtube") {
    const videoId = extractYouTubeId(musica.url);
    if (videoId) {
      // Usa noembed.com ou similar para puxar só o áudio
      src = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    }
  }

  // Retorna um player simples
  const html = `
    <div style="padding: 10px; background: #f5f5f5; border-radius: 8px;">
      <p style="margin: 0 0 8px 0;"><strong>${musica.nome}</strong></p>
      <audio controls style="width: 100%; max-width: 300px;">
        <source src="${src}" type="audio/mpeg">
        Seu navegador não suporta áudio.
      </audio>
    </div>
  `;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

module.exports = router;
