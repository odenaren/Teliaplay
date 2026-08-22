#!/usr/bin/env node
/**
 * Pingar varje källa och skriver ut vad den faktiskt svarar.
 *
 * Det här är skriptet som hittar felen. Adaptrarna i src/lib/sources är skrivna
 * mot dokumenterade svarsformat, inte mot svar som körts i den maskin där de
 * skrevs — nätverket där appen byggdes släppte inte igenom tv.nu. Kör det här
 * hemifrån EN gång innan du litar på tablån, och läs utskriften: den visar de
 * första raderna av varje svar så att du ser om fälten heter det adaptern tror.
 *
 *   npm run probe            alla källor
 *   npm run probe -- tvnu    bara en
 *
 * Ingen databas behövs.
 */

import { loadEnv } from "./env.mjs";

loadEnv();

const bara = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const kor = (namn) => bara.length === 0 || bara.includes(namn);

function rubrik(text) {
  console.log(`\n\x1b[1m${text}\x1b[0m`);
}

function prov(varde) {
  const text = JSON.stringify(varde, null, 2) ?? String(varde);
  return text.length > 700 ? `${text.slice(0, 700)}\n  … (kortat)` : text;
}

/* ------------------------------------------------------------------ tv.nu */

if (kor("tvnu")) {
  rubrik("tv.nu — kanallistan");
  try {
    const res = await fetch("https://web-api.tv.nu/tableauLinearChannels?limit=5&offset=0");
    console.log(`  HTTP ${res.status}`);
    const data = await res.json();
    console.log(`  toppnycklar: ${Object.keys(data).join(", ")}`);
    console.log(prov(Array.isArray(data) ? data[0] : Object.values(data)[0]?.[0] ?? data));
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }

  rubrik("tv.nu — en dags tablå");
  try {
    const datum = new Date().toISOString().slice(0, 10);
    const res = await fetch(`https://web-api.tv.nu/channels/svt1/schedule?date=${datum}&fullDay=true`);
    console.log(`  HTTP ${res.status}`);
    const data = await res.json();
    console.log(`  toppnycklar: ${Object.keys(data).join(", ")}`);
    const lista = data.broadcasts ?? data.data?.broadcasts ?? data.channel?.broadcasts;
    console.log(prov(Array.isArray(lista) ? lista[0] : data));
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }
}

/* ------------------------------------------------------------- TheSportsDB */

if (kor("sportsdb")) {
  rubrik("TheSportsDB — lag i Allsvenskan (id 4331)");
  try {
    const nyckel = process.env.SPORTSDB_KEY ?? "3";
    const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${nyckel}/lookup_all_teams.php?id=4331`);
    console.log(`  HTTP ${res.status}`);
    const data = await res.json();
    console.log(`  ${data.teams?.length ?? 0} lag`);
    console.log(prov(data.teams?.[0]?.strTeam));
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }
}

/* -------------------------------------------------------------------- TMDB */

if (kor("tmdb") || kor("tmdb-providers")) {
  rubrik("TMDB — providers i Sverige");
  const nyckel = process.env.TMDB_API_KEY;
  if (!nyckel) {
    console.log("  ! TMDB_API_KEY saknas, hoppar över");
  } else {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/watch/providers/movie?api_key=${nyckel}&watch_region=SE`,
      );
      console.log(`  HTTP ${res.status}`);
      const data = await res.json();
      const intressanta = (data.results ?? [])
        .filter((p) =>
          /viaplay|max|disney|tv4|prime|sky|netflix|discovery|svt/i.test(p.provider_name),
        )
        .sort((a, b) => a.display_priority - b.display_priority);

      console.log("  Klistra in de här som tmdbProvider i src/content/tjanster.ts:");
      for (const p of intressanta) {
        console.log(`    ${String(p.provider_id).padStart(5)}  ${p.provider_name}`);
      }
    } catch (err) {
      console.log(`  ✗ ${err.message}`);
    }
  }
}

/* ------------------------------------------------------------------- Telia */

if (kor("telia")) {
  rubrik("Telia — inloggning och abonnemang");
  if (!process.env.TELIA_USERNAME) {
    console.log("  ! TELIA_USERNAME saknas, hoppar över (manuell ingår-lista gäller)");
  } else {
    try {
      const { hamtaKanaler } = await import("@/lib/sources/telia");
      const kanaler = await hamtaKanaler();
      const mina = kanaler.filter((k) => k.ingar);
      console.log(`  ✓ ${kanaler.length} kanaler i utbudet, ${mina.length} ingår i ditt paket`);
      console.log(`  ${mina.slice(0, 12).map((k) => k.namn).join(", ")}${mina.length > 12 ? " …" : ""}`);
    } catch (err) {
      console.log(`  ✗ ${err.message}`);
      console.log("    Telias API är inte publikt och ändras utan förvarning.");
      console.log("    Appen fungerar ändå — kryssa i listan för hand på /ingar.");
    }
  }
}

console.log("");
