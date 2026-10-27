/**
 * O formato da bio: um pedaço pequeno de markdown, sem biblioteca —
 * **negrito**, *itálico*, __sublinhado__, ~~riscado~~ e [texto](https://…).
 * As quebras de linha ficam no texto (a tela usa `whitespace-pre-line`).
 *
 * Regras para não estragar texto comum:
 * - marca sem par, vazia ou colada em espaço por dentro (\`2 * 3 * 4\`) vira
 *   texto como está;
 * - \`\\*\` escreve o caractere sem formatar;
 * - link só com http(s) — nada de \`javascript:\`; o resto vira texto.
 *
 * O banco guarda o texto cru (com as marcas); quem formata é a tela.
 */

export type RichMark = "bold" | "italic" | "underline" | "strike"

export type RichNode =
  | { type: "text"; text: string }
  | { type: RichMark; children: RichNode[] }
  | { type: "link"; href: string; children: RichNode[] }

/** As marcas, das mais longas para as mais curtas (\`**\` antes de \`*\`). */
const MARKS: [string, RichMark][] = [
  ["**", "bold"],
  ["__", "underline"],
  ["~~", "strike"],
  ["*", "italic"],
]

const ESCAPABLE = "\\*_~[]()"

/** O próximo fechamento de `mark` a partir de `from` (sem barra antes); -1 se não há. */
function findClose(source: string, from: number, mark: string): number {
  for (let index = from; index < source.length; index++) {
    if (source[index] === "\\") {
      index++
      continue
    }
    if (!source.startsWith(mark, index)) continue
    // O `*` do itálico não fecha no meio de um `**`.
    if (mark === "*" && (source[index + 1] === "*" || source[index - 1] === "*")) {
      index++
      continue
    }
    return index
  }
  return -1
}

/** Um link http(s) que vale; `null` para o resto. */
export function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (!/^https?:\/\//i.test(href) || href.length > 2048) return null
  try {
    return new URL(href).toString()
  } catch {
    return null
  }
}

/** `[texto](https://…)` começando em `start`: o texto, o link e onde termina. */
function readLink(
  source: string,
  start: number
): { label: string; href: string; end: number } | null {
  const labelEnd = source.indexOf("](", start + 1)
  if (labelEnd < 0) return null
  const label = source.slice(start + 1, labelEnd)
  if (!label.trim() || label.includes("\n") || label.includes("[")) return null
  const hrefEnd = source.indexOf(")", labelEnd + 2)
  if (hrefEnd < 0) return null
  const href = safeHref(source.slice(labelEnd + 2, hrefEnd))
  return href ? { label, href, end: hrefEnd + 1 } : null
}

/** O texto da bio em pedaços: texto puro, marcas (com o que está dentro) e links. */
export function parseRichText(source: string): RichNode[] {
  const nodes: RichNode[] = []
  let text = ""
  const flush = () => {
    if (text) nodes.push({ type: "text", text })
    text = ""
  }

  let index = 0
  while (index < source.length) {
    const char = source[index]

    if (char === "\\" && ESCAPABLE.includes(source[index + 1] ?? "")) {
      text += source[index + 1]
      index += 2
      continue
    }

    if (char === "[") {
      const link = readLink(source, index)
      if (link) {
        flush()
        nodes.push({ type: "link", href: link.href, children: parseRichText(link.label) })
        index = link.end
        continue
      }
    }

    const found = MARKS.find(([mark]) => source.startsWith(mark, index))
    if (found) {
      const [mark, type] = found
      const close = findClose(source, index + mark.length, mark)
      const inner = close < 0 ? "" : source.slice(index + mark.length, close)
      if (inner && inner.trim() === inner) {
        flush()
        nodes.push({ type, children: parseRichText(inner) })
        index = close + mark.length
        continue
      }
      // Sem par (ou vazia, ou com espaço por dentro): a marca inteira é texto.
      text += mark
      index += mark.length
      continue
    }

    text += char
    index++
  }
  flush()
  return nodes
}

/** Só o texto, sem as marcas (o story, que não formata, e onde mais precisar). */
export function plainRichText(source: string): string {
  const flatten = (nodes: RichNode[]): string =>
    nodes.map((node) => (node.type === "text" ? node.text : flatten(node.children))).join("")
  return flatten(parseRichText(source))
}
