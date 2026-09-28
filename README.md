# Vitrine

Catálogo pessoal privado: cada pessoa registra tudo que consome — restaurantes,
filmes, livros, o que for. Cada **categoria** define a própria estrutura de
campos, os itens ficam organizados em **pastas**, e as **tags** são um
vocabulário compartilhado entre todas as categorias e todas as pessoas do grupo.

A interface é inteiramente em português do Brasil. O app é fechado por convite.

---

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript `strict` |
| Estilo | Tailwind CSS v4 (tokens por CSS, `@theme`) |
| Componentes | shadcn/ui sobre Radix, copiados em `components/ui/` |
| Banco + Auth | Supabase (Postgres + Auth), `@supabase/supabase-js` + `@supabase/ssr` |
| Validação | zod — um schema por formulário, compartilhado com a Server Action |
| Drag-and-drop | `@dnd-kit` |
| Ícones | lucide-react · **Toasts** sonner · **Fontes** next/font (Fraunces + Inter) |
| Testes | Vitest, só nas funções puras de `lib/domain/` |

Sem biblioteca de estado global, sem biblioteca de data fetching, sem ORM, sem
CSS-in-JS: Server Components + Server Actions + estado local otimista cobrem
tudo que este app precisa.

---

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha as duas variáveis
npm run dev
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento em http://localhost:3000 |
| `npm run build` | build de produção |
| `npm run test` | testes do domínio (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

A chave é a **anon** (publishable). Nunca a `service_role`: ela ignora a RLS e
tudo aqui é exposto ao navegador.

---

## Configuração do Supabase

### 1. Banco

No **SQL Editor**, rode nesta ordem:

1. `supabase/01_schema.sql`
2. `supabase/02_rls.sql`
3. `supabase/03_category_color.sql` a `supabase/07_entry_folders.sql`, em ordem
   (todos aditivos: cor de categoria, hardening, e as subpastas de categoria)

Projeto que já tinha a conta demo antiga (`demo-vitrine`, anterior à demo em
memória) roda ainda, **depois do deploy** da versão sem ela:

- `supabase/08_remove_demo_account.sql` — apaga a conta e os dados dela;
- `supabase/09_drop_demo_policies.sql` — **uma hora depois** do 08 (o tempo
  de o último token da conta expirar), devolve as políticas de RLS ao modelo
  do app. O porquê de cada espera está no comentário de cada arquivo.

> ⚠️ O `01_schema.sql` começa apagando as seis tabelas do app. É proposital: o
> formato de `categories.estrutura` e de `entries.custom_fields` mudou em
> relação à v1 e não há migração de dados. O arquivo termina recriando o perfil
> de todos os usuários que já existem em `auth.users`, então ninguém precisa ser
> convidado de novo.

O que o schema cria:

- as seis tabelas (`profiles`, `folders`, `categories`, `entries`, `tags`,
  `entry_tags`) — o `07` acrescenta a sétima, `entry_folders` (subpastas de
  dentro de uma categoria), e `entries.folder_id`;
- duas views de contagem (`category_entry_counts`, `tag_usage_counts`) com
  `security_invoker = true`, para o app nunca puxar linhas só para contar;
- o trigger de primeiro acesso, que cria o perfil e uma categoria de exemplo
  (**Restaurantes**).

### 2. Autenticação

**Authentication → Providers → Email**

- ligado;
- **Allow new users to sign up: desligado**. O app é fechado por convite, e o
  código também manda `shouldCreateUser: false`.

**Authentication → URL Configuration**

- *Site URL*: a URL do app;
- *Redirect URLs*: `http://localhost:3000/auth/callback` e a de produção.

**Authentication → Emails → Magic Link**

O template precisa trazer **link e código**, porque o app aceita os dois:

```html
<h2>Entrar na Vitrine</h2>
<p><a href="{{ .ConfirmationURL }}">Clique aqui para entrar</a></p>
<p>Ou digite este código no app: <strong>{{ .Token }}</strong></p>
```

### 3. Convidar gente

**Authentication → Users → Invite user**. O trigger cria o perfil no primeiro
acesso.

---

## Arquitetura

O motivo de existir desta versão é o carregamento. A v1 (Reflex) não renderizava
nada antes do WebSocket conectar, guardava o estado no servidor e fazia de 4 a 6
idas sequenciais ao Supabase depois da hidratação. As regras abaixo são o que
impede isso de voltar:

1. **Toda página é um Server Component que faz `await` dos próprios dados.** O
   HTML da primeira resposta já vem com coleções, itens e tags. Nenhum
   `useEffect` busca dados para a primeira pintura.
2. **Client Components são ilhas de interatividade**, não donos dos dados:
   recebem tudo pronto por props.
3. **O filtro roda 100% na memória do cliente.** A categoria inteira desce de
   uma vez; digitar na busca não gera requisição nenhuma.
4. **O estado do filtro não vai para `searchParams` via `router.push`** — isso
   re-executaria o Server Component a cada tecla. A URL é sincronizada com
   `window.history.replaceState` num debounce de 400 ms.
5. **Toda escrita é uma Server Action**: valida com zod → chama o Supabase (a
   RLS é quem autoriza) → `revalidatePath` → devolve `{ ok }` ou
   `{ ok: false, error }`. A exceção crua nunca chega na UI.
6. **Consultas independentes vão em `Promise.all`**, e o embedding do PostgREST
   é preferido a várias idas ao banco. Nenhuma página faz mais de duas idas em
   série.
7. **Contagem vem de view**, nunca de puxar linhas.
8. **Sessão em cookies httpOnly** (`@supabase/ssr`). O `middleware.ts` renova a
   sessão e barra rota protegida antes de renderizar.
9. **Toda mutação dá feedback instantâneo** e reverte com toast em caso de erro.
10. **Todo `page.tsx` tem um `loading.tsx`** com esqueleto fiel ao layout
    (exceto os de `/demo`, que não esperam dado nenhum).
11. **Lógica de domínio é TypeScript puro** em `lib/domain/`, sem React nem
    Supabase. É o que os testes cobrem.
12. **Imagem de item é `<img>` nativa**, com `loading="lazy"`. As URLs são
    externas e arbitrárias: liberar `remotePatterns: "**"` transformaria o
    otimizador do Next num proxy aberto.

### Estrutura

```
app/            rotas (Server Components) e actions.ts ao lado de cada rota
components/     ui/ (shadcn) · layout/ · collection/ · category/ · entry/ · tag/ · filter/
components/     … · demo/ (provider e banner da demonstração) · providers/ (useVitrine)
lib/
  actions/      contrato das escritas, schemas zod compartilhados, ActionResult
  demo/         acervo em memória da demonstração: seed, estado, operações
  domain/       TS puro e testado: tipos, campos, formatação, filtro, stats, erros
  queries/      leituras do Supabase
  supabase/     server.ts, client.ts, middleware.ts
supabase/       01_schema.sql … 09_drop_demo_policies.sql
```

### Organização: pastas, categorias e subpastas

```
Coleções › Bebidas › 🧃 Suco › Marca 1
   └─ pastas (folders)   └─ categoria   └─ subpastas (entry_folders)
```

- **Pastas das Coleções** (`folders`) organizam categorias. **Subpastas**
  (`entry_folders`) organizam os itens *dentro* de uma categoria. Ambas se
  aninham sem limite e usam as mesmas funções de árvore
  (`lib/domain/collections.ts`).
- A pasta aberta mora na URL (`?pasta=<id>`), trocada com
  `history.pushState`: F5 e o voltar do navegador funcionam, e navegar entre
  níveis continua sem ida ao servidor.
- O botão **Voltar** (`components/layout/level-nav.tsx`) sobe um nível:
  subpasta → categoria → pasta das Coleções → Coleções.
- Na categoria, o filtro e a aba Números olham **só os itens do nível aberto**.
- Excluir uma subpasta pergunta: **manter o conteúdo** (sobe um nível) ou
  **excluir tudo**. Mover um item para outra categoria o leva para a raiz dela.
- FKs compostas `(…, category_id)` garantem no banco que pasta-mãe e itens de
  uma subpasta são da mesma categoria.

### Filtros

- **E / OU**: na categoria, combina as tags marcadas; no filtro geral, combina
  tags **e** campos das categorias. Nome, nota e categoria valem sempre. O
  padrão é E.
- No filtro geral, **com categorias marcadas, só os campos delas** aparecem.
- O filtro geral **ordena** por data, nota, nome ou qualquer campo em escopo
  (quem não tem valor vai para o fim), agrupado por categoria ou numa lista só.

### Demonstração (`/demo`)

A demo roda **inteira no navegador**: não existe conta demo no Supabase e
nada do que o visitante faz sai da aba. Recarregar (F5) volta ao acervo de
exemplo (`lib/demo/seed-data.json`).

- Os componentes não importam Server Action nenhuma direto: pedem
  `useVitrine().actions` (`components/providers/vitrine-context.tsx`), que tem
  a forma do contrato `VitrineActions` (`lib/actions/contracts.ts`). No app,
  aponta para as Server Actions; em `/demo`, o `DemoProvider` troca por
  `createDemoActions` (`lib/demo/store.ts`), que transforma o acervo em
  memória com os **mesmos schemas zod** (`lib/actions/schemas.ts`) e as mesmas
  regras de domínio.
- Os ids do seed são UUIDs determinísticos (`demoId`), então o HTML do
  servidor bate com o do navegador e um link direto para uma categoria de
  exemplo sobrevive ao F5.
- A demo tem as próprias tags — nunca enxerga as do grupo.

### `estrutura` e `custom_fields`

`categories.estrutura` é uma lista **ordenada** de campos, cada um com um **id
estável**:

```json
[
  { "id": "f_8x2k1a", "nome": "Visitas", "tipo": "int" },
  { "id": "f_v7c4ln", "nome": "Modo", "tipo": "select", "opcoes": ["Salão", "Delivery"] }
]
```

E `entries.custom_fields` é chaveado pelo **id do campo**, não pelo nome:

```json
{ "f_8x2k1a": 4, "f_v7c4ln": "Salão" }
```

Na v1 a chave era o nome, então renomear um campo órfãava silenciosamente o
valor em todos os itens. Com id estável, renomear é seguro e barato — e o editor
de estrutura só pede confirmação quando a mudança realmente mexe nos itens
(campo acrescentado ou removido).

Os seis tipos de campo são `star`, `int`, `time`, `str`, `date` e `select`.
`star`, `int` e `time` são os numéricos: aceitam filtro por faixa e entram na
média da aba Números.

### Permissões

Todo usuário autenticado **lê** tudo; só o dono **escreve** o que é seu. As
`tags` são a exceção: vocabulário compartilhado, sem dono — qualquer autenticado
cria, edita e apaga, e a mudança vale para o acervo de todo mundo.

---

## Fora de escopo

- Console SQL / aba "Cmd" (a v1 tinha uma função `SECURITY DEFINER` que dava
  acesso irrestrito ao banco a qualquer autenticado — removida de propósito);
- upload de imagem (só links externos);
- cadastro aberto, recuperação de senha, login social;
- modo claro, paleta de comandos, notificações, comentários, favoritos.
