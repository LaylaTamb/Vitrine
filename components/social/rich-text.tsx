import type { ReactNode } from "react"

import { parseRichText, type RichNode } from "@/lib/domain/rich-text"

/**
 * A bio formatada (o formato de `lib/domain/rich-text.ts`). Serve ao
 * servidor e ao cliente: o perfil e a prévia do Editar perfil. Link abre em
 * outra aba e não passa "força" de busca (`nofollow ugc`).
 */
export function RichText({ text }: { text: string }) {
  return <>{render(parseRichText(text))}</>
}

function render(nodes: RichNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.text
      case "bold":
        return (
          <strong key={index} className="font-semibold">
            {render(node.children)}
          </strong>
        )
      case "italic":
        return <em key={index}>{render(node.children)}</em>
      case "underline":
        return (
          <u key={index} className="underline-offset-2">
            {render(node.children)}
          </u>
        )
      case "strike":
        return <s key={index}>{render(node.children)}</s>
      case "link":
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="text-brand underline underline-offset-2 [overflow-wrap:anywhere] hover:text-foreground"
          >
            {render(node.children)}
          </a>
        )
    }
  })
}
