/**
 * Matcher och lag, från TheSportsDB.
 *
 * Gratis och utan nyckel på testnivån (nyckel "3"), vilket räcker för ett
 * hushåll. Sätt SPORTSDB_KEY om du skaffar en egen — samma anrop, högre tak.
 *
 * Vad källan ger: när en match spelas och vilka som möts. Vad den INTE ger:
 * vilken kanal som sänder den i Sverige. Den kopplingen görs i lib/match.ts
 * genom att para ihop matchen med tablån. Det är avsiktligt att kanalen inte
 * hämtas härifrån även när fältet finns — TheSportsDB:s tv-uppgifter är
 * crowdsourcade och ofta amerikanska, och en felaktig kanaluppgift är värre än
 * ingen alls i just den här appen.
 */

import { fetchJson } from "./http";

const BAS = () => `https://www.thesportsdb.com/api/v1/json/${process.env.SPORTSDB_KEY ?? "3"}`;

export interface SportsdbLag {
  id: string;
  namn: string;
  logo: string | null;
  ligaId: string | null;
}

export interface SportsdbMatch {
  id: string;
  hemma: string;
  borta: string;
  start: Date | null;
  ligaId: string | null;
}

/** Lagen i en liga. Underlaget för favoritlagsväljaren. */
export async function hamtaLag(ligaId: string): Promise<SportsdbLag[]> {
  const svar = await fetchJson<{ teams?: Record<string, unknown>[] }>(
    `${BAS()}/lookup_all_teams.php?id=${encodeURIComponent(ligaId)}`,
  );

  return (svar.teams ?? []).flatMap((t) => {
    const id = t.idTeam;
    const namn = t.strTeam;
    if (typeof id !== "string" || typeof namn !== "string") return [];
    return [
      {
        id,
        namn,
        logo: typeof t.strBadge === "string" ? t.strBadge : null,
        ligaId: typeof t.idLeague === "string" ? t.idLeague : null,
      },
    ];
  });
}

/** Kommande matcher för ett lag. Femton stycken är vad API:et ger. */
export async function hamtaMatcher(lagId: string): Promise<SportsdbMatch[]> {
  const svar = await fetchJson<{ events?: Record<string, unknown>[] }>(
    `${BAS()}/eventsnext.php?id=${encodeURIComponent(lagId)}`,
  );

  return (svar.events ?? []).flatMap(tolkaMatch);
}

function tolkaMatch(e: Record<string, unknown>): SportsdbMatch[] {
  const id = e.idEvent;
  const hemma = e.strHomeTeam;
  const borta = e.strAwayTeam;
  if (typeof id !== "string" || typeof hemma !== "string" || typeof borta !== "string") return [];

  return [
    {
      id,
      hemma,
      borta,
      start: startTid(e),
      ligaId: typeof e.idLeague === "string" ? e.idLeague : null,
    },
  ];
}

/**
 * Starttiden.
 *
 * `strTimestamp` är UTC och det enda fältet man ska lita på. `dateEvent` +
 * `strTime` finns också, men strTime är ibland lokal tid för arenan och ibland
 * UTC, utan att något fält skvallrar om vilket — en match som ligger två
 * timmar fel i appen är värre än en match utan tid.
 */
function startTid(e: Record<string, unknown>): Date | null {
  const ts = e.strTimestamp;
  if (typeof ts === "string" && ts) {
    const d = new Date(ts.endsWith("Z") ? ts : `${ts.replace(" ", "T")}Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}
