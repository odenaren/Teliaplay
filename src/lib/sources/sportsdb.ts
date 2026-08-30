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
  /** Ligans namn enligt källan. Visas i väljaren så att fel lag går att se. */
  liga: string | null;
  /** Landet laget hör hemma i. Samma skäl. */
  land: string | null;
}

export interface SportsdbMatch {
  id: string;
  hemma: string;
  borta: string;
  start: Date | null;
  ligaId: string | null;
  /**
   * Ligans namn enligt källan, t.ex. "Swedish Allsvenskan".
   *
   * Följer med för att id:t inte går att lita på: våra liga-id:n är avskrivna
   * för hand och ett av dem är overifierat. Namnet ger en andra väg in, och
   * två oberoende vägar gör uppslagningen robust mot att den ena är fel.
   */
  liga: string | null;
}

/**
 * Lagen i en liga.
 *
 * Svaret KONTROLLERAS mot ligan vi frågade efter, och det är hela poängen med
 * funktionen. TheSportsDB svarar inte alltid med den liga man bad om: id:n
 * flyttas när registret städas, och den öppna testnyckeln ger begränsad data
 * oavsett fråga. Följden i den här appen var att man valde Allsvenskan i
 * väljaren och fick engelska lag — utan att något sa ifrån, eftersom svaret
 * såg ut som ett giltigt svar.
 *
 * Nu filtreras främmande lag bort, och blir ingenting kvar kastas ett fel som
 * säger vad källan faktiskt svarade. Ett tomt resultat med en förklaring är
 * användbart. Tjugo fel lag är det inte.
 */
export async function hamtaLag(ligaId: string): Promise<SportsdbLag[]> {
  const svar = await fetchJson<{ teams?: Record<string, unknown>[] }>(
    `${BAS()}/lookup_all_teams.php?id=${encodeURIComponent(ligaId)}`,
  );

  const alla = (svar.teams ?? []).flatMap(tolkaLag);
  if (alla.length === 0) return [];

  // Rader utan idLeague får passera: fältet saknas ibland, och att slänga dem
  // vore att straffa laget för källans slarv.
  const rätt = alla.filter((l) => l.ligaId === null || l.ligaId === ligaId);

  if (rätt.length === 0) {
    const fick = alla[0];
    throw new Error(
      `TheSportsDB svarade med lag ur ${fick.liga ?? "en annan liga"}` +
        `${fick.land ? ` (${fick.land})` : ""} i stället för den valda. ` +
        "Vanligaste orsaken är den öppna testnyckeln, som bara ger ett urval — " +
        "sätt SPORTSDB_KEY, eller sök upp laget på namn i stället.",
    );
  }

  return rätt;
}

/**
 * Sökning på lagnamn.
 *
 * Den här vägen är oberoende av liga-id:n, och därför den som fungerar när
 * registret ändrats eller nyckeln är begränsad. Väljaren använder den som
 * huvudväg och ligalistan som genväg — inte tvärtom, vilket var felet förut.
 */
export async function sokLag(fraga: string): Promise<SportsdbLag[]> {
  const rensad = fraga.trim();
  if (rensad.length < 2) return [];

  const svar = await fetchJson<{ teams?: Record<string, unknown>[] | null }>(
    `${BAS()}/searchteams.php?t=${encodeURIComponent(rensad)}`,
  );

  return (svar.teams ?? []).flatMap(tolkaLag);
}

function tolkaLag(t: Record<string, unknown>): SportsdbLag[] {
  const id = t.idTeam;
  const namn = t.strTeam;
  if (typeof id !== "string" || typeof namn !== "string") return [];

  const text = (v: unknown) => (typeof v === "string" && v ? v : null);

  return [
    {
      id,
      namn,
      // strBadge är det nya namnet, strTeamBadge det gamla. Båda förekommer i
      // svaren beroende på endpoint.
      logo: text(t.strBadge) ?? text(t.strTeamBadge),
      ligaId: text(t.idLeague),
      liga: text(t.strLeague),
      land: text(t.strCountry),
    },
  ];
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

  const text = (v: unknown) => (typeof v === "string" && v ? v : null);

  return [
    {
      id,
      hemma,
      borta,
      liga: text(e.strLeague),
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
