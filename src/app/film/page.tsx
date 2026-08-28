import { redirect } from "next/navigation";

/**
 * /film hette den här sidan förut och kan ligga kvar som bokmärke eller ikon
 * på någons hemskärm. Den pekar vidare i stället för att bli en 404 — en död
 * länk i en app man lagt till på hemskärmen är svår att förstå och lätt att
 * undvika.
 */
export default function Film() {
  redirect("/bladdra");
}
