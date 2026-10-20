import {
  GEMINI_RESPONSE_SCHEMA,
  geminiPrompt,
  parseGeminiResponse,
  type FieldSuggestion,
} from "@/lib/domain/field-suggestions"

/**
 * O Google Gemini (plano gratuito), só no servidor: `GEMINI_API_KEY` nunca vai
 * para o navegador. Recebe SÓ o nome da categoria. No plano gratuito, o
 * Google pode usar o que recebe para treinar e melhorar os produtos dele — a
 * Política de privacidade diz isso.
 *
 * O modelo padrão é o apelido "flash-lite mais recente" (o de limite diário
 * mais folgado no plano gratuito, e não quebra quando o Google troca a
 * versão); `GEMINI_MODEL` troca, se precisar.
 */

const DEFAULT_MODEL = "gemini-flash-lite-latest"
const TIMEOUT_MS = 15_000

export function geminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || null
}

function geminiModel(): string {
  const model = process.env.GEMINI_MODEL?.trim()
  return model && /^[a-z0-9.-]+$/.test(model) ? model : DEFAULT_MODEL
}

/** Os campos que a IA sugere para uma categoria com este nome. */
export async function askGeminiForFields(categoryName: string): Promise<FieldSuggestion[]> {
  const key = geminiApiKey()
  if (!key) throw new Error("Falta a GEMINI_API_KEY no servidor.")

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: geminiPrompt(categoryName) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          temperature: 0.4,
          maxOutputTokens: 800,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    }
  )
  if (!response.ok) throw new Error(`O Gemini respondeu ${response.status}.`)
  return parseGeminiResponse(await response.json())
}
