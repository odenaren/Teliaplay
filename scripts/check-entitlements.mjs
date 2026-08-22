#!/usr/bin/env node
/**
 * Ingår-testet. Appens viktigaste kontroll.
 *
 * Går igenom varje post som skulle ha renderats på startsidan, tablån,
 * sportsidan och filmsidan, och verifierar att var och en pekar på en tjänst
 * eller kanal som ingår. Faller en enda post är utfallet rött.
 *
 * Varför det behöver vara ett skript och inte bara noggrann kod: regeln "visa
 * aldrig något som inte ingår" är hela produktens existensberättigande, och
 * den upprätthålls på ett trettiotal ställen — SQL-villkor, komponentfilter,
 * en katalog som hämtas provider för provider. Att kontrollera den med ögat
 * fungerar tills någon lägger till ett block en tisdagskväll.
 *
 * Undantaget är medvetet och kontrolleras separat: sportsidans lista över
 * matcher UTAN sändning. Där är hela poängen att visa ett nej.
 *
 *   npm run check:ingar
 */

import { loadEnv } from "./env.mjs";

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL saknas — testet behöver den riktiga databasen.");
  process.exit(1);
}

const { ingarKarta, pagarNu, ikvall, tabla, sportITablan, nyttIPaketet, sistaChansen, kommandeMatcher } =
  await import("@/lib/queries");
const { ingar } = await import("@/lib/entitlement");
const { tvDayKey } = await import("@/lib/time");
const { sql } = await import("@/lib/db");

const karta = await ingarKarta();
console.log(
  `Ingår: ${karta.tjanster.size} tjänster, ${karta.kanaler.size} kanaler.\n`,
);

let brott = 0;

function kolla(vy, poster, ref) {
  const dåliga = poster.filter((p) => !ingar(karta, ref(p)));
  if (dåliga.length === 0) {
    console.log(`  ✓ ${vy}: ${poster.length} poster, alla ingår`);
    return;
  }
  brott += dåliga.length;
  console.log(`  ✗ ${vy}: ${dåliga.length} av ${poster.length} poster ingår INTE`);
  for (const p of dåliga.slice(0, 5)) {
    console.log(`      ${p.titel ?? p.namn ?? p.id}`);
  }
}

const profiler = await sql`select id from profil limit 1`;
const profilId = profiler[0]?.id ?? null;

console.log("Vyer:");

kolla("direkt nu", await pagarNu({ profilId }), (p) => ({ kanalId: p.kanal_id }));
kolla("ikväll", await ikvall({ profilId }), (p) => ({ kanalId: p.kanal_id }));
kolla("sport i tablån", await sportITablan(), (p) => ({ kanalId: p.kanal_id }));

const kanaler = await tabla(tvDayKey(), { profilId });
kolla(
  "tablån (kanaler)",
  kanaler,
  (k) => ({ kanalId: k.id, tjanstId: k.tjanstId }),
);
kolla(
  "tablån (program)",
  kanaler.flatMap((k) => k.program),
  (p) => ({ kanalId: p.kanal_id }),
);

for (const [namn, poster] of [
  ["nytt i paketet", await nyttIPaketet(50)],
  ["sista chansen", await sistaChansen(50)],
]) {
  const dåliga = poster.filter(
    (t) => !(t.tjanster ?? []).filter(Boolean).some((id) => karta.tjanster.has(id)),
  );
  if (dåliga.length === 0) {
    console.log(`  ✓ ${namn}: ${poster.length} titlar, alla på tjänster du har`);
  } else {
    brott += dåliga.length;
    console.log(`  ✗ ${namn}: ${dåliga.length} titlar på tjänster du INTE har`);
  }
}

// Sportsidans undantag. Matcher utan sändning FÅR visas — men en match som
// säger sig sändas måste peka på något som ingår.
if (profilId) {
  const matcher = await kommandeMatcher(profilId);
  const sanda = matcher.filter((m) => m.var);
  kolla("matcher med sändning", sanda, (m) => ({
    kanalId: m.var.kanalId,
    tjanstId: m.var.tjanstId,
  }));
  console.log(
    `  · matcher utan sändning: ${matcher.length - sanda.length} (tillåtet undantag, se lib/queries.ts)`,
  );
}

console.log("");
if (brott === 0) {
  console.log("\x1b[32m✓ Inget som inte ingår skulle ha visats.\x1b[0m\n");
} else {
  console.log(`\x1b[31m✗ ${brott} poster bryter mot ingår-regeln.\x1b[0m\n`);
  process.exitCode = 1;
}

await sql.end({ timeout: 5 });
