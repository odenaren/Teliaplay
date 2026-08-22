import { NextResponse } from "next/server";
import { sok, hamtaProvidersForTitel } from "@/lib/sources/tmdb";
import { TJANSTER } from "@/content/tjanster";
import { ingarKarta } from "@/lib/queries";

/**
 * Ingår-vakten.
 *
 * Frågan är alltid densamma: "får jag se det här?" Svaret får bara vara ja
 * eller nej, aldrig "ja, om du köper till". Därför tittar den bara på
 * `flatrate` hos TMDB — hyra och köp räknas som nej, eftersom det är precis
 * den sortens tips appen finns för att slippa.
 */
export async function GET(req: Request) {
  const fraga = new URL(req.url).searchParams.get("q")?.trim();
  if (!fraga) return NextResponse.json({ traffar: [] });

  try {
    const karta = await ingarKarta();
    const mina = new Map(
      TJANSTER.filter((t) => t.tmdbProvider && karta.tjanster.has(t.id)).map((t) => [
        t.tmdbProvider!,
        t.namn,
      ]),
    );

    const kandidater = (await sok(fraga)).slice(0, 5);

    const traffar = await Promise.all(
      kandidater.map(async (k) => {
        const providers = await hamtaProvidersForTitel(k.tmdbId, k.typ).catch(() => []);
        const dina = providers.map((p) => mina.get(p)).filter((n): n is string => Boolean(n));
        return {
          namn: k.namn,
          ar: k.ar,
          typ: k.typ,
          poster: k.poster,
          ingar: dina.length > 0,
          tjanster: dina,
        };
      }),
    );

    return NextResponse.json({ traffar });
  } catch (err) {
    return NextResponse.json(
      { traffar: [], fel: err instanceof Error ? err.message : "okänt fel" },
      { status: 502 },
    );
  }
}
