import type { TjanstId } from "./tjanster";

/**
 * Telias färdiga paket, som genvägar när man kryssar i /ingar för hand.
 *
 * VARFÖR DE FINNS. Telia-hämtningen är den avsedda vägen, men den går sönder —
 * deras API är inte publikt och svarar med 400 när det ändrats. Då står man
 * med Telias app i ena handen och /ingar i den andra och kryssar i fem rutor.
 * Det är precis den sortens tio minuter appen finns för att ta bort.
 *
 * VAD DE INTE ÄR. De är inte facit. Innehållet här är avskrivet från vad en
 * abonnent såg i Telias egen app en given dag, och Telia byter innehåll i sina
 * paket utan att fråga oss. Därför:
 *
 *   - ett paket KRYSSAR I, det kryssar aldrig UR. Ett fel i listan här ska
 *     inte kunna radera något du själv kryssat i.
 *   - `kalla` blir 'manuell', inte 'telia'. Uppgiften kommer från dig som
 *     tryckte på knappen, inte från Telia — och /ingar ska aldrig påstå att
 *     något är bekräftat av en källa som inte sagt det.
 *   - listan säger vilket datum den skrevs av, så att en gammal uppgift går
 *     att känna igen som gammal.
 */

/**
 * Hur mycket av en tjänst som ingår.
 *
 *   allt   — hela tjänsten: kanaler, sport, film och serier.
 *   sport  — bara sporten. Kanalerna och matcherna ingår, katalogen inte.
 *
 * Skillnaden finns för att Telia säljer sportnivåer av tjänster som också har
 * film och serier, och för en abonnent är det inte samma sak att "ha Viaplay"
 * som att kunna se Viaplays filmer.
 */
export type Omfattning = "allt" | "sport";

export interface PaketTjanst {
  id: TjanstId;
  omfattning: Omfattning;
  /** Vad som INTE ingår, med Telias egna ord. Visas på /ingar. */
  anmarkning?: string;
}

export interface Paket {
  id: string;
  namn: string;
  /** När innehållet senast stämdes av mot Telias egna sidor. */
  avskrivet: string;
  /** Var uppgiften kommer ifrån, så att den går att kontrollera. */
  kalla: string;
  tjanster: PaketTjanst[];
}

export const PAKET: Paket[] = [
  {
    id: "stora-sportpaketet",
    namn: "Stora sportpaketet",
    avskrivet: "2026-08",
    kalla: "telia.se/tv/sport/stora-sportpaketet",
    tjanster: [
      {
        id: "viaplay",
        omfattning: "sport",
        anmarkning: "Viaplay Sport, utan reklam. Film och serier ingår inte.",
      },
      {
        id: "tv4play",
        omfattning: "sport",
        anmarkning: "TV4 Play Sport Fotboll med reklam. Inte hela TV4 Play.",
      },
      { id: "max", omfattning: "allt", anmarkning: "HBO Max Basic med reklam." },
      { id: "disney", omfattning: "allt", anmarkning: "Disney+ Standard med reklam." },
      {
        id: "prime",
        omfattning: "allt",
        anmarkning:
          "Amazon Prime med reklam. Det som kostar extra hos Prime (hyra, köp, " +
          "Prime-kanaler) hämtas aldrig — appen frågar bara efter det som ingår i abonnemanget.",
      },
    ],
  },
];

export function paket(id: string): Paket | undefined {
  return PAKET.find((p) => p.id === id);
}
