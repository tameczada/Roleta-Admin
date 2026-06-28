require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
    "https://roleta-admin.onrender.com",
    "https://luyan-tamec.github.io/roleta-leoeisa",
    "https://roleta-admin.onrender.com/admin/",
  "https://luyan-tamec.github.io",
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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/admin",   express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.json({ ok: true, service: "Roleta Admin API", version: "3.0.0" }));

app.use("/api/config",    require("./routes/config"));
app.use("/api/sons",      require("./routes/sons"));
app.use("/api/arena",     require("./routes/arena"));
app.use("/api/visual",    require("./routes/visual"));
app.use("/api/imagens",   require("./routes/imagens"));
app.use("/api/filmes",    require("./routes/filmes"));
app.use("/api/estado",    require("./routes/estado"));
app.use("/api/historico",      require("./routes/historico"));
app.use("/api/participantes", require("./routes/participantes"));
app.use("/api/events",    require("./routes/events").router);

app.use((req, res) => res.status(404).json({ ok: false, error: "Rota não encontrada." }));
app.use((err, req, res, _next) => res.status(500).json({ ok: false, error: err.message }));

app.listen(PORT, () => {
  console.log(`\n🎡 Roleta Admin API v3 — http://localhost:${PORT}/admin`);
  console.log(`   ADMIN_SECRET: ${process.env.ADMIN_SECRET ? "✅" : "⚠️  NÃO definida"}\n`);
});
