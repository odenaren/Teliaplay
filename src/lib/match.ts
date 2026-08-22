/**
 * Kopplar en sportmatch till sin sändning.
 *
 * Det här är appens svåraste beräkning, och den enda som får bli fel utan att
 * något går sönder — men den avgör om appen är användbar. TheSportsDB vet att
 * Djurgården möter Hammarby 20:10 på söndag. Tablån vet att "Fotboll: Djurgården
 * - Hammarby" sänds 20:00 på TV4 Fotboll. Ingen av dem vet om den andra.
 *
 * Regeln: båda lagnamnen ska finnas i programtiteln, och sändningen ska börja
 * inom ett rimligt fönster runt matchstarten. Båda villkoren behövs. Bara
 * namnen matchar även studiosammanfattningen på söndagskvällen; bara tiden
 * matchar vilken match som helst i samma tidsblock.
 *
 * Tvetydiga fall — flera program som uppfyller båda villkoren — löses genom att
 * välja den sändning som börjar närmast matchstarten. Det är nästan alltid
 * själva matchen; repriser och sammandrag ligger längre bort.
 */

const FONSTER_MS = 90 * 60_000;

/**
 * Normaliserad nyckel för lag- och titeljämförelse.
 *
 * Suffix som "IF", "FC", "BK" tas bort: tablån skriver "Djurgården" där
 * TheSportsDB skriver "Djurgardens IF", och utan normalisering matchar de
 * aldrig. Å/Ä/Ö fälls ihop med a/o av samma skäl — engelska källor stavar dem
 * utan prickar.
 */
export function lagNyckel(namn: string): string {
  return namn
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/\b(if|fc|bk|sk|aik|ff|fk|hc|united|city|club|cf|sc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Samma normalisering för en programtitel, men utan att klippa bort ord. */
export function titelNyckel(titel: string): string {
  return titel
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export interface Kandidat {
  id: string;
  kanalId: string;
  titel_key: string;
  start: Date;
}

/**
 * Hittar sändningen för en match bland kandidatprogrammen.
 *
 * `kandidater` ska redan vara begränsade till kanaler som ingår — den här
 * funktionen avgör vilken sändning det är, inte om du får se den.
 */
export function hittaSandning(
  match: { hemma: string; borta: string; start: Date },
  kandidater: Kandidat[],
): Kandidat | null {
  const hemma = lagNyckel(match.hemma);
  const borta = lagNyckel(match.borta);
  if (!hemma || !borta) return null;

  const traffar = kandidater.filter((k) => {
    const nara = Math.abs(k.start.getTime() - match.start.getTime()) <= FONSTER_MS;
    if (!nara) return false;
    return k.titel_key.includes(hemma) && k.titel_key.includes(borta);
  });

  if (traffar.length === 0) return null;

  return traffar.reduce((bast, k) =>
    Math.abs(k.start.getTime() - match.start.getTime()) <
    Math.abs(bast.start.getTime() - match.start.getTime())
      ? k
      : bast,
  );
}

/**
 * Krockar två matcher i tid?
 *
 * Underlaget för konfliktvarningen: två favoritlag som spelar samtidigt är
 * information du vill ha på förhand, inte upptäcka 20:45.
 */
export function krockar(
  a: { start: Date },
  b: { start: Date },
  langdMin = 105,
): boolean {
  const slutA = a.start.getTime() + langdMin * 60_000;
  const slutB = b.start.getTime() + langdMin * 60_000;
  return a.start.getTime() < slutB && b.start.getTime() < slutA;
}
