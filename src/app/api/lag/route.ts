import { NextResponse } from "next/server";
import { hamtaLag } from "@/lib/sources/sportsdb";

/**
 * Lagen i en liga, för favoritlagsväljaren.
 *
 * Ligger som API-route i stället för server action eftersom väljaren hämtar
 * medan man skriver, och en server action per tangenttryck vore en omritning
 * av hela sidan per bokstav.
 */
export async function GET(req: Request) {
  const liga = new URL(req.url).searchParams.get("liga");
  if (!liga) return NextResponse.json({ lag: [] });

  try {
    const lag = await hamtaLag(liga);
    return NextResponse.json({ lag });
  } catch (err) {
    return NextResponse.json(
      { lag: [], fel: err instanceof Error ? err.message : "okänt fel" },
      { status: 502 },
    );
  }
}
