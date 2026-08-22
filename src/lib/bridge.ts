/**
 * Klienten mot hembryggan — den lilla tjänsten som styr Apple TV:n.
 *
 * VARFÖR DET INTE GÅR ATT STRÖMMA HÄR I STÄLLET
 *
 * Allt i paketet är DRM-skyddat (Widevine) och rättigheterna ligger hos varje
 * tjänst. En egen spelare skulle behöva kringgå det, vilket varken går att
 * göra lagligt eller är värt att försöka. Det appen kan göra är att ta bort
 * varenda steg mellan "jag vill se det här" och bild på tv:n — och det visar
 * sig vara nästan lika bra: ett tryck, tio sekunder, rätt app, rätt titel.
 *
 * VARFÖR DET MÅSTE FINNAS EN BRYGGA
 *
 * Apple TV pratar bara med enheter på samma nätverk. Appen ligger på Railway.
 * Alltså behövs något hemma som tar emot kommandot och för det vidare — en
 * Raspberry Pi, en NAS, en gammal dator. Se bridge/README.md.
 *
 * VARFÖR ETT FEL HÄR ALDRIG FÅR STOPPA NÅGOT
 *
 * Bryggan är den del av systemet som oftast är nere: strömavbrott, omstart,
 * ny IP. Därför returnerar allt här ett resultat i stället för att kasta, och
 * varje knapp har en fallback-länk som fungerar utan brygga.
 */

export interface BryggaSvar {
  ok: boolean;
  meddelande: string;
}

function konfig(): { url: string; hemlighet: string } | null {
  const url = process.env.BRIDGE_URL;
  const hemlighet = process.env.BRIDGE_SECRET;
  if (!url || !hemlighet) return null;
  return { url: url.replace(/\/$/, ""), hemlighet };
}

export function harBrygga(): boolean {
  return konfig() !== null;
}

/**
 * Starta något på tv:n.
 *
 * `deeplink` är en universallänk (https), inte ett url-schema. pyatv skickar
 * den till tvOS som öppnar rätt app och navigerar dit — samma mekanism som när
 * du delar en länk från telefonen till tv:n.
 */
export async function spela(opts: {
  deeplink: string;
  appleTvApp?: string;
  /** Väck tv:n först. Kostar ett par sekunder, gör att det funkar från soffan. */
  vack?: boolean;
}): Promise<BryggaSvar> {
  const cfg = konfig();
  if (!cfg) {
    return { ok: false, meddelande: "Ingen brygga konfigurerad (BRIDGE_URL saknas)." };
  }

  const ctrl = new AbortController();
  // Bryggan är på ditt eget nät och svarar på millisekunder när den lever.
  // Tio sekunder är gott om tid; längre och knappen känns trasig.
  const timer = setTimeout(() => ctrl.abort(), 10_000);

  try {
    const res = await fetch(`${cfg.url}/play`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Bridge-Secret": cfg.hemlighet,
      },
      body: JSON.stringify({
        deeplink: opts.deeplink,
        app: opts.appleTvApp ?? null,
        wake: opts.vack ?? true,
      }),
      cache: "no-store",
    });

    if (!res.ok) return { ok: false, meddelande: `Bryggan svarade HTTP ${res.status}.` };

    const svar = (await res.json()) as { ok?: boolean; message?: string };
    return {
      ok: svar.ok !== false,
      meddelande: svar.message ?? "Startat på Apple TV.",
    };
  } catch (err) {
    const orsak = err instanceof Error && err.name === "AbortError" ? "svarade inte" : "gick inte att nå";
    return { ok: false, meddelande: `Bryggan ${orsak}. Använd länken i stället.` };
  } finally {
    clearTimeout(timer);
  }
}

/** Lever bryggan? Används av /installningar för att visa status. */
export async function pinga(): Promise<BryggaSvar> {
  const cfg = konfig();
  if (!cfg) return { ok: false, meddelande: "Ingen brygga konfigurerad." };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(`${cfg.url}/health`, {
      signal: ctrl.signal,
      headers: { "X-Bridge-Secret": cfg.hemlighet },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, meddelande: `HTTP ${res.status}` };
    const svar = (await res.json()) as { device?: string };
    return { ok: true, meddelande: svar.device ? `Ansluten till ${svar.device}` : "Bryggan lever" };
  } catch {
    return { ok: false, meddelande: "Bryggan svarar inte." };
  } finally {
    clearTimeout(timer);
  }
}
