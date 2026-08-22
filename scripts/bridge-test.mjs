#!/usr/bin/env node
/**
 * Testar hembryggan.
 *
 *   npm run bridge:test          hälsokoll
 *   npm run bridge:test -- apps  lista appar med bundle-id
 *   npm run bridge:test -- play https://viaplay.se
 *
 * Körs hemifrån, mot bryggan. `apps` är det du använder för att fylla i
 * appleTvApp i src/content/tjanster.ts — id:n skiljer sig mellan länder och
 * tvOS-versioner, så listan i repot är ett utgångsläge, inte facit.
 */

import { loadEnv } from "./env.mjs";

loadEnv();

const bas = (process.env.BRIDGE_URL ?? "http://localhost:8787").replace(/\/$/, "");
const hemlighet = process.env.BRIDGE_SECRET;

if (!hemlighet) {
  console.error("✗ BRIDGE_SECRET saknas i .env.");
  process.exit(1);
}

const headers = { "X-Bridge-Secret": hemlighet, "Content-Type": "application/json" };
const [kommando, argument] = process.argv.slice(2);

try {
  if (kommando === "apps") {
    const res = await fetch(`${bas}/apps`, { headers });
    const { apps } = await res.json();
    for (const a of apps ?? []) console.log(`${a.id.padEnd(40)} ${a.namn}`);
  } else if (kommando === "play") {
    if (!argument) {
      console.error("✗ ange en länk: npm run bridge:test -- play https://…");
      process.exit(1);
    }
    const res = await fetch(`${bas}/play`, {
      method: "POST",
      headers,
      body: JSON.stringify({ deeplink: argument, wake: true }),
    });
    console.log(await res.json());
  } else {
    const res = await fetch(`${bas}/health`, { headers });
    console.log(`HTTP ${res.status}`, await res.json());
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  console.error(`  Nådde inte ${bas}. Kör bryggan och kontrollera BRIDGE_URL.`);
  process.exitCode = 1;
}
