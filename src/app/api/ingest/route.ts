import { NextResponse } from "next/server";
import { hamtaAllt } from "@/lib/ingest";

/**
 * Trigga en hämtning utifrån.
 *
 * Skyddad med INGEST_SECRET så att inte vem som helst kan sätta igång anrop
 * mot tv.nu och TMDB i ditt namn. Uppdatera-knappen i appen går via en server
 * action och behöver ingen nyckel.
 */
export async function POST(req: Request) {
  const hemlighet = process.env.INGEST_SECRET;
  const skickad = req.headers.get("x-ingest-secret");

  if (!hemlighet || skickad !== hemlighet) {
    return NextResponse.json({ fel: "obehörig" }, { status: 401 });
  }

  const djup = new URL(req.url).searchParams.get("djup") === "full" ? "full" : "snabb";
  const sammanfattning = await hamtaAllt(djup);

  return NextResponse.json(sammanfattning);
}
