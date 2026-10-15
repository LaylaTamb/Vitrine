# Vitrine — Visualização (tamanho da grade + tier list) e Mapa

> Cole este arquivo inteiro no Claude Code, na raiz do projeto `vitrine-web`.
> Ele foi escrito depois de ler o código atual do projeto (commit `483d958`).

---

## 0. Como você deve trabalhar

1. **Leia antes de mexer.** Comece pelo `README.md` (as 12 regras da seção "Arquitetura" valem para tudo que você fizer aqui) e depois pelos arquivos citados em cada parte deste prompt. Se algo que eu descrevo não bater com o código, pare e me avise em vez de adivinhar.
2. **Entre em modo plano primeiro.** Me mostre o plano: arquivos que serão criados e alterados, em que ordem, e qualquer dúvida. Só comece a codar depois do meu OK.
3. **Trabalhe em etapas** (lista na seção 9). Ao fim de cada etapa rode `npm run typecheck`, `npm run lint` e `npm run test`, me mostre o resumo do que mudou e **espere eu confirmar** antes da próxima.
4. **Não faça `git commit` nem `git push`.** Eu faço.
5. **Nunca leia, mostre ou edite o `.env.local`.** Só o `.env.example` (com valores de exemplo, sem chave de verdade).
6. **Não rode SQL em nenhum projeto Supabase.** Apenas crie o arquivo `.sql` novo na pasta `supabase/`; eu rodo no SQL Editor, como o README já manda.
7. A interface é **inteiramente em português do Brasil** (textos, erros, toasts, `aria-label`). O app é **dark-only**: use os tokens de cor do `app/globals.css` (`bg-surface`, `border-line`, `text-muted-foreground`, `text-brand` etc.), nunca cores soltas — a única exceção são as cores das fileiras do tier list (parte 1B).
8. Tailwind v4 só enxerga classes escritas por inteiro no código. **Nunca monte classe por concatenação** (`` `grid-cols-${n}` `` não funciona); use um mapa de strings completas.

---

## 1. Objetivo em uma frase

Deixar eu **enxergar meus itens do jeito que eu quiser** (grade maior ou menor, e em tier list) e **ver no mapa tudo que já marquei**, com filtro, atalho para abrir no Google Maps e uma aba que me diz **o que dos meus lugares salvos está perto de mim agora**.

## 2. Decisões já tomadas (não reabra)

| Assunto | Decisão |
| --- | --- |
| Mapa | **Google Maps completo**: mapa (Maps JavaScript API), busca de endereço (Geocoding API), dados dos lugares (Places API New) e tempo de trajeto (Routes API). |
| Sugestões, nesta fase | **Só o que eu já salvei.** Procurar lugares novos no Google fica para uma próxima fase (seção 8). Não implemente isso agora, mas não escreva nada que impeça de fazer depois. |
| Resumo do lugar | **Sem IA.** O resumo é montado com dados do Google + dados meus. Nada de chamar a API da Anthropic. |
| Tier list | **Só dentro da tela de uma categoria.** Não entra no Filtro geral. |
| Tamanho da grade | Na tela de **uma categoria** (itens e subpastas) e nas **Coleções** (pastas e categorias). **O Filtro geral não muda.** |
| Quem vê o mapa | Só o dono, com os próprios dados. A tela `/u/[username]` (acervo de outra pessoa) **não** ganha mapa. |
| Demonstração (`/demo`) | Ganha tamanho da grade e tier list (os componentes são os mesmos). **Não** ganha o Mapa (não pode gastar API nem ter chave). |

---

# PARTE 1 — Visualização

## 1A. Tamanho da grade

### O que eu quero
Poder aumentar ou diminuir os cards, para ver mais itens de uma vez ou ver cada um maior. São **duas configurações independentes**:

- **Itens** — na tela de uma categoria (`components/category/category-view.tsx`). Vale para os cards de item **e** para os cards de subpasta dessa tela (hoje os dois usam a mesma grade).
- **Categorias** — na tela de Coleções (`components/collection/collections-view.tsx`). Vale para os cards de pasta e de categoria.

