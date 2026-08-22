import { tjanst } from "@/content/tjanster";

/**
 * Tjänstemärket.
 *
 * Färgen är tjänstens egen. Poängen är att man ska kunna skanna en lista och se
 * "Viaplay, Viaplay, TV4" utan att läsa — och eftersom allt som visas ingår
 * betyder märket "här ser du det", aldrig "det här skulle du kunna köpa".
 */
export function Bricka({ tjanstId, liten }: { tjanstId: string; liten?: boolean }) {
  const t = tjanst(tjanstId);
  if (!t) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded font-medium text-white/95 ${
        liten ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
      style={{ background: t.farg }}
      title={`Ingår i ditt paket via ${t.namn}`}
    >
      {t.kort}
    </span>
  );
}
