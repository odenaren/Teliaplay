#!/usr/bin/env node
/**
 * Kör hela hämtkedjan mot riktiga källor UTAN databas, och skriver ut vad som
 * skulle ha sparats.
 *
 * Skriptet importerar appens riktiga moduler via alias-loadern, inte kopior av
 * dem. Det är hela poängen: ett testskript som duplicerar parsningen testar
 * sina egna regler och driver isär vid första ändring.
 *
 *   npm run dry-run
 */

import { loadEnv } from "./env.mjs";

loadEnv();

const { hamtaKanaler, hamtaTabla, matchaKanaler } = await import("@/lib/sources/tvnu");
const { KANALER, kanalNycklar } = await import("@/content/kanaler");
const { hittaSandning, titelNyckel } = await import("@/lib/match");
const { tvDayKey } = await import("@/lib/time");

console.log("\n\x1b[1mtv.nu — kanalmatchning\x1b[0m");

let tvnuKanaler = [];
try {
  tvnuKanaler = await hamtaKanaler();
  console.log(`  ${tvnuKanaler.length} kanaler hos tv.nu`);
} catch (err) {
  console.log(`  ✗ ${err.message}`);
  process.exit(1);
}

const vara = KANALER.map((k) => ({ id: k.id, nycklar: kanalNycklar(k) }));
const { traffar, omatchade } = matchaKanaler(vara, tvnuKanaler);

console.log(`  ✓ ${traffar.size} av ${KANALER.length} kanaler matchade på namn`);
if (omatchade.length > 0) {
  console.log(`  ! omatchade: ${omatchade.join(", ")}`);
  console.log("    Koppla dem för hand på /ingar, eller lägg till alias i content/kanaler.ts.");
}

const forsta = [...traffar.entries()].slice(0, 3);
console.log("\n\x1b[1mtv.nu — tablå för tre kanaler\x1b[0m");

const program = [];
for (const [vartId, tvnuKanal] of forsta) {
  try {
    const rader = await hamtaTabla(tvnuKanal.id, tvDayKey());
    console.log(`  ${vartId}: ${rader.length} sändningar`);
    if (rader[0]) {
      console.log(`    första: ${rader[0].start.toISOString()} ${rader[0].titel}`);
    }
    program.push(
      ...rader.map((r) => ({
        id: `${vartId}:${r.start.getTime()}`,
        kanalId: vartId,
        titel_key: titelNyckel(r.titel),
        start: r.start,
      })),
    );
  } catch (err) {
    console.log(`  ${vartId}: ✗ ${err.message}`);
  }
}

console.log("\n\x1b[1mmatchning — sportmatch mot tablå\x1b[0m");
const prov = { hemma: "Djurgården", borta: "Hammarby", start: new Date() };
const traff = hittaSandning(prov, program);
console.log(
  traff
    ? `  ✓ ${prov.hemma}–${prov.borta} skulle paras ihop med ${traff.id}`
    : "  (ingen träff i provet — väntat om inga av kanalerna sänder just den matchen nu)",
);

console.log("\nInget skrevs till databasen.\n");
