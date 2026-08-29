/**
 * Tv-tablån, från tv.nu:s webb-API.
 *
 * Två endpoints:
 *   GET /tableauLinearChannels        — kanallistan, sidindelad
 *   GET /channels/{id}/schedule       — en kanals dag
 *
 * Samma endpoints som iptv-org/epg använder i sin tv.nu-grabber, vilket är
 * skälet till att de är valda: någon annan håller redan koll på om de ändras.
 *
 * VARNING OM FORMATET. Adaptern är skriven mot dokumenterad struktur, inte mot
 * ett svar som körts i den här maskinen — nätverket där den skrevs släppte inte
 * igenom tv.nu. Därför är parsningen medvetet tolerant: den letar efter fältet
 * på flera rimliga platser i stället för att kräva en exakt form, och
 * `npm run probe` skriver ut det faktiska svaret så att du kan rätta den på
 * fem minuter om något ligger någon annanstans.
 *
 * Datan används i din egen installation. Den republiceras inte.
 */

import { fetchJson, plocka } from "./http";
import { kanalNyckel } from "@/content/kanaler";

const BAS = "https://web-api.tv.nu";

/*
 * tv.nu kräver en `modules`-parameter, och säger det bara när den saknas:
 *
 *   {"meta":{"status":400,"code":"E_VALIDATION",
 *            "message":"modules: Detta fält är obligatoriskt"}}
 *
 * Vilka värden den godtar står ingenstans — API:et är odokumenterat, och
 * felmeddelandet räknar inte upp alternativen. Att gissa ett värde och
 * hårdkoda det vore att bygga in nästa tysta haveri: gissar vi fel får vi
 * samma 400 igen, utan att någon förstår varför.
 *
 * Därför provar adaptern kandidaterna i tur och ordning och KOMMER IHÅG den
 * som fungerade, så att det kostar ett extra anrop en gång per process och
 * inte ett per hämtning. Fungerar ingen kastas det sista felet med svarets
 * egen text, som då är det bästa underlaget som finns.
 */
const MODULKANDIDATER: Record<string, string[]> = {
  kanaler: ["channels", "tableauLinearChannels", "tableau", "linearChannels", "all"],
  tabla: ["broadcasts", "schedule", "programs", "tableau", "all"],
};

const fungerandeModul: Record<string, string | undefined> = {};

/**
 * Hämtar med `modules` ifyllt, och lär sig vilket värde värden godtar.
 *
 * `bygg` får värdet och returnerar hela adressen, eftersom parametern ska in
 * bland de andra och inte alltid sist.
 */
async function medModul(sort: keyof typeof MODULKANDIDATER, bygg: (modul: string) => string) {
  const kant = fungerandeModul[sort];
  const kandidater = kant ? [kant] : MODULKANDIDATER[sort];

  let sistaFel: unknown;
  for (const modul of kandidater) {
    try {
      const svar = await fetchJson(bygg(modul));
      if (fungerandeModul[sort] !== modul) {
        console.log(`[tv.nu] modules=${modul} fungerar för ${sort}`);
        fungerandeModul[sort] = modul;
      }
      return svar;
    } catch (err) {
      sistaFel = err;
      // Ett 400 betyder fel modulnamn — prova nästa. Allt annat (403, 500,
      // nätverksfel) är inte något ett annat modulnamn löser.
      if (!(err instanceof Error) || !/HTTP 400/.test(err.message)) throw err;
    }
  }

  // Glöm det inlärda värdet: slutade det fungera ska nästa körning prova om.
  fungerandeModul[sort] = undefined;
  throw sistaFel;
}

export interface TvnuKanal {
  id: string;
  namn: string;
  logo?: string;
}

export interface TvnuProgram {
  titel: string;
  start: Date;
  slut: Date | null;
  beskrivning?: string;
  genre?: string;
  sasong?: number;
  avsnitt?: number;
  bild?: string;
}

/**
 * Hela kanallistan.
 *
 * Sidindelad med `limit`/`offset`. Vi hämtar tills en sida kommer tillbaka
 * tom eller kortare än limiten — inte tills ett fast antal sidor, eftersom
 * antalet kanaler ändras.
 */
export async function hamtaKanaler(): Promise<TvnuKanal[]> {
  const ut: TvnuKanal[] = [];
  const limit = 12;

  for (let offset = 0; offset < 400; offset += limit) {
    const svar = await medModul(
      "kanaler",
      (modul) =>
        `${BAS}/tableauLinearChannels?date=${idag()}&limit=${limit}&offset=${offset}` +
        `&modules=${encodeURIComponent(modul)}`,
    );
    const sida = kanalerUr(svar);
    ut.push(...sida);
    if (sida.length < limit) break;
  }

  return ut;
}

