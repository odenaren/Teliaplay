/**
 * SVT Play, från SVT:s eget GraphQL-API.
 *
 * Varför en egen källa i stället för TMDB: SVT Play är public service och
 * innehållet är till stor del svenskt — dokumentärer, Uppdrag granskning,
 * SVT:s egna dramaserier. Sådant är tunt eller helt frånvarande i TMDB, vars
 * tillgänglighetsdata dessutom är en dygnsgammal JustWatch-export. SVT vet
 * själva vad som ligger uppe just nu, och de säger det gratis.
 *
 * SÅ HÄR PRATAR MAN MED DET
 *
 * Servern är en Apollo-server med *persisted queries*: i stället för en hel
 * fråga skickar man en sha256-hash som pekar ut en fråga servern redan känner
 * till. Hasharna nedan är hämtade ur SVT:s egen webbklient (via Kodi-tillägget
 * kodi-svtplay/xbmc-svtplay) och är alltså inte något vi hittat på — men de
 * följer med när SVT ändrar sina frågor, och då slutar de fungera. Ett sådant
 * fel syns som "PersistedQueryNotFound" och betyder att hashen behöver
 * uppdateras, inte att API:et är borta.
 *
 * `ua`-parametern stavas "produnction". Det är SVT:s eget stavfel i deras
 * klientnamn, och det måste skrivas exakt så — rättar man det matchar inte
 * strängen längre.
 *
 * TRE URVAL, OCH VARFÖR JUST DE
 *
 *   latest_start      nytt på SVT Play  → matar "Nytt i paketet"
 *   popular_start     mest sedda        → ger katalogen en botten värd att bläddra i
 *   lastchance_start  snart borta       → se nedan
 *
 * Det sista är en riktig vinst. För de kommersiella tjänsterna är "Sista
 * chansen" en gissning: en titel som slutat dyka upp i katalogen antas vara på
 * väg bort. SVT säger det rakt ut. En officiell uppgift slår en heuristik varje
 * dag i veckan, och därför får SVT:s titlar en egen flagga i databasen i
 * stället för att köras genom gissningen.
 */

import { fetchJson, plocka } from "./http";

const ENDPOINT = "https://api.svt.se/contento/graphql";

/** SVT:s eget klientnamn. Stavfelet är deras, se filhuvudet. */
const KLIENT = "svtplaywebb-play-render-produnction-client";

/**
 * Hashar för de frågor vi använder.
 *
 * Slutar en av dem fungera svarar servern "PersistedQueryNotFound". Nya hashar
 * plockas ur nätverksfliken på svtplay.se, eller ur Kodi-tilläggets
 * resources/lib/api/graphql.py som brukar uppdateras snabbt.
 */
const FRAGOR = {
  GridPage: "1e2d15ff7ffa578d33ebf1287d3f7af7fd47125552b564e96fd277a744345a69",
  ProgramsListing: "17252e11da632f5c0d1b924b32be9191f6854723a0f50fb2adb35f72bb670efa",
} as const;

/** Urval på SVT Play:s startsida. */
export type Urval = "latest_start" | "popular_start" | "lastchance_start" | "live_start";

export interface SvtTitel {
  /** SVT:s väg, t.ex. "/video/abc123/rubrik". Unik och stabil nog som nyckel. */
  vag: string;
  namn: string;
  typ: "film" | "serie";
  synopsis: string | null;
  bild: string | null;
  /** Bara tillgänglig i Sverige. Vi sparar det men filtrerar inte på det. */
  baraSverige: boolean;
  /** Kommer ur lastchance-urvalet: SVT säger att den snart försvinner. */
  sistaChansen: boolean;
}

/*
 * SVT:s typnamn. Serier och program är "shows"; enstaka filmer och
 * dokumentärer är "Single".
 *
 * Episode, Clip och Trailer hämtas medvetet INTE. En katalog där varje avsnitt
 * av Rapport är en egen rad är inte en katalog utan en loggfil — det man vill
 * bläddra i är program, inte avsnitt.
 */
const SERIETYPER = ["TvShow", "KidsTvShow", "TvSeries"];
const FILMTYPER = ["Single"];

