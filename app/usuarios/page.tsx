import { redirect } from "next/navigation"

/** `/usuarios` (Pessoas) — agora é o Descobrir. */
export default function Page() {
  redirect("/explorar")
}
