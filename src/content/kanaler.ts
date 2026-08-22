/**
 * Kanalkatalogen — vilka linjära kanaler som kan finnas i ett Telia-paket, och
 * vilken tjänst de hör till.
 *
 * Notera vad som INTE står här: tv.nu:s interna kanal-id:n. De gissas inte.
 * Vid hämtningen hämtas tv.nu:s egen kanallista och matchas mot `namn` och
 * `alias` nedan med normaliserad jämförelse (se lib/sources/tvnu.ts). Kanaler
 * som inte hittar sin motsvarighet listas på /ingar med en ruta där du väljer
 * rätt kanal ur tv.nu:s lista en gång, varefter kopplingen sparas i databasen.
 *
 * Det är skillnaden mellan en app som går sönder tyst och en som säger till.
 * En hårdkodad slug som slutar gälla ger en tom tablårad utan förklaring; en
 * misslyckad namnmatchning ger en rad på /ingar som säger exakt vad som fattas.
 */

import type { TjanstId } from "./tjanster";

export interface Kanal {
  /** Vårt eget id. Stabilt, används som nyckel i databasen. */
  id: string;
  namn: string;
  /** Andra stavningar som tv.nu eller Telia kan tänkas använda. */
  alias?: string[];
  tjanst: TjanstId;
  /** Sportkanal. Styr sportfiltret och vad som hamnar i sportnavet. */
  sport?: boolean;
  /** Sorteringsordning som förval. Du kan sortera om per profil i appen. */
  sort: number;
}

