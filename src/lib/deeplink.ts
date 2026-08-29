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
  /**
   * Text att lägga i urklipp när länken öppnas.
   *
   * Satt för söksidor utan förifyllning: man landar i sökrutan och behöver
   * bara klistra in. Undefined när adressen redan bär sökningen.
   */
  kopiera?: string;
}

/*
 * Söksidorna.
 *
 * `url` är sidan. `monster` är en förifylld sökning, och den finns BARA för
 * tjänster där mönstret är känt att fungera.
 *
 * Här stod förut ett {q}-mönster för varenda tjänst, och de var till stor del
 * gissade. Följden var adresser som inte fanns: Disney+ fick
 * /sv-se/search?q=… när sidan i själva verket heter /sv-se/browse/search. En
 * länk till en söksida som inte finns är sämre än en länk till startsidan,
 * eftersom den ser ut att vara precis rätt.
 *
 * Därför är förifyllningen numera undantaget, inte regeln — och titeln läggs
 * i urklipp i stället, så att den som landar på söksidan bara behöver klistra
 * in. Det är ett tryck till, men ett tryck som alltid fungerar.
 *
 * ETT `monster` LÄGGS BARA TILL NÄR NÅGON SETT DET FUNGERA. Inte för att det
 * ser rimligt ut, inte för att en annan tjänst gör likadant. Den som provat i
 * appen vet mer än den som läser mönstret, och det var just gissningarna som
 * skickade folk till söksidor som inte fanns.
 */
const SOK: Partial<Record<TjanstId, { url: string; monster?: string }>> = {
  viaplay: { url: "https://viaplay.se/sok" },
  max: { url: "https://play.max.com/search" },
  // Adressen bekräftad av en abonnent i appen. De andra är obekräftade.
  disney: { url: "https://www.disneyplus.com/sv-se/browse/search" },
  tv4play: { url: "https://www.tv4play.se/sok" },
  prime: { url: "https://www.primevideo.com/search" },
  skyshowtime: { url: "https://www.skyshowtime.com/se/search" },
  // Netflix ?q= är dokumenterat och stabilt sedan många år.
  netflix: { url: "https://www.netflix.com/search", monster: "https://www.netflix.com/search?q={q}" },
  discovery: { url: "https://www.discoveryplus.com/se/search" },
  // Bekräftad av en abonnent: SVT:s ?q= fyller i sökrutan på riktigt.
  svtplay: { url: "https://www.svtplay.se/sok", monster: "https://www.svtplay.se/sok?q={q}" },
  teliaplay: { url: "https://www.teliaplay.se/sok" },
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

  const sok = SOK[t.id];
  if (opts.namn && sok) {
    return {
      ...bas,
      url: sok.monster ? sok.monster.replace("{q}", encodeURIComponent(opts.namn)) : sok.url,
      niva: "sok",
      // Titeln följer med så att knappen kan lägga den i urklipp. Utan
      // förifyllning i adressen är det den som gör söksidan användbar.
      kopiera: sok.monster ? undefined : opts.namn,
    };
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
