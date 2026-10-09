// scripts/migrar-supabase.js
//
// Roda UMA VEZ, localmente, para levar o data.json e os uploads que já
// existem no disco para o Supabase, antes de trocar o deploy do Render
// para a versão que lê/escreve no Supabase.
//
// Uso:
//   1. Preencha o .env com SUPABASE_URL e SUPABASE_SERVICE_KEY
//   2. npm install
//   3. node scripts/migrar-supabase.js
//
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const supabase = require("../supabase/client");

const ROOT        = path.join(__dirname, "..");
const DATA_FILE   = path.join(ROOT, "data.json");
const BONECOS_DIR = path.join(ROOT, "uploads", "bonecos");
const IMG_DIR      = path.join(ROOT, "uploads", "img");

const BUCKET_BONECOS   = "bonecos";
const BUCKET_ESTATICAS = "imagens-estaticas";

async function ensureBucket(bucket) {
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (error || !data) {
    const { error: createErr } = await supabase.storage.createBucket(bucket, { public: true });
    if (createErr && !/already exists/i.test(createErr.message)) throw createErr;
  }
}

async function migrarDados() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log("[dados] data.json não encontrado, pulando.");
    return;
  }
  const estado = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const { error } = await supabase
    .from("roleta_estado")
    .upsert({ id: "main", data: estado, updated_at: new Date().toISOString() });
  if (error) throw error;
  console.log("[dados] data.json migrado para a tabela roleta_estado.");
}

async function migrarPasta(dir, bucket) {
  if (!fs.existsSync(dir)) {
    console.log(`[storage] ${dir} não existe, pulando.`);
    return;
  }
  await ensureBucket(bucket);
  const arquivos = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
  for (const arquivo of arquivos) {
    const buffer = fs.readFileSync(path.join(dir, arquivo));
    const ext = path.extname(arquivo).slice(1).toLowerCase();
    const contentType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(arquivo, buffer, { contentType, upsert: true });
    if (error) {
      console.error(`  ✗ ${arquivo}: ${error.message}`);
    } else {
      console.log(`  ✓ ${arquivo} → bucket "${bucket}"`);
    }
  }
}

(async () => {
  console.log("== Migrando data.json ==");
  await migrarDados();

  console.log("\n== Migrando uploads/bonecos ==");
  await migrarPasta(BONECOS_DIR, BUCKET_BONECOS);

  console.log("\n== Migrando uploads/img ==");
  await migrarPasta(IMG_DIR, BUCKET_ESTATICAS);

  console.log("\nMigração concluída. Confira no Dashboard do Supabase (Table Editor e Storage).");
  process.exit(0);
})().catch(e => {
  console.error("Erro na migração:", e.message);
  process.exit(1);
});
