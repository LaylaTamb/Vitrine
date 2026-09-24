import { parseBackupJSON, type ParsedBackupPayload } from "@/lib/backup/import"
import rawSeed from "./seed-data.json"

/**
 * O JSON vem embutido no build (nada de ler arquivo em runtime — não existe
 * filesystem gravável em serverless). Validado pelo mesmo schema do import
 * comum, então um erro de digitação aqui derruba com uma mensagem clara em
 * vez de gravar lixo silenciosamente.
 */
export function getSeedPayload(): ParsedBackupPayload {
  const result = parseBackupJSON(JSON.stringify(rawSeed))
  if (!result.ok) {
    throw new Error(`lib/demo/seed-data.json inválido: ${result.error}`)
  }
  return result.data
}
