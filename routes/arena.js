// routes/arena.js
const express = require("express");
const router  = express.Router();
const store   = require("../store");
const { requireAuth } = require("../middleware/auth");
const { limparTexto } = require("../utils/sanitize");
const { emit } = require("./events");

const POSICOES  = ["frente", "atras", "desativado"];
const MODOS_COR = ["aleatorio", "fixo", "desativado"];
const ANIMACOES = ["normal", "queda", "fade", "bounce"];
const HEX = /^#[0-9a-fA-F]{3,8}$/;

// Faixas numéricas aceitas — valores fora da faixa são ajustados (clamp);
// valores não numéricos são rejeitados (antes virava NaN → null no banco).
const INTEIROS = {
  userCooldown:   [0, 3_600_000],
  globalCooldown: [0, 3_600_000],
  maxBonecos:     [1, 500],
  nomeTamanho:    [6, 72],
  tempoVida:      [0, 86_400],
  testeIntervalo: [1, 3_600],
};
const DECIMAIS = {
  escala:     [0.1, 5],
  velocidade: [0.1, 5],
};

router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().arena });
});

router.patch("/", requireAuth, (req, res) => {
  const b = req.body || {};
  const patch = {};
  const erro = (msg) => res.status(400).json({ ok: false, error: msg });

  if ("posicaoBoneco" in b) {
    if (!POSICOES.includes(b.posicaoBoneco)) return erro(`posicaoBoneco: ${POSICOES.join(", ")}`);
    patch.posicaoBoneco = b.posicaoBoneco;
  }
  if ("nomeCores" in b) {
    if (!MODOS_COR.includes(b.nomeCores)) return erro(`nomeCores: ${MODOS_COR.join(", ")}`);
    patch.nomeCores = b.nomeCores;
  }
  if ("animEntrada" in b) {
    if (!ANIMACOES.includes(b.animEntrada)) return erro(`animEntrada: ${ANIMACOES.join(", ")}`);
    patch.animEntrada = b.animEntrada;
  }
  if ("nomePaleta" in b) {
    if (!Array.isArray(b.nomePaleta)) return erro("nomePaleta deve ser array.");
    if (b.nomePaleta.some(c => typeof c !== "string" || !HEX.test(c))) return erro("nomePaleta: use cores hexadecimais (#rrggbb).");
    patch.nomePaleta = b.nomePaleta.slice(0, 50);
  }
  if ("nomeCorFixa" in b) {
    if (typeof b.nomeCorFixa !== "string" || !HEX.test(b.nomeCorFixa)) return erro("nomeCorFixa: use uma cor hexadecimal (#rrggbb).");
    patch.nomeCorFixa = b.nomeCorFixa;
  }
  if ("nomeFonte" in b) patch.nomeFonte = limparTexto(b.nomeFonte, 60).replace(/[;{}"'<>]/g, "") || "Arial";
  if ("comando" in b) {
    const c = limparTexto(b.comando, 50);
    if (!c) return erro("comando não pode ser vazio.");
    patch.comando = c;
  }
  if ("modoTeste" in b) patch.modoTeste = b.modoTeste === true || b.modoTeste === "true";

  for (const [campo, [min, max]] of Object.entries(INTEIROS)) {
    if (!(campo in b)) continue;
    const n = parseInt(b[campo], 10);
    if (isNaN(n)) return erro(`${campo} deve ser um número.`);
    patch[campo] = Math.min(max, Math.max(min, n));
  }
  for (const [campo, [min, max]] of Object.entries(DECIMAIS)) {
    if (!(campo in b)) continue;
    const n = parseFloat(b[campo]);
    if (isNaN(n)) return erro(`${campo} deve ser um número.`);
    patch[campo] = Math.min(max, Math.max(min, n));
  }

  if (!Object.keys(patch).length) return erro("Nenhum campo válido enviado.");

  const updated = store.patch("arena", patch);
  emit("arena", updated);
  res.json({ ok: true, data: updated });
});

// ── Modo teste: limpar arena ──────────────────────────────────────────────────
router.post("/limpar", requireAuth, (req, res) => {
  emit("arena_limpar", {});
  res.json({ ok: true });
});

module.exports = router;
