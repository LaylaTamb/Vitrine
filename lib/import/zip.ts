/**
 * Um leitor de .zip mínimo, com o que o navegador já tem
 * (`DecompressionStream("deflate-raw")`) — sem dependência. Lê o índice do
 * fim do arquivo e só os arquivos pedidos, em pedaços (`Blob.slice`): um
 * Takeout de gigabytes não precisa caber na memória. Entende ZIP64 (arquivos
 * acima de 4 GB) e os dois métodos de compressão que importam: guardado (0)
 * e deflate (8).
 */

export interface ZipEntry {
  /** O caminho dentro do zip ("Takeout/Salvos/Quero ir.csv"). */
  name: string
  method: number
  compressedSize: number
  size: number
  /** Onde começa o cabeçalho local deste arquivo. */
  offset: number
}

const EOCD = 0x06054b50
const EOCD64 = 0x06064b50
const EOCD64_LOCATOR = 0x07064b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50
const MAX_U16 = 0xffff
const MAX_U32 = 0xffffffff

/** Um arquivo de texto maior que isto não é exportação de lista: nem tenta. */
export const MAX_TEXT_ENTRY = 50 * 1024 * 1024

export function canUnzip(): boolean {
  return typeof DecompressionStream !== "undefined"
}

async function bytes(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer())
}

function u64(view: DataView, at: number): number {
  return Number(view.getBigUint64(at, true))
}

/** A lista de arquivos do zip (pastas ficam de fora). */
export async function listZip(blob: Blob): Promise<ZipEntry[]> {
  const tailStart = Math.max(0, blob.size - (22 + 65535))
  const tail = await bytes(blob, tailStart, blob.size)
  let eocd = -1
  for (let at = tail.byteLength - 22; at >= 0; at--) {
    if (tail.getUint32(at, true) === EOCD) {
      eocd = at
      break
    }
  }
  if (eocd < 0) throw new Error("Não é um arquivo .zip válido.")

  let count = tail.getUint16(eocd + 10, true)
  let size = tail.getUint32(eocd + 12, true)
  let offset = tail.getUint32(eocd + 16, true)

  if (count === MAX_U16 || size === MAX_U32 || offset === MAX_U32) {
    // ZIP64: o localizador fica logo antes do fim do índice comum.
    const locatorAt = eocd - 20
    if (locatorAt < 0 || tail.getUint32(locatorAt, true) !== EOCD64_LOCATOR) {
      throw new Error("Zip grande demais e sem o índice ZIP64.")
    }
    const recordAt = u64(tail, locatorAt + 8)
    const record = await bytes(blob, recordAt, recordAt + 56)
    if (record.getUint32(0, true) !== EOCD64) throw new Error("Índice ZIP64 inválido.")
    count = u64(record, 32)
    size = u64(record, 40)
    offset = u64(record, 48)
  }

  const directory = await bytes(blob, offset, offset + size)
  const decoder = new TextDecoder()
  const entries: ZipEntry[] = []
  let at = 0
  for (let index = 0; index < count && at + 46 <= directory.byteLength; index++) {
    if (directory.getUint32(at, true) !== CENTRAL) break
    const method = directory.getUint16(at + 10, true)
    let compressedSize = directory.getUint32(at + 20, true)
    let fileSize = directory.getUint32(at + 24, true)
    const nameLength = directory.getUint16(at + 28, true)
    const extraLength = directory.getUint16(at + 30, true)
    const commentLength = directory.getUint16(at + 32, true)
    let localOffset = directory.getUint32(at + 42, true)
    const name = decoder.decode(
      new Uint8Array(directory.buffer, directory.byteOffset + at + 46, nameLength)
    )

    // Extra ZIP64 (0x0001): os valores que estouraram 32 bits, nesta ordem.
    let extraAt = at + 46 + nameLength
    const extraEnd = extraAt + extraLength
    while (extraAt + 4 <= extraEnd) {
      const id = directory.getUint16(extraAt, true)
      const length = directory.getUint16(extraAt + 2, true)
      if (id === 0x0001) {
        let cursor = extraAt + 4
        if (fileSize === MAX_U32) {
          fileSize = u64(directory, cursor)
          cursor += 8
        }
        if (compressedSize === MAX_U32) {
          compressedSize = u64(directory, cursor)
          cursor += 8
        }
        if (localOffset === MAX_U32) localOffset = u64(directory, cursor)
      }
      extraAt += 4 + length
    }

    if (!name.endsWith("/")) {
      entries.push({ name, method, compressedSize, size: fileSize, offset: localOffset })
    }
    at = extraEnd + commentLength
  }
  return entries
}

/** O conteúdo de um arquivo do zip. */
export async function readZipEntry(blob: Blob, entry: ZipEntry): Promise<Uint8Array> {
  const header = await bytes(blob, entry.offset, entry.offset + 30)
  if (header.getUint32(0, true) !== LOCAL) throw new Error(`Arquivo corrompido: ${entry.name}`)
  const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true)
  const data = blob.slice(start, start + entry.compressedSize)
  if (entry.method === 0) return new Uint8Array(await data.arrayBuffer())
  if (entry.method !== 8) throw new Error(`Compressão não suportada em ${entry.name}.`)
  const stream = data.stream().pipeThrough(new DecompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** O conteúdo de um arquivo de texto do zip (UTF-8). */
export async function readZipText(blob: Blob, entry: ZipEntry): Promise<string> {
  if (entry.size > MAX_TEXT_ENTRY) throw new Error(`Arquivo grande demais: ${entry.name}`)
  return new TextDecoder().decode(await readZipEntry(blob, entry))
}
