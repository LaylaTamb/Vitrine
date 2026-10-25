import { redirect } from "next/navigation"

/** `/tags` — agora mora nas Configurações. */
export default function Page() {
  redirect("/configuracoes?secao=tags")
}
