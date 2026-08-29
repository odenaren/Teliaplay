/**
 * Låter node lösa upp `@/...` precis som Next gör, så att testskripten kan
 * importera appens riktiga moduler i stället för kopior av dem.
 *
 * Det är hela poängen. Ett testskript som duplicerar reguljäruttrycken ur
 * lib/tag.ts testar sina egna uttryck, inte appens, och driver isär vid första
 * ändring. Här körs samma kod som webbservern kör.
 *
 * Node 24 kan köra .ts direkt genom att stripa typerna. Det fungerar bara så
 * länge koden inte använder TS-funktioner som kräver kodgenerering — enum,
 * namespace, dekoratorer, parameteregenskaper. Den här kodbasen använder bara
 * typannoteringar och interface, som är rena strykningar.
 */

import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts"];

/*
 * next/cache utanför Next.
 *
 * Serveråtgärderna i app/actions.ts importerar revalidatePath. Utanför Next
 * går den inte att lösa upp, och därför gick åtgärderna inte att testa alls —
 * man fick nöja sig med att läsa deras SQL och hoppas. Just den sortens
 * otestade kod låg bakom att paketknappen kryssade i tjänster men inte deras
 * kanaler, och tablån blev tom.
 *
 * Stubben gör ingenting, vilket är precis rätt: i ett test finns ingen cache
 * att göra ogiltig.
 */
const modul = (kod) => "data:text/javascript," + encodeURIComponent(kod);

const NEXT_STUBBAR = {
  "next/cache": modul(
    "export function revalidatePath(){}\nexport function revalidateTag(){}\n" +
      "export function unstable_cache(f){return f}\n",
  ),
  // cookies() används av profilen. Ett test har ingen webbläsare och därmed
  // inga kakor — en tom uppsättning är sanningen, inte en förenkling.
  "next/headers": modul(
    "const tom = { get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [] };\n" +
      "export async function cookies(){ return tom }\n" +
      "export async function headers(){ return new Map() }\n",
  ),
  "next/navigation": modul(
    "export function redirect(u){ const e = new Error('redirect: ' + u); e.digest = 'NEXT_REDIRECT'; throw e }\n" +
      "export function notFound(){ throw new Error('notFound') }\n",
  ),
};

export async function resolve(specifier, context, nextResolve) {
  const stubbe = NEXT_STUBBAR[specifier];
  if (stubbe) return { url: stubbe, shortCircuit: true };

  // `@/lib/tag` → src/lib/tag.ts
  if (specifier.startsWith("@/")) {
    const base = path.join(SRC, specifier.slice(2));
    for (const ext of EXTENSIONS) {
      try {
        return await nextResolve(pathToFileURL(base + ext).href, context);
      } catch {
        // Nästa kandidat.
      }
    }
    throw new Error(`Kunde inte lösa upp ${specifier}`);
  }

  /*
   * Relativa importer saknar också filändelse i TypeScript — `./spoiler`
   * i stället för `./spoiler.ts`. Node kräver den, så vi provar oss fram på
   * samma sätt. Utan det här stannar upplösningen så fort en modul som
   * tag.ts importerar en granne.
   */
  if (specifier.startsWith(".")) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      for (const ext of EXTENSIONS.slice(1)) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {
          // Nästa kandidat.
        }
      }
      throw err;
    }
  }

  return nextResolve(specifier, context);
}
