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

export async function resolve(specifier, context, nextResolve) {
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
