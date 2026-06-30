/**
 * Verifica colunas e aplica migration type/mode/audio_enabled quando DATABASE_URL estiver definida.
 * Uso: node scripts/apply-generations-migration.mjs
 * Requer no .env.local: DATABASE_URL=postgresql://postgres.[ref]:[SENHA]@...
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = env.DATABASE_URL || env.SUPABASE_DB_URL;

const migrationSql = readFileSync(
  resolve(root, "supabase/migrations/20260518120000_generations_type_mode_audio.sql"),
  "utf8",
);

async function checkViaRest() {
  if (!url || !serviceKey) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }
  const res = await fetch(`${url}/rest/v1/generations?select=type,mode,audio_enabled&limit=1`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (res.ok) {
    console.log("OK: colunas type, mode e audio_enabled já existem no PostgREST.");
    return true;
  }
  const body = await res.text();
  console.log("PostgREST:", res.status, body.slice(0, 300));
  return false;
}

async function applyViaPg() {
  if (!databaseUrl) {
    console.log("\nDATABASE_URL não está no .env.local — não dá para aplicar SQL automaticamente.");
    console.log("Adicione em .env.local (Supabase → Settings → Database → Connection string → URI):");
    console.log('DATABASE_URL=postgresql://postgres.[ref]:[SENHA]@aws-0-....pooler.supabase.com:6543/postgres');
    return false;
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(migrationSql);
    console.log("Migration aplicada com sucesso via PostgreSQL.");
    return true;
  } finally {
    await client.end();
  }
}

const ok = await checkViaRest();
if (!ok) {
  const applied = await applyViaPg();
  if (applied) {
    await checkViaRest();
  } else {
    console.log("\n--- SQL para colar no Supabase (SQL Editor) ---\n");
    console.log(migrationSql);
    process.exit(1);
  }
}
