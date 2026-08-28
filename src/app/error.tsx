"use client";

/**
 * Felsidan.
 *
 * Utan den visar Next sitt eget "Application error: a server-side exception
 * has occurred" — en mening på engelska och en hash. Det räcker för den som
 * har serverloggen uppe bredvid. Den som står med telefonen i handen och
 * precis klistrat in en anslutningssträng får ingenting alls.
 *
 * OBS: i produktion skickar Next INTE med felmeddelandet till klienten. Det
 * ersätts med en generisk text och en digest. Sidan kan alltså inte tala om
 * vad som gick fel — bara vad det brukar vara, och var man ser resten. Att
 * gissa på ett fel vi inte kan se vore värre än att räkna upp de tre som
 * faktiskt inträffar.
 */
export default function Fel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface/60 px-4 py-5 text-[13px] leading-relaxed">
      <h2 className="text-[15px] font-semibold tracking-tight">Det tog stopp på servern</h2>

      <p className="mt-2">
        Sidan kunde inte byggas färdigt. Nästan alltid är det en av tre saker, och alla tre
        rättas där du satte variablerna — inte i appen.
      </p>

      <ol className="mt-3 space-y-1.5 text-muted">
        <li>
          1. <strong className="text-text">DATABASE_URL</strong> pekar fel, eller lösenordet i
          den stämmer inte. Vanligast direkt efter en ny deploy.
        </li>
        <li>
          2. Databasen svarar inte just nu. Neons gratisnivå pausar efter en stunds
          overksamhet och behöver några sekunder på sig — ladda om.
        </li>
        <li>
          3. En källa svarade konstigt under en hämtning. Då står det på{" "}
          <a href="/kallor" className="underline decoration-dotted">
            Källor
          </a>{" "}
          vilken.
        </li>
      </ol>

      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-ink"
      >
        Försök igen
      </button>

      {error.digest && (
        <p className="mt-3 text-[11px] text-muted">
          Felets id är <code className="text-text">{error.digest}</code>. Söker du på det i
          Railways logg hittar du hela meddelandet — det skickas medvetet inte hit, eftersom
          ett databasfel annars kan råka innehålla lösenordet.
        </p>
      )}
    </section>
  );
}
