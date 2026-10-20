/**
 * Lê no navegador os arquivos escolhidos — soltos ou dentro de um .zip — e
 * devolve só os de texto que interessam. Nada sai do aparelho aqui: o que vai
 * para o servidor são as linhas já lidas, em lotes.
 */

import { canUnzip, listZip, readZipText } from "./zip"

export interface ReadFile {
  /** O caminho (dentro do zip) ou o nome do arquivo solto. */
  path: string
  text: string
}

/** Arquivos maiores que isto não são exportação de lista (fotos, histórico…): ficam de fora. */
const MAX_FILE = 20 * 1024 * 1024

export class ZipNotSupportedError extends Error {
  constructor() {
    super(
      "Este navegador não abre .zip. Extraia o arquivo no computador e escolha os .csv e .json de dentro."
    )
  }
}

/**
 * `wanted(path)` diz quais arquivos ler. Arquivo que não abre ou grande
 * demais é pulado — o resto continua.
 */
export async function readImportFiles(
  files: File[],
  wanted: (path: string) => boolean
): Promise<ReadFile[]> {
  const out: ReadFile[] = []
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      if (!canUnzip()) throw new ZipNotSupportedError()
      const entries = await listZip(file)
      for (const entry of entries) {
        if (!wanted(entry.name) || entry.size > MAX_FILE) continue
        try {
          out.push({ path: entry.name, text: await readZipText(file, entry) })
        } catch {
          // Um arquivo estragado não derruba os outros.
        }
      }
      continue
    }
    if (wanted(file.name) && file.size <= MAX_FILE) {
      out.push({ path: file.name, text: await file.text() })
    }
  }
  return out
}
