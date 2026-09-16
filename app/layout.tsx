import type { Metadata, Viewport } from "next"
import { Fraunces, Inter } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

// next/font faz o self-host das duas no build — nenhuma requisição a
// fonts.googleapis.com em runtime (a v1 usava <link>, bloqueante).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Vitrine",
  description: "Seu acervo pessoal: tudo que você consome, catalogado do seu jeito.",
}

export const viewport: Viewport = {
  themeColor: "#131315",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable} ${fraunces.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
