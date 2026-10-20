import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Tudo, menos:
     * - _next/static e _next/image (assets do build)
     * - favicon e arquivos com extensão (imagens, fontes, etc.)
     * - o que o app instalável precisa sem login: sw.js, o manifest e os
     *   ícones gerados (/icon/…, /apple-icon)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon/|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
}
