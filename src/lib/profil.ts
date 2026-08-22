/**
 * Vem som tittar.
 *
 * Två personer delar appen och ska inte dela favoriter, favoritlag eller
 * startsida. Men de är två kompisar som delar ett tv-paket, inte två kunder
 * hos en bank: en inloggning med lösenord vore fel verktyg och skulle mest
 * göra att ingen orkar öppna appen.
 *
 * Lösningen är en cookie som pekar ut vald profil och en växel i navet. Ingen
 * autentisering — den som har adressen kan byta profil. Det är avsiktligt.
 * Det enda som faktiskt är låst är valvet, och det ligger bakom en PIN.
 */

import { cookies } from "next/headers";
import { sql, ensureSchema } from "./db";
import type { Profil } from "./types";

export const PROFIL_COOKIE = "tp_profil";

/** Läser vald profil ur cookien. null om ingen valts än. */
export async function valdProfilId(): Promise<string | null> {
  const store = await cookies();
  return store.get(PROFIL_COOKIE)?.value ?? null;
}

/**
 * Profilen för den här förfrågan.
 *
 * Faller tillbaka på den först skapade profilen när cookien saknas eller pekar
 * på en profil som tagits bort. En helt tom databas ger null, och då visar
 * appen uppstartsguiden i stället.
 */
export async function aktivProfil(): Promise<Profil | null> {
  await ensureSchema();
  const id = await valdProfilId();

  const rader = await sql<
    { id: string; namn: string; farg: string; pin_hash: string | null }[]
  >`
    select id, namn, farg, pin_hash
    from profil
    order by skapad
  `;

  if (rader.length === 0) return null;
  const vald = rader.find((r) => r.id === id) ?? rader[0];

  return { id: vald.id, namn: vald.namn, farg: vald.farg, harPin: Boolean(vald.pin_hash) };
}

export async function allaProfiler(): Promise<Profil[]> {
  await ensureSchema();
  const rader = await sql<
    { id: string; namn: string; farg: string; pin_hash: string | null }[]
  >`select id, namn, farg, pin_hash from profil order by skapad`;

  return rader.map((r) => ({
    id: r.id,
    namn: r.namn,
    farg: r.farg,
    harPin: Boolean(r.pin_hash),
  }));
}