### Como fazer
- Hoje a grade é fixa: `grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4`, repetida em vários lugares. Crie um módulo puro **`lib/domain/grid-size.ts`** com o tipo `GridSize = "small" | "medium" | "large"`, a lista de opções com rótulos em português ("Pequena", "Média", "Grande") e **um mapa de classes completas** por tamanho:
  - `small`: `grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6`
  - `medium`: `grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4` ← **é o comportamento de hoje e o padrão**
  - `large`: `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`
  - Inclua uma função `normalizeGridSize(valor)` que aceita qualquer coisa e devolve um tamanho válido (cai em `medium`). Teste em `lib/domain/` com Vitest.
- Crie um componente **`GridSizeToggle`** em `components/layout/` no mesmo estilo visual do `ViewToggle` (grupo de botões pequenos, `aria-pressed`, ícone + `sr-only`). Três botões P / M / G com `title` e `aria-label` em português.
- **Onde o controle aparece:** ao lado do `ViewToggle`, no `FilterBar` (categoria) e na linha do `ViewToggle` das Coleções. **Só aparece quando o modo é Grade** (e no tier list, ver 1B). No modo Lista ele some.
- **Persistência:** `localStorage`, igual ao que o projeto já faz com `vitrine:categoria:view` (leitura num `useEffect` com `try/catch`, valor padrão no primeiro render para o HTML do servidor bater). Chaves novas: `vitrine:categoria:grade` e `vitrine:colecoes:grade`. Valor inválido ou storage bloqueado → `medium`.
- Troque as strings de grade que estão repetidas em `category-view.tsx` (subpastas e itens) e `collections-view.tsx` pelo mapa de `grid-size.ts`. **Não mexa** em `components/filter/global-filter-view.tsx`.
- O drag-and-drop (`@dnd-kit`, `rectSortingStrategy`) tem que continuar funcionando em qualquer tamanho.
- No tamanho **Pequena**, o `EntryCard` fica apertado. Se precisar, adicione uma prop `compact` ao `EntryCard` que esconde só as linhas secundárias (resumo e tags); o nome, a imagem e a nota ficam. Confira visualmente em 360 px, 768 px e 1180 px de largura.

### Pronto quando
- [ ] Trocar P/M/G muda na hora, sem pedir nada ao servidor, e continua assim depois de F5.
- [ ] Categorias e itens guardam tamanhos separados.
- [ ] No tamanho Média, a tela está **idêntica** à de antes.
- [ ] O Filtro geral continua exatamente como estava.
- [ ] Testes do `normalizeGridSize` passando.

---

## 1B. Tier list

### O que eu quero
Um terceiro modo de visualização na tela de uma categoria, ao lado de Grade e Lista, igual ao site Tier Maker: **fileiras horizontais com uma letra colorida à esquerda e os itens daquele nível ao lado.** O nível de cada item vem da **nota (estrelas)** dele:

| Fileira | Notas que entram |
| --- | --- |
| **S** | 5 |
| **A** | 4,5 e 4 |
| **B** | 3,5 e 3 |
| **C** | 2,5 e 2 |
| **D** | 1,5 e 1 |
| **E** | 0,5 e 0 |

### Regras importantes (leia com atenção)
- **A nota 0 não existe no banco**: `normalizeRating` (em `lib/actions/schemas.ts`) transforma 0 em `null`, e `EntryView.hasRating` só é verdadeiro para nota > 0. Na prática a fileira E recebe só 0,5. Mesmo assim, implemente pela regra de faixas abaixo, que cobre o 0 também:
  - `nota >= 5` → S; `>= 4` → A; `>= 3` → B; `>= 2` → C; `>= 1` → D; qualquer outra nota ≥ 0 → E; `null` → **fora do tier list**.
  - Crie **`lib/domain/tiers.ts`** (TypeScript puro, sem React): `TIERS` (id, letra, cor), `tierOf(rating)` e `groupByTier(views)`. Teste nas bordas: 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0 e `null`.
