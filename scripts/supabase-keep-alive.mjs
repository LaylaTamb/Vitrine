#!/usr/bin/env node
/**
 * Keep-alive do Supabase.
 *
 * Projeto do plano gratuito é pausado depois de 7 dias sem atividade. Este
 * script faz uma leitura mínima pela API REST (PostgREST) — a consulta chega
 * ao Postgres, que é o que conta como atividade — e falha (exit 1) se a
 * resposta não vier 2xx. Roda todo dia pelo GitHub Actions
 * (`.github/workflows/supabase-keep-alive.yml`); falhar lá faz o GitHub mandar
 * e-mail, então dá para saber na hora se o projeto pausou ou a chave mudou.
 *
 * Usa só a chave pública (anon / publishable) — a mesma que o navegador já
 * recebe. Sem login, a RLS devolve uma lista vazia, e tudo bem: o que importa
 * é a consulta ter rodado. Nada é gravado.
 *
 * Rodar na máquina:  npm run keep-alive   (lê o .env.local)
 *
 * Variáveis: SUPABASE_URL e SUPABASE_ANON_KEY (no GitHub, como Secrets) — ou
 * as NEXT_PUBLIC_* do app, de reserva.
 */

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const ATTEMPTS = 3
const TIMEOUT_MS = 20_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function ping() {
  // Qualquer tabela serve; `tags` é pequena e não tem dado pessoal.
  const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/tags?select=id&limit=1`
  const started = Date.now()
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = await response.text()
  return { ok: response.ok, status: response.status, ms: Date.now() - started, body }
}

/**
 * Sai com `process.exitCode` em vez de `process.exit()`: encerrar à força
 * logo depois de um `fetch` derruba o Node no Windows (handle do libuv ainda
 * fechando). Assim o processo termina sozinho quando a conexão fecha.
 */
async function main() {
  if (!url || !key) {
    console.error(
      "Faltam SUPABASE_URL e/ou SUPABASE_ANON_KEY. No GitHub: Settings → Secrets and variables → Actions."
    )
    return 1
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const result = await ping()
      if (result.ok) {
        console.log(`Supabase respondeu ${result.status} em ${result.ms} ms — projeto ativo.`)
        return 0
      }
      console.error(
        `Tentativa ${attempt}/${ATTEMPTS}: HTTP ${result.status} — ${result.body.slice(0, 200)}`
      )
    } catch (error) {
      console.error(
        `Tentativa ${attempt}/${ATTEMPTS}: ${error instanceof Error ? error.message : error}`
      )
    }
    if (attempt < ATTEMPTS) await sleep(attempt * 10_000)
  }

  console.error(
    "O Supabase não respondeu. Se o projeto foi pausado, restaure em app.supabase.com (Project → Restore)."
  )
  return 1
}

process.exitCode = await main()
