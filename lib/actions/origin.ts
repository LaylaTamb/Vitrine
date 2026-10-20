import { headers } from "next/headers"

/**
 * De onde o app está sendo servido — o começo dos links dos e-mails e do QR
 * pessoal. `NEXT_PUBLIC_SITE_URL` fixa (útil atrás de proxy); sem ela, vale a
 * origem de quem pediu. Nos e-mails, o Supabase só aceita destinos da lista
 * "Redirect URLs" do projeto, então um cabeçalho forjado não leva o link para
 * fora; no QR, o link volta para quem pediu.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "")
  if (configured) return configured
  const list = await headers()
  const origin = list.get("origin")
  if (origin) return origin
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000"
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${protocol}://${host}`
}
