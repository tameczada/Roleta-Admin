// routes/estado.js
// Endpoints para exportar, importar e resetar todo o estado do painel.

const express = require("express");
const router = express.Router();
const store = require("../store");
const { requireAuth } = require("../middleware/auth");

/**
 * GET /api/estado
 * Retorna o estado completo (todas as seções).
 * Protegido.
 */
router.get("/", requireAuth, (req, res) => {
  res.json({ ok: true, data: store.get() });
});

/**
 * PUT /api/estado
 * Substitui o estado completo por um JSON importado.
 * Protegido. Use com cuidado.
 */
router.put("/", requireAuth, (req, res) => {
  const { config, sons, arena, imagens, filmes } = req.body;
  if (!config && !sons && !arena && !imagens && !filmes) {
    return res.status(400).json({ ok: false, error: "Body não contém seções reconhecidas." });
  }
  const current = store.get();
  const next = {
    config: config ?? current.config,
    sons: sons ?? current.sons,
    arena: arena ?? current.arena,
    imagens: imagens ?? current.imagens,
    filmes: filmes ?? current.filmes,
  };
  store.set(next);
  res.json({ ok: true, data: next });
});

/**
 * POST /api/estado/reset
 * Reseta tudo para os valores padrão.
 * Protegido.
 */
router.post("/reset", requireAuth, (req, res) => {
  const fresh = store.reset();
  res.json({ ok: true, message: "Estado resetado para os padrões.", data: fresh });
});

module.exports = router;
