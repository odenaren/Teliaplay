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
  /**
   * Adress som öppnar tjänstens app på telefonen i stället för webbläsaren.
   *
   * Poängen är inloggningen: Safari är utloggad, appen är det inte. Den som
   * trycker Spela vill se något, inte mötas av en inloggningsruta.
   *
   * Kan vara fel — se iosApp i content/tjanster.ts. Därför är `url` alltid
   * ifylld och används som fallback av knappen.
   */
  appUrl?: string;
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
  opts: { url?: string | null; titelId?: string | null; namn?: string | null } = {},
): Lank | null {
  const t = tjanst(tjanstId);
  if (!t) return null;

  const bas = { tjanstId, appleTvApp: t.appleTvApp, appUrl: appAdress(t, opts.titelId) };

  /*
   * En färdig adress från källan slår alltid ett mönster vi byggt själva.
   * SVT ger oss titelns riktiga väg; att i stället stoppa in ett id i en
   * mall vore att gissa på något vi redan blivit tillsagda.
   */
  if (opts.url) return { ...bas, url: opts.url, niva: "titel" };

  if (opts.titelId && t.titelMonster) {
    return { ...bas, url: t.titelMonster.replace("{id}", opts.titelId), niva: "titel" };
  }

  const sokMonster = SOK_MONSTER[t.id];
  if (opts.namn && sokMonster) {
    return { ...bas, url: sokMonster.replace("{q}", encodeURIComponent(opts.namn)), niva: "sok" };
  }

  return { ...bas, url: t.webb, niva: "start" };
}

/**
 * Adressen som öppnar telefonappen.
 *
 * Med känt titelmönster går den rakt in på titeln, annars till appens
 * startsida. Startsidan i en inloggad app slår en titelsida i en utloggad
 * webbläsare: det första är ett steg kvar, det andra är en återvändsgränd.
 */
function appAdress(t: ReturnType<typeof tjanst>, titelId?: string | null): string | undefined {
  if (!t?.iosApp) return undefined;
  if (titelId && t.iosTitelMonster) return t.iosTitelMonster.replace("{id}", titelId);
  return t.iosApp;
}

/** Knapptext som är ärlig om vad som faktiskt händer när du trycker. */
export function lankEtikett(lank: Lank): string {
  const namn = tjanst(lank.tjanstId)?.kort ?? lank.tjanstId;
  if (lank.niva === "titel") return `Spela i ${namn}`;
  if (lank.niva === "sok") return `Sök i ${namn}`;
  return `Öppna ${namn}`;
}
