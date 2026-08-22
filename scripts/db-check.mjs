#!/usr/bin/env node
/**
 * Granskar DATABASE_URL och anslutningen, och rapporterar vad som är fel på
 * ren svenska i stället för att låta appen krascha med ett drivrutinsfel.
 *
 * Kör den också EFTER en schemaändring, mot den riktiga databasen. Ett
 * schematest mot en tom databas passerar när det inte borde: "create table if
 * not exists" rör inte en tabell som redan finns, så kolumner som tillkommit
 * sedan förra versionen saknas — och det syns bara på en databas som funnits
 * ett tag.
 */

import postgres from "postgres";
import { loadEnv } from "./env.mjs";

loadEnv();

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("✗ DATABASE_URL saknas. Kopiera .env.example till .env och fyll i.");
  process.exit(1);
}

if (/[@]/.test(url) === false) {
  console.error("✗ DATABASE_URL ser inte ut som en anslutningssträng.");
  process.exit(1);
}

const losen = url.match(/\/\/[^:]+:([^@]*)@/)?.[1] ?? "";
if (/[#@/?]/.test(decodeURIComponent(losen)) && losen === decodeURIComponent(losen)) {
  console.warn(
    "! Lösenordet innehåller specialtecken som måste URL-kodas: @ → %40, # → %23, / → %2F",
  );
}

const host = url.match(/@([^:/?#]+)/)?.[1] ?? "";
const ssl = /sslmode=disable/.test(url)
  ? false
  : /^(localhost|127\.0\.0\.1)$/.test(host) || host.endsWith(".railway.internal")
    ? false
    : "require";

const sql = postgres(url, { ssl, prepare: false, connect_timeout: 15, max: 1 });

const TABELLER = [
  "profil",
  "tjanst",
  "kanal",
  "program",
  "titel",
  "tillganglig",
  "lag",
  "sportmatch",
  "favorit",
  "sett",
  "block",
  "konto",
  "ingest_logg",
  "telia_session",
  "paket_snapshot",
];

try {
  const [{ version }] = await sql`select version()`;
  console.log(`✓ ansluten (${ssl ? "TLS" : "utan TLS"}) — ${version.split(",")[0]}`);

  const rader = await sql`
    select table_name from information_schema.tables where table_schema = 'public'
  `;
  const finns = new Set(rader.map((r) => r.table_name));

  const saknas = TABELLER.filter((t) => !finns.has(t));
  if (saknas.length === 0) {
    console.log(`✓ alla ${TABELLER.length} tabeller finns`);
  } else {
    console.log(`! ${saknas.length} tabeller saknas: ${saknas.join(", ")}`);
    console.log("  De skapas automatiskt vid första sidladdningen eller hämtningen.");
  }

  if (finns.has("tjanst")) {
    const [{ antal }] = await sql`select count(*)::int as antal from tjanst where ingar = true`;
    console.log(
      antal > 0
        ? `✓ ${antal} tjänster markerade som ingående`
        : "! inga tjänster markerade som ingående — appen visar ingenting förrän du ställt in /ingar",
    );
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  if (/self.signed|certificate/i.test(err.message)) {
    console.error("  Prova att lägga till ?sslmode=require i anslutningssträngen.");
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(err.message)) {
    console.error("  Värdnamnet gick inte att slå upp. Stavfel, eller fel region?");
  }
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
