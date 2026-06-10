// routes/config.js
const express = require("express");
const router = express.Router();
const store = require("../store");
const { requireAuth } = require("../middleware/auth");
const { emit } = require("./events");

router.get("/", (req, res) => {
  res.json({ ok: true, data: store.get().config });
});

router.patch("/", requireAuth, (req, res) => {
  const allowed = ["titulo","channelName","tempoPadrao","modoCor","temaAtivo",
                   "autoRemoverVencedor","autoOcultarPainel","temaAutoRotar"];
  const patch = {};
  for (const key of allowed) { if (key in req.body) patch[key] = req.body[key]; }
  if (!Object.keys(patch).length)
    return res.status(400).json({ ok: false, error: "Nenhum campo válido enviado." });
  const updated = store.patch("config", patch);
  emit("config", updated);  // push em tempo real para a roleta
  res.json({ ok: true, data: updated });
});

router.put("/", requireAuth, (req, res) => {
  const state = store.get();
  state.config = { ...state.config, ...req.body };
  store.set(state);
  emit("config", state.config);
  res.json({ ok: true, data: state.config });
});

module.exports = router;
