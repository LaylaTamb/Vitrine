# Vitrine

Catálogo pessoal privado: cada pessoa registra tudo que consome — restaurantes,
filmes, livros, o que for. Cada **categoria** define a própria estrutura de
campos, os itens ficam organizados em **pastas**, e as **tags** são um
vocabulário compartilhado entre todas as categorias e todas as pessoas do grupo.
Itens com endereço aparecem no **Mapa**, que também diz o que dos seus lugares
salvos fica perto de você agora.

A interface é inteiramente em português do Brasil. Qualquer pessoa cria conta
com e-mail e senha; o que cada um vê das outras é só o que elas deixaram público.

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
| Mapa | MapLibre GL + `supercluster`, com o mapa do [OpenFreeMap](https://openfreemap.org/) (sem chave, sem limite). Endereços, horário e trajetos: [Geoapify](https://www.geoapify.com/) (dados do OpenStreetMap), só no servidor, plano grátis |
| Ícones | lucide-react · **Toasts** sonner · **Fontes** next/font (Fraunces + Inter) |
| Testes | Vitest, só nas funções puras: `lib/domain/`, `lib/demo/` e o tratamento das respostas da Geoapify (`lib/geo/parse.ts`) |

Sem biblioteca de estado global, sem biblioteca de data fetching, sem ORM, sem
CSS-in-JS: Server Components + Server Actions + estado local otimista cobrem
tudo que este app precisa.

---

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento em http://localhost:3000 |
| `npm run build` | build de produção |
| `npm run test` | testes do domínio (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run keep-alive` | pinga o Supabase uma vez (o mesmo que o GitHub Actions faz todo dia) |

### Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# o Mapa — veja "Configuração da Geoapify"
GEOAPIFY_API_KEY=sua-chave              # servidor: endereços, horário e trajetos
```

A chave do Supabase é a **anon** (publishable). Nunca a `service_role`: ela
ignora a RLS e tudo aqui é exposto ao navegador.

A da Geoapify é **opcional**: sem ela o app inteiro funciona (o mapa também
aparece — o desenho vem do OpenFreeMap, que não tem chave); só a busca dos
endereços e os dados das Sugestões avisam que ela falta. Ela **nunca** leva o
prefixo `NEXT_PUBLIC_` — com ele, o Next a embutiria no JavaScript do
navegador.

Na **Vercel**, cadastre as mesmas variáveis em *Settings → Environment
Variables*. As `NEXT_PUBLIC_*` entram no build: depois de mudar uma delas,
faça um novo deploy.

---

## Configuração do Supabase

### 1. Banco

No **SQL Editor**, rode nesta ordem:

1. `supabase/01_schema.sql`
2. `supabase/02_rls.sql`
3. `supabase/03_category_color.sql` a `supabase/07_entry_folders.sql`, em ordem
   (todos aditivos: cor de categoria, hardening, e as subpastas de categoria)
4. `supabase/10_rating_toggle_manual_order.sql` (aditivo: estrelas opcionais
   por categoria, ordenação padrão e ordem manual de itens e subpastas)
5. `supabase/11_entry_places.sql` (aditivo: a localização dos itens para o
   Mapa — tabela `entry_places` e a função `prune_entry_places`). Sem ele o
   app funciona, mas o Mapa pede para rodar
6. `supabase/12_privacy_and_rating_sort.sql` (aditivo: pastas e categorias
   **públicas ou privadas**, o padrão de privacidade do perfil e as regras de
   leitura que escondem o privado de terceiros; e a ordem padrão "Nota (maior
   primeiro)"). Tudo o que já existe continua público. Sem ele o app funciona
   como antes, e o botão Pública/Privada avisa que falta rodar
7. `supabase/13_profile_after_email_confirmation.sql` (aditivo: com o
   cadastro aberto, o perfil e a categoria de exemplo só nascem quando o
   e-mail é confirmado — conta que nunca confirmou não aparece em Pessoas nem
   prende um nome de usuário). Rode antes de abrir o cadastro

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
  dentro de uma categoria), e `entries.folder_id`; o `11`, a oitava,
  `entry_places` (onde fica cada endereço);
- duas views de contagem (`category_entry_counts`, `tag_usage_counts`) com
  `security_invoker = true`, para o app nunca puxar linhas só para contar;
- o trigger de primeiro acesso, que cria o perfil e uma categoria de exemplo
  (**Restaurantes**).

### 2. Autenticação (e-mail e senha)

Quem guarda e confere as senhas é o **Supabase Auth** (com hash, no servidor
dele — o app nunca vê nem grava senha). A sessão vive em cookies httpOnly
(`@supabase/ssr`) e o middleware a renova a cada requisição: atualizar a
página ou voltar dias depois continua logado, até sair ou a sessão expirar.

**Authentication → Sign In / Providers → Email**

- **Email**: ligado;
- **Allow new users to sign up: ligado** — o cadastro é aberto (`/cadastro`);
- **Confirm email: ligado** — a conta só entra depois do link de confirmação;
- **Minimum password length: 8** e **Password requirements: Letters and
  digits** — os mesmos requisitos que a tela mostra (`lib/domain/auth.ts`);
- **Secure password change**: pode ficar desligado (ligado, trocar a senha nas
  Configurações pede um login recente).

**Authentication → URL Configuration**

- *Site URL*: a URL de produção;
- *Redirect URLs*: `http://localhost:3000/auth/callback` e
  `https://seu-dominio/auth/callback`. Destino fora desta lista o Supabase
  recusa — é isso que impede um link de e-mail de levar para outro site.

**Authentication → Emails → SMTP Settings**

O envio de e-mail padrão do Supabase é para testes: tem limite baixo de envios
por hora e pode entregar só para os e-mails do time do projeto. Com o cadastro
aberto, configure um SMTP próprio (Resend, Brevo, Amazon SES…) — senão a
confirmação e a recuperação de senha não chegam para quem é de fora.

**Authentication → Emails → Templates**

Os links levam a `/auth/callback` com `token_hash`, que funciona em qualquer
aparelho (o modelo padrão do Supabase, PKCE, só funciona no mesmo navegador
que pediu o e-mail — o app aceita os dois, mas estes são os recomendados).
Os links valem por 1 hora (*Email OTP Expiration*) e uma vez só.

*Confirm signup*:

```html
<h2>Confirme seu e-mail</h2>
<p>Falta só confirmar para entrar na Vitrine.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirmar meu e-mail</a></p>
```

*Reset password* — serve também para quem ainda não tem senha:

```html
<h2>Criar uma senha nova</h2>
<p>Recebemos um pedido para criar uma senha nova na Vitrine.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Criar senha nova</a></p>
<p>Se não foi você, ignore este e-mail: nada muda na sua conta.</p>
```

*Invite user* — o convite leva direto a criar a senha:

```html
<h2>Você foi convidado para a Vitrine</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite">Aceitar e criar minha senha</a></p>
```

*Magic Link* não é mais usado pelo app.

O que o app faz com cada link (`app/auth/callback/route.ts`): troca o token
por uma sessão; quem chega por **recuperação** ou **convite** vai para
`/redefinir-senha` criar a senha; quem confirma o cadastro entra direto. Link
vencido ou já usado volta para o login com a explicação.

### 3. Contas que já existiam (antes da senha)

A troca não recria nem desvincula ninguém: cada conta continua com o mesmo
`id` em `auth.users` e em `profiles`, e todos os dados seguem ligados a ele.
O que muda é que essas contas **ainda não têm senha**. Dois caminhos:

1. quem ainda está logado: **Configurações → Senha**, e cria a senha ali;
2. quem não está: **Entrar → Esqueci minha senha**. O link do e-mail leva a
   criar a senha — vale também para quem nunca teve uma.

"Criar conta" com o e-mail de uma conta que já existe não cria outra e não
avisa que ela existe (a tela é igual para todo mundo); ela orienta a entrar
ou a usar "Esqueci minha senha".

Convites pelo painel (**Authentication → Users → Invite user**) continuam
funcionando, com o modelo *Invite user* acima.

### 4. Keep-alive (projeto gratuito)

O plano gratuito do Supabase pausa o projeto depois de 7 dias sem atividade.
O workflow `.github/workflows/supabase-keep-alive.yml` roda todo dia um ping
de leitura (`scripts/supabase-keep-alive.mjs`) e falha — o GitHub manda
e-mail — se o Supabase não responder. Ele precisa de dois **Secrets** em
*Settings → Secrets and variables → Actions*:

- `SUPABASE_URL` — a mesma de `NEXT_PUBLIC_SUPABASE_URL`;
- `SUPABASE_ANON_KEY` — a chave **anon/publishable** (nunca a `service_role`).

Para testar sem esperar o horário: *Actions → Supabase keep-alive → Run
workflow*. Em repositório público, o GitHub desliga agendamentos depois de 60
dias sem commit; aí é só reativar o workflow na mesma tela.

---

## Configuração da Geoapify

O Mapa tem duas partes, e nenhuma delas cobra:

- **o desenho do mapa** vem do [OpenFreeMap](https://openfreemap.org/) (tema
  escuro): sem conta, sem chave, sem limite de uso;
- **endereço → coordenada, horário, contato e trajeto** vêm da
  [Geoapify](https://www.geoapify.com/), com dados do OpenStreetMap. Só o
  servidor fala com ela.

"Abrir no Maps" e "Como chegar" são links comuns para o Google Maps: não usam
chave nem API nenhuma do Google.

### 1. Conta e chave

1. Crie a conta em [myprojects.geoapify.com](https://myprojects.geoapify.com/)
   — plano **Free**, sem cartão.
2. Crie um projeto; a chave (*API key*) aparece na página dele.
3. Ponha a chave em `GEOAPIFY_API_KEY` no `.env.local` e na Vercel
   (*Settings → Environment Variables*) e faça um novo deploy.

Deixe a chave sem restrição de site ou IP: quem chama é o servidor (a Vercel
não tem IP fixo), e ela nunca chega ao navegador.

### 2. Créditos do plano grátis

O plano Free dá **3.000 créditos por dia** (renovam todo dia) e aceita até 5
pedidos por segundo — o servidor espaça os pedidos sozinho. Sem cartão
cadastrado, passar do limite não gera cobrança: a Geoapify recusa e o app
avisa ("Os créditos grátis da Geoapify acabaram por hoje").

| Ação no app | Créditos |
| --- | --- |
| Abrir a página do Mapa | 0 — o desenho é do OpenFreeMap e as coordenadas já estão no banco |
| Salvar um item com endereço novo ou mudado, ou converter Texto → Localização | 1 por endereço |
| "Tentar de novo" nos itens sem pino | 1 por endereço |
| Sugestões: buscar por um endereço digitado | 1 |
| Sugestões: abrir a aba, ou mudar posição, raio ou recorte | até 20 (dados dos 20 mais perto) + até 10 (trajeto dos 10 mais perto) |

O servidor guarda os dados de cada lugar por 24 h e os trajetos por 15 min:
abrir as Sugestões de novo no mesmo dia quase não gasta. As coordenadas ficam
no banco (`entry_places`) sem prazo — um endereço só é procurado de novo
quando o texto dele muda.

### 3. Observações

- **O crédito é obrigatório**: o plano grátis exige mostrar "Powered by
  Geoapify" e "© OpenStreetMap". O mapa mostra os dois no canto (botão ⓘ) e a
  aba Sugestões, embaixo dos cartões. Não tire.
- **"Minha localização"** só funciona em HTTPS (ou `localhost`) — a Vercel já
  atende.
- De carro, o trajeto é calculado **sem trânsito em tempo real**.
- Os dados de cada lugar são os do OpenStreetMap: muito lugar não tem horário,
  telefone ou site cadastrado, e aí o cartão mostra só o que houver.

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
components/     … · map/ (página do Mapa, Sugestões, links do Google Maps)
components/     … · demo/ (provider e banner da demonstração) · providers/ (useVitrine)
lib/
  actions/      contrato das escritas, schemas zod compartilhados, ActionResult
  demo/         acervo em memória da demonstração: seed, estado, operações
  domain/       TS puro e testado: tipos, campos, formatação, filtro, stats, erros,
                grade e tier list, localização, pinos, links e dados do Mapa
  geo/          só servidor: chamadas à Geoapify (client.ts) e o tratamento das
                respostas em funções puras e testadas (parse.ts)
  queries/      leituras do Supabase
  supabase/     server.ts, middleware.ts, env.ts (só servidor: a sessão vive em cookies)
supabase/       01_schema.sql … 13_profile_after_email_confirmation.sql
scripts/        supabase-keep-alive.mjs (rodado pelo .github/workflows/)
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
- Na categoria, a lista e o filtro olham **só os itens do nível aberto**; a
  aba Números conta o nível aberto **com todas as subpastas dele** (na raiz,
  a categoria inteira) — e diz "inclui as subpastas" quando é o caso.
- Excluir uma subpasta pergunta: **manter o conteúdo** (sobe um nível) ou
  **excluir tudo**. Mover um item para outra categoria o leva para a raiz dela.
- FKs compostas `(…, category_id)` garantem no banco que pasta-mãe e itens de
  uma subpasta são da mesma categoria.
- **Arrastar para reordenar**: subpastas sempre (para o dono); itens quando a
  ordenação é **Ordem manual** e não há filtro ativo — reordenar um recorte
  filtrado deixaria ambíguo onde fica o resto. A posição vive em
  `display_order` e é gravada em um único UPDATE pelas funções
  `reorder_entries` / `reorder_entry_folders` (SECURITY INVOKER: a RLS vale).
  Item ou pasta nova entra no fim do nível; reordenar não mexe no
  `updated_at`.

### Categorias sem estrelas

- Cada categoria escolhe, na **Estrutura**, entre **★ Estrelas** e **Nula**.
  Nula é uma lista simples: some a nota do formulário, dos cards, da página do
  item, do filtro (faixa e ordenações por nota) e da aba Números. Campos do
  tipo "Estrelas" que você mesma criou continuam valendo.
- **Desligar as estrelas apaga as notas** dos itens — o diálogo de impacto
  mostra quantas antes de salvar. O servidor também recusa nota nova numa
  categoria sem estrelas, e mover um item para ela tira a nota dele.
- A **ordem padrão dos itens** (Recentes, Nota, Nome ou Ordem manual) também
  é da categoria: é como ela abre quando a URL não diz outra coisa. Categoria
  nova abre por **Nota (maior primeiro)**; sem estrelas, por Recentes
  (`initialSortFor`, em `lib/domain/filter.ts`).

### Estrutura: cor e campos

- **Cor**: as 8 da paleta ou a nona, **+**, que abre uma roda de cores (a
  volta escolhe a cor, o centro clareia), o brilho e o campo **HEX** para
  digitar ou colar (`#2A9D8F`, `2a9d8f` ou `#abc`). A cor é só um `#RRGGBB`
  em `categories.color` — cards, tier list, pinos do Mapa e Números usam a
  mesma, seja da paleta ou livre (`normalizeCategoryColor`, em
  `lib/domain/tags.ts`). As tags continuam só com as 8.
- Os tipos de campo aparecem nesta ordem: Estrela (0–5), Data, Texto, Número
  inteiro, Número com vírgula, Duração (h:min), Moeda, Lista de opções e
  Localização (mapa).
- **Duração** se escolhe como **00:00**: horas e minutos se digitam
  separados, as setas (e a roda do mouse, com o campo em foco) sobem e
  descem, e o relógio abre duas colunas que rolam (horas 0–999, minutos
  0–59). Por dentro continua o total em **minutos** — `custom_fields`, filtro,
  ordenação, backup e Números não mudaram. O filtro por duração do Filtro
  geral usa o mesmo campo.

### Números

Uma leitura rápida do recorte (a pasta aberta com as subpastas, depois do
filtro), de cima para baixo:

- **Resumo** numa linha: quantos itens, a nota média e quantos têm nota.
- **Notas** por faixa de estrela (5, 4–4,5 … 0–0,5 — as mesmas do tier list)
  e **Destaques**: os 3 de nota mais alta e, fora deles, o de menor nota, com
  link para cada um. Somem numa categoria sem estrelas.
- **Campos**, uma linha cada: média, faixa (de… a…) e total (para contagem,
  dinheiro e tempo); as opções mais comuns de uma Lista; a faixa de datas; e
  "em N de M" quando nem todo item preencheu.
- **Tags mais usadas**, como pastilhas com a contagem.

O cálculo é puro e testado (`lib/domain/stats.ts`).

### Filtros

- **E / OU**: na categoria, combina as tags marcadas; no filtro geral, combina
  tags **e** campos das categorias. Nome, nota e categoria valem sempre. O
  padrão é E.
- No filtro geral, **com categorias marcadas, só os campos delas** aparecem.
- O filtro geral **ordena** por data, nota, nome ou qualquer campo em escopo
  (quem não tem valor vai para o fim), agrupado por categoria ou numa lista só.
- O estado do filtro geral mora no hook `useGlobalFilter` e a barra lateral em
  `GlobalFilterSidebar` (`components/filter/`) — os dois são os mesmos no
  `/filtro` e no Mapa.

### Visualização: tamanho da grade e tier list

- **Tamanho da grade** (P / M / G, ao lado de Grade/Lista): na categoria vale
  para itens e subpastas; nas Coleções, para pastas e categorias — cada tela
  guarda o seu no `localStorage` (`vitrine:categoria:grade`,
  `vitrine:colecoes:grade`). Média é a grade de sempre. O Filtro geral não
  muda. As classes ficam num mapa de strings completas
  (`lib/domain/grid-size.ts`): o Tailwind só gera o que está escrito por
  inteiro.
- **Tier list**: terceiro modo da tela de uma categoria **com estrelas**. Uma
  fileira por faixa de nota — S (5), A (4,5–4), B (3,5–3), C (2,5–2),
  D (1,5–1), E (0,5–0) —, com os itens que passam pelo filtro, na ordem dele.
  Item sem nota fica de fora (e é contado embaixo). É **somente leitura**:
  sem arrastar, sem seleção — mudar de fileira seria mudar a nota. O tamanho
  das miniaturas segue o P / M / G.

### Mapa (`/mapa`)

- Mostra num mapa escuro (MapLibre + OpenFreeMap) tudo que **eu** marquei com
  Localização: um pino com a cor e o ícone da categoria, agrupados quando
  ficam perto. A página de outra pessoa (`/u/...`) e a demonstração não têm
  mapa. O filtro é o mesmo do Filtro geral; no celular, recolhido atrás do
  botão "Filtros".
- **O filtro do Mapa só oferece o que pode virar pino** (`mapScope`, em
  `lib/domain/map.ts`): as categorias com campo de Localização — mesmo as
  ainda sem endereço —, com o número de lugares de cada uma ao lado; as tags
  usadas pelos itens delas; e os campos delas no "Adicionar campo…". A nota
  some quando nenhuma dessas categorias usa estrelas.
- **"Ver no mapa"** na tela de uma categoria com Localização (só para o dono,
  e fora da demonstração) abre `/mapa?categoria=<id>`, com ela já marcada no
  filtro. O `?categoria=` só vale na abertura e sai da URL em seguida.
- **`entry_places` é um cache.** O endereço continua em `custom_fields`; a
  tabela guarda, por (item, campo), o texto que foi procurado (`address`), as
  coordenadas, o `place_id` (o id da Geoapify) e a situação (`ok`,
  `not_found`, `error`). O pino só aparece quando `address` é igual ao texto
  atual do campo — endereço editado nunca mostra o pino antigo. Pendente é
  calculado, não gravado. Sem prazo de validade: a coordenada fica até o
  texto mudar.
- **Quando a Geoapify é chamada** (sempre no servidor: `app/mapa/actions.ts`,
  por meio de `lib/geo/client.ts`): depois de salvar um item cujo endereço
  mudou (sem atrasar o salvamento); ao converter Texto → Localização; e no
  "Tentar de novo" dos itens sem pino. **Abrir o Mapa não chama nada.** Os
  lotes têm até 20 endereços, 3 de cada vez, com os pedidos espaçados para
  caber nos 5 por segundo do plano grátis.
- **Mantendo a tabela em dia**: editar a estrutura chama
  `prune_entry_places` (campo removido ou que deixou de ser Localização —
  inclusive pelo modo JSON — perde as linhas); mover itens de categoria leva a
  linha para o campo de destino quando o valor é mantido; excluir item ou
  categoria cascateia. O backup leva só o texto: depois de importar, os
  endereços ficam pendentes e o "Tentar de novo" do Mapa localiza.
- **Sugestões** (segunda aba): eu informo onde estou (localização do aparelho
  ou endereço digitado — nunca gravado) e um raio; a lista dos meus lugares
  por perto sai na hora, na memória, por distância ou pela minha nota. Depois
  chegam, da Geoapify, os dados dos 20 mais próximos (o que é o lugar — tipo
  e cozinha —, horário com "aberto agora / fecha às…", telefone e site) e o
  trajeto pelas ruas dos 10 mais próximos (a pé ou de carro). A Geoapify só é
  consultada com a aba aberta — nunca por abrir o Mapa.
- O horário vem no formato do OpenStreetMap (`opening_hours`) e é lido no
  próprio app (`lib/domain/opening-hours.ts`), no fuso do lugar; o que ele
  não sabe ler (feriado, nascer do sol…) aparece como texto. O OpenStreetMap
  não tem nota, preço nem resumo de terceiros: o cartão mostra a minha nota, o
  meu preço (o primeiro campo Moeda preenchido) e uma frase montada por regra
  (`lib/domain/place-summary.ts`), isolada para um dia virar texto de IA.
- **"Abrir no Maps" / "Como chegar"** são links comuns para o Google Maps (as
  Maps URLs oficiais, sem chave): as coordenadas e, sem elas, o texto do
  endereço — funcionam até sem localização (e na demonstração). O `place_id`
  da Geoapify não vai para o Google.

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
- A demo tem o tamanho da grade e o tier list (são os mesmos componentes), mas
  **não tem o Mapa**: não pode gastar crédito nem ter chave. As ações da Geoapify
  respondem "Indisponível na demonstração.", e "Abrir no Maps" usa o texto do
  endereço.

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

Os nove tipos de campo são `star`, `date`, `str`, `int`, `decimal`, `time`,
`currency`, `select` e `location`. `star`, `int`, `decimal`, `currency` e
`time` são os numéricos: aceitam filtro por faixa e entram na média da aba
Números. `time` guarda o total em minutos (`95` = 1h 35min).

`location` ("Localização (mapa)") guarda o **texto** do endereço, como um
`str` — busca, filtro "contém", ordenação e backup não mudam. As coordenadas
moram à parte, em `entry_places` (veja **Mapa**). Uma categoria pode ter mais
de um campo de Localização; cada um vira um pino. O tipo de um campo que já
existe fica travado no editor, com uma exceção: **Texto pode virar
Localização** (os endereços já escritos são procurados na Geoapify ao salvar).

### Permissões

Todo usuário autenticado **lê** o que é **público**; só o dono **escreve** o
que é seu. As `tags` são a exceção: vocabulário compartilhado, sem dono —
qualquer autenticado cria, edita e apaga, e a mudança vale para o acervo de
todo mundo.

**Privacidade** (migração 12):

- Cada **pasta** e cada **categoria** é **Pública** (quem tem acesso ao app
  vê) ou **Privada** (só o dono). O dono troca no interruptor do topo da
  categoria, ou do topo da pasta aberta nas Coleções; as privadas ganham um
  cadeado no card.
- **Pasta privada esconde tudo o que está dentro dela**, em qualquer
  profundidade — mesmo uma categoria marcada como pública. A tela avisa o
  dono quando é o caso ("está dentro de “X”, que é privada").
- Quem decide é o **banco**, não a tela: as políticas de leitura (RLS) de
  `folders`, `categories`, `entries`, `entry_folders`, `entry_tags` e
  `entry_places` só devolvem a terceiros o que é visível
  (`folder_chain_is_public`, `category_is_visible`, `entry_is_visible`). Um
  link direto, a contagem de itens ou o uso de uma tag não denunciam nada
  privado, e trocar para privada vale na próxima leitura de qualquer pessoa.
- **Padrão do perfil** (Configurações → Privacidade): novas pastas e
  categorias nascem **públicas** (o inicial) ou **privadas**. Um gatilho no
  banco aplica o padrão quando a criação não diz nada — vale também para a
  importação de backup. Mudar o padrão não mexe no que já existe.
- Na página de outra pessoa (`/u/...`), pasta sem nada visível dentro não
  aparece.

---

## Fora de escopo

- Console SQL / aba "Cmd" (a v1 tinha uma função `SECURITY DEFINER` que dava
  acesso irrestrito ao banco a qualquer autenticado — removida de propósito);
- upload de imagem (só links externos);
- login social (Google etc.) e verificação em duas etapas;
- modo claro, paleta de comandos, notificações, comentários, favoritos;
- no Mapa, por enquanto: descobrir lugares **novos** por perto ("Descobrir",
  com "Salvar no Vitrine") e resumo escrito por IA — próxima fase; mapa na
  página de outras pessoas e na demonstração;
- na privacidade: compartilhar só com algumas pessoas (é tudo ou nada: o
  grupo inteiro ou só o dono), e levar a privacidade no backup — o arquivo
  não guarda quem é público, e a importação segue o padrão do perfil;
- no tier list: arrastar entre fileiras (mudaria a nota) e exportar como
  imagem.