- **Itens sem nota ficam de fora.** Abaixo das fileiras, mostre uma linha discreta: "N itens sem nota não aparecem aqui." (só se N > 0).
- **O tier list só existe em categorias que usam estrelas** (`category.rating_enabled`). Em categoria "Nula" (sem estrelas), o botão do tier list **não aparece**. Se a preferência salva for `tier` e a categoria não tiver estrelas, mostre Grade **sem apagar** a preferência salva.
- **Usa o que já está filtrado.** Monte as fileiras a partir de `filtered` (o resultado de `applyCategoryFilter` do nível aberto). Busca, tags, faixa de nota e ordenação continuam valendo. Dentro de cada fileira, **mantenha a ordem de `filtered`**.
- **É somente leitura.** Sem arrastar, sem alça de reordenar, sem checkbox de seleção em massa, sem botões de editar/excluir. Arrastar um item entre fileiras mudaria a nota dele, e isso **não faz parte** deste pedido. Garanta que `canDragItems` fica `false` no tier list e que o `DndContext` dos itens não envolve essa visualização.
- As **subpastas** do nível continuam aparecendo acima das fileiras (são navegação), como nos outros modos.

### Visual
- Cada fileira: uma caixa colorida à esquerda com a letra grande (use a fonte `display` do projeto) e, ao lado, uma área escura (`bg-surface`/`border-line`) com os itens em linha, quebrando para a linha de baixo quando não couber. Altura mínima da fileira mesmo vazia, como no Tier Maker.
- Cores das fileiras (as clássicas do Tier Maker, com texto escuro por cima): **S** `#FF7F7F`, **A** `#FFBF7F`, **B** `#FFDF7F`, **C** `#FFFF7F`, **D** `#BFFF7F`, **E** `#7FFF7F`. Defina como constantes em `tiers.ts`.
- Cada item é uma **miniatura quadrada** (reaproveite o `EntryImage` com `ratio="1 / 1"`; quando não há imagem ele já mostra a inicial) e, por baixo, o nome truncado. Um selo pequeno no canto com a nota exata ("4,5") para eu diferenciar 4,5 de 4 dentro da fileira A. `Tooltip` com o nome completo.
- Clicar no item abre a página dele (`view.href`), como no card.
- **O tamanho da miniatura obedece ao `GridSizeToggle` da categoria** (mesma chave `vitrine:categoria:grade`): Pequena ≈ 56 px, Média ≈ 80 px, Grande ≈ 112 px. O controle também aparece neste modo.
- Se nenhum item do nível tem nota: use o `EmptyState` com a mensagem "Nenhum item com nota neste nível ainda."

### Como integrar
- O tipo `ViewMode` (`"grid" | "list"`) é usado também por `collection-card.tsx` e `collections-view.tsx`, onde tier **não** faz sentido. **Não** acrescente `"tier"` nele. Crie `EntryViewMode = ViewMode | "tier"` só para a tela de categoria e faça o `ViewToggle` aceitar a lista de modos disponíveis por prop (as Coleções continuam com Grade/Lista).
- `category-view.tsx` valida o valor lido do `localStorage` (`"grid" | "list"`): inclua `"tier"`.
- Componente novo: `components/entry/tier-list.tsx`.

### Pronto quando
- [ ] Os 6 níveis aparecem na ordem S → E, com as cores acima, mesmo vazios.
- [ ] Um item de nota 4 cai em A; 3,5 em B; 5 em S; 0,5 em E; sem nota fica fora e é contado na linha de aviso.
- [ ] Buscar/filtrar por tag atualiza o tier list na hora.
- [ ] Categoria sem estrelas não mostra o botão.
- [ ] A demonstração (`/demo/categoria/...`) também mostra o tier list.
- [ ] Testes de `tierOf`/`groupByTier` passando.

---

# PARTE 2 — Mapa

## 2A. Novo tipo de campo: "Localização"

### O que eu quero
Ao montar a **Estrutura** de uma categoria, o seletor de tipo de campo ganha a opção **"Localização (mapa)"**. Nesse campo eu digito um **endereço** (ou nome de lugar). A partir daí, todo item que tiver esse campo preenchido **aparece no mapa do Vitrine**.

### Como fazer
- Novo tipo `"location"`:
  - `lib/domain/types.ts`: acrescente em `FIELD_TYPES`.
  - `lib/domain/fields.ts`: rótulo em `FIELD_TYPE_LABELS` ("Localização (mapa)"); em `coerceFieldValue` trate como texto (trim, máximo 300 caracteres, vazio → `null`). Não é numérico.
  - **O valor guardado em `custom_fields` continua sendo o texto do endereço** (string). Assim a busca livre, o filtro "contém", a ordenação, o backup e a exibição seguem funcionando sem mudança. Confira `stats.ts`, `view.ts` (`formatFieldValue`), `filter.ts` e `lib/backup/import.ts` para ter certeza de que o novo tipo cai num caminho de texto e não quebra nada.
  - Uma categoria pode ter **mais de um** campo de localização; cada um vira um pino próprio, identificado pelo nome do campo.
  - `unifyFields` já agrupa campos pelo par nome + tipo, então "Localização" de várias categorias vira **um filtro só** no Filtro geral. Confirme.
