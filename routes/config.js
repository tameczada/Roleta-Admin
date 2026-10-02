// routes/config.js
const express = require("express");
const router = express.Router();
const store = require("../store");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const { limparTexto, canalTwitchValido } = require("../utils/sanitize");
const { emit } = require("./events");

const MODOS_COR = ["colorido", "neutro"];

// Valida/normaliza os campos aceitos. Campos desconhecidos são descartados
// (antes o PUT mesclava qualquer chave enviada dentro de `config`).
function montarPatch(body) {
  const patch = {};
  const b = body || {};

  if ("titulo" in b)              patch.titulo = limparTexto(b.titulo, 100);
  if ("temaAtivo" in b)           patch.temaAtivo = limparTexto(b.temaAtivo, 60);
  if ("vencedorForcado" in b)     patch.vencedorForcado = limparTexto(b.vencedorForcado, 50);

  if ("channelName" in b) {
    const canal = canalTwitchValido(b.channelName);
    if (!canal) return { error: "channelName inválido (3–25 caracteres: letras, números e _)." };
    patch.channelName = canal;
  }
  if ("tempoPadrao" in b) {
    const n = parseInt(b.tempoPadrao, 10);
    if (isNaN(n)) return { error: "tempoPadrao deve ser um número." };
    patch.tempoPadrao = Math.min(120, Math.max(1, n));
  }
  if ("modoCor" in b) {
    if (!MODOS_COR.includes(b.modoCor)) return { error: `modoCor: ${MODOS_COR.join(", ")}` };
    patch.modoCor = b.modoCor;
  }
  for (const flag of ["autoRemoverVencedor", "autoOcultarPainel", "temaAutoRotar"]) {
    if (flag in b) patch[flag] = b[flag] === true || b[flag] === "true";
  }
  return { patch };
}

router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().config });
});

function atualizar(req, res) {
  const { patch, error } = montarPatch(req.body);
  if (error) return res.status(400).json({ ok: false, error });
  if (!Object.keys(patch).length)
    return res.status(400).json({ ok: false, error: "Nenhum campo válido enviado." });
  const updated = store.patch("config", patch);
  emit("config", updated);  // push em tempo real para a roleta
  res.json({ ok: true, data: updated });
}

router.patch("/", requireAuth, atualizar);
router.put("/",   requireAuth, atualizar);

/**
 * POST /api/config/consumir-vencedor
 * Zera o campo "vencedorForcado" depois que a roleta já usou (giro concluído).
 * Sem auth de propósito (a roleta pública precisa chamar): só permite LIMPAR o campo,
 * nunca definir um novo vencedor. Protegido por limite de requisições por IP.
 */
router.post("/consumir-vencedor", rateLimit({ windowMs: 60_000, max: 20 }), (req, res) => {
  if (!store.get().config.vencedorForcado) {
    return res.json({ ok: true, data: store.get().config }); // nada a limpar — não gera escrita nem push
  }
  const updated = store.patch("config", { vencedorForcado: "" });
  emit("config", updated);
  res.json({ ok: true, data: updated });
});

module.exports = router;
