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
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function main() {
  const sample = await fetch(`${url}/rest/v1/generations?select=id,type,mode,audio_enabled&limit=5&order=created_at.desc`, {
    headers,
  });
  const rows = await sample.json();
  console.log("Amostra (últimos 5 pedidos):", JSON.stringify(rows, null, 2));

  const needMode = await fetch(
    `${url}/rest/v1/generations?select=id,type,mode&type=not.is.null&mode=is.null&limit=100`,
    { headers },
  );
  const toFix = await needMode.json();
  if (Array.isArray(toFix) && toFix.length > 0) {
    console.log(`Sincronizando mode ← type em ${toFix.length} linha(s)...`);
    for (const row of toFix) {
      const patch = await fetch(`${url}/rest/v1/generations?id=eq.${row.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ mode: row.type }),
      });
      if (!patch.ok) console.error("Falha", row.id, await patch.text());
    }
    console.log("Sync concluído.");
  } else {
    console.log("Nenhuma linha precisa de sync mode ← type.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