- **Editor de estrutura** (`components/category/category-editor.tsx`): o tipo aparece sozinho porque o `<select>` usa `FIELD_TYPES`. Hoje o tipo de um campo existente fica **travado** na edição (`disabled={editingFieldId !== null}`). Abra **uma única exceção**: um campo do tipo **Texto (`str`) pode ser convertido em Localização** (e só essa troca), porque eu já tenho endereços escritos em campos de texto chamados "Localização" (a categoria de exemplo Restaurantes nasce assim — `supabase/01_schema.sql`). Ao salvar essa conversão, mostre no diálogo de impacto que os endereços serão procurados no Google e dispare a localização dos pendentes (2B).
- **Formulário do item** (`components/entry/entry-form.tsx`, trecho que renderiza cada campo por `field.tipo`): para `location`, um campo de texto com `placeholder` "Rua, número, bairro ou nome do lugar". Salvar **nunca** é bloqueado por causa do mapa (ver 2B).
- **Página do item** (`components/entry/entry-detail.tsx`): ver 2D.

---

## 2B. Banco e localização dos endereços

### Migração nova: `supabase/11_entry_places.sql`
Aditiva, no mesmo estilo dos arquivos 07 e 10 (comentário no topo explicando o porquê, `if not exists`, RLS idêntica ao padrão do `entry_folders`). Não altere os arquivos antigos. Tabela **`entry_places`**, uma linha por (item, campo de localização):

| Coluna | Para quê |
| --- | --- |
| `entry_id` (FK → `entries`, `on delete cascade`) + `field_id` (text) | chave primária composta; `field_id` é o id estável do campo na `estrutura` |
| `owner_id` (FK → `profiles`, `on delete cascade`) | para a RLS e para buscar "só os meus" |
| `address` | o texto exato que foi procurado (para saber se o endereço mudou) |
| `formatted_address` | o endereço como o Google devolveu |
| `lat`, `lng` (`double precision`) | posição do pino |
| `place_id` (text) | identificador do lugar no Google (usado nas Sugestões e nos links) |
| `status` (`'pending' \| 'ok' \| 'not_found' \| 'error'`, check constraint) | situação da busca |
| `geocoded_at` (`timestamptz`) | quando foi localizado |

- RLS: segue o modelo do projeto — qualquer autenticado **lê**, só o dono **escreve**. Siga como o `07_entry_folders.sql` garante, com FK composta, que o `owner_id` é o mesmo do item.
- Índice em `(owner_id, status)`.
- Atualize a seção "Configuração do Supabase" do README (passo novo 11).

### Localizando os endereços (servidor)
- Chave **de servidor**, nunca no navegador: `GOOGLE_MAPS_SERVER_KEY`. Use a **Geocoding API**, com idioma `pt-BR` e viés para o Brasil (`region=br`). Guarde `place_id`, `lat`, `lng` e o endereço formatado.
- Coloque as chamadas ao Google em uma pasta só de servidor, `lib/google/` (`import "server-only"`), com o **tratamento da resposta em funções puras** que dá para testar com respostas de exemplo (fixtures): sem resultado → `not_found`; erro de cota/rede → `error`; ok → coordenadas.
- Ações novas (Server Actions, num `app/mapa/actions.ts` com `"use server"`), todas seguindo o padrão do projeto: `requireUser()` → valida com zod (schemas novos em `lib/actions/schemas.ts`) → faz o trabalho → `revalidatePath` → devolve `ActionResult`. Erros viram frase em português (veja `lib/domain/errors.ts`).
  - `geocodeEntryLocations({ entryId })` — localiza os campos de localização do item cujo texto mudou ou está pendente.
  - `geocodePendingLocations({ categoryId? })` — processa pendentes em lote (máximo ~50 por chamada, poucas requisições em paralelo para não estourar cota). Serve para a conversão de Texto → Localização, para itens importados do backup e para o botão "Tentar de novo".
