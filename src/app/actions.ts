"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "@/lib/db";
import { PROFIL_COOKIE, aktivProfil } from "@/lib/profil";
import { spela as bryggSpela } from "@/lib/bridge";
import { lankTill } from "@/lib/deeplink";
import { kryptera, pinHash, pinStammer } from "@/lib/vault";
import { BLOCK } from "@/content/block";
import { lagNyckel } from "@/lib/match";

/* --------------------------------------------------------------- profiler */

export async function valjProfil(id: string): Promise<void> {
  const store = await cookies();
  store.set(PROFIL_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}

/**
 * Skapar en profil och ger den standarduppsättningen block.
 *
 * Att fylla i blocken direkt i stället för att låta startsidan vara tom är
 * skillnaden mellan en app som fungerar från första sekunden och en som kräver
 * att du bygger den själv innan den visar något.
 */
export async function skapaProfil(formData: FormData): Promise<void> {
  await ensureSchema();

  const namn = String(formData.get("namn") ?? "").trim();
  if (!namn) return;

  const farg = String(formData.get("farg") ?? "#a06bff");
  const id = crypto.randomUUID();

  await sql`insert into profil (id, namn, farg) values (${id}, ${namn}, ${farg})`;

  for (const [i, b] of BLOCK.entries()) {
    await sql`
      insert into block (profil_id, sort, ordning, aktiv)
      values (${id}, ${b.sort}, ${i * 10}, ${b.standard})
      on conflict (profil_id, sort) do nothing
    `;
  }

  await valjProfil(id);
  revalidatePath("/", "layout");
}

export async function dopOmProfil(formData: FormData): Promise<void> {
  await ensureSchema();
  const id = String(formData.get("id") ?? "");
  const namn = String(formData.get("namn") ?? "").trim();
  if (!id || !namn) return;

  await sql`update profil set namn = ${namn} where id = ${id}`;
  revalidatePath("/", "layout");
}

/* -------------------------------------------------------------- favoriter */

export async function vaxlaFavorit(sort: string, refId: string): Promise<void> {
  const profil = await aktivProfil();
  if (!profil) return;

  const borttagna = await sql`
    delete from favorit
    where profil_id = ${profil.id} and sort = ${sort} and ref_id = ${refId}
  `;

  if (borttagna.count === 0) {
    await sql`
      insert into favorit (profil_id, sort, ref_id)
      values (${profil.id}, ${sort}, ${refId})
      on conflict do nothing
    `;
  }

  revalidatePath("/", "layout");
}

/**
 * Lägger till ett favoritlag.
 *
 * Laget skrivs in i `lag` med sitt TheSportsDB-id om det inte redan finns.
 * Matchhämtningen plockar sedan upp det vid nästa körning — favoritlag utan
 * matcher är alltså normalt i upp till tjugo minuter, och sportsidan säger det
 * i stället för att se tom och trasig ut.
 */
export async function laggTillLag(formData: FormData): Promise<void> {
  const profil = await aktivProfil();
  if (!profil) return;

  const sportsdbId = String(formData.get("sportsdbId") ?? "").trim();
  const namn = String(formData.get("namn") ?? "").trim();
  const ligaId = String(formData.get("ligaId") ?? "").trim() || null;
  if (!sportsdbId || !namn) return;

  const id = `lag:${sportsdbId}`;
  await sql`
    insert into lag (id, sportsdb_id, namn, namn_key, liga_id)
    values (${id}, ${sportsdbId}, ${namn}, ${lagNyckel(namn)}, ${ligaId})
    on conflict (id) do update set namn = excluded.namn
  `;
  await sql`
    insert into favorit (profil_id, sort, ref_id) values (${profil.id}, 'lag', ${id})
    on conflict do nothing
  `;

  revalidatePath("/sport");
}

/* ----------------------------------------------------------- ingår-listan */

/**
 * Kryssar i alla tjänster i ett av Telias paket.
 *
 * Bara i, aldrig ur. Listan i content/paket.ts är avskriven från Telias app en
 * given dag och kan vara inaktuell — och en genväg som RADERAR något du själv
 * kryssat i vore ett sämre byte än de tio minuter den sparar.
 */
export async function kryssaPaket(paketId: string): Promise<void> {
  await ensureSchema();

  const { paket } = await import("@/content/paket");
  const p = paket(paketId);
  if (!p) return;

  for (const tjanstId of p.tjanster) {
    await sql`
      update tjanst
      set ingar = true, kalla = 'manuell', verifierad_at = now()
      where id = ${tjanstId} and ingar = false
    `;
  }

  revalidatePath("/ingar");
  revalidatePath("/", "layout");
}

/**
 * Kryssar i eller ur en tjänst.
 *
 * Katalogen för en nyss ikryssad tjänst finns inte förrän en full hämtning
 * körts — det är därför /ingar pekar på Uppdatera-knappen i stället för att
 * lämna en tom lista och låta dig undra.
 */
export async function vaxlaTjanst(id: string, ingar: boolean): Promise<void> {
  await ensureSchema();

  await sql`
    update tjanst set ingar = ${ingar}, kalla = 'manuell', verifierad_at = now()
    where id = ${id}
  `;

  // Kryssar du i en tjänst för hand menar du rimligen dess kanaler också.
  // Kryssar du ur den ska ingenting från den kunna visas — därför slås även
  // kanalerna av, inte bara tjänsten.
  await sql`update kanal set ingar = ${ingar} where tjanst_id = ${id}`;

  revalidatePath("/", "layout");
}

export async function vaxlaKanal(id: string, ingar: boolean): Promise<void> {
  await ensureSchema();
  await sql`update kanal set ingar = ${ingar}, kalla = 'manuell' where id = ${id}`;
  revalidatePath("/", "layout");
}

/** Kopplar en av våra kanaler till tv.nu:s id när namnmatchningen missat. */
export async function kopplaKanal(formData: FormData): Promise<void> {
  await ensureSchema();
  const id = String(formData.get("id") ?? "");
  const tvnuId = String(formData.get("tvnuId") ?? "").trim();
  if (!id || !tvnuId) return;

  await sql`update kanal set tvnu_id = ${tvnuId} where id = ${id}`;
  revalidatePath("/ingar");
}

/* ------------------------------------------------------------- startsidan */

export async function sparaBlock(formData: FormData): Promise<void> {
  const profil = await aktivProfil();
  if (!profil) return;

  for (const b of BLOCK) {
    const aktiv = formData.get(`aktiv:${b.sort}`) !== null;
    const ordning = Number(formData.get(`ordning:${b.sort}`) ?? 100);

    await sql`
      insert into block (profil_id, sort, ordning, aktiv)
      values (${profil.id}, ${b.sort}, ${ordning}, ${aktiv})
      on conflict (profil_id, sort) do update set
        ordning = excluded.ordning,
        aktiv   = excluded.aktiv
    `;
  }

  revalidatePath("/");
}

/* ------------------------------------------------------------------ spela */

export interface SpelaSvar {
  ok: boolean;
  meddelande: string;
  /** Länken att falla tillbaka på när bryggan inte svarar. */
  lank: string | null;
}

/**
 * Startar något på tv:n.
 *
 * Tre saker händer, i den ordningen: länken byggs, bryggan får ett försök, och
 * oavsett utfall sparas en rad i `sett` med status 'startad'. Den raden är vad
 * "Fortsätt titta" och kostnadsvyn bygger på — och den ska skrivas även när
 * bryggan är nere, eftersom du då startade innehållet via länken i stället.
 */
export async function spelaPaTv(
  tjanstId: string,
  opts: {
    url?: string | null;
    titelId?: string | null;
    namn?: string | null;
    refId?: string;
    sort?: string;
  } = {},
): Promise<SpelaSvar> {
  const lank = lankTill(tjanstId, { url: opts.url, titelId: opts.titelId, namn: opts.namn });
  if (!lank) return { ok: false, meddelande: "Okänd tjänst.", lank: null };

  const profil = await aktivProfil();
  if (profil && opts.refId && opts.sort) {
    await sql`
      insert into sett (profil_id, sort, ref_id, status, at)
      values (${profil.id}, ${opts.sort}, ${opts.refId}, 'startad', now())
      on conflict (profil_id, sort, ref_id) do update set at = now(), status = 'startad'
    `.catch(() => {});
  }

  const svar = await bryggSpela({ deeplink: lank.url, appleTvApp: lank.appleTvApp });
  return { ok: svar.ok, meddelande: svar.meddelande, lank: lank.url };
}

export async function markeraSedd(sort: string, refId: string): Promise<void> {
  const profil = await aktivProfil();
  if (!profil) return;

  await sql`
    insert into sett (profil_id, sort, ref_id, status, at)
    values (${profil.id}, ${sort}, ${refId}, 'sedd', now())
    on conflict (profil_id, sort, ref_id) do update set status = 'sedd', at = now()
  `;
  revalidatePath("/");
}

/* ------------------------------------------------------------------ valvet */

export async function sparaKonto(formData: FormData): Promise<void> {
  await ensureSchema();

  const tjanstId = String(formData.get("tjanstId") ?? "");
  if (!tjanstId) return;

  const agare = String(formData.get("agare") ?? "").trim() || null;
  const epost = String(formData.get("epost") ?? "").trim() || null;
  const losen = String(formData.get("losen") ?? "");
  const totp = String(formData.get("totp") ?? "").trim();
  const notering = String(formData.get("notering") ?? "").trim() || null;

  // Tomt fält betyder "rör inte det som redan ligger där", inte "radera".
  // Annars raderas lösenordet varje gång man rättar en stavning i e-posten.
  const losenKrypt = losen ? kryptera(losen) : null;
  const totpKrypt = totp ? kryptera(totp) : null;

  await sql`
    insert into konto (id, tjanst_id, agare, epost, losen_krypt, totp_krypt, notering)
    values (${`konto:${tjanstId}`}, ${tjanstId}, ${agare}, ${epost}, ${losenKrypt}, ${totpKrypt}, ${notering})
    on conflict (id) do update set
      agare       = excluded.agare,
      epost       = excluded.epost,
      losen_krypt = coalesce(excluded.losen_krypt, konto.losen_krypt),
      totp_krypt  = coalesce(excluded.totp_krypt, konto.totp_krypt),
      notering    = excluded.notering,
      uppdaterad_at = now()
  `;

  revalidatePath("/valv");
}

/**
 * Sätter, byter eller tar bort valvets PIN.
 *
 * Den kunde bara SÄTTAS förut, aldrig ändras eller tas bort. Glömde man den
 * var valvet stängt för gott — allt låg kvar krypterat i databasen, oåtkomligt
 * från appen, och enda vägen tillbaka gick genom en sql-fråga mot Postgres.
 * Det är en fälla att bygga in i något två kompisar delar.
 *
 * Att byta kräver att valvet redan är upplåst, alltså att man nyss skrivit den
 * gamla koden. Utan den kontrollen räcker det att någon får tag i adressen för
 * att låsa om valvet till en kod bara de känner till.
 */
export async function sattPin(formData: FormData): Promise<void> {
  const profil = await aktivProfil();
  if (!profil) return;

  if (profil.harPin) {
    const store = await cookies();
    if (store.get(`tp_valv_${profil.id}`)?.value !== "1") return;
  }

  const pin = String(formData.get("pin") ?? "").trim();

  // Tomt fält på ett upplåst valv betyder "ta bort låset".
  if (pin === "" && profil.harPin) {
    await sql`update profil set pin_hash = null where id = ${profil.id}`;
    revalidatePath("/valv");
    return;
  }

  if (!/^\d{4,8}$/.test(pin)) return;

  await sql`update profil set pin_hash = ${pinHash(pin)} where id = ${profil.id}`;
  revalidatePath("/valv");
}

/**
 * Låser upp valvet för den här webbläsaren.
 *
 * Upplåsningen ligger i en cookie som lever en timme. Inte längre: valvet är
 * det enda i appen som är värt att skydda, och en app som ligger olåst i
 * telefonens flikhistorik i en vecka skyddar ingenting.
 */
export async function lasUpp(formData: FormData): Promise<{ ok: boolean }> {
  const profil = await aktivProfil();
  if (!profil) return { ok: false };

  const pin = String(formData.get("pin") ?? "");
  const rad = await sql<{ pin_hash: string | null }[]>`
    select pin_hash from profil where id = ${profil.id}
  `;

  const hash = rad[0]?.pin_hash;
  if (!hash || !pinStammer(pin, hash)) return { ok: false };

  const store = await cookies();
  store.set(`tp_valv_${profil.id}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/valv");
  return { ok: true };
}

/* ------------------------------------------------------------- hämtning nu */

/**
 * Hämta nu — och då menas ALLT, film- och seriekatalogen inkluderad.
 *
 * Den körde "snabb" förut, vilket hoppar över TMDB. Det är rätt för
 * schemaläggaren, som går var tjugonde minut mot en källa som ändå bara
 * uppdateras en gång per dygn. Men det gjorde knappen obrukbar för det den
 * faktiskt trycks för: man kryssar i en tjänst på /ingar, trycker Uppdatera,
 * och ingenting händer — katalogen kommer först vid nästa dygnskörning, och
 * appen ser trasig ut i mellantiden.
 *
 * En knapp man trycker på själv är sällsynt nog att få kosta en full hämtning.
 */
export async function hamtaNu(): Promise<void> {
  const { hamtaAllt } = await import("@/lib/ingest");
  await hamtaAllt("full");
  revalidatePath("/", "layout");
}
