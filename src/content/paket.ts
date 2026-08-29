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

export interface Paket {
  id: string;
  namn: string;
  /** När innehållet senast stämdes av mot Telias app. */
  avskrivet: string;
  tjanster: TjanstId[];
}

export const PAKET: Paket[] = [
  {
    id: "stora-sportpaketet",
    namn: "Stora sportpaketet",
    avskrivet: "2026-08",
    tjanster: ["viaplay", "tv4play", "max", "prime", "disney"],
  },
];

export function paket(id: string): Paket | undefined {
  return PAKET.find((p) => p.id === id);
}
