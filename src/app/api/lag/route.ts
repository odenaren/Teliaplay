import { NextResponse } from "next/server";
import { hamtaLag, sokLag } from "@/lib/sources/sportsdb";

/**
 * Lagen i en liga, för favoritlagsväljaren.
 *
 * Ligger som API-route i stället för server action eftersom väljaren hämtar
 * medan man skriver, och en server action per tangenttryck vore en omritning
 * av hela sidan per bokstav.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const sok = params.get("sok")?.trim();
  const liga = params.get("liga");

  // Namnsökningen går först. Den är oberoende av liga-id:n och fungerar även
  // när registret ändrats eller nyckeln bara ger ett urval.
  if (sok) {
    try {
      return NextResponse.json({ lag: await sokLag(sok) });
    } catch (err) {
      return NextResponse.json(
        { lag: [], fel: err instanceof Error ? err.message : "okänt fel" },
        { status: 502 },
      );
    }
  }

  if (!liga) return NextResponse.json({ lag: [] });

  try {
    return NextResponse.json({ lag: await hamtaLag(liga) });
  } catch (err) {
    return NextResponse.json(
      { lag: [], fel: err instanceof Error ? err.message : "okänt fel" },
      { status: 502 },
    );
  }
}
