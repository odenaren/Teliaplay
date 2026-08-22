/**
 * Next kör den här en gång per serverstart — och bygger den för både node- och
 * edge-runtime. Schemaläggaren använder node:crypto och pg-drivern, som inte
 * finns i edge, så den får ligga i en egen modul som bara importeras när vi
 * faktiskt kör i node.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/scheduler");
  }
}