export const KANALER: Kanal[] = [
  // --- Marksänt och baspaket -------------------------------------------
  { id: "svt1", namn: "SVT1", tjanst: "svtplay", sort: 10 },
  { id: "svt2", namn: "SVT2", tjanst: "svtplay", sort: 11 },
  { id: "tv4", namn: "TV4", tjanst: "tv4play", sort: 12 },
  { id: "tv3", namn: "TV3", tjanst: "viaplay", sort: 13 },
  { id: "kanal5", namn: "Kanal 5", tjanst: "discovery", sort: 14 },
  { id: "tv6", namn: "TV6", tjanst: "viaplay", sort: 15 },
  { id: "sjuan", namn: "Sjuan", tjanst: "tv4play", sort: 16 },
  { id: "tv8", namn: "TV8", tjanst: "viaplay", sort: 17 },
  { id: "kanal9", namn: "Kanal 9", tjanst: "discovery", sort: 18 },
  { id: "tv10", namn: "TV10", tjanst: "viaplay", sort: 19 },
  { id: "tv12", namn: "TV12", tjanst: "tv4play", sort: 20 },
  { id: "svt24", namn: "SVT24", tjanst: "svtplay", sort: 21 },
  { id: "kunskapskanalen", namn: "Kunskapskanalen", tjanst: "svtplay", sort: 22 },
  { id: "svtbarn", namn: "SVT Barn", tjanst: "svtplay", sort: 23 },

  // --- Sport: Viaplay ---------------------------------------------------
  { id: "viaplay-sport-1", namn: "Viaplay Sport 1", alias: ["V Sport 1", "Viasat Sport"], tjanst: "viaplay", sport: true, sort: 30 },
  { id: "viaplay-sport-2", namn: "Viaplay Sport 2", alias: ["V Sport 2"], tjanst: "viaplay", sport: true, sort: 31 },
  { id: "viaplay-sport-3", namn: "Viaplay Sport 3", alias: ["V Sport 3"], tjanst: "viaplay", sport: true, sort: 32 },
  { id: "v-sport-premium", namn: "V Sport Premium", tjanst: "viaplay", sport: true, sort: 33 },
  { id: "v-sport-football", namn: "V Sport Football", alias: ["V Sport Fotboll"], tjanst: "viaplay", sport: true, sort: 34 },
  { id: "v-sport-live-1", namn: "V Sport Live 1", tjanst: "viaplay", sport: true, sort: 35 },
  { id: "v-sport-live-2", namn: "V Sport Live 2", tjanst: "viaplay", sport: true, sort: 36 },
  { id: "v-sport-live-3", namn: "V Sport Live 3", tjanst: "viaplay", sport: true, sort: 37 },
  { id: "v-sport-live-4", namn: "V Sport Live 4", tjanst: "viaplay", sport: true, sort: 38 },
  { id: "v-sport-motor", namn: "V Sport Motor", tjanst: "viaplay", sport: true, sort: 39 },
  { id: "v-sport-golf", namn: "V Sport Golf", tjanst: "viaplay", sport: true, sort: 40 },
  { id: "v-sport-extra", namn: "V Sport Extra", tjanst: "viaplay", sport: true, sort: 41 },
  { id: "v-sport-ultra-hd", namn: "V Sport Ultra HD", tjanst: "viaplay", sport: true, sort: 42 },

  // --- Sport: TV4 / C More ---------------------------------------------
  { id: "tv4-sport", namn: "TV4 Sport", alias: ["Sportkanalen"], tjanst: "tv4play", sport: true, sort: 50 },
  { id: "tv4-fotboll", namn: "TV4 Fotboll", alias: ["C More Fotboll"], tjanst: "tv4play", sport: true, sort: 51 },
  { id: "tv4-hockey", namn: "TV4 Hockey", alias: ["C More Hockey"], tjanst: "tv4play", sport: true, sort: 52 },
  { id: "tv4-sport-live-1", namn: "TV4 Sport Live 1", alias: ["C More Live 1"], tjanst: "tv4play", sport: true, sort: 53 },
  { id: "tv4-sport-live-2", namn: "TV4 Sport Live 2", alias: ["C More Live 2"], tjanst: "tv4play", sport: true, sort: 54 },
  { id: "tv4-sport-live-3", namn: "TV4 Sport Live 3", alias: ["C More Live 3"], tjanst: "tv4play", sport: true, sort: 55 },
  { id: "tv4-sport-live-4", namn: "TV4 Sport Live 4", alias: ["C More Live 4"], tjanst: "tv4play", sport: true, sort: 56 },

  // --- Sport: övriga -----------------------------------------------------
  { id: "eurosport-1", namn: "Eurosport 1", alias: ["TNT Sports 1"], tjanst: "discovery", sport: true, sort: 60 },
  { id: "eurosport-2", namn: "Eurosport 2", alias: ["TNT Sports 2"], tjanst: "discovery", sport: true, sort: 61 },
  { id: "sport-tv", namn: "Sportkanalen", tjanst: "tv4play", sport: true, sort: 62 },
  { id: "motorsport-tv", namn: "Motorsport.tv", tjanst: "discovery", sport: true, sort: 63 },

  // --- Film och serier ---------------------------------------------------
  { id: "tv4-film", namn: "TV4 Film", alias: ["C More Film"], tjanst: "tv4play", sort: 70 },
  { id: "tv4-stars", namn: "TV4 Stars", alias: ["C More Stars"], tjanst: "tv4play", sort: 71 },
  { id: "tv4-serier", namn: "TV4 Serier", alias: ["C More Series"], tjanst: "tv4play", sort: 72 },
  { id: "viaplay-film", namn: "Viaplay Film", alias: ["V Film Premiere"], tjanst: "viaplay", sort: 73 },
  { id: "v-film-action", namn: "V Film Action", tjanst: "viaplay", sort: 74 },
  { id: "v-film-family", namn: "V Film Family", tjanst: "viaplay", sort: 75 },
  { id: "v-series", namn: "V Series", tjanst: "viaplay", sort: 76 },

  // --- Fakta, nyheter, barn ---------------------------------------------
  { id: "discovery-channel", namn: "Discovery Channel", tjanst: "discovery", sort: 80 },
  { id: "national-geographic", namn: "National Geographic", tjanst: "disney", sort: 81 },
  { id: "history", namn: "History", tjanst: "discovery", sort: 82 },
  { id: "animal-planet", namn: "Animal Planet", tjanst: "discovery", sort: 83 },
  { id: "tlc", namn: "TLC", tjanst: "discovery", sort: 84 },
  { id: "cnn", namn: "CNN", tjanst: "teliaplay", sort: 85 },
  { id: "bbc-world", namn: "BBC World News", tjanst: "teliaplay", sort: 86 },
  { id: "cartoon-network", namn: "Cartoon Network", tjanst: "max", sort: 87 },
  { id: "nickelodeon", namn: "Nickelodeon", tjanst: "teliaplay", sort: 88 },
];

const BY_ID = new Map(KANALER.map((k) => [k.id, k]));

export function kanal(id: string): Kanal | undefined {
  return BY_ID.get(id);
}

/**
 * Normaliserad nyckel för namnjämförelse.
 *
 * "V Sport Premium HD", "v sport premium" och "VSport Premium" ska ge samma
 * nyckel. HD-suffixet är det som ställer till mest: samma kanal listas som både
 * "TV4 HD" och "TV4" beroende på var man frågar.
 */
export function kanalNyckel(namn: string): string {
  return namn
    .toLowerCase()
    .replace(/\b(hd|uhd|4k|sd)\b/g, "")
    .replace(/[^a-z0-9åäö]+/g, "")
    .trim();
}

/** Alla nycklar en kanal kan tänkas dyka upp under, inklusive alias. */
export function kanalNycklar(k: Kanal): string[] {
  return [k.namn, ...(k.alias ?? [])].map(kanalNyckel);
}
