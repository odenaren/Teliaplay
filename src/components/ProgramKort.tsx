import { klockan, pagar, forlopp, relativt } from "@/lib/time";
import { Bricka } from "./Bricka";
import { SpelaKnapp } from "./SpelaKnapp";
import { FavoritKnapp } from "./FavoritKnapp";
import type { ProgramVy } from "@/lib/types";

/**
 * En rad i tablån.
 *
 * Tiden står först och störst. Det är det man skannar efter — inte titeln, inte
 * kanalen. Pågår sändningen ritas en tunn förloppslinje under raden, så att man
 * ser om det är fem minuter kvar eller femtio innan man startar den.
 */
export function ProgramKort({ program, visaKanal = true }: { program: ProgramVy; visaKanal?: boolean }) {
  const live = pagar(program.start, program.slut);
  const andel = live ? forlopp(program.start, program.slut) : 0;

  return (
    <article className="relative flex items-start gap-3 border-b border-line/60 py-2.5 last:border-0">
      <div className="w-11 shrink-0 pt-0.5 text-right">
        <div className={`text-[13px] tabular-nums ${live ? "text-live" : "text-text"}`}>
          {klockan(program.start)}
        </div>
        {program.slut && (
          <div className="text-[10px] tabular-nums text-muted">{klockan(program.slut)}</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="min-w-0 truncate text-[14px] font-medium">{program.titel}</h3>
          {live && (
            <span className="shrink-0 rounded bg-live/15 px-1.5 py-0.5 text-[9px] font-medium text-live">
              DIREKT
            </span>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          {visaKanal && <span className="truncate">{program.kanalNamn}</span>}
          <Bricka tjanstId={program.tjanstId} liten />
          {program.genre && <span className="truncate">{program.genre}</span>}
          {!live && <span>{relativt(program.start, program.slut)}</span>}
        </div>

        {program.beskrivning && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted/90">
            {program.beskrivning}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <FavoritKnapp sort="program" refId={program.id} aktiv={Boolean(program.favorit)} />
        <SpelaKnapp
          tjanstId={program.tjanstId}
          namn={program.titel}
          refId={program.id}
          sort="program"
          liten
        />
      </div>

      {live && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-live/60"
          style={{ width: `${Math.round(andel * 100)}%` }}
        />
      )}
    </article>
  );
}
