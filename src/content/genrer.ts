/**
 * Genrer, på svenska, i den uppsättning appen faktiskt bläddrar i.
 *
 * TMDB har nitton genrer för film och sexton för serier, delvis olika, och
 * flera av dem är samma sak under olika namn — "Action & Adventure" finns bara
 * på serier, "Sci-Fi & Fantasy" slår ihop två genrer som film håller isär.
 * Att spegla den listan rakt av ger ett bläddrande där Andor ligger under en
 * rubrik och Dune under en annan.
 *
 * Därför en egen, kortare lista. Fjorton rader man kan överblicka på en
 * telefonskärm, och en avbildning från TMDB:s id:n till dem. Ett id som inte
 * står med tappas medvetet: en titel utan genre hamnar under sin tjänst i
 * stället, vilket är bättre än en rubrik som heter "Såpopera".
 */

export interface Genre {
  id: string;
  namn: string;
  /** Ordningen de visas i på /bladdra. Bredast först. */
  sort: number;
}

export const GENRER: Genre[] = [
  { id: "drama", namn: "Drama", sort: 10 },
  { id: "komedi", namn: "Komedi", sort: 20 },
  { id: "action", namn: "Action", sort: 30 },
  { id: "thriller", namn: "Thriller", sort: 40 },
  { id: "dokumentar", namn: "Dokumentärt", sort: 50 },
  { id: "barn", namn: "Barn", sort: 60 },
  { id: "sci-fi", namn: "Sci-fi", sort: 70 },
  { id: "fantasy", namn: "Fantasy", sort: 80 },
  { id: "aventyr", namn: "Äventyr", sort: 90 },
  { id: "skrack", namn: "Skräck", sort: 100 },
  { id: "krim", namn: "Krim", sort: 110 },
  { id: "romantik", namn: "Romantik", sort: 120 },
  { id: "historia", namn: "Historia", sort: 130 },
  { id: "sport", namn: "Sport", sort: 140 },
];

const BY_ID = new Map(GENRER.map((g) => [g.id, g]));

export function genre(id: string): Genre | undefined {
  return BY_ID.get(id);
}

/** Genrenamn för visning. Okända id:n skrivs ut som de är hellre än att döljas. */
export function genreNamn(id: string): string {
  return BY_ID.get(id)?.namn ?? id;
}

/**
 * TMDB:s genre-id:n → våra.
 *
 * Både film- och serielistan, i samma tabell. Id:n krockar inte mellan de två
 * utom där de betyder samma sak (16 Animation, 35 Comedy, 18 Drama, 80 Crime,
 * 99 Documentary, 37 Western), vilket är precis vad vi vill.
 */
const TMDB: Record<number, string> = {
  // film
  28: "action",
  12: "aventyr",
  16: "barn",
  35: "komedi",
  80: "krim",
  99: "dokumentar",
  18: "drama",
  10751: "barn",
  14: "fantasy",
  36: "historia",
  27: "skrack",
  9648: "thriller",
  10749: "romantik",
  878: "sci-fi",
  53: "thriller",
  10752: "historia",
  37: "aventyr",
  // serier
  10759: "action",
  10762: "barn",
  10764: "dokumentar",
  10765: "sci-fi",
  10768: "historia",
};

/** Översätter TMDB:s genre_ids till våra, utan dubbletter och i vår ordning. */
export function franTmdb(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];

  const träffar = new Set<string>();
  for (const id of ids) {
    const vår = TMDB[Number(id)];
    if (vår) träffar.add(vår);
  }

  return [...träffar].sort((a, b) => (genre(a)?.sort ?? 999) - (genre(b)?.sort ?? 999));
}
