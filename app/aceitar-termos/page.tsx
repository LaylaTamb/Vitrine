import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { signOutAction } from "@/app/actions"
import { AcceptTermsForm } from "@/components/auth/accept-terms-form"
import { AUTH_LINK_CLASS, AuthShell } from "@/components/auth/auth-shell"
import { safeNextPath } from "@/lib/domain/auth"
import { hasAcceptedCurrentTerms, TERMS_EFFECTIVE_DATE } from "@/lib/domain/terms"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Termos de uso · Vitrine" }

/**
 * `/aceitar-termos` — quem já tinha conta (ou quando a versão dos textos muda)
 * passa por aqui uma vez: o middleware manda para cá enquanto o aceite da
 * versão em vigor não estiver na conta. Exige login (o middleware cuida).
 */
export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const { proximo } = await searchParams
  const next = safeNextPath(proximo)

  // `getUser` (e não o token): o aceite acabou de ser gravado e o token pode
  // ainda ser o de antes.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (hasAcceptedCurrentTerms(user.user_metadata)) {
    redirect(next.startsWith("/aceitar-termos") ? "/" : next)
  }

  return (
    <AuthShell
      title="Antes de continuar"
      description={
        <>
          Os Termos de uso e a Política de privacidade mudaram (em vigor desde{" "}
          {TERMS_EFFECTIVE_DATE}). O que está marcado como{" "}
          <span className="text-foreground">Público</span> é visível na internet, também para
          quem não tem conta — e agora quem não tem conta também explora o Vitrine: as
          Sugestões, a lista de pessoas com alguma lista Pública e, nesses perfis, quem segue
          quem (só o nome, o @ e a foto). Para seguir usando, é só aceitar.
        </>
      }
      footer={
        <form action={signOutAction}>
          <button type="submit" className={AUTH_LINK_CLASS}>
            Sair da conta
          </button>
        </form>
      }
    >
      <AcceptTermsForm next={next} />
    </AuthShell>
  )
}