function kanalerUr(svar: unknown): TvnuKanal[] {
  const lista =
    (plocka(svar, "channels", "data.channels", "data", "items") as unknown[]) ?? [];
  if (!Array.isArray(lista)) return [];

  const ut: TvnuKanal[] = [];
  for (const rad of lista) {
    const id = plocka(rad, "slug", "id", "channelId", "channel.slug", "channel.id");
    const namn = plocka(rad, "name", "title", "channel.name", "displayName");
    if (typeof id !== "string" && typeof id !== "number") continue;
    if (typeof namn !== "string") continue;

    const logo = plocka(rad, "logo", "image", "channel.logo", "images.logo");
    ut.push({
      id: String(id),
      namn,
      logo: typeof logo === "string" ? logo : undefined,
    });
  }
  return ut;
}

/** En kanals sändningar för ett datum ("2026-08-22"). */
export async function hamtaTabla(kanalId: string, datum: string): Promise<TvnuProgram[]> {
  const svar = await medModul(
    "tabla",
    (modul) =>
      `${BAS}/channels/${encodeURIComponent(kanalId)}/schedule?date=${datum}&fullDay=true` +
      `&modules=${encodeURIComponent(modul)}`,
  );
  return programUr(svar);
}

function programUr(svar: unknown): TvnuProgram[] {
  const lista =
    (plocka(
      svar,
      "broadcasts",
      "data.broadcasts",
      "channel.broadcasts",
      "data.channel.broadcasts",
      "schedule",
    ) as unknown[]) ?? [];
  if (!Array.isArray(lista)) return [];

  const ut: TvnuProgram[] = [];
  for (const rad of lista) {
    const titel = plocka(rad, "title", "program.title", "name");
    const start = plocka(rad, "startTime", "start", "broadcast.startTime");
    if (typeof titel !== "string" || !titel.trim()) continue;
    if (typeof start !== "string" && typeof start !== "number") continue;

    const startDate = tolkaTid(start);
    if (!startDate) continue;

    const slut = plocka(rad, "endTime", "stop", "end");
    const genre = plocka(rad, "genres.0", "genre", "program.genre", "category");
    const sasong = plocka(rad, "season", "program.season", "seasonNumber");
    const avsnitt = plocka(rad, "episode", "program.episode", "episodeNumber");
    const bild = plocka(rad, "image", "images.main", "program.image");
    const beskrivning = plocka(rad, "description", "program.description", "synopsis");

    ut.push({
      titel: titel.trim(),
      start: startDate,
      slut: tolkaTid(slut),
      beskrivning: typeof beskrivning === "string" ? beskrivning : undefined,
      genre: typeof genre === "string" ? genre : undefined,
      sasong: Number.isFinite(Number(sasong)) ? Number(sasong) : undefined,
      avsnitt: Number.isFinite(Number(avsnitt)) ? Number(avsnitt) : undefined,
      bild: typeof bild === "string" ? bild : undefined,
    });
  }
  return ut;
}

/**
 * Tolkar en tidsstämpel som antingen ISO-sträng eller epok-sekunder.
 *
 * Skillnaden mellan sekunder och millisekunder är den klassiska fällan: ett
 * epokvärde i sekunder tolkat som millisekunder landar 1970 och programmet
 * försvinner tyst ur tablån. Gränsen nedan är "år 2001 i millisekunder".
 */
function tolkaTid(varde: unknown): Date | null {
  if (typeof varde === "number") {
    const ms = varde < 1e11 ? varde * 1000 : varde;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof varde === "string") {
    const d = new Date(varde);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function idag(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Matchar våra kanaler mot tv.nu:s lista på normaliserat namn.
 *
 * Returnerar både träffarna och det som blev över åt båda hållen. De
 * omatchade är inte ett fel att logga och glömma — de visas på /ingar där du
 * kopplar dem för hand en gång.
 */
export function matchaKanaler(
  vara: { id: string; nycklar: string[] }[],
  tvnu: TvnuKanal[],
): { traffar: Map<string, TvnuKanal>; omatchade: string[] } {
  const index = new Map<string, TvnuKanal>();
  for (const k of tvnu) index.set(kanalNyckel(k.namn), k);

  const traffar = new Map<string, TvnuKanal>();
  const omatchade: string[] = [];

  for (const v of vara) {
    const traff = v.nycklar.map((n) => index.get(n)).find(Boolean);
    if (traff) traffar.set(v.id, traff);
    else omatchade.push(v.id);
  }

  return { traffar, omatchade };
}
