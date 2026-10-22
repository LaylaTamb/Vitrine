# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Vitrine**, uma "rede de gostos": cada pessoa cataloga o que consome (pastas → categorias com campos
próprios → itens) e mostra para quem quiser (Pública / Amigos / Privada). Também tem seguir,
Explorar, Match entre amigos, Mapa, importações e Steam. É feito com Next.js 15 (App Router) e
Supabase, e roda na Vercel.

Documentação existente (consulte em vez de duplicar):

- `README.md`: público, só explica o app e como usar.
- `GUIA-LOCAL.md`: o guia técnico completo (rodar, variáveis, a ordem dos SQLs, Geoapify, Steam,
  Gemini, Cron, a arquitetura e as regras de cada recurso). Está no `.gitignore` e só existe no
  computador da dona: num clone novo, ele não vem.
- `Claude outputs/plano-vitrine-rede-de-gostos.md`: o plano das fases do projeto.
- `supabase/CLAUDE.md`: as convenções e armadilhas das migrações SQL.

## Regras da dona (obrigatórias)

- **Não faça `git commit` nem `git push`, e não deixe nada em stage** (`git add`/`git rm`). A dona
  faz o commit e o push e testa no site no ar.
- **Nunca leia, mostre ou edite o `.env.local`.** Mexa só no `.env.example`, sempre com valores
  fictícios.
- **Não rode SQL em nenhum projeto Supabase** (nem por MCP, nem por script). Crie um `.sql` novo em
  `supabase/` e a dona roda no SQL Editor (veja `supabase/CLAUDE.md`).
- Não faça deploy nem nenhuma operação com efeito externo. Exemplo: `npm run keep-alive` faz uma
  chamada real ao Supabase.
- Trabalhe em etapas. Ao fim de cada uma, rode `npm run typecheck`, `npm run lint` e
  `npm run test`, mostre um resumo em pt-BR e espere a confirmação para seguir.
- Ao fim de cada fase, rode `npm run build`: pare o dev server antes e religue depois.
- Antes de instalar uma dependência nova, diga qual é, por quê e o tamanho, e espere o ok. Só use
  serviços gratuitos.
- Na dúvida, pergunte.
- O `README.md` só muda quando um recurso visível muda, e em linguagem de uso. O que é técnico vai
  para o `GUIA-LOCAL.md`, que nunca vai para o Git.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | dev server com Turbopack em http://localhost:3000 (no painel, preview `vitrine-dev` do `.claude/launch.json`) |
