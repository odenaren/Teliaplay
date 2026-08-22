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
  { id: "allsvenskan", namn: "Allsvenskan", sport: "fotboll", sportsdbId: "4331", tablaOrd: ["allsvenskan"] },
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
