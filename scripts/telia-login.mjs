#!/usr/bin/env node
/**
 * Provar Telia-inloggningen och skriver ut vad ditt abonnemang innehåller.
 *
 * Skriver ingenting till databasen utom sessionsraden. Kör den när /ingar
 * påstår att Telia-hämtningen är avstängd, eller när uppgifterna börjat bli
 * gamla — felmeddelandet här är mer detaljerat än det som syns i appen.
 *
 * Lösenordet skrivs aldrig ut, varken i klartext eller som del av en URL.
 */

import { loadEnv } from "./env.mjs";

loadEnv();

if (!process.env.TELIA_USERNAME || !process.env.TELIA_PASSWORD) {
  console.error("✗ TELIA_USERNAME och TELIA_PASSWORD måste stå i .env.");
  process.exit(1);
}

const { hamtaKanaler } = await import("@/lib/sources/telia");
const { sql } = await import("@/lib/db");

try {
  const kanaler = await hamtaKanaler();
  const mina = kanaler.filter((k) => k.ingar);

  console.log(`\n✓ ${mina.length} av ${kanaler.length} kanaler ingår i ditt abonnemang:\n`);
  for (const k of mina) console.log(`  ${k.namn}`);

  console.log(
    "\nRena streamingtjänster (HBO Max, Disney+, Prime, SkyShowtime) syns inte här —\n" +
      "de har inga kanaler i Telias kanalregister. Kryssa i dem för hand på /ingar.\n",
  );
} catch (err) {
  console.error(`\n✗ ${err.message}\n`);
  console.error("Telias API är inte publikt och ändras utan förvarning. Appen fungerar");
  console.error("ändå — den manuella listan på /ingar är den som gäller då.\n");
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