- **Contrato:** acrescente essas ações em `VitrineActions` (`lib/actions/contracts.ts`). O `createDemoActions` em `lib/demo/store.ts` precisa implementar as mesmas assinaturas; na demo, devolvem erro amigável "Indisponível na demonstração." (o TypeScript vai quebrar o build se faltar uma das pontas — é de propósito).
- **Quando localizar:**
  - Depois de criar/editar um item, **sem atrasar nem impedir o salvamento**: o item salva, o formulário fecha, e a localização roda em seguida. Se não achar o endereço, `toast` avisando "Não consegui localizar “…”. O item foi salvo, mas não aparece no mapa." Endereço apagado → apaga a linha de `entry_places`.
  - Endereço igual ao que já foi localizado (`address` igual e `status = 'ok'`) → não chama o Google de novo.
- **Manter `entry_places` consistente** (leia o código atual de cada um antes de mexer):
  - Campo removido da estrutura (`removedFieldIds` em `updateCategory`) ou convertido de Localização para outro tipo → apagar as linhas daquele `field_id`.
  - Mover itens para outra categoria (`bulkMoveEntries`, `lib/domain/migrate.ts`): o valor só é mantido quando o campo de destino tem mesmo nome e tipo; nesse caso a linha de `entry_places` muda para o `field_id` do destino. Se o valor é descartado, a linha some.
  - Excluir item/categoria: o `on delete cascade` resolve.
  - Backup (`lib/backup/`): o endereço já vai junto em `customFields`. **Não exporte coordenadas**; depois de importar, os endereços ficam `pending` e são localizados pelo botão da página do Mapa.

---

## 2C. Página do Mapa (`/mapa`)

### O que eu quero
Uma página nova, **Mapa**, que mostra no Google Maps tudo que eu já marquei com Localização, com um **filtro igual ao Filtro geral**, e que eu consigo usar bem **no celular** (é onde vou usar na rua).

### Rota e dados
- `app/mapa/page.tsx` (Server Component, com `requireUser()` e `loading.tsx` com esqueleto fiel ao layout — regra 10 do README). Busque em `Promise.all`: `getAcervo(user.id)` (já existe, é o que o `/filtro` usa), o perfil e as linhas de `entry_places` do dono. Nenhuma ida ao banco em série.
- Link **"Mapa"** na navegação (`components/layout/nav-links.tsx`), entre "Filtro" e "Tags". Esconda na demo (como já se faz com `hideUsers`). **Atenção:** a `<nav>` atual é `hidden … md:flex`, ou seja, some no celular; lá eu chego em Filtro, Tags e Pessoas pelo menu da conta (`components/layout/user-menu.tsx`). Acrescente o **Mapa** nesse menu também, com o mesmo estilo dos outros itens (e esconda na demo).
- Em `lib/supabase/middleware.ts` só `/login`, `/auth` e `/demo` são públicos; toda outra rota já é protegida. `/mapa` **não** deve ser adicionada a essa lista.
- Função pura **`lib/domain/map.ts`**: `buildPins(views, categories, places)` → lista de pinos `{ key, entryId, fieldId, fieldLabel, lat, lng, view, category }`, só com `status = 'ok'`; mais `pendingPlaces(...)` para itens que têm endereço mas não têm coordenadas. Teste.

### Filtro (reaproveitar, não copiar)
- O filtro do Mapa **é o mesmo do Filtro geral**: nome, faixa de nota, categorias, tags, campos das categorias (incluindo o campo "Localização" como "contém…") e o modo E/OU. Use `applyGlobalFilter`, `unifyFields`, `categoriesInScope` etc. de `lib/domain/filter.ts`.
- Hoje toda essa interface vive dentro de `components/filter/global-filter-view.tsx` (547 linhas). **Extraia** o estado e a barra lateral para peças reutilizáveis (por exemplo um hook `useGlobalFilter` e um componente `GlobalFilterSidebar`), usadas pelo Filtro geral **e** pelo Mapa. Faça isso como **etapa própria, sem mudar nada no comportamento nem no visual do `/filtro`** (etapa 3 da seção 9). O filtro roda 100% em memória do cliente e **não** vai para `searchParams` via `router.push` (regras 3 e 4 do README).

