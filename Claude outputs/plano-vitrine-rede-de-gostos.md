# Vitrine — o projeto hoje e o plano da "rede de gostos"

> Documento de passagem para o agente que vai executar o plano. Escrito em
> 19/10/2026, a partir do código no commit `63891ab` ("trocando magic link por
> login") e de duas rodadas de perguntas e respostas com a dona do produto,
> **Layla Sabatini Tambellini**.
>
> **Leia tudo antes de mexer.** A Parte 1 explica o projeto como ele está. A
> Parte 2 registra a nova visão e TODAS as decisões já tomadas (não pergunte de
> novo o que já está decidido aqui). A Parte 3 é o plano, em fases e etapas.
> Se algo descrito aqui não bater com o código, **pare e pergunte** em vez de
> adivinhar — o código pode ter mudado depois deste documento.

---

## Sumário

- [Regras de trabalho (obrigatórias)](#regras-de-trabalho-obrigatórias)
- [Parte 1 — O projeto hoje](#parte-1--o-projeto-hoje)
- [Parte 2 — A nova visão e as decisões](#parte-2--a-nova-visão-e-as-decisões)
- [Parte 3 — Plano de execução](#parte-3--plano-de-execução)
- [Apêndice — armadilhas conhecidas](#apêndice--armadilhas-conhecidas)

---

## Regras de trabalho (obrigatórias)

Estas regras vêm da dona do produto e valeram durante todo o projeto até aqui.

1. **Trabalhe em etapas.** Cada etapa da Parte 3 é uma entrega. Ao fim de cada
   uma, rode `npm run typecheck`, `npm run lint` e `npm run test`, mostre um
   resumo do que mudou e **espere a confirmação** antes da próxima.
2. **Não faça `git commit` nem `git push`.** A dona faz. Também não deixe nada
   em *stage* (`git add`/`git rm`): deixe as mudanças só na árvore de trabalho.
3. **Nunca leia, mostre ou edite o `.env.local`.** Só o `.env.example`, sempre
   com valores de exemplo, nunca chave de verdade.
4. **Não rode SQL em nenhum projeto Supabase** (nem por MCP, nem por script).
   Crie o arquivo `.sql` novo em `supabase/`, numerado na sequência (o próximo
   é o `14_…`), aditivo e idempotente sempre que der; a dona roda no SQL Editor.
5. **Interface 100% em português do Brasil.** Texto de tela, mensagens de erro,
   toasts, comentários de código e nomes de arquivo de rota em pt-BR (os
   identificadores de código seguem em inglês, como já são).
6. **O app é dark-only.** Use os tokens de cor do `app/globals.css`
   (`bg-surface`, `border-line`, `text-muted-foreground`, `text-faint`,
   `text-brand`, `bg-brand-wash`, `text-danger`, `bg-here`…) — nunca cores
   soltas. Exceções aceitas: as cores das fileiras do tier list, a roda de cores
   e a cor escolhida pelo usuário (categoria, pessoa no Match).
7. **Tailwind v4 só enxerga classes escritas por inteiro.** Nunca monte classe
   por concatenação (`"w-" + n`). Use mapas de strings completas (veja
   `lib/domain/grid-size.ts`) ou `cn()` com strings inteiras.
8. **Só serviços gratuitos neste MVP.** Nada que exija cartão de crédito.
9. **Usuário é preguiçoso:** todo fluxo novo deve salvar em 1–2 toques, sem
   tela intermediária desnecessária.
10. **Faça perguntas** quando algo for ambíguo, e sugira melhorias — mas não
    reabra decisões da Parte 2 sem um motivo técnico forte.
11. **Antes de instalar dependência nova**, diga qual, por quê e o tamanho, e
    espere o ok (as candidatas previstas estão na Parte 3).
12. **Verificação visual:** mudança de tela é conferida no navegador (no `/demo`
    quando não precisa de login) em ~375 px, ~768 px e desktop, sem rolagem
    horizontal. Remova qualquer página temporária de teste ao terminar.
13. **Ao fim de cada fase**, rode também `npm run build` (pare o servidor de
    desenvolvimento antes: os dois usam a mesma pasta `.next`).

---

## Parte 1 — O projeto hoje

### 1.1 O que é

Catálogo pessoal de tudo o que a pessoa consome — restaurantes, filmes, livros,
jogos, vinhos, o que for. Cada **categoria** tem a **própria estrutura de
campos** (definida pelo usuário), os itens podem ser organizados em
**subpastas** dentro da categoria, as categorias ficam em **pastas** nas
Coleções, e as **tags** são um vocabulário **global** compartilhado por todas as
pessoas. Itens com endereço aparecem no **Mapa**, que também sugere o que dos
seus lugares fica perto de você. Há uma **demonstração** completa em `/demo`,
sem login e sem banco.

Hoje: cadastro aberto por e-mail e senha (com confirmação de e-mail); cada
pasta/categoria é Pública (qualquer conta logada vê) ou Privada.

### 1.2 Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 15.5 (App Router, Turbopack), React 19.1, TypeScript `strict` |
| Estilo | Tailwind CSS v4 (tokens por CSS, `@theme`), dark-only |
| Componentes | shadcn/ui sobre Radix (`radix-ui`), copiados em `components/ui/` |
| Banco + Auth | Supabase (Postgres + Auth), `@supabase/supabase-js` 2.116 + `@supabase/ssr` 0.12 |
| Validação | zod 4 — schemas em `lib/actions/schemas.ts`, compartilhados entre Server Action e demo |
| Drag-and-drop | `@dnd-kit` |
| Mapa | MapLibre GL 5 + `supercluster`, tiles do **OpenFreeMap** (sem chave) |
| Geo (servidor) | **Geoapify** (plano grátis, 3.000 créditos/dia): geocodificação, dados do lugar, trajetos |
| Ícones / toasts | lucide-react · sonner |
| Testes | Vitest, só funções puras (`lib/domain/`, `lib/demo/`, `lib/geo/` — ver `vitest.config.mts`) |
| Hospedagem | Vercel (plano Hobby) · keep-alive do Supabase por GitHub Actions |

Scripts (`package.json`): `dev`, `build`, `start`, `lint`, `test`,
`typecheck`, `keep-alive`.

Variáveis de ambiente (ver `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a chave anon —
  nunca a `service_role` no cliente);
- `NEXT_PUBLIC_SITE_URL` (opcional: fixa o começo dos links dos e-mails);
- `GEOAPIFY_API_KEY` (só servidor).

### 1.3 Arquitetura — as 12 regras (do README)

1. Toda página é um **Server Component que faz `await` dos próprios dados**.
   Nenhum `useEffect` busca dados para a primeira pintura.
2. **Client Components são ilhas** de interatividade e recebem tudo por props.
3. **Filtros rodam 100% na memória do cliente.**
4. Estado de filtro na URL só por `history.replaceState` (com debounce), nunca
   `router.push`.
5. **Toda escrita é uma Server Action:** valida com zod → Supabase (a RLS
   autoriza) → `revalidatePath` → devolve `ActionResult`
   (`{ ok: true, data? } | { ok: false, error }`). Erro cru nunca chega à tela:
   passa por `translateError` (`lib/domain/errors.ts`).
6. Consultas independentes em **`Promise.all`**; embedding do PostgREST em vez
   de várias idas; nenhuma página faz mais de duas idas em série.
7. **Contagem vem de view** (`category_entry_counts`, `tag_usage_counts`, ambas
   `security_invoker`).
8. **Sessão em cookies httpOnly** (`@supabase/ssr`); o `middleware.ts` renova a
   sessão e barra rota protegida antes de renderizar.
9. **Toda mutação dá feedback instantâneo** e reverte com toast se der erro.
10. **Todo `page.tsx` tem um `loading.tsx`** (exceto os de `/demo`).
11. **Lógica de domínio é TypeScript puro** em `lib/domain/` — é o que os testes
    cobrem.
12. **Imagem de item é `<img>` nativa** (URLs externas arbitrárias; nada de
    `remotePatterns: "**"`).

**O contrato `VitrineActions`** (`lib/actions/contracts.ts`): componentes não
importam Server Action direto; pedem `useVitrine().actions`
(`components/providers/vitrine-context.tsx`). No app ele aponta para as Server
Actions; em `/demo`, o `DemoProvider` troca por `createDemoActions`
(`lib/demo/store.ts`), que altera o acervo em memória com os **mesmos schemas
zod**. **Toda ação nova do acervo entra nos três lugares**: contrato, mapa de
Server Actions no `vitrine-context.tsx` e demo store. Exceções que importam a
Server Action direto (porque não existem na demo): Configurações
(`app/configuracoes/actions.ts`) e conta (`app/auth/actions.ts`).
`useVitrine()` também devolve `basePath` (`""` ou `"/demo"`) e `isDemo`.

### 1.4 Estrutura de pastas

```
app/                    rotas (Server Components) e actions.ts ao lado de cada rota
  page.tsx              Coleções (pastas + categorias do dono)
  categoria/[id]/       uma categoria (abas Itens e Números) e /[entryId] (página do item)
  filtro/               Filtro geral (todas as categorias do dono)
  mapa/                 Mapa e aba Sugestões (+ actions.ts: Geoapify)
  tags/                 tags (vocabulário global)
  u/[username]/         coleções de outra pessoa  ← vira /v/[username] (Fase 1)
  usuarios/             "Pessoas" (todas as contas)
  configuracoes/        perfil, senha, privacidade padrão, backup (+ actions.ts)
  login/ cadastro/ recuperar-senha/ redefinir-senha/   conta
  auth/callback/        destino dos links dos e-mails (token_hash ou code)
  auth/actions.ts       entrar, criar conta, recuperar, nova senha
  demo/                 a demonstração (DemoProvider, sem banco)
  actions.ts            pastas, categorias, visibilidade, sair
components/
  ui/                   shadcn
  layout/               navbar, menus, cabeçalhos, toggles, formulários de configurações
  collection/           cards e diálogos das Coleções, PrivacySwitch
  category/             tela da categoria, editor de estrutura, roda de cores, Números
  entry/                card, linha, formulário, página do item, tier list, duração 00:00
  filter/               Filtro geral (hook useGlobalFilter + barra lateral)
  map/                  Mapa (MapLibre), lista, cartões, Sugestões
  tag/ auth/ demo/ providers/
lib/
  actions/              contrato, schemas zod, ActionResult
  domain/               TS puro e testado (tipos, campos, filtro, stats, privacidade,
                        auth, cor, duração, mapa, horário OSM…)
  geo/                  Geoapify: client.ts (só servidor) + parse.ts (puro, testado)
  queries/              leituras do Supabase (sessão, coleções, categoria, item, acervo…)
  supabase/             server.ts, middleware.ts, env.ts
  backup/               formato e importação do backup JSON
  demo/                 seed (formato de backup), estado e ações em memória
supabase/               01_schema.sql … 13_profile_after_email_confirmation.sql
scripts/ .github/       keep-alive do Supabase
```

### 1.5 Modelo de dados (Postgres / Supabase)

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `profiles` | `id` (= `auth.users.id`), `username` (único), `display_name`, `avatar_url` (link), `created_at`, `default_public` (12) | criada por gatilho; com o 13, só quando o e-mail é confirmado |
| `folders` | `id`, `owner_id`, `name`, `parent_folder_id`, `display_order`, `is_public` (12) | pastas das Coleções, aninháveis |
| `categories` | `id`, `owner_id`, `name` (único por dono), `icon`, `color` (`#RRGGBB` qualquer), `folder_id`, `display_order`, `estrutura` (jsonb), `rating_enabled`, `default_sort`, `is_public` (12) | `default_sort` padrão `rating_desc` (12) |
| `entries` | `id`, `category_id`, `owner_id`, `folder_id` (subpasta), `name`, `rating` (0–5, passo 0,5, nulo), `image_url`, `image_display`, `custom_fields` (jsonb), `display_order`, `created_at`, `updated_at` | `custom_fields` é chaveado pelo **id** do campo |
| `entry_folders` | `id`, `owner_id`, `category_id`, `name`, `parent_folder_id`, `display_order` | subpastas dentro da categoria |
| `tags` | `id`, `name` (único **global**), `color` | vocabulário compartilhado, sem dono |
| `entry_tags` | `entry_id`, `tag_id` | |
| `entry_places` | `entry_id`, `field_id`, `owner_id`, `address`, `formatted_address`, `lat`, `lng`, `place_id` (id da **Geoapify**), `status`, `geocoded_at` | cache da geocodificação de cada campo Localização |

Cascatas: `profiles` → `auth.users on delete cascade`; todo o resto →
`profiles on delete cascade`. Apagar a conta em `auth.users` apaga tudo.

**`estrutura`** é uma lista ordenada de campos com **id estável**
(`{ id: "f_8x2k1a", nome, tipo, opcoes?, moeda? }`). Os 9 tipos, nesta ordem no
editor: `star` (Estrela 0–5), `date`, `str` (Texto), `int`, `decimal`, `time`
(**Duração h:min — guardada em minutos**), `currency` (com `moeda`), `select`
(com `opcoes`), `location` (texto do endereço; coordenadas em `entry_places`).
Toda categoria já tem, além da estrutura, **Nome**, **Imagem** e (se
`rating_enabled`) a **Avaliação** em estrelas.

**Migrações** (rodadas à mão pela dona; 01–11 confirmadas; **confirme com ela
se 12 e 13 já foram rodadas** antes de criar o 14):

| Arquivo | O que faz |
| --- | --- |
| 01–02 | schema, gatilho de primeiro acesso (`seed_profile`), views de contagem, RLS base |
| 03 | cor de categoria |
| 04 | hardening (`(select auth.uid())` nas políticas) |
| 05–06, 08–09 | conta demo antiga (já removida) |
| 07 | subpastas (`entry_folders`) |
| 10 | estrelas opcionais, `default_sort`, ordem manual (`reorder_*`) |
| 11 | `entry_places` + `prune_entry_places` |
| 12 | `is_public` em pastas/categorias, `default_public` no perfil, gatilho que aplica o padrão, funções `folder_chain_is_public`, `category_is_visible`, `entry_is_visible` (SECURITY DEFINER) e políticas de leitura; ordem padrão `rating_desc` |
| 13 | perfil e categoria de exemplo só nascem quando o e-mail é confirmado |

**Modelo de RLS hoje:** cada tabela tem "leitura autenticada" (a partir do 12,
filtrada pela visibilidade), e "dono insere/edita/apaga". Só `authenticated` lê;
`anon` não lê nada. Pasta privada esconde tudo o que está dentro dela, em
qualquer profundidade.

### 1.6 Funcionalidades existentes (resumo)

- **Coleções:** pastas aninháveis, categorias, arrastar para reordenar, mover,
  grade P/M/G ou lista, cadeado nas privadas, interruptor Pública/Privada no topo
  da pasta aberta.
- **Categoria:** abas **Itens** (grade, lista, **tier list** S–E pela nota;
  subpastas; filtro por nome/nota/tags E-OU; ordenações; ordem manual com
  arrastar; seleção em massa: mover para subpasta, mover para outra categoria,
  tag, excluir) e **Números** (resumo, notas por faixa, destaques, uma linha por
  campo, tags — conta a pasta aberta com as subpastas).
- **Editor de estrutura:** nome, ícone (emoji), cor (8 da paleta + **roda de
  cores/HEX**), visibilidade (só ao criar), estrelas ligadas/"Nula", ordem
  padrão, campos (modo visual com arrastar ou JSON). Texto pode virar
  Localização.
- **Item:** formulário com campos por tipo (estrelas, data, duração 00:00 com
  colunas roláveis, moeda, lista, localização), imagem por link com
  enquadramento, tags (cria tag na hora). Página do item com "Abrir no Maps".
- **Mover itens entre categorias** (`lib/domain/migrate.ts`): mantém valor quando
  o campo de destino tem o **mesmo nome e tipo** (e, em lista, a opção existe);
  o resto se perde, com aviso; leva a localização junto (`fieldMap`).
- **Filtro geral** (`/filtro`): todas as categorias, campos unificados por
  nome+tipo, E/OU, ordenação por qualquer campo.
- **Mapa** (`/mapa`): pinos com cor e ícone da categoria, clusters, lista,
  "Minha localização", filtro só com categorias que têm Localização, aba
  **Sugestões** (seus lugares perto de você, com horário/contato do OSM via
  Geoapify e tempo de trajeto). "Abrir no Maps"/"Como chegar" são links do
  Google Maps (sem API).
- **Privacidade:** Pública/Privada por pasta e categoria; padrão do perfil nas
  Configurações.
- **Conta:** e-mail e senha; confirmação de e-mail; recuperar senha; criar senha
  (também para contas antigas, que entravam por link); trocar senha nas
  Configurações (derruba as outras sessões); sair (escopo global).
- **Backup:** exportar e importar o acervo inteiro em JSON (Configurações).
- **Demo** (`/demo`): tudo menos Mapa e conta, em memória, a partir de
  `lib/demo/seed-data.json` (formato de backup).

### 1.7 Configurações externas pendentes (manuais, da dona)

- Supabase Auth: "Allow new users to sign up" **ligado**, "Confirm email"
  **ligado**, senha mínima 8 + "Letters and digits"; Redirect URLs com
  `/auth/callback` (local e produção); modelos de e-mail (Confirm signup, Reset
  password, Invite user) com `token_hash` — o texto exato está no README, seção
  "2. Autenticação".
- SMTP próprio (o envio padrão do Supabase é limitado).
- `GEOAPIFY_API_KEY` no `.env.local` e na Vercel.
- SQLs 12 e 13 (confirmar se já rodaram).

---

## Parte 2 — A nova visão e as decisões

### 2.1 A visão

O Vitrine deixa de ser só um app pessoal e vira uma **rede social de
compartilhamento de gostos**. O ativo é o dado: gostos extremamente bem
categorizados (estrutura própria por categoria, notas, campos, lugares). O
modelo de negócio previsto é **vender insights agregados e anonimizados** —
nunca dado pessoal identificável. Princípio de produto: **o usuário é
preguiçoso** — tudo precisa ser rápido, fácil e nada chato.

### 2.2 Decisões gerais

| Tema | Decisão |
| --- | --- |
| Visibilidade | **3 níveis: Pública / Amigos / Privada**, por pasta e por categoria. Vale o nível mais restrito no caminho de pastas. |
| Amigos | **Amigos = pessoas que se seguem mutuamente.** O app é de **seguir** (sem aceite). |
| "Pública" | Passa a significar **qualquer pessoa na internet**: o perfil `/v/usuario` abre **sem login** e mostra o cartão e as categorias públicas. Quem já tem categorias públicas vê um **aviso único** sobre essa mudança. |
| Leitura sem login | Por funções que entregam **um perfil/uma categoria por vez** — nunca abrir as tabelas para o papel `anon` (dificulta raspar a base, que é o ativo). |
| Catálogo comum | Sim: uma tabela de "coisas" (lugares primeiro; depois filmes, livros, jogos) para saber que dois itens são a mesma coisa. Lugares guardam ids da Geoapify, do OSM e (no futuro) do Google. Filmes/livros/jogos: **Wikidata** (livre inclusive para uso comercial); **evitar TMDB** (API gratuita só para uso não comercial). |
| Dados e insights | Insights usam **só dados públicos**, agregados. |
| Termos e LGPD | Termos de uso e Política de privacidade. Controladora: **Layla Sabatini Tambellini**, pessoa física, contato **laylatambellini@gmail.com**. **Idade mínima 18 anos.** Aceite no cadastro (e uma vez para quem já tem conta). **Excluir minha conta** (direito da LGPD). Recomendar revisão por advogado antes de lançar. |
| Plataforma | **PWA** no MVP; app nativo depois (sem prazo). Tudo que exige nativo fica anotado como "depois". |
| Orçamento | **Só gratuito** no MVP. |
| Ordem | Fundações → Preguiça → Social → Descoberta → Match. |

### 2.3 Decisões por funcionalidade

**1. Lugar onde você está (Google Maps → Geoapify por enquanto)**
- Fonte: **Geoapify** (grátis) agora; migrar para o Google quando oficializar.
- MVP: a sugestão aparece **quando o app abre** (com permissão de localização).
  Notificação por localização = **app nativo, depois**.
- "Pessoas avaliaram": mostra **o @ de quem avaliou** e a nota — das avaliações
  **públicas** para todos, e das marcadas **Amigos** para os amigos de quem
  avaliou. Não há aprovação para mostrar trechos de texto: não mostrar texto
  livre por enquanto.
- Qualquer lugar que apareça no mapa (não só estabelecimentos).
- Adicionar → escolher categoria (as que têm Localização primeiro) ou **"A
  organizar"**; Nome e Localização preenchidos; pode dar **estrelas** já aqui.

**"A organizar"** — uma categoria-caixa-de-entrada **por conta**, criada
automaticamente, com Nome, Localização e Estrelas. Recebe itens do ponto 1, do
compartilhamento (10) e do "Trazer" do Match (4).

**2. Amizade**
- **Seguir** (sem aceite). Amigos = mútuos. **Bloquear** e **remover seguidor**.
- @ próprio, sempre visível; perfil em **`/v/usuario`** (`/u/` redireciona).
- Trocar o @: **até 2 vezes a cada 14 dias**. O @ antigo **redireciona** para o
  novo e fica **reservado por 14 dias**; depois fica livre.
- Adicionar por **@ e QR code** agora. **Telefone** (e achar amigos pela
  **agenda**) = app nativo, depois. Quando vier, o telefone pode ficar oculto.
- **QR pessoal:** escanear pessoalmente faz **os dois se seguirem** (viram
  Amigos na hora).
- **Sininho** com notificações dentro do app (novo seguidor etc.).

**3. Cartão de apresentação**
- Foto **por link** (sem upload por enquanto), nome, @, **bio de até 220
  caracteres**, **até 5 categorias** escolhidas (pode ser zero) — **só
  categorias Públicas**; cada uma mostra os **3 melhores** itens (maior nota;
  em categoria sem estrelas, os 3 primeiros da ordem manual).
- **Todos veem** o cartão (inclusive sem login).
- **Exportar como imagem de story (9:16)**: foto, @, bio, as categorias com os
  3 melhores e o **QR** do perfil.
- **Aplicativos conectados** (aba nas Configurações):
  - **Steam — integração de verdade:** cria e atualiza a categoria **"Jogos"**
    (pasta "Steam") com o campo **Horas jogadas**, atualizada **sozinha de
    tempos em tempos** (1x/dia). Não mostra nada extra no cartão.
  - **Spotify, YouTube, Instagram, X, Discord: só link.**

**4. Match**
- Convite para **Amigos**, **até 8 pessoas** no total (grupo já no MVP).
  **Todos precisam aceitar**; se alguém recusar, **o match é cancelado**.
- Quando todos aceitam, **cada participante recebe a sua cópia independente**
  (uma **foto do momento**, não atualiza) numa pasta **"Matches"** criada
  automaticamente (renomeável e apagável; o próximo match recria).
- Nome da categoria: **"@você & @amigo · DD/MM/AAAA"** (com a data, porque é
  uma foto do momento); editável.
- A categoria **não tem estrutura própria**: mostra os itens de cada pessoa.
  Compara **todas as categorias**. Itens organizados em **subpastas por
  categoria de origem**; o resto é **marcação nos itens**: **"Em comum"** (pelo
  menos 2 pessoas têm) e **"Sugestão para @x"** (nota ≥ 4 de outra pessoa e @x
  não tem).
- Cada pessoa tem uma **cor automática**.
- Na sua cópia você **pode editar e apagar** os itens (nome, imagem, nota e
  tags; os campos originais ficam só para leitura).
- **"Trazer"** uma sugestão manda o item para **"A organizar"** (sem a nota do
  outro).
- **% de compatibilidade** (aprovada a proposta): por par —
  *sobreposição* = itens em comum ÷ (25% da coleção menor), teto 1;
  *concordância* = média de (1 − |nota A − nota B| ÷ 5) nos itens avaliados
  pelos dois (1 se não houver);
  **% = sobreposição × (0,6 + 0,4 × concordância)**. Grupo = média dos pares.

**5. Sugestões de campos ("Campos usados em categorias como essa")**
- Só ao **criar** uma categoria.
- Fonte **A + B**: (A) campos de **categorias públicas** de outras pessoas com
  nome parecido, usados por **≥ 3 pessoas**; (B) quando não houver dados, **IA
  gratuita (Gemini)** com limite diário, mandando **só o nome da categoria**.
- "Trazer" adiciona o campo **com as opções (listas) e a moeda**.

**6. Categorias prontas e Explorar**
- **Toda categoria pública** pode ser usada como modelo, mostrando o **@ do
  autor**. Sem modelos oficiais por enquanto.
- **"Nova categoria" → "Começar de um modelo":** traz **só a estrutura**.
- **Tela Explorar** (só categorias no MVP, com busca e "mais copiadas"):
  "Pegar com itens", **até 500 itens**; os itens vêm **com tudo — nome, imagem,
  campos, tags e a nota**.
- A cópia do Explorar **fica ligada à original**, com estas regras: itens novos
  do autor chegam; edição do autor atualiza os itens que você **não** editou;
  item apagado pelo autor continua no seu, marcado "removido do original";
  original que ficar privada ou for apagada para de sincronizar (sua cópia fica
  como está); você pode **desligar a ligação**.

**7. Importações**
- **Google Maps via Takeout** (não há API dos "Salvos"): uma **categoria por
  lista do Google** + **"Salvos com estrela"**; campos **Nome, Localização, Sua
  anotação**; pasta **"Google Maps"**; listas sem coordenadas são localizadas
  numa fila de até 3.000/dia (lista grande termina no dia seguinte, com aviso);
  reimportar não duplica.
- **Letterboxd** (arquivo exportado): só os **filmes assistidos** (sem a
  watchlist), na categoria **"Filmes"** (pasta "Letterboxd") com **Nome, Ano,
  Nota (estrelas 0,5–5), Data em que assistiu, Resenha**. Reimportar acrescenta
  os novos e **atualiza as notas** que mudaram.
- **Steam:** pela conexão do ponto 3.
- Pasta com o nome da origem; visibilidade = **padrão do perfil**.

**8. Trocar item de categoria**
- Botão **no formulário de edição** do item.
- Mantém o valor quando o campo é o **mesmo campo de origem** (mesmo id — duas
  categorias vindas do mesmo modelo) **ou** tem o **mesmo nome e o mesmo tipo**.
  Nome igual com **tipo diferente → em branco**. O resto **é apagado** (com
  aviso de quantos campos se perdem antes de confirmar).
- Tags, imagem e nota vão junto (a nota some se o destino não usa estrelas).
- Depois de mover, o item **reabre em edição** na categoria nova.

**9. Campo principal**
- Toda estrutura tem **exatamente um** campo principal (Nome, Estrelas ou um
  campo da estrutura). Categorias existentes começam com **Nome**. Escolhido só
  no editor de estrutura. **Não precisa ser preenchido** e **não aparece em
  destaque** nos cards — serve só para o popup do acesso rápido.

**10. Acesso extra rápido (Compartilhar)**
- Prioridade: **Android (PWA)** → extensão de navegador → iPhone (app nativo).
- **Só texto** por enquanto. O texto vira o **Nome**.
- Escolher categoria existente (preenche o campo principal, se não for o Nome),
  **criar categoria** (só o nome; **estrelas ligadas**; **ícone automático por
  palavra-chave**) ou **"A organizar"**.
- Sugerir a categoria pelo texto **se possível**.
- Sem login: entra e **volta direto** para o compartilhamento.
- Aviso discreto **"Instale o Vitrine"** depois do login e opção nas
  Configurações.

**11. Favoritos**
- Aba **Favoritos** no menu principal = **"meu favorito de cada categoria"**.
- **Um favorito por categoria** (estrela no canto do item), **só você vê**
  (não vai para o cartão nem para o perfil).
- Você **monta a aba à parte** (escolhe quais categorias e a ordem); marcar a
  estrela não adiciona a categoria sozinho.
- **Categoria sem favorito não aparece** na aba (no modo de editar a aba, ela
  aparece na lista para você gerenciar).

---

## Parte 3 — Plano de execução

Convenções do plano:

- **SQL:** cada etapa que mexe no banco cria **um** arquivo novo, a partir do
  `14_…`. Aditivo, idempotente, comentado no topo como os anteriores (o que faz,
  por quê, o que acontece com o que já existe). Funções SECURITY DEFINER sempre
  com `set search_path`, `revoke … from public, anon` e `grant` explícito.
- **Coluna nova antes da migração rodar:** leia com `select("*")` (nunca pelo
  nome) e, ao escrever, traduza o erro de coluna ausente (`isMissingColumn`, em
  `lib/domain/errors.ts`) para "rode o supabase/NN…". O app não pode quebrar
  entre o deploy e a dona rodar o SQL.
- **Demo:** toda ação nova do acervo entra no contrato e na demo store; o que
  não fizer sentido na demo (social, importação, Steam) fica escondido nela.
- **Testes:** toda regra nova em `lib/domain/` com teste; adicione o diretório
  ao `include` do `vitest.config.mts` se criar um novo (ex.: `lib/import/`).
- **README:** atualize a seção correspondente a cada etapa, e a lista de SQLs.

### Fase 1 — Fundações

#### Etapa 1.1 — Visibilidade em 3 níveis e base de seguidores
**SQL 14** (`14_visibility_and_follows.sql`):
- `visibility` (`'public' | 'friends' | 'private'`) em `folders` e `categories`,
  preenchida a partir de `is_public` (true → public, false → private);
  `profiles.default_visibility` a partir de `default_public`. Atualizar o
  gatilho de padrão (`fill_is_public_from_owner`) para o novo campo. Manter as
  colunas antigas até o código não usá-las (remover numa migração posterior) e,
  enquanto as duas existirem, mantê-las **coerentes por gatilho** (`is_public =
  visibility = 'public'`), porque o código antigo e o novo podem conviver entre
  o deploy e a dona rodar o SQL.
- `follows (follower_id, followee_id, created_at)` — PK no par, check
  `follower_id <> followee_id`, FKs para `profiles` com cascade; RLS: qualquer
  autenticado lê os follows (para contagens e listas); insere só como
  `follower_id = auth.uid()`; apaga o próprio follow **ou** um follow em que
  você é o seguido (= remover seguidor).
- `blocks (blocker_id, blocked_id, created_at)` — RLS: só o dono lê/escreve.
  Bloquear apaga os follows nos dois sentidos (gatilho) e impede novos (check na
  política de insert de `follows`).
- Funções (SECURITY DEFINER, `stable`): `are_friends(a, b)`,
  `is_blocked(a, b)` (qualquer sentido), `visibility_allows(owner, visibility,
  viewer)` (dono, ou `public`, ou `friends` + `are_friends`, e nunca se houver
  bloqueio), `folder_chain_allows(folder_id, viewer)` (o mais restrito no
  caminho), e reescrever `category_is_visible` / `entry_is_visible` com elas
  (viewer = `auth.uid()`).
- Reescrever as políticas de leitura de `folders`, `categories`, `entries`,
  `entry_folders`, `entry_tags`, `entry_places` com as funções novas.
- **Leitura sem login:** NÃO dar `select` a `anon` nas tabelas. Criar RPCs
  SECURITY DEFINER, executáveis por `anon` e `authenticated`:
  `public_profile(p_username)` (perfil + cartão + categorias públicas com
  contagem) e `public_category(p_category_id)` (uma categoria pública e seus
  itens). Elas devolvem só o que é `public` (e respeitam a cadeia de pastas).
- `profiles.public_notice_seen_at` para o aviso único (A9).

**Código:**
- `lib/domain/privacy.ts`: tipo `Visibility`, rótulos, "mais restrito no
  caminho" (substitui `privateAncestor`), e testes.
- `PrivacySwitch` vira um seletor de 3 opções (segmentado), com a opção
  **Amigos escondida até a Fase 3** (flag), mesmo visual atual; cadeado/ícone
  por nível nos cards; aviso "dentro de uma pasta mais restrita".
- Ações `setFolderVisibility` / `setCategoryVisibility` passam a receber
  `visibility`; criação de pasta/categoria idem; Configurações → padrão com 3
  opções. Contrato, Server Actions e demo store.
- **Aviso único** (banner) para quem tem categoria pública e ainda não viu:
  "Pública agora quer dizer visível na internet, também para quem não tem
  conta".

**Aceite:** dono vê tudo; conta logada que não é amiga vê só `public`; amigos
veem `friends`; bloqueados não se veem; pasta mais restrita esconde o que está
dentro; nada do banco é legível por `anon` direto pelo PostgREST (documente no
topo do SQL como testar no SQL Editor com `set role anon`).

#### Etapa 1.2 — @ próprio e `/v/usuario` aberto sem login
**SQL 15** (`15_username_handles.sql`): `username_changes (profile_id,
old_username, new_username, changed_at)`; função `change_username(p_new)`
(SECURITY DEFINER): valida formato (`^[a-z0-9_]{3,30}$`), lista de palavras
reservadas (admin, v, u, login, cadastro, api, demo, mapa, filtro, tags,
explorar, favoritos, configuracoes, vitrine…), **no máximo 2 trocas em 14
dias**, e recusa um @ que outra pessoa largou há menos de 14 dias;
`resolve_username(p)` devolve o @ atual quando `p` é um @ antigo ainda
reservado (para o redirecionamento).

**Código:**
- Rota `app/v/[username]/` (mover de `app/u/`); `app/u/[username]` vira
  redirecionamento permanente para `/v/…`; trocar todos os links `/u/` do app.
- `/v/…` entra nas rotas públicas do middleware. Com login: leitura normal (RLS).
  Sem login: via `public_profile` / `public_category`. Visitante vê o cartão
  (Fase 3 completa o cartão; aqui basta nome, @ e categorias públicas) e um
  convite "Crie sua conta".
- Página de categoria pública acessível sem login (somente leitura) a partir do
  perfil: `/v/[username]/[categoryId]` ou reaproveitar `/categoria/[id]` com
  modo visitante — escolha a que reaproveitar mais código e explique.
- Configurações: trocar @ com a regra visível ("você pode trocar mais N vez(es)
  até DD/MM") e o erro traduzido. O @ aparece sempre visível (navbar/menu e
  perfil).

**Aceite:** `/v/fulano` abre deslogado e mostra só o público; `/u/fulano`
redireciona; @ antigo redireciona por 14 dias; limite de trocas respeitado.

#### Etapa 1.3 — Termos, Privacidade, 18+ e excluir conta
**SQL 16** (`16_terms_and_account_deletion.sql`): `profiles.terms_version`,
`profiles.terms_accepted_at`, `profiles.adult_confirmed_at`; função
`delete_my_account()` SECURITY DEFINER que apaga `auth.users where id =
auth.uid()` (as cascatas levam o resto — confirme no 01).

**Código:**
- Páginas públicas `/termos` e `/privacidade` (texto em pt-BR, em linguagem
  simples): controladora **Layla Sabatini Tambellini** (pessoa física),
  contato **laylatambellini@gmail.com**; dados coletados (conta, acervo,
  localização só quando autorizada e só no momento, integrações); finalidades
  (o serviço; **insights agregados apenas de dados públicos**); com quem é
  compartilhado (Supabase, Vercel, Geoapify, OpenFreeMap, Google Gemini — só
  nomes de categoria —, Steam quando conectado); retenção; direitos da LGPD
  (acesso, correção, exclusão, portabilidade via backup, revogação);
  **idade mínima 18**; cookies (só sessão). Marcar no topo "versão" e data.
  Recomendar revisão jurídica.
- Cadastro: caixa obrigatória "Tenho 18 anos ou mais e aceito os Termos e a
  Política de privacidade" (validada também no servidor; grava aceite).
  Contas antigas: tela `/aceitar-termos` na próxima entrada (middleware ou
  layout verifica `terms_version` atual).
- Configurações → **Excluir minha conta**: digitar o próprio @ para confirmar;
  chama `delete_my_account`, sai e volta ao login com mensagem.
- Links para Termos e Privacidade no rodapé das telas de conta e nas
  Configurações.
- `/termos` e `/privacidade` entram nas rotas públicas do middleware
  (`lib/supabase/middleware.ts`), assim como `/v` na etapa 1.2.

**Aceite:** ninguém cria conta sem marcar a caixa; conta antiga precisa aceitar
uma vez; excluir conta apaga tudo e encerra a sessão.

#### Etapa 1.4 — "A organizar"
**SQL 17** (`17_inbox_category.sql`): `categories.kind` (`'normal' |
'inbox'`, padrão `normal` — o `'match'` entra na Fase 5) com índice único
parcial `(owner_id) where kind = 'inbox'`; criar a "A organizar" para quem já
tem perfil (estrutura com um campo Localização de id fixo; estrelas ligadas;
ícone 📥) e no `seed_profile` para contas novas. Se o dono já tiver uma
categoria chamada "A organizar", use um sufixo.

**Código:** a categoria aparece fixa no topo das Coleções, com visual de caixa
de entrada; não pode ser apagada nem ter a estrutura editada, e o nome é fixo
"A organizar" (proposta do plano — a dona não decidiu se pode renomear;
pergunte antes de implementar); itens dela podem ser movidos (etapa 2.2). Demo
com a mesma categoria. Helper `inboxOf(categories)`.

**Aceite:** toda conta tem exatamente uma; os fluxos das próximas fases conseguem
salvar nela em 1 toque.

#### Etapa 1.5 — Catálogo comum (lugares)
**SQL 18** (`18_catalog.sql`): `catalog_items (id, kind 'place'|'movie'|'book'|
'game', title, year, lat, lng, external_ids jsonb, data jsonb, created_at,
updated_at)` com índices únicos por id externo (ex.:
`(external_ids->>'geoapify')`, `(external_ids->>'osm')`); leitura por
autenticados; escrita só por função SECURITY DEFINER
`upsert_catalog_place(...)`. `entry_places.catalog_item_id` (nulo) e
`entries.catalog_item_id` (para filmes/livros/jogos depois). Backfill: cria os
lugares a partir das `entry_places` com `status = 'ok'`.

**Código:** a geocodificação (`app/mapa/actions.ts`) passa a fazer o upsert no
catálogo e ligar a `entry_places`; `lib/domain/catalog.ts` com
`normalizeTitle` (minúsculas, sem acento, sem pontuação, sem artigos iniciais) —
base para "é a mesma coisa" quando não há id externo. Testes.

**Aceite:** dois itens de pessoas diferentes no mesmo lugar apontam para o mesmo
`catalog_items.id`.

> **Fim da Fase 1:** `npm run build`, README atualizado (visibilidade, @, `/v/`,
> termos, "A organizar", catálogo), lista de SQLs 14–18 com o que cada um faz.

### Fase 2 — Preguiça

#### Etapa 2.1 — Campo principal
**SQL 19** (`19_quick_field.sql`): `categories.quick_field text not null
default 'name'` (`'name' | 'rating' | <id de campo>`).

**Código:** seletor "Campo do acesso rápido" no editor de estrutura (Nome,
Estrelas se ligadas, e os campos); se o campo escolhido for removido ou as
estrelas desligadas, volta para `name` (no domínio: `quickFieldOf(category)`;
no servidor ao salvar). Demo. Testes.

#### Etapa 2.2 — Trocar de categoria no formulário de edição
**Código (sem SQL):**
- `migrateCustomFields`: acrescentar a regra **mesmo id e mesmo tipo** antes da
  regra de nome+tipo; tipo diferente → em branco. Garantir que importar modelo
  (Fase 4) **preserva os ids dos campos**. Testes.
- No formulário de edição do item: seletor "Categoria". Ao trocar, diálogo com o
  impacto (`movePreview`: N mantidos, N apagados) → `bulkMoveEntries([id],
  destino)` → abre o item na categoria nova **já em edição**. Tags e imagem vão
  junto; nota some se o destino não tem estrelas; localização segue o
  `fieldMap` (já existe).

#### Etapa 2.3 — Favoritos
**SQL 20** (`20_favorites.sql`): `categories.favorite_entry_id` (nulo, FK para
`entries on delete set null`, com gatilho garantindo que o item é da
categoria); `profiles.favorite_category_ids uuid[] not null default '{}'`
(ordem da aba).

**Código:**
- Estrela no canto do card/linha/página do item, só para o dono (toque marca;
  marcar outro troca; tocar de novo desmarca).
- Aba **Favoritos** (`/favoritos`) no menu principal, depois de Tags (manter
  "Pessoas" como está): mostra, na ordem escolhida, o favorito de cada categoria
  da lista — **categoria sem favorito não aparece**. Modo "Editar aba":
  adicionar/remover categorias e arrastar para ordenar (aqui as sem favorito
  aparecem). Demo também.

#### Etapa 2.4 — App instalável + Compartilhar (Android)
**Código (sem SQL):**
- `app/manifest.ts` (nome, cores do tema, `display: standalone`, ícones
  192/512 — gerar a partir do wordmark), service worker mínimo
  (`public/sw.js`, só o necessário para instalar), e
  `share_target` → `GET /compartilhar?text=…&title=…&url=…` (aceitar só texto
  agora; se vier link, tratar como texto).
- Aviso discreto "Instale o Vitrine" (evento `beforeinstallprompt`) depois do
  login, dispensável e lembrado no `localStorage`; botão também nas
  Configurações. Explicar no iPhone que não há "Compartilhar" para web apps.
- Rota `/compartilhar` (protegida; sem login → login → volta com o texto,
  usando `safeNextPath`): painel compacto "Salvar em…" com o texto como Nome;
  categorias recentes primeiro + busca; **Nova categoria** (só nome; estrelas
  ligadas; ícone por palavra-chave — `iconForCategoryName` em `lib/domain/`,
  com testes); **A organizar**; se a categoria tem campo principal ≠ Nome,
  pede só ele. Salvar → toast "Salvo em X" com **Desfazer** e volta.
- Sugestão de categoria pelo texto (se possível): comparar o texto normalizado
  com nomes de itens/catálogo e sugerir a categoria mais provável no topo.

**Depois (fora do MVP desta fase):** extensão do Chrome ("clique direito →
Enviar para o Vitrine" abrindo `/compartilhar?text=`); iPhone com app nativo.

> **Fim da Fase 2:** build, README.

### Fase 3 — Social

#### Etapa 3.1 — Seguir, Amigos, bloquear e notificações
**SQL 21** (`21_notifications.sql`): `notifications (id, user_id, type, actor_id,
payload jsonb, read_at, created_at)` com RLS "só o dono"; gatilho em `follows`
cria "novo seguidor"; função para marcar como lidas.

**Código:**
- No perfil `/v/…`: botão **Seguir/Seguindo**, selo **Amigos** quando é mútuo,
  contagens de seguidores/seguindo, listas; menu com **Bloquear**; na sua lista
  de seguidores, **Remover seguidor**.
- Liberar a opção **Amigos** no seletor de visibilidade (etapa 1.1).
- "Pessoas" (`/usuarios`) com botão de seguir.
- **Sininho** na navbar com contagem de não lidas (lida no servidor junto do
  perfil, sem `useEffect` na primeira pintura) e lista de notificações.

#### Etapa 3.2 — QR pessoal (vira Amigos na hora)
**SQL 22** (`22_qr_tokens.sql`): `qr_tokens (token_hash, profile_id, expires_at)`
(RLS: só o dono cria); função `redeem_qr(p_token)` SECURITY DEFINER: token
válido (≈5 min) → cria os follows **nos dois sentidos** (respeitando
bloqueios) e notifica os dois.

**Código:** tela "Meu QR" (tela cheia, renova o token sozinha a cada ~4 min;
o QR codifica `https://<site>/v/<usuario>?qr=<token>`); abrir esse link logado
chama `redeem_qr` e mostra "Agora vocês são amigos"; deslogado → login →
volta. "Ler QR" usa `BarcodeDetector` quando existir; senão, orienta a usar a
câmera do celular. Dependência prevista para gerar QR: `qrcode` (MIT) — pedir
ok antes.

#### Etapa 3.3 — Cartão de apresentação + story
**SQL 23** (`23_profile_card.sql`): `profiles.bio` (check ≤ 220),
`profiles.card_category_ids uuid[]` (≤ 5), `profiles.social_links jsonb`
(instagram, x, discord, spotify, youtube). Atualizar `public_profile` para
devolver o cartão completo.

**Código:**
- Cartão no topo de `/v/…`: foto (link), nome, @, bio, links das redes
  (validados: aceitar @ ou URL e normalizar), até 5 categorias **públicas**
  com os **3 melhores** (nota desc, empate por nome; sem estrelas → ordem
  manual). Categoria que deixou de ser pública **some do cartão na leitura**
  (filtrar na consulta, não depender de gatilho).
- Configurações → **Perfil**: bio, escolher/ordenar as categorias do cartão
  (só públicas aparecem para escolher), links.
- **Story 9:16:** rota `app/v/[username]/story/route.tsx` com `ImageResponse`
  (`next/og`, 1080×1920): foto, @, bio, categorias com os 3 melhores e o QR do
  perfil (link simples `/v/usuario`, sem token). Botão "Compartilhar no story"
  (Web Share com arquivo no celular; download no desktop).

#### Etapa 3.4 — Aplicativos conectados (Steam)
**SQL 24** (`24_connected_accounts.sql`): `connected_accounts (user_id,
provider, external_id, display_name, connected_at, last_synced_at,
last_error)` (RLS só o dono); `entries.source` + `entries.source_id` com único
`(owner_id, source, source_id)` — usado também pelas importações da Fase 4.

**Código:**
- Configurações → **Aplicativos conectados**: Steam (conectar/desconectar) e os
  campos de link das outras redes (os mesmos da etapa 3.3).
- **Steam OpenID** (rota de ida e volta; verificar a resposta com
  `check_authentication`) → guarda o SteamID64. `STEAM_API_KEY` (gratuita, só
  servidor). `GetOwnedGames` (com `include_appinfo`) → pasta **"Steam"**,
  categoria **"Jogos"** com o campo **Horas jogadas** (`time`, minutos —
  `playtime_forever` já vem em minutos), item por jogo (`source = 'steam'`,
  `source_id = appid`), imagem do jogo. Avisar se o perfil Steam não for
  público.
- **Atualização diária:** rota `/api/cron/steam` protegida por `CRON_SECRET`,
  chamada 1x/dia (Vercel Cron do plano Hobby ou GitHub Actions, como o
  keep-alive). Sem sessão de usuário, ela precisa da **chave secreta do
  Supabase** (só servidor) — ou de uma função SECURITY DEFINER chamada com um
  segredo; escolha e explique. Novas variáveis no `.env.example`:
  `STEAM_API_KEY`, `CRON_SECRET` (e a chave secreta, se usada).

> **Fim da Fase 3:** build, README (seguir/amigos, QR, cartão, story,
> aplicativos conectados, variáveis novas e onde obter cada chave).

### Fase 4 — Descoberta

#### Etapa 4.1 — "Começar de um modelo" (só estrutura)
**SQL 25** (`25_templates_and_explore.sql`): `category_imports (id,
source_category_id, target_category_id, user_id, mode 'structure'|'linked',
created_at)` (para "usado por N" e "mais copiadas"); `categories.source_category_id`,
`categories.linked boolean`; RPC `search_public_categories(q, sort)` (nome
normalizado, @ do autor, prévia dos campos, contagem de cópias).

**Código:** no "Nova categoria", aba **Começar de um modelo**: busca, cartão
com @ do autor, campos e "usado por N"; **Usar** traz nome, ícone, cor,
estrelas, ordem padrão e campos **preservando os ids**.
`normalizeCategoryName` no domínio (minúsculas, sem acento, singular simples).

#### Etapa 4.2 — Explorar (com itens, cópia ligada)
**SQL 26** (`26_linked_copies.sql`): `entries.source_entry_id`,
`entries.edited_after_copy boolean`, `entries.source_removed_at`; função de
sincronização SECURITY DEFINER que aplica as regras da Parte 2 (novos chegam;
edição do autor só atualiza os não editados; apagado no original → marca;
original não pública/apagada → `linked = false`).

**Código:** tela **`/explorar`** (menu: decidir com a dona se entra no menu
principal ou dentro de Coleções): busca e "mais copiadas"; **Pegar com itens**
(até 500) → copia categoria + itens com **nome, imagem, campos, tags e nota**;
sincroniza ao abrir a categoria ligada (e/ou 1x/dia); selo "ligada a @autor" e
botão **Desligar**.

#### Etapa 4.3 — Sugestões de campos (dados reais + Gemini)
**SQL 27** (`27_field_suggestions.sql`): RPC `field_suggestions(p_name)` —
agrega a `estrutura` das categorias **públicas** com nome normalizado parecido,
conta **donos distintos** por (nome do campo normalizado, tipo), devolve os com
**≥ 3**, com as opções mais comuns e a moeda; `field_suggestion_cache
(normalized_name, fields jsonb, source 'ai', created_at)`.

**Código:** no editor, **só ao criar**: painel "Campos usados em categorias
como essa" com **Trazer** (campo + opções + moeda, id novo). Se a RPC voltar
vazia: Server Action chama o **Gemini (plano gratuito)** com `GEMINI_API_KEY`
(só servidor), enviando **só o nome da categoria**, pedindo JSON (nome, tipo,
opções, moeda) validado com zod; cache por nome normalizado; limite diário por
pessoa (ex.: 10). Documentar no README e na Política que o plano gratuito do
Gemini pode usar o que recebe para treinamento.

#### Etapa 4.4 — "Você está em X?" (lugar onde você está)
**Código (+ SQL 28 `28_place_ratings.sql`):**
- `lib/geo`: chamada da **Geoapify Places** (lugares num raio pequeno, ~150 m)
  com parse testado e cache por coordenada arredondada.
- Ao abrir Coleções/Mapa, se a localização já foi autorizada (nunca pedir sem
  ação do usuário na primeira vez): faixa "Você está em X?" com até 3 lugares.
- Cartão do lugar: tipo e horário (OSM) + "No Vitrine": RPC
  `place_ratings(p_catalog_item_id)` devolve **@ e nota** das avaliações
  visíveis para quem pergunta (públicas; Amigos se for amigo); nota média e
  contagem. Sem texto livre.
- **Adicionar** → escolher categoria (com Localização primeiro) ou **A
  organizar**; Nome + Localização preenchidos (já com coordenadas e catálogo —
  sem gastar crédito de geocodificação); estrelas opcionais.

#### Etapa 4.5 — Importar do Google (Takeout) e do Letterboxd
**Código (+ SQL se faltar algo de `source`/`source_id`):** tela **Importar**
(Configurações):
- **Google:** passo a passo ilustrado do Takeout; aceitar os arquivos extraídos
  (`Saved Places.json` e os `.csv` da pasta "Saved") — se quiser aceitar o
  `.zip` direto, a dependência prevista é `jszip` (pedir ok). Ler **no
  navegador** e mandar as linhas em lotes para uma Server Action. Pasta
  **"Google Maps"**; uma categoria por lista + **"Salvos com estrela"**; campos
  **Nome, Localização, Sua anotação**; `source = 'google'`, `source_id` = link
  do lugar (dedupe). Estrelados já têm coordenadas (grava `entry_places` direto,
  `ok`); listas entram como pendentes na fila de geocodificação existente
  (3.000/dia), com aviso e notificação ao terminar.
- **Letterboxd:** aceitar o `.zip` ou os CSVs (`watched.csv`, `ratings.csv`,
  `diary.csv`, `reviews.csv`); juntar pelo **Letterboxd URI**; pasta
  **"Letterboxd"**, categoria **"Filmes"** com **Nome, Ano (int), Nota (a nota do
  item, 0,5–5), Data em que assistiu (date), Resenha (str)**; `source =
  'letterboxd'`, `source_id` = URI. Reimportar: acrescenta os novos e atualiza a
  nota que mudou. **Sem a watchlist.**
- Visibilidade = padrão do perfil (o gatilho do banco já aplica). Parsers puros
  em `lib/import/` com testes (fixtures pequenas).

> **Fim da Fase 4:** build, README (modelos, Explorar, sugestões, "você está
> em", importações, `GEMINI_API_KEY`).

### Fase 5 — Match

#### Etapa 5.1 — Convite e aceite
**SQL 29** (`29_matches.sql`): `matches (id, created_by, created_at, status
'pending'|'ready'|'canceled', compat jsonb)`, `match_members (match_id,
user_id, status 'invited'|'accepted'|'declined', color, responded_at)` (RLS:
só membros leem); convite só para **Amigos**, **até 8 pessoas**; função
`respond_match(p_match_id, p_accept)`: recusa → `canceled` (avisa todos); todos
aceitaram → chama a montagem (5.2). Notificações de convite, cancelamento e
match pronto.

**Código:** "Novo match" no perfil de um amigo e na pasta Matches (escolher até
7 amigos); tela de convite pendente com Aceitar/Recusar.

#### Etapa 5.2 — Montagem da cópia e % de compatibilidade
**SQL 30** (`30_match_build.sql`): `categories.kind` ganha `'match'`;
`entries.match_owner_id`, `entries.match_color`, `entries.match_common
boolean`, `entries.match_suggestion_for uuid[]`, `entries.match_fields jsonb`
(os campos originais formatados, só leitura). Função `build_match(p_match_id)`
SECURITY DEFINER: para **cada** participante, cria (se não existir) a pasta
**"Matches"**, a categoria **"@a & @b · DD/MM/AAAA"** (grupo: todos os @),
**subpastas por categoria de origem**, e copia os itens de todas as categorias
dos participantes **visíveis entre eles naquele momento** (público + amigos;
nunca privado), com cor automática por pessoa e as marcações "Em comum" (≥ 2
têm — mesmo `catalog_item_id`, ou mesmo título normalizado em categorias
equivalentes: mesmo nome normalizado, mesmo modelo de origem ou mesmo tipo de
catálogo) e "Sugestão para @x" (nota ≥ 4 de outra pessoa; @x não tem).

**Código:**
- `lib/domain/match.ts` (puro, testado): equivalência de categorias e itens,
  marcações, e a fórmula de compatibilidade da Parte 2 (com o exemplo 100/40/8
  → 77% como teste).
- Tela da categoria Match: legenda de cores por pessoa, % de compatibilidade (do
  par ou do grupo), filtros rápidos "Em comum" e "Sugestões para mim"; card com
  a cor do dono; item com nome, imagem, nota, tags editáveis e os campos
  originais só para leitura; **Trazer** → copia para **A organizar** (nome,
  imagem, localização; sem a nota do outro).
- A pasta "Matches" pode ser renomeada/apagada; o próximo match a recria.

> **Fim da Fase 5:** build, README (Match, regras, privacidade da cópia).

### Depois do MVP (registrado, não fazer agora)

- App nativo (Capacitor): notificação por localização ("você está no X"),
  telefone com verificação por SMS, achar amigos pela agenda, compartilhar no
  iPhone.
- Extensão do Chrome para o acesso rápido.
- Compartilhar links e imagens com preenchimento automático (título/foto do
  link).
- Migrar a fonte de lugares para o Google (o catálogo já guarda os ids).
- Catálogo de filmes/livros/jogos via Wikidata (e ligar Letterboxd/Steam a ele).
- Spotify/YouTube como integração de verdade (dependem de aprovação das
  plataformas).
- Upload de foto de perfil (Supabase Storage).
- Insights agregados (produto de dados) e planos pagos (Vercel Pro, que o uso
  comercial exige).

### Limites dos serviços gratuitos (considerar no desenho)

| Serviço | Limite |
| --- | --- |
| Vercel Hobby | **sem uso comercial**; cron no máximo 1x/dia |
| Supabase Free | 500 MB de banco, 1 GB de arquivos, 50 mil usuários ativos/mês; pausa se ficar parado (o keep-alive cuida) |
| Supabase e-mail padrão | limite baixo de envios; configurar SMTP próprio |
| Geoapify | 3.000 créditos/dia, 5 requisições/s (o `lib/geo/client.ts` já espaça) |
| Gemini (gratuito) | limite diário; pode usar o conteúdo para treinamento |
| Steam Web API | 100 mil chamadas/dia; perfil precisa ser público |

---

## Apêndice — armadilhas conhecidas

Coisas que já custaram tempo neste projeto:

- **Ambiente:** Windows; a ferramenta de shell é Git Bash. Não há Python. Para
  git, use `git -c safe.directory='*' …`.
- **Edições por `perl`/`sed`:** com `perl -pi -e 's|…|…|'`, um `\|` no padrão
  vira alternação (o `|` é o delimitador) e corrompe o arquivo — use `#` como
  delimitador. Na substituição, `$1` seguido de dígito vira `$17`; use `${1}7`.
  Prefira a ferramenta de edição quando o trecho tiver `|` (tipos TS!).
- **`.next` compartilhado:** pare o servidor de desenvolvimento antes de
  `npm run build`, e religue depois.
- **Radix Popover dentro de Dialog:** o diálogo modal bloqueia rolagem e toques
  fora dele (`react-remove-scroll`); porte o conteúdo do popover para dentro do
  próprio diálogo (`Popover.Portal container={…closest('[role=dialog]')}`), como
  em `components/entry/duration-input.tsx`.
- **Server Action com `redirect()`** chamada do cliente: o `await` volta
  `undefined` quando redireciona — trate `result && !result.ok`.
- **Supabase `signOut()`** tem escopo **global** por padrão (o app usa
  explicitamente).
- **Colunas de migração ainda não rodada:** `select("*")` na leitura; erro de
  coluna ausente traduzido para "rode o SQL N" (`isMissingColumn`).
- **Navegador interno (testes visuais):** a captura de tela às vezes vem
  atrasada; confirme pelo DOM (`find`, `read_page`, `javascript_tool`). A roda do
  mouse simulada não rola elementos com o painel em segundo plano — teste
  rolagem setando `scrollTop` via script.
- **`components/ui/*` importam `cn` do pacote `"cn"`**; o resto do app usa
  `cn` de `@/lib/utils`. Siga o padrão do arquivo que estiver editando.
- **Estilo de código:** sem ponto e vírgula, aspas duplas, largura ~100,
  vírgula final no estilo ES5, comentários em pt-BR explicando o *porquê*. Não
  há Prettier configurado no projeto; não reformate arquivos inteiros.
