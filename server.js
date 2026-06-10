// server.js
require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const path    = require("path");

const configRouter  = require("./routes/config");
const sonsRouter    = require("./routes/sons");
const arenaRouter   = require("./routes/arena");
const imagensRouter = require("./routes/imagens");
const filmesRouter  = require("./routes/filmes");
const estadoRouter  = require("./routes/estado");
const { router: eventsRouter } = require("./routes/events");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:3000",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origem não permitida: ${origin}`));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Arquivos estáticos ────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/admin",   express.static(path.join(__dirname, "public")));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Roleta Admin API",
    version: "2.0.0",
    painel: `${process.env.BACKEND_URL || "http://localhost:" + PORT}/admin`,
  });
});

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use("/api/config",  configRouter);
app.use("/api/sons",    sonsRouter);
app.use("/api/arena",   arenaRouter);
app.use("/api/imagens", imagensRouter);
app.use("/api/filmes",  filmesRouter);
app.use("/api/estado",  estadoRouter);
app.use("/api/events",  eventsRouter);   // SSE — sem auth, público

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ ok: false, error: "Rota não encontrada." }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("[erro]", err.message);
  res.status(500).json({ ok: false, error: err.message || "Erro interno." });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎡 Roleta Admin API v2 — http://localhost:${PORT}`);
  console.log(`   Painel: http://localhost:${PORT}/admin`);
  console.log(`   ADMIN_SECRET: ${process.env.ADMIN_SECRET ? "✅ definida" : "⚠️  NÃO definida"}`);
  console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL || "(não definida)"}\n`);
});