### Tela
- Duas abas no topo da página: **Mapa** e **Sugestões** (2E). O estado do filtro fica no componente pai e é **compartilhado** entre as duas abas: trocar de aba não perde o filtro. A aba ativa vai para a URL com `history.replaceState` (como a aba "Números" da categoria faz).
- **Desktop:** barra lateral do filtro (a mesma largura de 18 rem do Filtro geral) + mapa grande. **Celular:** o mapa ocupa a tela; o filtro fica recolhido atrás de um botão "Filtros" (com contador de regras ativas).
- **Mapa Google** carregado **só nesta página**, com import dinâmico (`next/dynamic`, `ssr: false`), para as outras páginas não ficarem mais lentas. Chave de navegador: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (restrita por domínio) e, se usar marcadores avançados, `NEXT_PUBLIC_GOOGLE_MAP_ID`. Use a biblioteca React recomendada pelo Google (`@vis.gl/react-google-maps`) se for compatível com React 19; se não, o `@googlemaps/js-api-loader`. Confira a versão atual e a compatibilidade antes de instalar.
- **Pinos:** na cor da categoria (`category.color`, padrão roxo da marca `#B98CC2`) com o emoji da categoria; **agrupar pinos próximos** (clustering) quando houver muitos. Ao abrir e a cada mudança de filtro, enquadrar o mapa nos pinos visíveis (sem reenquadrar quando eu apenas arrasto o mapa).
- **Tocar num pino** abre um cartão com: miniatura (`EntryImage`), nome, categoria, nota em estrelas (`Stars`), endereço, tags, e os botões **Ver item** (`view.href`), **Abrir no Maps** e **Como chegar** (2D).
- **Lista dos lugares filtrados** ao lado (desktop) ou embaixo do mapa (celular), com "N lugares". Tocar numa linha centraliza o pino e abre o cartão.
- **Botão "Minha localização"**: usa `navigator.geolocation`, mostra um ponto azul no mapa e guarda a posição só em memória (compartilhada com a aba Sugestões). Trate permissão negada e tempo esgotado com mensagem clara.
- **Itens sem pino:** bloco "N itens com endereço que não apareceram no mapa" (pendentes, não encontrados ou com erro), com **Tentar de novo** (chama `geocodePendingLocations`) e **Editar** o item.
- **Estados vazios**: (a) nenhuma categoria tem campo de Localização → explicar como criar; (b) o filtro escondeu tudo → "Nada bateu com o filtro", com "Limpar tudo"; (c) **chave do Google ausente** → `EmptyState` explicando quais variáveis configurar, **sem quebrar a página**.

---

## 2D. "Abrir no Maps" e ligação com a página do item

### O que eu quero
Em qualquer lugar onde eu vejo um item com localização, poder **abrir o lugar no app/site do Google Maps** para ir até lá.

### Como fazer
- Módulo puro **`lib/domain/maps-links.ts`** com funções testáveis, usando as URLs oficiais "Maps URLs" (não exigem chave):
  - `mapsPlaceUrl({ placeId?, lat?, lng?, address })` → `https://www.google.com/maps/search/?api=1&query=…&query_place_id=…`
  - `mapsDirectionsUrl({ destination…, origin?, travelMode? })` → `https://www.google.com/maps/dir/?api=1&destination=…&destination_place_id=…&travelmode=…`
  - Prioridade: `place_id`, depois coordenadas, depois o **texto do endereço**. Assim "Abrir no Maps" funciona até quando a localização falhou ou na demo. Sempre `encodeURIComponent`.
  - Abrir em nova aba com `target="_blank" rel="noopener noreferrer"`.
- **Página do item** (`entry-detail.tsx`): em cada campo `location` (`EntryExtra.tipo === "location"`), mostrar o endereço com dois botões: **Abrir no Maps** e **Ver no mapa do Vitrine** (`/mapa?item=<id>`, que abre o Mapa já com aquele pino em foco; na demo esse segundo botão não aparece). Essa página é um componente sem estado nem hook e é compartilhada com a demo: **mantenha-a assim** (só links `<a>`/`<Link>`). Para usar `place_id`/coordenadas, a página do item em `app/categoria/[categoryId]/[entryId]/page.tsx` busca as linhas de `entry_places` daquele item na mesma `Promise.all`.
- Os mesmos botões aparecem no cartão do pino (2C) e no cartão da Sugestão (2E).

