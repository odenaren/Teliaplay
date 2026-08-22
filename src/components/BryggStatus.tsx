import { pinga, harBrygga } from "@/lib/bridge";

/**
 * Bryggans hälsa.
 *
 * Ligger på källsidan därför att "Spela-knappen gör ingenting" nästan alltid är
 * en brygga som inte svarar, och det är svårt att gissa sig till. Pingen görs
 * vid sidladdning och tar max fem sekunder.
 */
export async function BryggStatus() {
  if (!harBrygga()) {
    return (
      <section className="rounded-lg border border-line bg-surface/40 px-3 py-3 text-[12px] leading-relaxed">
        <h2 className="text-[13px] font-semibold tracking-tight">Ingen brygga inkopplad</h2>
        <p className="mt-1 text-muted">
          Spela-knapparna öppnar länkar i stället för att starta på Apple TV:n. Vill du ha
          ett-tryck-start: sätt upp bryggan enligt <code className="text-text">bridge/README.md</code>{" "}
          och lägg in BRIDGE_URL och BRIDGE_SECRET i .env.
        </p>
      </section>
    );
  }

  const svar = await pinga();

  return (
    <section className="rounded-lg border border-line bg-surface/40 px-3 py-3 text-[12px]">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${svar.ok ? "bg-sport" : "bg-live"}`}
          aria-hidden
        />
        <h2 className="text-[13px] font-semibold tracking-tight">Hembryggan</h2>
      </div>
      <p className="mt-1 text-muted">{svar.meddelande}</p>
    </section>
  );
}
