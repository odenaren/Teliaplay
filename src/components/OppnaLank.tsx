"use client";

import { useRef, useState } from "react";

/**
 * Länken som helst öppnar tjänstens app, och webben först om appen inte finns.
 *
 * PROBLEMET. En vanlig länk till primevideo.com hamnar i Safari, och Safari är
 * utloggad. Man trycker Spela och möts av en inloggningsruta i stället för av
 * något att titta på. Appen på telefonen är redan inloggad — den ska öppnas.
 *
 * VARFÖR DET INTE RÄCKER MED EN VANLIG LÄNK. iOS öppnar "universal links" i
 * appen bara när man kommer från en ANNAN app. Står man redan i Safari stannar
 * en https-länk i Safari, oavsett hur väl tjänsten konfigurerat sina länkar.
 * Ett URL-schema (aiv://, nflx://) är det enda som bryter ut.
 *
 * VARFÖR DET INTE KAN BLI EN DÖD KNAPP. Schemat kan vara fel, och appen kan
 * saknas. Därför startas en klocka samtidigt: händer ingenting inom 1,2
 * sekunder öppnas webbadressen som förut. Öppnades appen har sidan blivit
 * dold, och då avbryts klockan — annars ligger webbsidan och väntar i Safari
 * när man kommer tillbaka.
 */
export function OppnaLank({
  appUrl,
  url,
  kopiera,
  children,
  className,
  title,
}: {
  appUrl?: string | null;
  url: string;
  /** Läggs i urklipp när länken öppnas — titeln man ska klistra in i sökrutan. */
  kopiera?: string | null;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const klocka = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [kopierat, setKopierat] = useState(false);

  const oppna = (e: React.MouseEvent<HTMLAnchorElement>) => {
    /*
     * Urklipp först, och medan klicket fortfarande pågår.
     *
     * Webbläsare tillåter skrivning till urklipp bara som direkt följd av en
     * användarhandling. Görs det efter en navigering, eller i en timer, nekas
     * det tyst — och då står man på söksidan med tomt urklipp och undrar.
     */
    if (kopiera) {
      navigator.clipboard?.writeText(kopiera).then(
        () => setKopierat(true),
        () => setKopierat(false),
      );
    }

    if (!appUrl) return; // ingen app känd — låt länken gå som vanligt

    e.preventDefault();

    const avbryt = () => {
      if (klocka.current) clearTimeout(klocka.current);
      klocka.current = null;
      document.removeEventListener("visibilitychange", avbryt);
    };
    document.addEventListener("visibilitychange", avbryt);

    klocka.current = setTimeout(() => {
      document.removeEventListener("visibilitychange", avbryt);
      if (document.visibilityState === "visible") window.location.href = url;
    }, 1200);

    window.location.href = appUrl;
  };

  return (
    <a
      href={url}
      onClick={oppna}
      target={appUrl ? undefined : "_blank"}
      rel="noopener noreferrer"
      className={className}
      title={title}
    >
      {kopierat ? "titeln kopierad ✓" : children}
    </a>
  );
}
