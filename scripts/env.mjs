import { readFileSync } from "node:fs";

/**
 * Läser .env på samma sätt som Next gör: .env.local vinner över .env.
 *
 * Skripten kör utanför Next och får alltså inga miljövariabler gratis. Att
 * glömma det ger felmeddelandet "DATABASE_URL saknas" trots att den står i
 * filen — en timmes felsökning värd att slippa.
 */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* filen finns inte */
    }
  }
}
