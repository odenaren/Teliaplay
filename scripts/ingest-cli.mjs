#!/usr/bin/env node
/**
 * Triggar en hämtning mot en körande server.
 *
 *   npm run ingest              snabb (tablå, sport)
 *   npm run ingest -- full      även film- och seriekatalogen
 */

import { loadEnv } from "./env.mjs";

loadEnv();

const bas = process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const djup = process.argv.includes("full") ? "full" : "snabb";
const hemlighet = process.env.INGEST_SECRET;

if (!hemlighet) {
  console.error("✗ INGEST_SECRET saknas i .env — servern skulle svara 401.");
  process.exit(1);
}

const res = await fetch(`${bas}/api/ingest?djup=${djup}`, {
  method: "POST",
  headers: { "x-ingest-secret": hemlighet },
});

if (!res.ok) {
  console.error(`✗ HTTP ${res.status}`);
  process.exit(1);
}

const { steg, ms } = await res.json();
for (const s of steg) {
  const tecken = s.status === "ok" ? "✓" : "✗";
  console.log(`${tecken} ${s.kalla.padEnd(16)} ${String(s.antal).padStart(5)} rader  ${s.ms} ms`);
  if (s.meddelande) console.log(`  ${s.meddelande}`);
}
console.log(`\nTotalt ${ms} ms.`);
