import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { supabaseAnonKey, supabaseUrl } from "./env"

/** As telas de entrar, criar conta e pedir o link de senha — sem sessão. */
const AUTH_PAGES = ["/login", "/cadastro", "/recuperar-senha"]

/** Rotas que não exigem sessão. (`/redefinir-senha` exige: a sessão vem do link.) */
const PUBLIC_PREFIXES = [...AUTH_PAGES, "/auth", "/demo"]

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

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    if (pathname !== "/") {
      url.searchParams.set("proximo", `${pathname}${search}`)
    }
    return NextResponse.redirect(url)
  }

  // Já logado não tem o que fazer em entrar, criar conta ou pedir link.
  if (user && matches(AUTH_PAGES, pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}
