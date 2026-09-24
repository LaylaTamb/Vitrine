import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { DEMO_EMAIL } from "@/lib/demo/config"
import { ensureDemoAccount } from "@/lib/demo/provision"

/**
 * `/demo` — entra na conta de demonstração sem OTP, sem criar conta.
 *
 * Usa a `service_role` pra (a) garantir que a conta demo existe, semeada, e
 * (b) gerar um token de login válido pra ela. Depois troca esse token por
 * uma sessão de verdade com o cliente normal (o mesmo que grava os cookies
 * em toda outra rota) — é o mesmo mecanismo do magic link por e-mail, só que
 * sem o e-mail.
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl

  try {
    // Já logado (de verdade ou já na demo) — não troca a sessão por baixo dele.
    const session = await createClient()
    const {
      data: { user: existingUser },
    } = await session.auth.getUser()
    if (existingUser) return NextResponse.redirect(`${origin}/`)

    const admin = createAdminClient()
    await ensureDemoAccount(admin)

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: DEMO_EMAIL,
    })
    if (error || !data.properties?.hashed_token) {
      throw new Error(error?.message ?? "Não consegui gerar o link de entrada da demo.")
    }

    const supabase = await createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: data.properties.hashed_token,
    })
    if (verifyError) throw verifyError

    return NextResponse.redirect(`${origin}/`)
  } catch (err) {
    console.error("[/demo]", err)
    return NextResponse.redirect(`${origin}/login?erro=demo_indisponivel`)
  }
}
