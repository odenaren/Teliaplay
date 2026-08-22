import { NextResponse, type NextRequest } from "next/server";
import { PROFIL_COOKIE } from "@/lib/profil";

/**
 * Ser till att varje besökare har en profilcookie.
 *
 * Till skillnad från TI-appen slumpas inget id här: profilerna är namngivna och
 * skapas i appen. Middleware gör bara att cookien följer med vidare, och att
 * en tom cookie inte ligger kvar och pekar på ingenting.
 *
 * Kör i edge-runtime, så inget databasanrop får finnas här.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const nuvarande = req.cookies.get(PROFIL_COOKIE)?.value;

  if (nuvarande === "") res.cookies.delete(PROFIL_COOKIE);

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
