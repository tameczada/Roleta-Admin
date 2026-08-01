// routes/sons.js
const express = require("express");
const router = express.Router();
const store = require("../store");
const { requireAuth } = require("../middleware/auth");
const { emit } = require("./events");

const MUSICAS = [
  "Silvio Santos (padrão)","Sou humano (gospel)","Como zaquel (gospel)",
  "Noites traiçoeiras (gospel)","Ragatanga","We Are the Champions",
  "Rock Balboa","Rock Balboa 2","PSY – Gangnam Style","Roleta Vira e Volta",
  "Missão Impossível","Quem é esse? (gospel)","Tango balango",
  "Jesus Cristo (gospel)","Butterfly","Uni Duni Tê (Balão Mágico)",
  "No Baile Nois é Mídia","Música padrão de sorteio",
];

router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().sons, musicas: MUSICAS.map((nome, idx) => ({ id: idx, nome })) });
});

router.patch("/", requireAuth, (req, res) => {
  const allowed = ["musicaSelecionada","volumeMusica","volumeTick","tocarMusicaAoGirar"];
  const patch = {};
  for (const key of allowed) { if (key in req.body) patch[key] = req.body[key]; }

  if ("musicaSelecionada" in patch) {
    const idx = parseInt(patch.musicaSelecionada);
    // Índice cobre a lista fixa (0..17) + as faixas da playlist enviada no painel,
    // cujo tamanho é dinâmico — por isso não há mais um limite superior fixo aqui.
    if (isNaN(idx) || idx < 0)
      return res.status(400).json({ ok: false, error: "musicaSelecionada inválida." });
    patch.musicaSelecionada = idx;
  }
  for (const vol of ["volumeMusica","volumeTick"]) {
    if (vol in patch) {
      const v = parseFloat(patch[vol]);
      if (isNaN(v) || v < 0 || v > 1)
        return res.status(400).json({ ok: false, error: `${vol} deve estar entre 0.0 e 1.0.` });
      patch[vol] = v;
    }
  }
  const updated = store.patch("sons", patch);
  emit("sons", updated);
  res.json({ ok: true, data: updated });
});

module.exports = router;
