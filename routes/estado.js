// routes/estado.js
// Endpoints para exportar, importar e resetar todo o estado do painel.

const express = require("express");
const router = express.Router();
const store = require("../store");
const { requireAuth } = require("../middleware/auth");
const { emit } = require("./events");

// Seções que o import aceita. Objetos simples, exceto as listas.
const SECOES_OBJETO = ["config", "sons", "arena", "visual", "imagens", "filmes"];
const SECOES_LISTA  = ["participantes", "playlist", "historico"];

function emitirTudo(state) {
  emit("config", state.config);
  emit("sons",   state.sons);
  emit("arena",  state.arena);
  emit("visual", state.visual);
  emit("participantes", state.participantes || []);
  emit("historico",     state.historico || []);
}

/**
 * GET /api/estado
 * Retorna o estado completo (todas as seções). Protegido.
 */
router.get("/", requireAuth, (req, res) => {
  res.json({ ok: true, data: store.get() });
});

/**
 * PUT /api/estado
 * Importa um estado. Só substitui as seções enviadas; as demais são PRESERVADAS
 * (antes, visual/participantes/playlist/historico eram apagados a cada import).
 * Protegido. Use com cuidado.
 */
router.put("/", requireAuth, (req, res) => {
  const body = req.body || {};
  const recebidas = [...SECOES_OBJETO, ...SECOES_LISTA].filter(k => k in body);
  if (!recebidas.length) {
    return res.status(400).json({ ok: false, error: "Body não contém seções reconhecidas." });
  }

  for (const k of SECOES_OBJETO) {
    if (k in body && (body[k] === null || typeof body[k] !== "object" || Array.isArray(body[k])))
      return res.status(400).json({ ok: false, error: `Seção "${k}" deve ser um objeto.` });
  }
  for (const k of SECOES_LISTA) {
    if (k in body && !Array.isArray(body[k]))
      return res.status(400).json({ ok: false, error: `Seção "${k}" deve ser uma lista.` });
  }

  const next = { ...store.get() };
  for (const k of recebidas) next[k] = body[k];
  // historico mantém o teto de 50 itens
  if (Array.isArray(next.historico)) next.historico = next.historico.slice(0, 50);

  const state = store.set(next);
  emitirTudo(state);
  res.json({ ok: true, data: state });
});

/**
 * POST /api/estado/reset
 * Reseta tudo para os valores padrão. Protegido.
 */
router.post("/reset", requireAuth, (req, res) => {
  const fresh = store.reset();
  emitirTudo(fresh);
  res.json({ ok: true, message: "Estado resetado para os padrões.", data: fresh });
});

module.exports = router;