| `npm run build` | build de produção (`next build --turbopack`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint 9 (`next/core-web-vitals` + `next/typescript`) |
| `npm run test` | Vitest (`vitest run`) |
| `npx vitest run lib/domain/match.test.ts` | roda um arquivo de teste |
| `npx vitest run -t "nome do teste"` | roda um teste pelo nome |

O Vitest só procura `lib/domain/**/*.test.ts`, `lib/geo/**/*.test.ts`, `lib/import/**/*.test.ts` e
`lib/backup/**/*.test.ts` (veja `vitest.config.mts`), em ambiente `node`, sem DOM. Teste fora dessas pastas não roda. Os
testes cobrem só funções puras: nada de React, Supabase ou rede.

## Arquitetura

As 12 regras de carregamento estão no `GUIA-LOCAL.md`, seção "Arquitetura". O essencial:

- **Leitura.** Todo `page.tsx` é um Server Component que faz `await` dos próprios dados, e todo
  `page.tsx` tem um `loading.tsx`. Os Client Components são ilhas de interatividade e recebem os
  dados por props, sem `useEffect` para a primeira pintura. As leituras ficam em `lib/queries/*` e
  usam `createClient()` de `lib/supabase/server.ts` (sessão em cookies httpOnly via
  `@supabase/ssr`). Quem autoriza é a RLS.
- **Sem login**, o papel `anon` não lê nenhuma tabela. Ele lê só pelas RPCs `public_profile` e
  `public_category` (`lib/queries/public.ts`), uma de cada vez e só o que é público.
- **Escrita.** São Server Actions em `app/**/actions.ts`, ao lado da rota. O fluxo:
  1. valida com o zod (`lib/actions/schemas.ts`);
  2. chama o Supabase;
  3. faz `revalidatePath`;
  4. devolve um `ActionResult` (`lib/actions/result.ts`: `ok`, `fail`, `failValidation`).

  O `fail` passa o erro por `translateError` (`lib/domain/errors.ts`), então a UI recebe sempre uma
  frase em pt-BR e nunca a exceção crua.
- **Como os componentes escrevem.** As escritas centrais (coleções, categoria, itens, favoritos,
  mapa…) chegam por `useVitrine().actions` (`components/providers/vitrine-context.tsx`), tipado
  por `lib/actions/contracts.ts`. Uma escrita nova desse grupo entra no contrato e no contexto.
  Telas próprias (Lixeira, Matches, Configurações…) importam direto a action da rota.
- **Domínio.** É TypeScript puro e testado, em `lib/domain/`, e serve tanto ao servidor quanto ao
  cliente. Helper usado por um Server Component não pode ser exportado de um arquivo
  `"use client"`: ponha-o em `lib/domain/`.
- **Middleware** (`middleware.ts` → `lib/supabase/middleware.ts`):
  - renova a sessão (não ponha nada entre o `createServerClient` e o `getUser`);
  - manda quem não tem sessão para `/login?proximo=…`, fora dos `PUBLIC_PREFIXES` (`/login`,
    `/cadastro`, `/recuperar-senha`, `/auth`, `/v`, `/categoria`, `/termos`, `/privacidade`,
    `/api/cron`);
  - tira quem está logado das telas de entrar;
  - leva ao `/aceitar-termos` quem não aceitou a versão em vigor dos Termos (`TERMS_VERSION` em
    `lib/domain/terms.ts`: mudá-la obriga todo mundo a aceitar de novo);
  - deixa passar sem login o `sw.js`, o manifest e os ícones (o app instalável precisa deles).
- **Migração que ainda não rodou não pode quebrar o app.** As queries e as actions checam
  `isMissingSchema` / `isMissingColumn` (`lib/domain/errors.ts`) e mostram um aviso de "falta
  rodar" no lugar do erro. O código pode ir para o ar antes de a dona rodar o SQL.
- **Estado na URL.** O filtro roda na memória do cliente, e a URL é sincronizada com
  `history.replaceState` (com debounce), não com `router.push`. A pasta aberta usa o parâmetro
  `pasta` (`lib/navigation.ts`).
- **Imagens.** Toda imagem entra por link externo, numa `<img>` nativa. Não ative
  `remotePatterns: "**"` no `next/image`: o otimizador viraria um proxy aberto.

Rotas (nomes em pt-BR):

- **Coleções:** `/` (coleções) e `/categoria/[categoryId]/[entryId]`.
- **Perfil:**
  - `/v/[username]` (perfil, seguidores, seguindo e `story/`, a imagem via `next/og`);
  - `/u/:username` redireciona para `/v/` (`next.config.ts`);
  - `/perfil` leva ao próprio perfil.
- **Telas logadas:** `/explorar`, `/favoritos`, `/filtro`, `/mapa`, `/matches`, `/importar`,
  `/lixeira`, `/tags`, `/usuarios` (Pessoas), `/qr`, `/compartilhar` (o share target do app
  instalável) e `/configuracoes`.
- **Auth e textos legais:** as telas de auth, `/auth/callback`, `/termos`, `/privacidade` e
  `/aceitar-termos`.
- **APIs:** `/api/steam/{conectar,retorno}` (OpenID) e `/api/cron/{steam,lixeira}`.

## Integrações (todas só no servidor)

| Serviço | Onde | Observação |
| --- | --- | --- |
| Supabase | `lib/supabase/{server,middleware,anon,env}.ts` | chave anon/publishable apenas; `createAnonClient` para o que roda sem sessão (Cron) |
| Geoapify | `lib/geo/client.ts` (tem `import "server-only"`), parse puro em `lib/geo/parse.ts` | endereços, horário, trajeto |
| Steam | `lib/steam/{client,sync,state}.ts`, `/api/steam/*`, `/api/cron/steam` | OpenID + Web API; sincroniza todo dia |
| Gemini | `lib/ai/gemini.ts` | só recebe o nome da categoria; limite de 10 por dia no banco (`take_ai_suggestion_quota`, migração 27) |
| OpenFreeMap | `components/map/` (MapLibre + supercluster) | sem chave |
| QR / story | `qrcode` no servidor; `app/v/[username]/story/route.tsx` (`next/og`) | o satori ignora `object-position`: corte manual com `imageSizeOf`/`coverBox` (`lib/domain/remote-image.ts`) |

**Segredo do servidor.** O `CRON_SECRET` protege as rotas `/api/cron/*`:

- as rotas comparam `Bearer <segredo>` com `timingSafeEqual` sobre sha256;
- as funções do banco que gravam sem sessão conferem o mesmo valor com `server_secret_ok(p_secret)`,
  contra o hash em `app_secrets` (migração 24);
- é assim que o app evita a chave `service_role`.

## Regras de negócio críticas

Quem garante estas regras é o **banco** (RLS, gatilhos, funções), não a tela. Os detalhes estão
nas seções do `GUIA-LOCAL.md` com o mesmo nome.

- **Visibilidade.**
  - São três níveis por pasta e por categoria.
  - Vale o nível **mais restrito do caminho**: pasta privada esconde tudo o que está dentro.
  - Quem filtra são `visibility_allows_me`, `folder_is_visible`, `category_is_visible` e
    `entry_is_visible`.
  - Amigos = os dois se seguem. Bloquear esconde tudo nos dois sentidos.
  - Nunca resolva privacidade só na UI.
- **Tags** são um vocabulário compartilhado, sem dono: qualquer pessoa autenticada cria, edita e
  apaga.
- **"A organizar"** (categoria `kind = 'inbox'`) é travada: ninguém apaga, renomeia nem muda a
  estrutura (migração 17).
- **Cópia de Match** (`kind = 'match'`):
  - é privada, e item não entra nem sai dela; só existe o "Trazer" (gatilhos da 31);
  - quem monta é o `build_my_match_copy`, só com as "famílias" de categoria em comum (34);
  - esconder um match some só para quem escondeu, e a cópia fica.
- **Lixeira** (37):
  - pasta, categoria e subpasta vão como "foto" para `trash_items` por 30 dias, e a restauração
    mantém os ids;
  - item solto é apagado direto;
  - a limpeza roda pelo Cron e também ao abrir a Lixeira.
- **Troca de @** (15): no máximo 2 trocas a cada 14 dias, e só pela função `change_username`
  (um gatilho bloqueia o resto). O @ antigo redireciona para o novo e fica reservado por 14 dias.
- **Termos** exigem 18+. O aceite fica no `user_metadata` e é copiado para o perfil (16).
- **Favoritos:**
  - a estrelinha marca um item por categoria;
  - a aba Favoritos guarda categorias inteiras, só da própria pessoa.
- **Explorar.** "Pegar com os itens" cria uma cópia ligada que recebe as novidades de quem fez
  (26).
- **Sugestões de campos** aparecem a partir de 1 pessoa com categoria parecida (32), e a IA entra
  quando ninguém tem.

## Convenções de código

- **Sem ponto e vírgula**, aspas duplas, ~100 colunas, trailing comma `es5`, 2 espaços (os
  arquivos de config gerados pelo Next ainda usam `;`). **Não há config de Prettier**: o padrão
  dele põe `;`. Se for formatar, use `npx prettier --no-semi --print-width 100 --trailing-comma es5`.
- Identificadores em inglês. Comentários em pt-BR, explicando o porquê. A **interface é 100% em
  pt-BR**, com aspas tipográficas “”.
- Import pelo alias `@/` (a raiz). A UI usa shadcn (`components/ui/`, estilo `radix-nova`),
  ícones `lucide-react` e toasts `sonner`.
- Tailwind v4, com os tokens em `app/globals.css`. O app é **só escuro** (`<html class="dark">`).
  - Use os tokens, não cores soltas: `bg-surface`, `bg-surface-hi`, `border-line`, `border-line-hi`,
    `text-muted-foreground`, `text-faint`, `text-brand`, `bg-brand-wash`, `text-danger`…
  - **Nunca monte uma classe por concatenação ou interpolação**: o Tailwind não a gera. Use a
    classe literal ou um mapa.
- Celular primeiro:
  - confira em ~375px, ~768px e no desktop, sem rolagem horizontal;
  - ação que aparece só no hover fica `hidden sm:flex`;
  - texto longo leva `min-w-0 [overflow-wrap:anywhere]`.
- O usuário é "preguiçoso": toda ação deve caber em 1 ou 2 toques.

## Verificação no navegador

- Abra com o preview `vitrine-dev`. Quase toda rota exige login.
- Para conferir um componente sem sessão, use uma página temporária em `app/v/zz_teste/` (cai no
  prefixo público `/v`), marcada com `// TEMP-VERIFICACAO`, e **apague-a ao terminar**.
- No painel do navegador, a área de transferência é bloqueada. O print às vezes sai cortado ou
  velho: para medir estouro horizontal, compare `scrollWidth` com `clientWidth`.

## Deploy e ambiente

- **Vercel.** A dona dá commit e push e testa no site no ar.
- `vercel.json` tem dois Crons diários (UTC): `/api/cron/steam` às 09:23 e `/api/cron/lixeira` às
  09:41.
- **GitHub Actions.** `.github/workflows/supabase-keep-alive.yml` roda
  `scripts/supabase-keep-alive.mjs` (cron `17 9 */5 * *`). Ele usa os Secrets `SUPABASE_URL` e
  `SUPABASE_ANON_KEY`.
- **Variáveis** (os nomes estão no `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (opcional), `GEOAPIFY_API_KEY`,
  `STEAM_API_KEY`, `CRON_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL` (opcional).
  - Só as `NEXT_PUBLIC_*` vão para o navegador. As outras são lidas apenas em `lib/geo/client.ts`,
    `lib/steam/client.ts` e `lib/ai/gemini.ts`.
  - Nunca dê o prefixo `NEXT_PUBLIC_` a uma chave do servidor.
  - Não importe `lib/steam/` nem `lib/ai/` de um Client Component: eles não têm `server-only`.
- **Supabase.**
  - Os SQLs rodam à mão, em ordem (`GUIA-LOCAL.md` → "Configuração do Supabase").
  - A configuração de Auth (Redirect URLs, templates de e-mail, SMTP) fica no painel do Supabase,
    não no código.
  - Os links dos e-mails saem de `appOrigin()` (`lib/actions/origin.ts`).
- **Nunca use a chave `service_role`.** A chave anon é pública e a fronteira é a RLS.
- Todo fetch de URL de usuário feito no servidor passa por `publicImageUrl`
  (`lib/domain/remote-image.ts`, que bloqueia host interno).

## Pendente de confirmação

- **SQLs.** Quais arquivos de `supabase/` já rodaram em produção não dá para saber pelo código; o
  app tolera os que faltam.
- **Vercel.** O plano, o domínio de produção e se o deploy automático no push está ligado não
  estão no repositório. Só a dona relatou que testa no site no ar depois do push.
- **Node.** Não há versão fixada (sem `engines` nem `.nvmrc`). O workflow usa Node 22.
- **Keep-alive.** O comentário do workflow diz "uma vez por dia", mas o cron roda a cada 5 dias.
- **Guia desatualizado.** A seção "Estrutura" do `GUIA-LOCAL.md` está desatualizada: lista os SQLs
  só até o `20_favorites.sql`.
- **Repositório.** Não se sabe se o repositório do GitHub é público, nem se este `CLAUDE.md` deve
  ir para o Git (hoje ele não está no `.gitignore`).
