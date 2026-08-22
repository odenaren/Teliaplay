import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ProfilVaxel } from "@/components/ProfilVaxel";
import { aktivProfil, allaProfiler } from "@/lib/profil";
import { hasDatabase } from "@/lib/db";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vad ingår",
  description: "Allt som ingår i Telia Play-paketet, på ett ställe. Inget annat.",
  appleWebApp: { capable: true, title: "Vad ingår", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0b10",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Utan databas går inga frågor att ställa. Layouten måste ändå renderas,
  // annars ser en felkonfigurerad installation ut som en trasig app i stället
  // för en oinstallerad.
  const [profil, profiler] = hasDatabase()
    ? await Promise.all([aktivProfil(), allaProfiler()]).catch(() => [null, []] as const)
    : [null, []];

  return (
    <html lang="sv">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-tight">Vad ingår</h1>
              <p className="truncate text-[11px] text-muted">
                Telia Play, utan det du inte har
              </p>
            </Link>
            {profil && <ProfilVaxel profiler={profiler} aktiv={profil.id} />}
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">{children}</main>

        <Nav />
      </body>
    </html>
  );
}
