/**
 * Film- och seriekatalogen, från TMDB.
 *
 * Tillgänglighetsdatan (vem som visar vad i Sverige) kommer från JustWatch via
 * TMDB. Två villkor följer med den:
 *
 *   1. JustWatch ska anges som källa. Attributionen ligger på /kallor och är
 *      inget att ta bort — TMDB drar in nyckeln annars.
 *   2. JustWatch levererar EN export per dygn. Att hämta oftare ger inte
 *      färskare data, bara onödig last. Schemaläggaren kör katalogen en gång
 *      per dygn av just det skälet.
 *
 * Filtreringen sker i frågan, inte efteråt: `with_watch_providers` med bara
 * dina tjänster betyder att TMDB aldrig skickar något du inte har. Det är
 * billigare, och det gör att ett misstag i vår egen filtrering inte kan leda
 * till att fel innehåll visas.
 */

import { fetchJson } from "./http";

const BAS = "https://api.themoviedb.org/3";
const BILD = "https://image.tmdb.org/t/p/w342";

export interface TmdbTitel {
  tmdbId: number;
  typ: "film" | "serie";
  namn: string;
  ar: number | null;
  poster: string | null;
  synopsis: string | null;
  betyg: number | null;
}

function nyckel(): string {
  const k = process.env.TMDB_API_KEY;
  if (!k) throw new Error("TMDB_API_KEY saknas — ingen film- och seriekatalog hämtas.");
  return k;
}

/**
 * Alla providers TMDB känner till i Sverige, med id och namn.
 *
 * Används av `npm run probe -- tmdb-providers` för att fylla i `tmdbProvider`
 * i content/tjanster.ts. Id:n ändras sällan men de ändras, och en app som
 * gissar dem hämtar tyst fel katalog.
 */
export async function hamtaProviders(): Promise<{ id: number; namn: string }[]> {
  const url = `${BAS}/watch/providers/movie?api_key=${nyckel()}&watch_region=SE`;
  const svar = await fetchJson<{ results?: { provider_id: number; provider_name: string }[] }>(url);
  return (svar.results ?? []).map((r) => ({ id: r.provider_id, namn: r.provider_name }));
}

/**
 * Katalogen för en uppsättning providers.
 *
 * `sidor` styr hur djupt vi går. Tjugo sidor är 400 titlar per typ och
 * provider-kombination, vilket räcker gott för "vad finns" utan att bli en
 * kopia av hela JustWatch.
 */
export async function hamtaKatalog(
  providerIds: number[],
  typ: "film" | "serie",
  sidor = 5,
): Promise<TmdbTitel[]> {
  if (providerIds.length === 0) return [];

  const path = typ === "film" ? "discover/movie" : "discover/tv";
  const ut: TmdbTitel[] = [];

  for (let sida = 1; sida <= sidor; sida++) {
    const url =
      `${BAS}/${path}?api_key=${nyckel()}` +
      `&watch_region=SE&with_watch_providers=${providerIds.join("|")}` +
      `&with_watch_monetization_types=flatrate` +
      `&language=sv-SE&sort_by=popularity.desc&page=${sida}`;

    const svar = await fetchJson<{ results?: unknown[]; total_pages?: number }>(url);
    const rader = svar.results ?? [];
    for (const rad of rader) ut.push(...tolka(rad, typ));

    if (rader.length === 0 || sida >= (svar.total_pages ?? 1)) break;
  }

  return ut;
}

function tolka(rad: unknown, typ: "film" | "serie"): TmdbTitel[] {
  const r = rad as Record<string, unknown>;
  const id = Number(r.id);
  const namn = (typ === "film" ? r.title : r.name) ?? r.original_title ?? r.original_name;
  if (!Number.isFinite(id) || typeof namn !== "string") return [];

  const datum = (typ === "film" ? r.release_date : r.first_air_date) as string | undefined;
  const poster = typeof r.poster_path === "string" ? `${BILD}${r.poster_path}` : null;
  const betyg = Number(r.vote_average);

  return [
    {
      tmdbId: id,
      typ,
      namn,
      ar: datum ? Number(datum.slice(0, 4)) || null : null,
      poster,
      synopsis: typeof r.overview === "string" && r.overview ? r.overview : null,
      betyg: Number.isFinite(betyg) && betyg > 0 ? Math.round(betyg * 10) / 10 : null,
    },
  ];
}

/**
 * Vilka av dina tjänster som visar en viss titel.
 *
 * Används av ingår-vakten på /sok: du klistrar in en titel, appen svarar var
 * den finns — och svarar "nej" när den inte finns någonstans du har.
 */
export async function hamtaProvidersForTitel(
  tmdbId: number,
  typ: "film" | "serie",
): Promise<number[]> {
  const path = typ === "film" ? "movie" : "tv";
  const url = `${BAS}/${path}/${tmdbId}/watch/providers?api_key=${nyckel()}`;
  const svar = await fetchJson<Record<string, unknown>>(url);

  const se = (svar.results as Record<string, unknown> | undefined)?.SE as
    | Record<string, unknown>
    | undefined;
  if (!se) return [];

  // Bara flatrate. "rent" och "buy" är sådant du får betala extra för, vilket
  // är precis det appen ska sluta tipsa om.
  const flatrate = (se.flatrate as { provider_id: number }[] | undefined) ?? [];
  return flatrate.map((p) => p.provider_id);
}

/** Fritextsökning. Ger kandidater att slå upp tillgänglighet för. */
export async function sok(fraga: string): Promise<TmdbTitel[]> {
  const url =
    `${BAS}/search/multi?api_key=${nyckel()}` +
    `&language=sv-SE&query=${encodeURIComponent(fraga)}`;
  const svar = await fetchJson<{ results?: Record<string, unknown>[] }>(url);

  const ut: TmdbTitel[] = [];
  for (const rad of svar.results ?? []) {
    if (rad.media_type !== "movie" && rad.media_type !== "tv") continue;
    ut.push(...tolka(rad, rad.media_type === "movie" ? "film" : "serie"));
  }
  return ut;
}
