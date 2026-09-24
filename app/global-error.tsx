"use client"

import { useEffect } from "react"

/**
 * Só entra em cena quando o próprio `layout.tsx` quebra — `error.tsx` não
 * cobre esse caso. Precisa vir com `<html>`/`<body>` próprios (substitui o
 * layout inteiro) e ficar deliberadamente simples: sem componentes nem
 * `next/font`, pra não correr o risco de essa própria rede de segurança
 * falhar também.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#131315",
          color: "#ececef",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 1.5rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            Algo quebrou
          </h1>
          <p style={{ color: "#9a9aa4", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            Não era pra acontecer. Tenta de novo — se continuar, recarrega a página.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#b98cc2",
              color: "#1a1220",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.9rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  )
}