---

## 2E. Aba "Sugestões" (só com o que já está salvo)

### O que eu quero
Eu informo **onde estou**, e o Vitrine me mostra, **entre os itens que passam pelo filtro atual**, quais ficam **perto de mim**, ordenados por distância, cada um com um resumo e as informações que importam para decidir.

### Entrada
- **Onde estou:** botão **"Usar minha localização"** *ou* campo para digitar um endereço (localizado por uma ação de servidor, `geocodeAddress`). A posição **nunca é gravada no banco**; fica só na memória da página.
- **Raio:** 500 m, 1 km, 2 km (padrão), 5 km, 10 km, 25 km.
- **Ordenar por:** distância (padrão), melhor nota no Google, minha nota.
- O filtro da barra lateral (o mesmo do Mapa) continua visível e é o que define o "universo" das sugestões.

### Como calcular
1. **No navegador, sem pedir nada ao servidor:** pegue os pinos que passam pelo filtro, calcule a distância em linha reta (função pura `haversine` em `lib/domain/map.ts`, testada) e corte pelo raio. A lista aparece **na hora**, com os dados que já tenho (nome, categoria, minha nota, tags, endereço, distância).
2. **Depois, em segundo plano**, para no máximo os **20 mais próximos**, busque os dados do Google de cada um (cartões mostram esqueleto até chegar):
   - **Places API (New), Place Details**, por `place_id`, **sempre com `FieldMask`** pedindo só o necessário: nome, tipo principal, tipos, nota, quantidade de avaliações, nível/faixa de preço, horário de funcionamento (aberto agora e horário de hoje), status do negócio (`businessStatus`), resumo editorial (`editorialSummary`), telefone, site e link do Google Maps.
   - **Routes API (Compute Route Matrix)** para o **tempo e a distância reais** de trajeto dos 10 mais próximos, com um seletor **"A pé | Carro"** (padrão: a pé; lembrar a escolha no `localStorage`).
   - Tudo isso em Server Actions novas (`placeDetails`, `routeTimes`), com `requireUser()`, validação com zod e `FieldMask`. Cache curto no servidor (no máximo 24 h; **nunca** guarde dados do Google além de 30 dias, exceto o `place_id`). Só consulte o Google quando eu abrir a aba ou mudar raio/posição, **nunca** só por abrir a página do Mapa.
   - Se o Google falhar, o cartão continua mostrando o que eu tenho, com um aviso discreto "dados do Google indisponíveis agora".

### O que cada cartão mostra
- **Nome** e **o que é**: tipo do Google ("Restaurante japonês") e minha categoria/tags.
- **Resumo (sem IA):** o `editorialSummary` do Google quando existir; senão uma frase montada por regra, por exemplo "Restaurante japonês a 850 m. Sua nota: 4,5. Tags: rodízio, japonês." — use `view.summary` (os 2 primeiros textos que preenchi) e as tags. Deixe essa parte num componente/função isolada, para que um dia seja trocada por texto de IA sem mexer no resto.
- **Preço médio:** faixa de preço do Google (`priceRange`) se existir; senão o nível ($ a $$$$); e, se o item tem campo de moeda preenchido, mostrar também "Seu registro: R$ X".
- **Caminho:** distância e tempo (a pé ou de carro, conforme o seletor) + botão **Como chegar** (`mapsDirectionsUrl` com minha posição como origem).
- **Avaliação do Google:** ★ nota · N avaliações.
- **O que mais ajuda a decidir:** **aberto agora / fecha às HH:MM** (ou "fechado hoje"), **aviso em destaque se o negócio está "fechado permanentemente" ou "temporariamente"**, minha nota e tags, telefone e site (se houver).
- Botões: **Ver item**, **Abrir no Maps**, **Como chegar**.

### Estados vazios
- Sem posição informada → explicar e mostrar os dois jeitos de informar.
- Ninguém dentro do raio → "Nada seu perto daqui" + sugerir aumentar o raio.
- Filtro escondeu tudo → mesma mensagem do Mapa.

---

## 3. Chaves e configuração

