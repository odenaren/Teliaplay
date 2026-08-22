import { klockan, dagEtikett, tvDayKey, relativt } from "@/lib/time";
import { Bricka } from "./Bricka";
import { SpelaKnapp } from "./SpelaKnapp";
import type { MatchVy } from "@/lib/types";

/**
 * En match, med svaret på frågan som är hela anledningen till att du har
 * paketet: går den att se, och var?
 *
 * När svaret är nej sägs det rakt ut. Det är det enda stället i appen där en
 * post utan sändning får synas, och skälet är att "min match sänds inte på
 * något jag har" är information du behöver — till skillnad från ett tips om en
 * film du inte kan se.
 */
export function MatchKort({ match }: { match: MatchVy }) {
  return (
    <article className="flex items-start gap-3 border-b border-line/60 py-3 last:border-0">
      <div className="w-16 shrink-0">
        <div className="text-[13px] tabular-nums">{klockan(match.start)}</div>
        <div className="text-[10px] text-muted">{dagEtikett(tvDayKey(match.start))}</div>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[14px] font-medium">
          {match.hemma} – {match.borta}
        </h3>

        {match.var ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <span className="rounded bg-sport/15 px-1.5 py-0.5 text-[9px] font-medium text-sport">
              INGÅR
            </span>
            <span className="truncate">{match.var.kanalNamn}</span>
            <Bricka tjanstId={match.var.tjanstId} liten />
            <span>{relativt(match.start)}</span>
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-muted">
            Ingen sändning hittad på det du har.{" "}
            <span className="text-muted/70">
              Kan också betyda att tablån inte sträcker sig så långt fram än.
            </span>
          </p>
        )}
      </div>

      {match.var && (
        <SpelaKnapp
          tjanstId={match.var.tjanstId}
          namn={`${match.hemma} ${match.borta}`}
          refId={match.id}
          sort="match"
          liten
        />
      )}
    </article>
  );
}