async function fraga(operation: keyof typeof FRAGOR, variables: Record<string, unknown> = {}) {
  const params = new URLSearchParams({
    operationName: operation,
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: FRAGOR[operation] },
    }),
    ua: KLIENT,
  });

  const svar = await fetchJson<{ data?: unknown; errors?: { message: string }[] }>(
    `${ENDPOINT}?${params}`,
  );

  if (svar.errors?.length) {
    const meddelande = svar.errors[0].message;
    if (/PersistedQuery/i.test(meddelande)) {
      throw new Error(
        `SVT känner inte igen frågan ${operation} längre — hashen i sources/svtplay.ts ` +
          "behöver uppdateras. Se filhuvudet.",
      );
    }
    throw new Error(`SVT ${operation}: ${meddelande}`);
  }

  return svar.data;
}

/** Ett urval från startsidan. */
export async function hamtaUrval(urval: Urval): Promise<SvtTitel[]> {
  const data = await fraga("GridPage", { selectionId: urval });
  const poster = plocka(data, "selectionById.items");
  if (!Array.isArray(poster)) return [];

  const ut: SvtTitel[] = [];
  for (const teaser of poster) {
    const titel = tolkaTeaser(teaser, urval === "lastchance_start");
    if (titel) ut.push(titel);
  }
  return ut;
}

function tolkaTeaser(teaser: unknown, sistaChansen: boolean): SvtTitel | null {
  const item = plocka(teaser, "item");
  if (!item) return null;

  const typnamn = plocka(item, "__typename");
  const typ = tolkaTyp(typnamn);
  if (!typ) return null;

  const vag = plocka(item, "urls.svtplay");
  const namn = plocka(item, "name");
  if (typeof vag !== "string" || typeof namn !== "string") return null;

  const beskrivning = plocka(teaser, "description", "item.longDescription");
  const bildId = plocka(teaser, "images.wide.id", "item.images.wide.id");
  const bildAndrad = plocka(teaser, "images.wide.changed", "item.images.wide.changed");

  return {
    vag,
    namn,
    typ,
    synopsis: typeof beskrivning === "string" && beskrivning ? beskrivning : null,
    bild:
      typeof bildId === "string" ? bildUrl(bildId, String(bildAndrad ?? "")) : null,
    baraSverige: plocka(item, "restrictions.onlyAvailableInSweden") === true,
    sistaChansen,
  };
}

function tolkaTyp(typnamn: unknown): "film" | "serie" | null {
  if (typeof typnamn !== "string") return null;
  if (SERIETYPER.includes(typnamn)) return "serie";
  if (FILMTYPER.includes(typnamn)) return "film";
  return null;
}

/**
 * Bildadress.
 *
 * `id` ser ut som "12345/6789" och `changed` är en versionsstämpel som gör att
 * en uppdaterad bild får en ny adress i stället för att ligga kvar cachad.
 */
function bildUrl(id: string, andrad: string): string {
  return `https://www.svtstatic.se/image/large/1080/${id}/${andrad}`;
}

/**
 * Hela A–Ö-listan.
 *
 * Tusentals program, men bara namn och adress — inga bilder, ingen text. Det
 * gör den olämplig att bläddra i och utmärkt att söka i, vilket är precis vad
 * den används till: `/sok` ska kunna svara på "finns Uppdrag granskning?" utan
 * att titeln råkat ligga i ett av startsidans urval den dagen.
 */
export async function hamtaAllaProgram(): Promise<SvtTitel[]> {
  const data = await fraga("ProgramsListing");
  const urval = plocka(data, "programAtillO.selections");
  if (!Array.isArray(urval)) return [];

  const ut: SvtTitel[] = [];
  for (const grupp of urval) {
    const poster = plocka(grupp, "items");
    if (!Array.isArray(poster)) continue;

    for (const teaser of poster) {
      const item = plocka(teaser, "item");
      const typ = tolkaTyp(plocka(item, "__typename"));
      const vag = plocka(item, "urls.svtplay");
      const namn = plocka(teaser, "heading", "item.name");
      if (!typ || typeof vag !== "string" || typeof namn !== "string") continue;

      ut.push({
        vag,
        namn,
        typ,
        synopsis: null,
        bild: null,
        baraSverige: plocka(item, "restrictions.onlyAvailableInSweden") === true,
        sistaChansen: false,
      });
    }
  }
  return ut;
}

/** Full adress till titeln på svtplay.se. Det är den bryggan får. */
export function svtplayUrl(vag: string): string {
  return `https://www.svtplay.se${vag.startsWith("/") ? vag : `/${vag}`}`;
}
