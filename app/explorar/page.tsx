import { redirect } from "next/navigation"

/**
 * `/explorar` — o antigo Descobrir, agora a aba Sugestões do Início. As
 * actions (`./actions.ts`) continuam aqui: a busca, o Pegar e os modelos.
 */
export default function Page() {
  redirect("/inicio?aba=sugestoes")
}
