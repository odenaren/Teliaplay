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

import type { TjanstId } from "./tjanster";

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

  /**
   * Vem som har rättigheterna, när det är känt.
   *
   * VARFÖR FÄLTET FINNS. En match som bara strömmas finns inte i någon tablå,
   * och appen sa därför "ingen sändning hittad på det du har" om matcher som
   * abonnenten mycket väl kan se. Allsvenskan 2026 är det tydligaste fallet:
   * samtliga matcher går exklusivt på TV4 Play, bara utvalda på linjära TV4.
   * Tablåmatchningen kan per definition inte hitta dem.
   *
   * DET HÄR ÄR REDAKTIONELLT OCH FÄRSKVARA. Rättigheter flyttar mellan
   * tjänster, och listan är avskriven från Telias och TV4:s egna sidor i
   * augusti 2026. Därför säger gränssnittet "går troligen på" och aldrig "går
   * på": vi vet vem som har ligan, inte att just den här matchen sänds.
   *
   * Tom lista = vi vet inte, och då beter sig ligan precis som förut. Det är
   * ett bättre svar än en gissning.
   */
  tjanster?: TjanstId[];
}

export const LIGOR: Liga[] = [
  // 4347 är INTE verifierat mot API:et — källorna gick inte att nå från miljön
  // där ändringen gjordes. Det gamla värdet (4331) var bevisligen fel, eftersom
  // Bundesliga har det. Stämmer inte 4347 heller säger väljaren det rakt ut och
  // namnsökningen fungerar ändå. Kör `npm run probe -- sportsdb` för att fastställa.
  { id: "allsvenskan", namn: "Allsvenskan", sport: "fotboll", sportsdbId: "4347", tablaOrd: ["allsvenskan"], tjanster: ["tv4play"] },
  { id: "superettan", namn: "Superettan", sport: "fotboll", sportsdbId: "4403", tablaOrd: ["superettan"], tjanster: ["tv4play"] },
  { id: "damallsvenskan", namn: "Damallsvenskan", sport: "fotboll", sportsdbId: "4816", tablaOrd: ["damallsvenskan"] },
  { id: "premier-league", namn: "Premier League", sport: "fotboll", sportsdbId: "4328", tablaOrd: ["premier league", "england"], tjanster: ["viaplay", "prime"] },
  { id: "champions-league", namn: "Champions League", sport: "fotboll", sportsdbId: "4480", tablaOrd: ["champions league", "cl"], tjanster: ["viaplay"] },
  { id: "europa-league", namn: "Europa League", sport: "fotboll", sportsdbId: "4481", tablaOrd: ["europa league"] },
  { id: "la-liga", namn: "La Liga", sport: "fotboll", sportsdbId: "4335", tablaOrd: ["la liga", "spanien"], tjanster: ["disney"] },
  { id: "serie-a", namn: "Serie A", sport: "fotboll", sportsdbId: "4332", tablaOrd: ["serie a", "italien"] },
  { id: "bundesliga", namn: "Bundesliga", sport: "fotboll", sportsdbId: "4331", tablaOrd: ["bundesliga", "tyskland"] },
  { id: "shl", namn: "SHL", sport: "hockey", sportsdbId: "4444", tablaOrd: ["shl", "hockey"] },
  { id: "nhl", namn: "NHL", sport: "hockey", sportsdbId: "4380", tablaOrd: ["nhl"], tjanster: ["viaplay"] },
  { id: "formel-1", namn: "Formel 1", sport: "motorsport", sportsdbId: "4370", tablaOrd: ["formel 1", "f1", "grand prix"], tjanster: ["viaplay"] },
];

const BY_ID = new Map(LIGOR.map((l) => [l.id, l]));
const BY_SPORTSDB = new Map(LIGOR.map((l) => [l.sportsdbId, l]));

export function liga(id: string): Liga | undefined {
  return BY_ID.get(id);
}

/**
 * Slår upp en liga på ANTINGEN vårt id eller TheSportsDB:s.
 *
 * VARFÖR BÅDA. sportmatch.liga_id fylls av hämtningen med TheSportsDB:s egna
 * nummer — "4328", inte "premier-league". Uppslagningen av rättighetshavare
 * gjordes mot vårt id och träffade därför aldrig, så varje strömmad match föll
 * tillbaka på "ingen sändning hittad" trots att ligan stod med i listan.
 *
 * Felet syntes inte i testet, eftersom testet skrev in vårt id för hand. Det
 * bekräftade antagandet i stället för verkligheten. Att ta emot båda formerna
 * är dessutom rätt oavsett: rader skrivna före den här ändringen bär gamla
 * nummer och ska fortsätta fungera.
 */
export function hittaLiga(id: string | null | undefined): Liga | undefined {
  if (!id) return undefined;
  return BY_ID.get(id) ?? BY_SPORTSDB.get(id);
}

/** Normaliserar ett liganamn: gemener, inga specialtecken, inga mellanrum. */
function namnNyckel(namn: string): string {
  return namn
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Slår upp en liga på NAMN, som en andra väg när id:t inte träffar.
 *
 * TheSportsDB skriver "Swedish Allsvenskan", "English Premier League",
 * "Spanish La Liga" — vårt namn ligger inuti deras. Matchningen är därför
 * "innehåller", inte "lika med".
 *
 * Vägen finns eftersom liga-id:na är avskrivna för hand och minst ett är
 * overifierat. Ett fel id ska kosta en långsammare uppslagning, inte en
 * match som påstås osänd.
 */
export function hittaLigaViaNamn(namn: string | null | undefined): Liga | undefined {
  if (!namn) return undefined;
  const nyckel = namnNyckel(namn);
  if (!nyckel) return undefined;

  return LIGOR.find((l) => {
    if (nyckel.includes(namnNyckel(l.namn))) return true;
    return l.tablaOrd.some((ord) => {
      const o = namnNyckel(ord);
      return o.length >= 4 && nyckel.includes(o);
    });
  });
}
