/**
 * CSV (RFC 4180) — o formato das exportações do Google Takeout e do
 * Letterboxd. Aspas, aspas dobradas, vírgula e quebra de linha dentro de
 * aspas, CRLF ou LF, e o BOM do começo.
 */

/** O texto → linhas de células. Linhas totalmente vazias são descartadas. */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index++
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++
      row.push(cell)
      if (row.some((value) => value !== "")) rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }
  row.push(cell)
  if (row.some((value) => value !== "")) rows.push(row)
  return rows
}

/** O nome de uma coluna para comparar: minúsculas, sem acento, sem espaço nas pontas. */
export function headerKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

/**
 * A primeira linha vira os nomes (em `headerKey`) e cada linha seguinte, um
 * objeto. Célula que falta vira "".
 */
export function csvRecords(text: string): { header: string[]; records: Record<string, string>[] } {
  const [first, ...rest] = parseCsv(text)
  if (!first) return { header: [], records: [] }
  const header = first.map(headerKey)
  const records = rest.map((cells) => {
    const record: Record<string, string> = {}
    header.forEach((name, index) => {
      if (name) record[name] = (cells[index] ?? "").trim()
    })
    return record
  })
  return { header, records }
}

/** O primeiro valor não vazio entre as colunas dadas (para nomes em inglês ou português). */
export function pick(record: Record<string, string>, names: string[]): string {
  for (const name of names) {
    const value = record[headerKey(name)]
    if (value) return value
  }
  return ""
}
