/**
 * Valvet: lösenorden till tjänsterna, krypterade.
 *
 * Problemet det löser är litet men verkligt. Apple TV loggar ut dig ur Viaplay
 * en gång i halvåret, alltid mitt i en matchstart, och lösenordet ligger i ett
 * mejl från 2023 eller i huvudet på din kompis. Fem minuter senare har du
 * struntat i matchen.
 *
 * SÅ HÄR ÄR DET BYGGT
 *
 * AES-256-GCM, nyckeln i miljövariabeln VAULT_KEY och ingen annanstans. En
 * databasdump utan nyckeln är obrukbar. GCM och inte CBC för att GCM upptäcker
 * manipulation — ett ändrat chiffertextblock ger ett fel i stället för skräp
 * som råkar avkrypteras.
 *
 * Varje hemlighet får sin egen slumpade IV. Att återanvända en IV med samma
 * nyckel i GCM är inte en skönhetsfläck utan ett fullständigt haveri: två
 * meddelanden med samma IV går att räkna ut mot varandra. Därför slumpas den
 * per skrivning, aldrig per nyckel.
 *
 * VAD DET INTE ÄR
 *
 * Det är ingen lösenordshanterare. Det finns ingen delning, ingen synk, ingen
 * granskningslogg. Det är en låda för ett tiotal inloggningar som du och en
 * kompis redan delar, på en tjänst ni själva driver. Är det för svagt för din
 * smak: sätt inga lösenord alls i valvet och använd bara /valv för
 * återställningslänkarna. Den halvan fungerar utan nyckel.
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const ALGO = "aes-256-gcm";

function nyckel(): Buffer {
  const rå = process.env.VAULT_KEY;
  if (!rå) {
    throw new Error(
      "VAULT_KEY saknas. Generera en med `npm run vault:key` och lägg i .env. " +
        "Utan den kan valvet inte kryptera något.",
    );
  }
  const buf = Buffer.from(rå, "base64");
  if (buf.length !== 32) {
    throw new Error(`VAULT_KEY ska vara 32 byte base64-kodat, fick ${buf.length} byte.`);
  }
  return buf;
}

export function harNyckel(): boolean {
  try {
    nyckel();
    return true;
  } catch {
    return false;
  }
}

/** Krypterar. Resultatet är "iv.tag.chiffer", allt base64. */
export function kryptera(klartext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, nyckel(), iv);
  const chiffer = Buffer.concat([cipher.update(klartext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, chiffer].map((b) => b.toString("base64")).join(".");
}

/** Avkrypterar. Kastar om innehållet manipulerats eller nyckeln är fel. */
export function avkryptera(paket: string): string {
  const delar = paket.split(".");
  if (delar.length !== 3) throw new Error("valvposten har fel format");

  const [iv, tag, chiffer] = delar.map((d) => Buffer.from(d, "base64"));
  const decipher = createDecipheriv(ALGO, nyckel(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(chiffer), decipher.final()]).toString("utf8");
}

/* ------------------------------------------------------------------ PIN */

/**
 * PIN-hash med scrypt.
 *
 * En fyrsiffrig PIN har tiotusen möjligheter och skyddar inte mot någon som
 * har databasen — det är inte vad den är till för. Den skyddar mot att valvet
 * ligger öppet när mobilen ligger på soffbordet. scrypt gör ändå att en läckt
 * hash inte omedelbart ger PIN-koden, vilket spelar roll om du återanvänt den.
 */
export function pinHash(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `${salt.toString("base64")}.${hash.toString("base64")}`;
}

export function pinStammer(pin: string, lagrad: string): boolean {
  const [salt, hash] = lagrad.split(".").map((d) => Buffer.from(d, "base64"));
  if (!salt || !hash) return false;
  const test = scryptSync(pin, salt, 32);
  // Konstant tid: en jämförelse som avbryter vid första felaktiga byte
  // läcker hur många tecken som stämde.
  return test.length === hash.length && timingSafeEqual(test, hash);
}

/* ----------------------------------------------------------------- TOTP */

/**
 * Tvåfaktorkoden, RFC 6238.
 *
 * Tjänsterna som kräver 2FA skickar dig annars till en app på telefonen, och
 * poängen med valvet är att slippa byta enhet mitt i en inloggning på tv:n.
 *
 * Hemligheten sparas som den `otpauth://`-URI du får när du sätter upp 2FA,
 * krypterad som allt annat här.
 */
export function totpKod(otpauthUri: string, nu = Date.now()): string {
  const url = new URL(otpauthUri.replace(/^otpauth:\/\//, "https://"));
  const hemlighet = url.searchParams.get("secret");
  if (!hemlighet) throw new Error("otpauth-länken saknar secret");

  const steg = Number(url.searchParams.get("period") ?? 30);
  const siffror = Number(url.searchParams.get("digits") ?? 6);
  const algo = (url.searchParams.get("algorithm") ?? "SHA1").toLowerCase();

  const rakning = Math.floor(nu / 1000 / steg);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(rakning));

  const hmac = createHmac(algo, base32Avkoda(hemlighet)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const kod =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(kod % 10 ** siffror).padStart(siffror, "0");
}

/** Sekunder kvar tills koden byts. Utan den vet man inte om man hinner. */
export function totpSekunderKvar(otpauthUri: string, nu = Date.now()): number {
  const url = new URL(otpauthUri.replace(/^otpauth:\/\//, "https://"));
  const steg = Number(url.searchParams.get("period") ?? 30);
  return steg - (Math.floor(nu / 1000) % steg);
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Avkoda(input: string): Buffer {
  const rensad = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bitar = 0;
  let varde = 0;
  const ut: number[] = [];

  for (const tecken of rensad) {
    const index = BASE32.indexOf(tecken);
    if (index === -1) throw new Error("otpauth-secret är inte giltig base32");
    varde = (varde << 5) | index;
    bitar += 5;
    if (bitar >= 8) {
      ut.push((varde >>> (bitar - 8)) & 0xff);
      bitar -= 8;
    }
  }

  return Buffer.from(ut);
}