- Duas chaves separadas no Google Cloud (nunca a mesma):
  - **Navegador** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` → só a *Maps JavaScript API*, restrita por referenciador HTTP (`http://localhost:3000/*` e o domínio de produção).
  - **Servidor** `GOOGLE_MAPS_SERVER_KEY` → *Geocoding API*, *Places API (New)* e *Routes API*, restrita por API. **Sem** o prefixo `NEXT_PUBLIC_`.
- Acrescente os nomes no `.env.example` com valores de exemplo e um comentário curto (mesmo estilo do que já existe), e documente no README (stack, variáveis, como criar as chaves, e o aviso de **definir cota diária e alerta de orçamento** no Google Cloud para não ter surpresa na fatura). Lembre também que na Vercel as variáveis precisam ser cadastradas.
- Geolocalização do navegador só funciona em HTTPS (ou localhost); a Vercel já atende.

## 4. O que NÃO fazer agora

- Procurar **lugares novos** no Google ("descobrir").
- Resumo escrito por IA.
- Arrastar itens entre fileiras do tier list (isso editaria a nota).
- Exportar o tier list como imagem.
- Mapa nas páginas de outras pessoas (`/u/...`) e na demonstração.
- Mexer no Filtro geral além da extração da parte 2C.
- Alterar as migrações antigas (`01` a `10`).

## 5. Desempenho e arquitetura (valem para tudo)

- Página = Server Component que faz `await` dos próprios dados em `Promise.all`; client components recebem tudo por props (regras 1, 2 e 6 do README). Todo `page.tsx` novo tem `loading.tsx`.
- Todo filtro roda na memória do cliente. A única coisa que depende de rede é o que for do Google, e isso nunca trava a primeira pintura.
- Toda escrita é Server Action: valida com zod → Supabase (a RLS autoriza) → `revalidatePath` → `ActionResult`. A exceção crua nunca chega na tela.
- Lógica de domínio nova (`tiers`, `grid-size`, `map`, `maps-links`, tratamento das respostas do Google) é **TypeScript puro com testes Vitest**, na pasta `lib/domain/` (ou `lib/google/` para o que é só de servidor). Siga o estilo dos testes de `lib/domain/domain.test.ts`.
- Acessibilidade: botões com `aria-label`/`aria-pressed`, foco visível, e o mapa com alternativa em lista (a lista dos lugares já cumpre isso).

## 6. Documentação a atualizar

- `README.md`: stack (Google Maps Platform), variáveis de ambiente, passo 11 da migração, rota `/mapa`, o novo tipo de campo e as duas novas visualizações. **Atenção:** o README ainda diz "Os seis tipos de campo", mas o código já tem **oito** (`decimal` e `currency` foram acrescentados). Com `location` são **nove**: corrija o texto.
- Estrutura de pastas do README: `components/map/`, `lib/google/`.

## 7. Testes mínimos exigidos

`tierOf`/`groupByTier` (todas as bordas), `normalizeGridSize`, `coerceFieldValue` e `parseEstruturaJSON` com `location`, `unifyFields` com campos `location`, `buildPins`/`pendingPlaces`, `haversine` e corte por raio, `mapsPlaceUrl`/`mapsDirectionsUrl` (com e sem `place_id`, com acento e espaço no endereço), e o tratamento das respostas do Google (ok, sem resultado, erro). Ao final: `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` sem erros.

## 8. Fase seguinte (só para você deixar a porta aberta)

Na aba Sugestões, adicionar uma seção **"Descobrir"**: lugares novos do Google parecidos com os itens filtrados, com botão "Salvar no Vitrine". E, mais adiante, resumo escrito por IA. Não escreva código para isso agora.

## 9. Ordem de entrega (pare e me mostre ao fim de cada etapa)

1. **Tamanho da grade** (1A).
2. **Tier list** (1B).
3. **Extração do filtro geral** em hook + componente reutilizáveis, **sem mudar o `/filtro`** (parte de 2C).
4. **Campo Localização + banco + localização de endereços + "Abrir no Maps" na página do item** (2A, 2B, 2D) — inclui a migração `11` (eu rodo) e a conversão Texto → Localização.
5. **Página do Mapa** (2C).
6. **Aba Sugestões** (2E).
7. **README, `.env.example` e revisão final** (seções 6 e 7).
