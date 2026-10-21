import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { needsTermsAcceptance } from "@/lib/domain/terms"

import { supabaseAnonKey, supabaseUrl } from "./env"

/** As telas de entrar, criar conta e pedir o link de senha — sem sessão. */
const AUTH_PAGES = ["/login", "/cadastro", "/recuperar-senha"]

/**
 * Rotas que não exigem sessão. (`/redefinir-senha` exige: a sessão vem do link.)
 * `/v` (perfil) e `/categoria` (categoria e item) abrem sem login mostrando só o
 * que é público — a própria página decide, e quem esconde o resto é o banco.
 * `/termos` e `/privacidade` são os textos legais.
 */
const PUBLIC_PREFIXES = [
  ...AUTH_PAGES,
  "/auth",
  "/v",
  "/categoria",
  "/termos",
  "/privacidade",
  // Chamada pelo Cron da Vercel, sem sessão: a própria rota confere o segredo.
  "/api/cron",
]

function matches(prefixes: string[], pathname: string): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function isPublic(pathname: string): boolean {
  return matches(PUBLIC_PREFIXES, pathname)
}

/**
 * Renova a sessão a cada requisição e barra rota protegida ANTES de renderizar
 * — a checagem de auth não pode custar um round trip depois da hidratação,
 * como custava na v1.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Não coloque nada entre o createServerClient e o getUser: é ele que
  // revalida o token e regrava os cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl

  // Redirecionar levando os cookies que o getUser acabou de renovar: sem eles,
  // a sessão renovada nesta requisição se perderia no caminho.
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
  }

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    if (pathname !== "/") {
      url.searchParams.set("proximo", `${pathname}${search}`)
    }
    return redirectTo(url)
  }

  // Já logado não tem o que fazer em entrar, criar conta ou pedir link.
  if (user && matches(AUTH_PAGES, pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return redirectTo(url)
  }

  // Conta que ainda não aceitou a versão em vigor dos Termos: aceita uma vez e
  // volta para onde ia. O aceite está no `user_metadata` que o `getUser` acima
  // já trouxe — nenhuma consulta a mais.
  if (user && needsTermsAcceptance(pathname, user.user_metadata)) {
    const url = request.nextUrl.clone()
    url.pathname = "/aceitar-termos"
    url.search = ""
    if (pathname !== "/") url.searchParams.set("proximo", `${pathname}${search}`)
    return redirectTo(url)
  }

  return response
}
