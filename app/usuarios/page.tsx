import { redirect } from "next/navigation"

/** `/usuarios` (Pessoas) — agora é a aba Sugestões do Início. */
export default function Page() {
  redirect("/inicio?aba=sugestoes")
}
