/**
 * Ligor som appen kan följa, med TheSportsDB:s id:n.
 *
 * Listan avgör vad du kan välja favoritlag ur. Den är avsiktligt kort: varje
 * liga kostar ett anrop per hämtning, och en app som följer trettio ligor du
 * inte bryr dig om hämtar långsamt och visar brus.
 *
 * Id:n verifieras med:
 *   npm run probe -- sportsdb
 *
 * TheSportsDB är crowdsourcad. Ett lag kan byta id när någon städar i registret,
 * och därför sparas lagets namn tillsammans med id:t — hittas inte id:t nästa
 * gång görs en namnuppslagning i stället för att laget tyst försvinner.
 *
 * ID:NA HÄR ÄR GENVÄGAR, INTE FACIT.
 *
 * Allsvenskan och Bundesliga stod länge båda som 4331, vilket inte kan stämma
 * för två olika ligor — följden var att man valde den ena och fick den andras
 * lag. Ett fel som det syns inte i koden och inte i en typkontroll; det syns
 * bara för den som väljer sin liga och får fel lag.
 *
 * Därför bygger favoritlagsväljaren inte längre på den här listan. Den söker
 * på lagnamn, och ligan är en genväg som kontrolleras mot svaret
 * (sources/sportsdb.ts). Stämmer id:t inte säger appen det i stället för att
 * visa fel lag under rätt rubrik.
 */

export interface Liga {
  id: string;
  namn: string;
  /** Sport, för gruppering och ikon. */
  sport: "fotboll" | "hockey" | "motorsport" | "tennis" | "handboll" | "annat";
  /** TheSportsDB:s idLeague. */
  sportsdbId: string;
  /**
   * Ord som brukar stå i tablåtiteln för den här ligan. Används av
   * lib/match.ts när en match ska paras ihop med sin sändning.
   */
  tablaOrd: string[];
}

export const LIGOR: Liga[] = [
  // 4347 är INTE verifierat mot API:et — källorna gick inte att nå från miljön
  // där ändringen gjordes. Det gamla värdet (4331) var bevisligen fel, eftersom
  // Bundesliga har det. Stämmer inte 4347 heller säger väljaren det rakt ut och
  // namnsökningen fungerar ändå. Kör `npm run probe -- sportsdb` för att fastställa.
  { id: "allsvenskan", namn: "Allsvenskan", sport: "fotboll", sportsdbId: "4347", tablaOrd: ["allsvenskan"] },
  { id: "superettan", namn: "Superettan", sport: "fotboll", sportsdbId: "4403", tablaOrd: ["superettan"] },
  { id: "damallsvenskan", namn: "Damallsvenskan", sport: "fotboll", sportsdbId: "4816", tablaOrd: ["damallsvenskan"] },
  { id: "premier-league", namn: "Premier League", sport: "fotboll", sportsdbId: "4328", tablaOrd: ["premier league", "england"] },
  { id: "champions-league", namn: "Champions League", sport: "fotboll", sportsdbId: "4480", tablaOrd: ["champions league", "cl"] },
  { id: "europa-league", namn: "Europa League", sport: "fotboll", sportsdbId: "4481", tablaOrd: ["europa league"] },
  { id: "la-liga", namn: "La Liga", sport: "fotboll", sportsdbId: "4335", tablaOrd: ["la liga", "spanien"] },
  { id: "serie-a", namn: "Serie A", sport: "fotboll", sportsdbId: "4332", tablaOrd: ["serie a", "italien"] },
  { id: "bundesliga", namn: "Bundesliga", sport: "fotboll", sportsdbId: "4331", tablaOrd: ["bundesliga", "tyskland"] },
  { id: "shl", namn: "SHL", sport: "hockey", sportsdbId: "4444", tablaOrd: ["shl", "hockey"] },
  { id: "nhl", namn: "NHL", sport: "hockey", sportsdbId: "4380", tablaOrd: ["nhl"] },
  { id: "formel-1", namn: "Formel 1", sport: "motorsport", sportsdbId: "4370", tablaOrd: ["formel 1", "f1", "grand prix"] },
];

const BY_ID = new Map(LIGOR.map((l) => [l.id, l]));

export function liga(id: string): Liga | undefined {
  return BY_ID.get(id);
}
