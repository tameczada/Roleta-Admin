require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const { requireAuth } = require("./middleware/auth");

const VERSION = "3.1.0";
const app  = express();
const PORT = process.env.PORT || 3001;

// Atrás do proxy do Render: necessário para req.ip / req.protocol corretos
// (usados no limitador de requisições e na checagem de origem).
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ── CORS ─────────────────────────────────────────────────────────────────────
// O header Origin nunca traz caminho — só esquema + host (+ porta). As entradas antigas
// com "/roleta-leoeisa" ou "/admin/" jamais casavam. Aqui tudo é normalizado para origin.
function paraOrigin(valor) {
  try {
    const v = String(valor).trim();
    if (!v) return null;
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).origin;
  } catch { return null; }
}

const allowedOrigins = new Set([
  "https://roleta-admin.onrender.com",
  "https://luyan-tamec.github.io",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:3000",
  paraOrigin(process.env.FRONTEND_URL),
  paraOrigin(process.env.BACKEND_URL),
  // Origens extras separadas por vírgula (ex.: domínio próprio)
  ...String(process.env.EXTRA_ORIGINS || "").split(",").map(paraOrigin),
].filter(Boolean));

app.use(cors((req, cb) => {
  const origin = req.headers.origin;
  const mesmaOrigem = origin && origin === `${req.protocol}://${req.get("host")}`;
  cb(null, {
    origin: !origin || mesmaOrigem || allowedOrigins.has(origin), // false = sem headers CORS (o navegador bloqueia)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
}));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/admin",   express.static(path.join(__dirname, "public")));

const store = require("./store");

app.get("/", (req, res) => res.json({
  ok: true,
  service: "Roleta Admin API",
  version: VERSION,
  // "ok" = estado lido do Supabase e sendo gravado; "indisponivel" = modo degradado (só memória)
  persistencia: store.isPersistent() ? "ok" : "indisponivel",
}));

// Valida a chave do painel (o login antes testava /api/config, que é público).
app.get("/api/auth/check", requireAuth, (req, res) => res.json({ ok: true }));

app.use("/api/config",    require("./routes/config"));
app.use("/api/sons",      require("./routes/sons"));
app.use("/api/musicas",   require("./routes/musicas"));
app.use("/api/arena",     require("./routes/arena"));
app.use("/api/visual",    require("./routes/visual"));
app.use("/api/imagens",   require("./routes/imagens"));
app.use("/api/filmes",    require("./routes/filmes"));
app.use("/api/youtube",   require("./routes/youtube"));
app.use("/api/estado",    require("./routes/estado"));
app.use("/api/historico",      require("./routes/historico"));
app.use("/api/participantes", require("./routes/participantes"));
app.use("/api/events",    require("./routes/events").router);

app.use((req, res) => res.status(404).json({ ok: false, error: "Rota não encontrada." }));

app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("[erro]", req.method, req.originalUrl, err);
  res.status(status).json({ ok: false, error: status >= 500 ? "Erro interno do servidor." : err.message });
});

// Uma falha isolada não deve derrubar o servidor durante a live.
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
process.on("uncaughtException",  (e) => console.error("[uncaughtException]", e));

store.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🎡 Roleta Admin API v${VERSION} — http://localhost:${PORT}/admin`);
    console.log(`   ADMIN_SECRET:    ${process.env.ADMIN_SECRET ? "✅" : "⚠️  NÃO definida (rotas protegidas respondem 503)"}`);
    console.log(`   Supabase:        ${process.env.SUPABASE_URL ? "✅" : "⚠️  NÃO configurado"}`);
    console.log(`   Persistência:    ${store.isPersistent() ? "✅" : "⚠️  indisponível (modo degradado)"}`);
    console.log(`   YOUTUBE_API_KEY: ${process.env.YOUTUBE_API_KEY ? "✅" : "— (busca do YouTube desativada)"}\n`);
    if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length < 16)
      console.warn("⚠️  ADMIN_SECRET curta (<16 caracteres). Use: openssl rand -hex 32");
  });
});
