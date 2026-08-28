/**
 * Tid, svensk.
 *
 * Allt i appen räknas i Europe/Stockholm. Servern kan stå var som helst —
 * Railway kör UTC — så tidszonen får aldrig komma från maskinen. Den står här.
 */

export const TZ = "Europe/Stockholm";

function parts(date: Date): Record<string, number> {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

/** "2026-08-22" i svensk tid. */
export function dayKey(date: Date = new Date()): string {
  const p = parts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Tv-dygnet, som inte är samma sak som kalenderdygnet.
 *
 * En film som börjar 23:30 på fredagen och slutar 01:20 hör till fredagens
 * tablå, inte lördagens. Alla tablåer i Sverige drar gränsen runt 06:00 och
 * appen gör likadant — annars ligger sena matcher på "fel" dag och du hittar
 * dem inte där du letar.
 */
export const TV_DAY_START_HOUR = 6;

export function tvDayKey(date: Date = new Date()): string {
  const p = parts(date);
  if (p.hour >= TV_DAY_START_HOUR) return dayKey(date);
  return dayKey(new Date(date.getTime() - 24 * 3600_000));
}

/** Start och slut för ett tv-dygn, som riktiga tidpunkter. */
export function tvDayRange(key: string): { from: Date; to: Date } {
  const [y, m, d] = key.split("-").map(Number);
  // Bygg tidpunkten via en UTC-gissning och justera med den faktiska
  // förskjutningen — sommartid gör att 06:00 svensk tid inte alltid är samma
  // antal timmar från UTC.
  const guess = Date.UTC(y, m - 1, d, TV_DAY_START_HOUR, 0);
  const offset = offsetMinutes(new Date(guess));
  const from = new Date(guess - offset * 60_000);
  return { from, to: new Date(from.getTime() + 24 * 3600_000) };
}

function offsetMinutes(date: Date): number {
  const p = parts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
}

const timeFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "20:45" */
export function klockan(date: Date): string {
  return timeFmt.format(date);
}

/** "idag", "imorgon" eller "lördag 24 augusti". */
export function dagEtikett(key: string): string {
  const idag = tvDayKey();
  if (key === idag) return "idag";

  const { from } = tvDayRange(key);
  const imorgon = tvDayKey(new Date(Date.now() + 24 * 3600_000));
  if (key === imorgon) return "imorgon";

  return dateFmt.format(from);
}

/**
 * Samma etikett, men för en tidpunkt — och då kan den säga "inatt".
 *
 * Tv-dygnet slutar 06:00, så en match 00:27 hör till gårdagens tablå och får
 * etiketten "idag". Det är rätt enligt tablåns logik och läses ändå som fel:
 * "00:27 idag" om en match som är tre timmar bort ser ut som något som redan
 * varit. "inatt" är samma uppgift, utan tvetydigheten.
 */
export function dagEtikettFor(date: Date): string {
  const key = tvDayKey(date);
  const timme = parts(date).hour;

  if (key === tvDayKey() && timme < TV_DAY_START_HOUR) return "inatt";

  return dagEtikett(key);
}

/** "om 12 min", "om 3 tim", "pågår", "slut". */
export function relativt(start: Date, slut?: Date | null): string {
  const nu = Date.now();
  if (slut && nu >= slut.getTime()) return "slut";
  if (nu >= start.getTime()) return "pågår";

  const min = Math.round((start.getTime() - nu) / 60_000);
  if (min < 60) return `om ${min} min`;
  const tim = Math.round(min / 60);
  if (tim < 24) return `om ${tim} tim`;
  return `om ${Math.round(tim / 24)} dygn`;
}

/** Pågår sändningen just nu? */
export function pagar(start: Date, slut?: Date | null): boolean {
  const nu = Date.now();
  return nu >= start.getTime() && (!slut || nu < slut.getTime());
}

/** Hur långt in i sändningen vi är, 0–1. För förloppsindikatorn. */
export function forlopp(start: Date, slut?: Date | null): number {
  if (!slut) return 0;
  const total = slut.getTime() - start.getTime();
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (Date.now() - start.getTime()) / total));
}
