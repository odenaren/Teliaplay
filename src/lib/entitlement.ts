/**
 * Ingår-filtret. Appens enda egentliga regel.
 *
 * Allt som visas måste kunna peka på en tjänst eller kanal som du betalar för.
 * Saknas beviset visas posten inte alls — inte gråad, inte med hänglås, inte
 * "uppgradera för att se". Borta.
 *
 * Regeln ligger här och ingen annanstans. Frestelsen är att skriva
 * `if (kanal.ingar)` direkt i en komponent, och efter tjugo komponenter är det
 * omöjligt att svara på frågan "kan något otillåtet slinka igenom?". Med en
 * funktion är svaret ett skript bort, se scripts/check-entitlements.mjs.
 *
 * Fallriktningen är medvetet obekväm: vet vi inte, visar vi inte. Ett
 * bortfiltrerat program du hade kunnat se kostar en sökning. Ett felaktigt
 * visat program kostar exakt det irritationsmoment appen finns för att slippa.
 */

import { ALLTID_INGAR } from "@/content/tjanster";

/**
 * Ögonblicksbild av vad som ingår, läst en gång per sidladdning och skickad
 * ned genom vyerna. Att fråga databasen per post vore hundratals frågor för
 * en tablåsida.
 */
export interface IngarKarta {
  tjanster: Set<string>;
  kanaler: Set<string>;
  /** När uppgifterna senast bekräftades mot Telia. null = aldrig. */
  verifierad: Date | null;
}

export const TOM_KARTA: IngarKarta = {
  tjanster: new Set(ALLTID_INGAR),
  kanaler: new Set(),
  verifierad: null,
};

/** Ingår tjänsten? */
export function tjanstIngar(karta: IngarKarta, tjanstId: string | null | undefined): boolean {
  if (!tjanstId) return false;
  return karta.tjanster.has(tjanstId);
}

/** Ingår kanalen? Både kanalen själv och dess tjänst måste vara med. */
export function kanalIngar(
  karta: IngarKarta,
  kanal: { id: string; tjanst_id: string } | null | undefined,
): boolean {
  if (!kanal) return false;
  return karta.kanaler.has(kanal.id) && tjanstIngar(karta, kanal.tjanst_id);
}

/**
 * Den gemensamma ingången. Allt som ska renderas passerar här.
 *
 * `ref` beskriver var posten kommer ifrån. En post utan vare sig kanal eller
 * tjänst är per definition obevisad och släpps aldrig igenom.
 */
export function ingar(
  karta: IngarKarta,
  ref: { kanalId?: string | null; tjanstId?: string | null },
): boolean {
  if (ref.kanalId && karta.kanaler.has(ref.kanalId)) {
    // Kanalen är redan kontrollerad mot sin tjänst när kartan byggdes.
    return true;
  }
  if (ref.tjanstId) return tjanstIngar(karta, ref.tjanstId);
  return false;
}

/**
 * Filtrera en lista. Kortare än att skriva samma filter på tolv ställen, och
 * gör att `ingar()` blir det enda anropet som behöver granskas.
 */
export function baraIngar<T>(
  karta: IngarKarta,
  poster: T[],
  ref: (post: T) => { kanalId?: string | null; tjanstId?: string | null },
): T[] {
  return poster.filter((p) => ingar(karta, ref(p)));
}

/**
 * Hur gammal ingår-uppgiften är, i dagar. Över en vecka och /ingar börjar
 * påminna: automatiken kan ha slutat fungera utan att säga något.
 */
export function alderDagar(karta: IngarKarta): number | null {
  if (!karta.verifierad) return null;
  return Math.floor((Date.now() - karta.verifierad.getTime()) / 86_400_000);
}
