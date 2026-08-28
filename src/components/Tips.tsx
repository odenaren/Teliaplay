import Link from "next/link";

/**
 * Ett tips.
 *
 * Reglerna för vad som får stå här är hårdare än de ser ut. Ett tips ska
 * bygga på något appen VET om just din kväll — att tre titlar försvinner, att
 * två matcher krockar, att en tjänst du betalar för inte är ikryssad. Ett tips
 * som lika gärna kunde stått i en broschyr ("visste du att du kan söka?") är
 * brus, och brus lär läsaren att hoppa över rutan. Då är den värdelös den
 * gången den har något att säga.
 *
 * Därför tar den emot färdig text från sidan som räknat fram den, och har
 * ingen egen logik alls.
 */
export function Tips({
  text,
  lank,
  lankText,
  ton = "vanlig",
}: {
  text: React.ReactNode;
  lank?: string;
  lankText?: string;
  ton?: "vanlig" | "brådskande";
}) {
  const brådskande = ton === "brådskande";

  return (
    <aside
      className={`rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed ${
        brådskande ? "border-live/30 bg-live/5" : "border-line bg-surface/40"
      }`}
    >
      <p className={brådskande ? "text-text" : "text-muted"}>
        {text}
        {lank && lankText && (
          <>
            {" "}
            <Link href={lank} className="text-accent underline decoration-dotted">
              {lankText}
            </Link>
          </>
        )}
      </p>
    </aside>
  );
}
