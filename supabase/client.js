// supabase/client.js
// Cliente Supabase compartilhado (server-side, usa a service_role key).
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "[supabase] SUPABASE_URL e/ou SUPABASE_SERVICE_KEY não definidos. " +
    "Configure-os no .env (local) ou nas variáveis de ambiente do Render."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

module.exports = supabase;
