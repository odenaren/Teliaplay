/**
 * Länkar in i tjänsterna.
 *
 * Det finns tre precisionsnivåer, och appen använder alltid den bästa den kan:
 *
 *   1. Direkt till titeln  — när vi har tjänstens eget id för den.
 *   2. Till tjänstens sök  — när vi bara har ett namn. Ett steg kvar för dig,
 *                            men rätt app och rätt sökning redan ifylld.
 *   3. Till startsidan     — sista utvägen. Trubbigt, men aldrig fel.
 *
 * Att hoppa över nivå två vore lätt och dumt: skillnaden mellan "öppna Viaplay"
 * och "öppna Viaplay med Djurgården redan sökt" är hela avståndet mellan att
 * orka och att inte orka.
 */

import { tjanst, type TjanstId } from "@/content/tjanster";

export interface Lank {
  url: string;
  /** Hur säker länken är. Styr vad knappen heter. */
  niva: "titel" | "sok" | "start";
  tjanstId: string;
  /** App-id för Apple TV, till bryggan. */
  appleTvApp?: string;
}

const SOK_MONSTER: Partial<Record<TjanstId, string>> = {
  viaplay: "https://viaplay.se/sok?query={q}",
  max: "https://play.max.com/search?q={q}",
  disney: "https://www.disneyplus.com/sv-se/search?q={q}",
  tv4play: "https://www.tv4play.se/sok?q={q}",
  prime: "https://www.primevideo.com/search/ref=atv_nb_sr?phrase={q}",
  skyshowtime: "https://www.skyshowtime.com/se/search?q={q}",
  netflix: "https://www.netflix.com/search?q={q}",
  discovery: "https://www.discoveryplus.com/se/search?q={q}",
  svtplay: "https://www.svtplay.se/sok?q={q}",
  teliaplay: "https://www.teliaplay.se/sok?q={q}",
};

export function lankTill(
  tjanstId: string,
  opts: { titelId?: string | null; namn?: string | null } = {},
): Lank | null {
  const t = tjanst(tjanstId);
  if (!t) return null;

  const bas = { tjanstId, appleTvApp: t.appleTvApp };

  if (opts.titelId && t.titelMonster) {
    return { ...bas, url: t.titelMonster.replace("{id}", opts.titelId), niva: "titel" };
  }

  const sokMonster = SOK_MONSTER[t.id];
  if (opts.namn && sokMonster) {
    return { ...bas, url: sokMonster.replace("{q}", encodeURIComponent(opts.namn)), niva: "sok" };
  }

  return { ...bas, url: t.webb, niva: "start" };
}

/** Knapptext som är ärlig om vad som faktiskt händer när du trycker. */
export function lankEtikett(lank: Lank): string {
  const namn = tjanst(lank.tjanstId)?.kort ?? lank.tjanstId;
  if (lank.niva === "titel") return `Spela i ${namn}`;
  if (lank.niva === "sok") return `Sök i ${namn}`;
  return `Öppna ${namn}`;
}
