# Vitrine

Catálogo de gostos: cada pessoa registra tudo que consome — restaurantes,
filmes, livros, o que for — e mostra o que quiser. Cada **categoria** define a
própria estrutura de campos, os itens ficam organizados em **pastas**, e as
**tags** são um vocabulário compartilhado entre todas as categorias e todas as
pessoas. Itens com endereço aparecem no **Mapa**, que também diz o que dos seus
lugares salvos fica perto de você agora.

A interface é inteiramente em português do Brasil. Qualquer pessoa com 18 anos
ou mais cria conta com e-mail e senha. Cada pasta e categoria é **Pública**
(qualquer pessoa vê, inclusive sem conta, no perfil `/v/<@>`), de **Amigos** ou
**Privada**.

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
| QR | `qrcode` (MIT), só no servidor: a tela recebe o QR pronto em SVG (e o story leva o QR desenhado) |
| Testes | Vitest, só nas funções puras: `lib/domain/`, o tratamento das respostas da Geoapify (`lib/geo/parse.ts`) e os leitores das importações (`lib/import/`) |

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

# a Steam — veja "Configuração da Steam"
STEAM_API_KEY=sua-chave                 # servidor: os jogos e as horas
CRON_SECRET=segredo-de-32+-caracteres   # servidor: rodada diária e funções do banco

# as sugestões de campos por IA — veja "Sugestões de campos"
GEMINI_API_KEY=sua-chave                # servidor: só o nome da categoria vai para o Google
# GEMINI_MODEL=gemini-flash-lite-latest # opcional
```

A chave do Supabase é a **anon** (publishable). Nunca a `service_role`: ela
ignora a RLS e tudo aqui é exposto ao navegador.

A da Geoapify é **opcional**: sem ela o app inteiro funciona (o mapa também
aparece — o desenho vem do OpenFreeMap, que não tem chave); só a busca dos
endereços e os dados das Sugestões avisam que ela falta. Ela **nunca** leva o
prefixo `NEXT_PUBLIC_` — com ele, o Next a embutiria no JavaScript do
navegador.

As da Steam também são **opcionais** e também nunca levam `NEXT_PUBLIC_`:
sem elas, "Conectar Steam" avisa que a Steam não está ativada. A do Gemini
idem: sem ela, o botão "Sugerir campos com IA" não aparece.

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
8. `supabase/14_visibility_and_follows.sql` (aditivo: visibilidade em **3
   níveis** — Pública, Amigos, Privada —, as tabelas `follows` e `blocks`, as
   regras de leitura novas, as funções de leitura sem login `public_profile`
   e `public_category`, e tira de `anon` o acesso direto às tabelas). Precisa
   do 12 (para logo no começo, com aviso, se ele não rodou). O que era público
   continua público, o que era privado continua privado. Sem ele o app
   funciona, e o seletor de visibilidade avisa que falta rodar. **Não rode o
   12 de novo depois do 14**
9. `supabase/15_username_handles.sql` (aditivo: a troca de @ com limite —
   tabela `username_changes`, funções `change_username` e `resolve_username`,
   e um gatilho que só deixa o @ mudar pela função; o @ automático de conta
   nova passa a respeitar as palavras reservadas). Sem ele o app funciona, e
   trocar o @ nas Configurações avisa que falta rodar
10. `supabase/16_terms_and_account_deletion.sql` (aditivo: o aceite dos Termos
    e da Política no perfil — `terms_version`, `terms_accepted_at`,
    `adult_confirmed_at`, copiados do `user_metadata` da conta por gatilho —
    e a função `delete_my_account`). Sem ele o aceite continua funcionando
    (fica na conta do Supabase Auth e é copiado quando o 16 rodar), mas
    "Excluir minha conta" avisa que falta rodar
11. `supabase/17_inbox_category.sql` (aditivo: `categories.kind` e a categoria
    **"A organizar"** de cada conta — criada agora para quem já existe e por
    gatilho para cada perfil novo —, com as travas que impedem apagar,
    renomear ou mudar a estrutura dela). Precisa do 14 (para logo no começo,
    com aviso, se ele não rodou)
12. `supabase/18_catalog.sql` (aditivo: o **catálogo comum** `catalog_items` —
    lugares agora; filmes, livros e jogos depois —, a ligação
    `entry_places.catalog_item_id` feita por gatilho e o `catalog_item_id` dos
    itens; os lugares já localizados entram na hora). Sem ele o app funciona
    como antes (a geocodificação grava sem as colunas novas)
13. `supabase/19_quick_field.sql` (aditivo: `categories.quick_field`, o **campo
    principal** do acesso rápido; toda categoria começa com o Nome). Sem ele o
    app funciona; escolher outro campo no editor avisa que falta rodar
14. `supabase/20_favorites.sql` (aditivo: a tabela `category_favorites` — o
    **favorito** de cada categoria e a **aba Favoritos** —, só o dono lê).
    Sem ele o app funciona sem favoritos, e marcar a estrela avisa que falta
    rodar
15. `supabase/21_notifications.sql` (aditivo: a tabela `notifications` — o
    **sininho** —, a função `mark_notifications_read` e o gatilho que avisa
    de **novo seguidor**). Precisa do 14 (para logo no começo, com aviso, se
    ele não rodou). Sem ele o app funciona e o sininho fica vazio
16. `supabase/22_qr_tokens.sql` (aditivo: a tabela `qr_tokens` e as funções
    `issue_qr_token` e `redeem_qr` — o **QR pessoal**: quem escaneia vira
    amigo do dono na hora). Precisa do 14 e do 21 (para logo no começo, com
    aviso, se eles não rodaram). Sem ele o app funciona, e a tela do QR avisa
    que falta rodar
17. `supabase/23_profile_card.sql` (aditivo: `profiles.bio`,
    `profiles.card_category_ids` e `profiles.social_links` — o **cartão de
    apresentação** —, a função pública `profile_card` e `public_profile` com
    o cartão junto). Precisa do 17 (para logo no começo, com aviso, se ele não
    rodou). Sem ele o perfil mostra só a foto, o nome e o @, e salvar o cartão
    avisa que falta rodar
18. `supabase/24_connected_accounts.sql` (aditivo: `connected_accounts` — os
    **aplicativos conectados**, a Steam por enquanto —, `entries.source` e
    `entries.source_id`, a tabela `app_secrets` e as funções que gravam a
    conta e os jogos). Precisa do 17. **Depois de rodar, grave o segredo do
    servidor** com a linha do topo do arquivo (veja "Configuração da Steam").
    Sem ele o app funciona, e "Conectar Steam" avisa que falta rodar
19. `supabase/25_templates_and_explore.sql` (aditivo: `categories.source_category_id`
    e `categories.linked`, a tabela `category_imports` — o "usado por N" —, a
    função `normalize_category_name` e a busca `search_public_categories`).
    Precisa do 17 e do 19. Sem ele o app funciona, e "Começar de um modelo"
    avisa que falta rodar
20. `supabase/26_linked_copies.sql` (aditivo: `entries.source_entry_id`,
    `entries.edited_after_copy`, `entries.source_removed_at`,
    `categories.linked_synced_at` e a tabela `linked_entry_receipts` — as
    **cópias ligadas** do Explorar —, as funções `copy_category_with_items`,
    `sync_linked_category` e `explore_public_categories`). Precisa do 25. Sem
    ele o app funciona, e o Explorar avisa que falta rodar
21. `supabase/27_field_suggestions.sql` (aditivo: a função
    `field_suggestions` — os campos que outras pessoas usam —, o cache das
    respostas da IA e o limite diário por pessoa). Precisa do 25 (e do 24 para
    guardar as respostas da IA). Sem ele o app funciona e o painel de
    sugestões não aparece
22. `supabase/28_place_ratings.sql` (aditivo: a função `place_ratings` — o
    "No Vitrine" do cartão de um lugar por perto). Precisa do 14 e do 18. Sem
    ele o cartão diz que ninguém avaliou
23. `supabase/29_imports.sql` (aditivo: a função `notify_import_done` — o
    aviso no sininho quando uma importação termina). Precisa do 21 e do 24
    (`entries.source`/`source_id`, que fazem reimportar não duplicar). Sem
    ele a importação funciona, só sem o aviso
24. `supabase/30_matches.sql` (aditivo: as tabelas `matches` e
    `match_members` e as funções `create_match` e `respond_match` — o
    **convite e o aceite** do Match). Precisa do 14 e do 21. Sem ele a tela
    Matches avisa que falta rodar
25. `supabase/31_match_build.sql` (aditivo: `categories.kind` ganha
    `'match'`, as colunas `match_*` da cópia, as travas e a função
    `build_my_match_copy` — a **cópia de cada pessoa**; refaz também o
    `place_ratings` do 28 para ignorar as cópias). Precisa do 18, do 24, do
    25, do 28 e do 30. Sem ele o "Abrir a sua cópia" avisa que falta rodar
26. `supabase/32_refinements.sql` (refaz duas funções: `field_suggestions`
    — um campo sugerido aparece com **uma** pessoa, não mais três — e
    `build_my_match_copy` — a cópia do match vira **lista solta**, sem
    subpastas —; e tira das subpastas os itens das cópias que já existiam).
    Precisa do 27 e do 31

**Fase 5 (30 e 31), em uma linha cada:** 30 = o convite e o aceite do Match;
31 = a cópia de cada um (com as marcações e a % calculadas na tela).
**Refinamentos (32):** sugestões de campos com uma pessoa e o match solto.

**Fase 4 (25 a 29), em uma linha cada:** 25 = modelos (começar da estrutura
de outra); 26 = Explorar e cópias ligadas; 27 = sugestões de campos (e a IA);
28 = "No Vitrine" de um lugar; 29 = o aviso das importações.

**Fase 3 (21 a 24), em uma linha cada:** 21 = o sininho; 22 = o QR que faz
amigos; 23 = o cartão de apresentação; 24 = a Steam (e a origem dos itens).

**Fase 1 da rede de gostos (14 a 18), em uma linha cada:** 14 = Pública /
Amigos / Privada, seguir e bloquear, leitura sem login por função; 15 = o @ com
limite de trocas e redirecionamento; 16 = aceite dos Termos (18+) e excluir a
conta; 17 = a "A organizar" de cada conta; 18 = o catálogo comum de lugares.
Rode em ordem — o 14 confere o 12, e o 17 confere o 14.

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

## Configuração da Steam

O "Conectar Steam" (Meu perfil → **Editar cartão** → Steam) usa o **login da
própria Steam** (OpenID — a senha nunca passa pelo Vitrine) e a **Web API**
gratuita para ler os jogos e as horas. Tudo opcional.

### 1. A chave da Web API

1. Entre em <https://steamcommunity.com/dev/apikey> com uma conta Steam (a
   Steam pede que a conta já tenha alguma compra; a chave é de graça).
2. Em *Domain Name*, ponha o domínio do site (ex.: `vitrine.vercel.app`).
3. Copie a chave para `STEAM_API_KEY` no `.env.local` e na Vercel.

### 2. O segredo do servidor (`CRON_SECRET`)

Um texto aleatório e longo que **só o servidor conhece**. Ele faz duas coisas:
protege a rota diária e abre as funções do banco que gravam a conta e os
jogos — assim o app **não precisa da chave secreta do Supabase** (a
`service_role`, que ignora toda a RLS). Se o segredo vazar, o estrago fica
restrito à sincronização da Steam.

1. Gere: `openssl rand -hex 32` (ou qualquer gerador de senha, 32+
   caracteres).
2. Ponha em `CRON_SECRET` no `.env.local` e na Vercel.
3. Grave o **mesmo valor** no banco, uma vez, no SQL Editor (depois do
   `24_connected_accounts.sql`) — o banco guarda só o hash:

   ```sql
   insert into public.app_secrets (name, secret_hash)
   values ('cron', encode(sha256(convert_to('COLE_AQUI_O_CRON_SECRET', 'UTF8')), 'hex'))
   on conflict (name) do update
     set secret_hash = excluded.secret_hash, updated_at = now();
   ```

   Trocou o segredo? Rode de novo com o novo valor e atualize a Vercel.

### 3. A atualização diária

O `vercel.json` agenda o **Cron da Vercel** (grátis no plano Hobby, uma vez
por dia — por volta das 06h de Brasília; a Vercel escolhe o minuto dentro da
hora) chamando `/api/cron/steam`. Com a variável `CRON_SECRET` cadastrada, a
Vercel manda `Authorization: Bearer <CRON_SECRET>` sozinha; sem o cabeçalho
certo, a rota responde 401. Cada rodada atualiza até 25 contas (as mais
antigas primeiro) e para antes dos 60 s da função — o resto vai na rodada
seguinte.

Para testar na máquina (com o `npm run dev` rodando):

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/cron/steam
```

Sem Vercel? Qualquer agendador serve (um workflow do GitHub Actions como o do
keep-alive, por exemplo), desde que mande o mesmo cabeçalho.

### 4. Observações

- A Steam só entrega os jogos se o **perfil e os detalhes dos jogos forem
  públicos** (Steam → Editar perfil → Privacidade). Se não forem, a tela avisa
  e explica onde mudar.
- Os jogos vão para a categoria **"Jogos"** (ou "Jogos da Steam", se a pessoa
  já tiver uma "Jogos") na pasta **"Steam"**, com o campo **Horas jogadas**
  (tipo Tempo; o `playtime_forever` da Steam já vem em minutos) e a capa do
  jogo. A visibilidade é o padrão do perfil.
- Sincronizar de novo **só atualiza as horas**: nome, nota, imagem, tags e o
  resto que a pessoa mexeu ficam. Jogo apagado à mão volta na sincronização
  seguinte (ele continua na biblioteca da Steam).
- Desconectar apaga só a ligação: a categoria e os jogos ficam.

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
10. **Todo `page.tsx` tem um `loading.tsx`** com esqueleto fiel ao layout.
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
components/     … · providers/ (useVitrine: as escritas do app num objeto só)
lib/
  actions/      contrato das escritas, schemas zod compartilhados, ActionResult
  domain/       TS puro e testado: tipos, campos, formatação, filtro, stats, erros,
                grade e tier list, localização, pinos, links e dados do Mapa
  geo/          só servidor: chamadas à Geoapify (client.ts) e o tratamento das
                respostas em funções puras e testadas (parse.ts)
  queries/      leituras do Supabase
  supabase/     server.ts, middleware.ts, env.ts (só servidor: a sessão vive em cookies)
supabase/       01_schema.sql … 20_favorites.sql
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
  Item sem nota vai para a faixa **"Sem nota"**, no fim (uma lista importada
  do Google, sem notas, aparece inteira ali). É **somente leitura**:
  sem arrastar, sem seleção — mudar de fileira seria mudar a nota. O tamanho
  das miniaturas segue o P / M / G.

### Mapa (`/mapa`)

- Mostra num mapa escuro (MapLibre + OpenFreeMap) tudo que **eu** marquei com
  Localização: um pino com a cor e o ícone da categoria, agrupados quando
  ficam perto. A página de outra pessoa (`/v/...`) não tem mapa. O filtro é o mesmo do Filtro geral; no celular, recolhido atrás do
  botão "Filtros".
- **O filtro do Mapa só oferece o que pode virar pino** (`mapScope`, em
  `lib/domain/map.ts`): as categorias com campo de Localização — mesmo as
  ainda sem endereço —, com o número de lugares de cada uma ao lado; as tags
  usadas pelos itens delas; e os campos delas no "Adicionar campo…". A nota
  some quando nenhuma dessas categorias usa estrelas.
- **"Ver no mapa"** na tela de uma categoria com Localização (só para o dono)
  abre `/mapa?categoria=<id>`, com ela já marcada no
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
  endereço — funcionam até sem localização (e sem login). O `place_id`
  da Geoapify não vai para o Google.

### Sem conta: só pelo link

Não existe demonstração nem "entrar sem conta": quem não tem conta vê **só o
que é público, pelo link** que alguém compartilhou — o perfil (`/v/<@>`), uma
categoria (`/categoria/<id>`) ou um item (`/categoria/<id>/<item>`), somente
leitura, com Entrar e Criar conta no topo. Criar pasta, categoria, item,
seguir, mexer nas próprias configurações — tudo pede conta.

- A leitura sem login vai pelas funções `public_profile` e `public_category`
  (migração 14): `anon` não lê tabela nenhuma.
- Os componentes pedem as escritas a `useVitrine().actions`
  (`components/providers/vitrine-context.tsx`), um objeto com a forma do
  contrato `VitrineActions` (`lib/actions/contracts.ts`) que aponta para as
  Server Actions; os schemas zod ficam em `lib/actions/schemas.ts`.

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

Cada pessoa **lê** o que o nível de visibilidade deixa (abaixo); só o dono
**escreve** o que é seu. As `tags` são a exceção: vocabulário compartilhado, sem dono —
qualquer autenticado cria, edita e apaga, e a mudança vale para o acervo de
todo mundo.

**Privacidade** (migrações 12 e 14):

- Cada **pasta** e cada **categoria** tem um de três níveis: **Pública**
  (qualquer pessoa vê, **inclusive sem conta**), **Amigos** (quem se segue
  mutuamente com o dono) ou **Privada** (só o dono). O dono troca no seletor
  do topo da categoria, ou do topo da pasta aberta nas Coleções; as de
  Amigos ganham um ícone de pessoas no card, e as privadas, um cadeado.
  A opção **Amigos** está ligada desde que existe o botão Seguir
  (`FRIENDS_VISIBILITY_ENABLED` em `lib/domain/privacy.ts`; desligar
  esconde a opção de novo).
- **Vale o nível mais restrito do caminho**: pasta privada esconde tudo o que
  está dentro dela, em qualquer profundidade, e pasta de Amigos limita aos
  amigos o que está dentro — mesmo uma categoria marcada como pública. A tela
  avisa o dono quando é o caso ("está dentro de “X”, que é privada").
- Quem decide é o **banco**, não a tela: as políticas de leitura (RLS) de
  `folders`, `categories`, `entries`, `entry_folders`, `entry_tags` e
  `entry_places` só devolvem a terceiros o que é visível para eles
  (`visibility_allows_me`, `folder_is_visible`, `category_is_visible`,
  `entry_is_visible`). Um link direto, a contagem de itens ou o uso de uma tag
  não denunciam nada fechado, e trocar o nível vale na próxima leitura de
  qualquer pessoa.
- **Seguir e bloquear** (tabelas `follows` e `blocks`; as telas estão em
  "Seguir, Amigos e bloquear", abaixo): seguir não pede aceite; **amigos = os
  dois se seguem**. Bloquear
  desfaz os follows nos dois sentidos, impede novos e esconde tudo de um para
  o outro; o perfil de quem bloqueou some para quem foi bloqueado.
- **Sem login**, nenhuma tabela é legível pelo papel `anon` (nem com a chave
  pública). Quem não tem conta lê só pelas funções `public_profile(usuario)` e
  `public_category(id)`, que entregam **um** perfil ou **uma** categoria por
  vez, e só o que é público — copiar a base inteira fica difícil. O topo do
  `14_visibility_and_follows.sql` mostra como conferir no SQL Editor.
- **Padrão do perfil** (Configurações → Privacidade): novas pastas e
  categorias nascem **públicas** (o inicial), de **amigos** ou **privadas**.
  Um gatilho no banco aplica o padrão quando a criação não diz nada — vale
  também para a importação de backup. Mudar o padrão não mexe no que já
  existe.
- **Aviso único**: quem já tinha conta antes do 14 e tem alguma categoria
  pública vê, uma vez, nas Coleções, que "Pública" agora quer dizer
  "visível na internet" (`profiles.public_notice_seen_at`).
- As colunas antigas `is_public` e `default_public` continuam no banco,
  sempre coerentes com as novas (gatilho), até uma migração futura removê-las.
- Na página de outra pessoa (`/v/...`), pasta sem nada visível dentro não
  aparece.

### O @ e o perfil (`/v/<@>`)

- Cada pessoa tem um **@** (3 a 30 caracteres: letras sem acento, números e
  `_`), sempre à vista: ao lado do avatar na barra, no menu e no topo das
  Coleções. O perfil fica em **`/v/<@>`**; o endereço antigo `/u/<@>`
  redireciona (permanente, em `next.config.ts`).
- **`/v/<@>` abre sem login**: mostra o cartão (abaixo) e as pastas e
  categorias **públicas** (pela função `public_profile`), com um convite
  para entrar. Com login, a leitura é a normal (a RLS decide — Amigos inclusive).
- **O perfil de outra pessoa** mostra o cartão e, embaixo, as coleções dela
  (o que você pode ver). **O seu perfil (Meu perfil) é só o cartão** — as suas
  coleções ficam em **Coleções** (`/`) — e é ali que ele se edita.
- **O menu da conta** (o @ e a foto, no canto da barra): **Meu perfil**,
  **Coleções**, **Meu QR**, **Matches**, **Configurações** e **Sair**. Os
  links da barra de cima (Explorar, Filtro, Mapa, Tags, Favoritos, Pessoas)
  não se repetem nele — só no celular (abaixo de 768 px), onde a barra não os
  mostra. `/perfil` é um atalho para o seu perfil (leva a query junto).
- **Categoria e item públicos também abrem sem login**, somente leitura, no
  mesmo endereço de sempre (`/categoria/<id>` e `/categoria/<id>/<item>`):
  sem login, a página lê pela função `public_category`; com login, pelas
  tabelas. Foi reaproveitar a rota em vez de criar `/v/<@>/<categoria>`: as
  duas telas, os links dos cards e os links já compartilhados continuam os
  mesmos. Categoria que não é pública mostra "não encontrada" com um botão
  Entrar (que volta para ela depois do login).
- **Trocar o @** (Configurações → Nome de usuário): no máximo **2 vezes a
  cada 14 dias**, com a regra escrita embaixo do campo e uma confirmação
  antes. O @ antigo **redireciona** para o novo por 14 dias e fica
  **reservado** nesse tempo (só a própria pessoa pode voltar a ele); depois
  fica livre. Só muda pela função `change_username` (migração 15) — um
  gatilho recusa a troca direta na tabela. Palavras reservadas (admin,
  vitrine, login, mapa…) ficam em `lib/domain/username.ts` e na função
  `is_reserved_username`: mudou uma, mude a outra.

### Seguir, Amigos e bloquear

- **Seguir** não pede aceite: o botão fica no topo do perfil (`/v/<@>`) e em
  cada pessoa de **Pessoas** (`/usuarios`), com a contagem de **seguidores**
  e **seguindo** (cada uma abre a lista, em `/v/<@>/seguidores` e
  `/v/<@>/seguindo`). Quem segue você e você ainda não segue de volta vê
  **Seguir de volta**; os dois se seguindo, aparece o selo **Amigos** — e o
  que for de Amigos passa a aparecer para os dois. Deixar de seguir tem
  **Desfazer** no aviso.
- **Remover seguidor**: na própria lista de seguidores, sem bloquear (a
  pessoa pode seguir de novo).
- **Bloquear** fica no menu "⋯" do perfil, com confirmação: desfaz os follows
  nos dois sentidos, impede novos e esconde tudo de um para o outro. O
  perfil de quem bloqueou mostra a faixa **Desbloquear**.
- **Sininho** na barra: o número de não lidas vem do servidor (num
  `Suspense`, então a página não espera por ele) e a lista só é buscada ao
  abrir — abrir marca tudo como lido. Avisa de **novo seguidor** (e diz
  quando virou amizade) e de **amigos pelo QR** (abaixo); a mesma pessoa
  não gera dois avisos de novo seguidor em 24 horas, e aviso de quem está
  bloqueado não aparece. Os avisos nascem no banco (gatilho da migração 21
  e `redeem_qr` da 22), então nenhuma tela precisa lembrar de criá-los.
- Sem login, os botões viram um convite para entrar. As ações ficam em `app/v/actions.ts`;
  as frases, em `lib/domain/social.ts`.

### QR pessoal (`/qr`)

- **Meu QR** (no menu da conta, no seu perfil e em Pessoas): o QR do seu
  perfil com um **código de 5 minutos** — `/v/<@>?qr=<código>`. A tela troca
  o código sozinha a cada 4 minutos (e na hora, ao voltar para a aba depois
  de um tempo), então o anterior ainda vale enquanto alguém escaneia, e um
  print não serve por muito tempo. Numa roda, todo mundo pode escanear o
  mesmo QR.
- **Escaneou, viraram amigos**: quem abre o link logado passa a seguir o
  dono e o dono passa a segui-lo, na hora (`redeem_qr`, migração 22). O
  perfil mostra "Agora vocês são amigos", tira o código da barra de endereço
  e lê a página de novo (o que é de Amigos aparece). O dono recebe no
  sininho "Você e @… viraram amigos pelo QR" — um aviso só, no lugar dos dois
  de "novo seguidor". Sem login: vai entrar e volta para o perfil com o
  código. Bloqueio vale: quem bloqueou é avisado para desbloquear; quem foi
  bloqueado vê só "este QR não vale mais", sem saber do bloqueio.
- **Ler QR** (`/qr?modo=ler`): a câmera traseira com `BarcodeDetector`
  (Chrome no Android e no Mac). Só abre perfis do próprio Vitrine
  (`scannedProfilePath`, em `lib/domain/qr.ts`) — QR de outro site é
  recusado. Onde não existe (iPhone, Firefox, Chrome no Windows), a tela
  orienta a usar a câmera do celular, que abre o link do mesmo jeito.
- O banco guarda só o **hash** do código; ninguém lê a tabela direto, só as
  funções. Cada pessoa tem no máximo 3 códigos vivos, e os vencidos são
  apagados a cada código novo. O QR é gerado no servidor (`qrcode`), com o
  endereço de `NEXT_PUBLIC_SITE_URL` — ou, em branco, o de quem abriu a tela.

### Cartão de apresentação e story

- **O cartão** fica no topo do perfil (`/v/<@>`) e **todo mundo vê**, com ou
  sem login: foto (por link), nome, @, **bio** de até 220 caracteres, os
  **links das redes**, a faixa de seguir e até **5 categorias** com os **3
  melhores** itens de cada uma (maior nota, empate pelo nome; em categoria
  sem estrelas, os 3 primeiros da ordem manual). No perfil de outra pessoa,
  embaixo dele vêm as coleções dela.
- **Só categorias públicas de fato** entram: a função `profile_card`
  (migração 23) confere o nível da categoria e de todas as pastas acima a
  cada leitura — categoria que deixou de ser pública some do cartão na hora
  e volta sozinha se ficar pública de novo. A "A organizar" nunca entra.
- **Meu perfil → Editar cartão** (`/v/<@>?editar=1`, o painel abre embaixo
  do cartão; **Concluir** fecha): **foto e nome**; a **bio** e as categorias
  (só as públicas aparecem para escolher; subir, descer e tirar); as
  **redes**; e a **Steam** (abaixo). O **@**, a senha e o resto da conta
  ficam nas Configurações.
  **Redes — Instagram, X, Discord, Spotify e YouTube**: aceita o @ ou o link e grava
  normalizado (`normalizeSocialLink`, em
  `lib/domain/card.ts`); ao mostrar, normaliza de novo, então um link
  estranho gravado direto pela API nunca vira `href`. Nome do Discord não
  tem página pública: o toque copia.
- **Story 9:16** (`/v/<@>/story`, PNG 1080×1920 gerado com `next/og`): foto,
  nome, @, bio, as categorias com os 3 melhores e o **QR do perfil** (o link
  simples, sem código de amizade — o story fica no ar 24 horas). O botão
  **Compartilhar no story** (no próprio perfil) abre o compartilhar do
  celular com a imagem (dali, Instagram → Story). No computador ele vira
  **Copiar imagem do story**: copia a imagem para a área de transferência
  (Ctrl+V onde quiser; o aviso tem **Baixar**) e, se o navegador não deixar
  copiar, baixa.
- A foto do story é buscada pelo **servidor**, então só vale endereço de
  internet de verdade (`publicImageUrl`, em `lib/domain/remote-image.ts`):
  nada de IP solto, `localhost` ou rede interna, cada redirecionamento é
  conferido, no máximo 2 MB e 3 segundos, só PNG ou JPEG. Fora disso, a
  imagem usa a inicial. Os ícones das categorias (emoji) vêm do Twemoji, que o
  `next/og` busca na hora.

### Aplicativos conectados (Steam)

- **Meu perfil → Editar cartão → Steam**: conectar, sincronizar agora, ver
  os jogos, desconectar. A volta do login da Steam cai no mesmo painel
  (`/perfil?editar=1&steam=…`, com o recado).
- **Conectar**: `/api/steam/conectar` manda para o login da Steam com um
  "estado" aleatório num cookie httpOnly; `/api/steam/retorno` confere o
  estado e a mensagem do OpenID, pergunta à Steam se ela é legítima
  (`check_authentication`) e só então liga o SteamID64 ao perfil — pela
  função `steam_connect`, que abre só com o segredo do servidor. Por isso
  ninguém consegue gravar uma conta Steam que não provou ser dela, nem
  "ocupar" a de outra pessoa. Uma conta Steam liga a um perfil só.
- **Sincronizar**: `GetOwnedGames` (com `include_appinfo`) → `steam_apply`
  (migração 24), que cria a pasta e a categoria se preciso e grava cada jogo
  com `source = 'steam'` e `source_id = appid` — o par é único por dono, então
  sincronizar de novo atualiza em vez de duplicar. Roda sozinho uma vez por
  dia (veja "Configuração da Steam") e no "Sincronizar agora" (no máximo uma
  vez por minuto). O que deu errado fica em `last_error` e aparece na tela.
- O cartão do perfil não ganha nada extra por causa da Steam (a categoria dos
  jogos pode entrar nele como qualquer outra pública).

### App instalável e acesso rápido (`/compartilhar`)

- O Vitrine é um **PWA**: `app/manifest.ts` (nome, cores, `display:
  standalone`, ícones 192/512 gerados por `app/icon.tsx` e o do iPhone por
  `app/apple-icon.tsx`, sem imagem no repositório) e um **service worker
  mínimo** (`public/sw.js`): só o necessário para instalar — não guarda nada
  em cache nem intercepta requisição. O middleware deixa `sw.js`, o manifest
  e os ícones passarem sem login.
- **Aviso discreto "Instale o Vitrine"** depois do login, só quando o
  navegador oferece a instalação (`beforeinstallprompt`); "Agora não" fica
  lembrado no `localStorage`. Nas **Configurações → App no celular**: o
  botão de instalar, ou o passo a passo (no iPhone, "Adicionar à Tela de
  Início" — e o aviso de que o iPhone não deixa web app receber o
  "Compartilhar"; isso fica para o app nativo).
- **Compartilhar (Android)**: instalado, o Vitrine aparece no botão
  Compartilhar dos outros apps (`share_target` → `/compartilhar?text=…`).
  Só texto por enquanto: o que chega vira o **Nome** (um link junto de
  palavras sai; só o link, vira o nome). Sem login, o middleware leva ao login
  e volta com o texto.
- O painel **"Salvar em…"**: um toque numa categoria salva. Em cima, o
  **palpite** (`suggestCategoryId`: um item de mesmo nome, o nome da
  categoria citado no texto, ou quase todas as palavras de um item) e a **"A
  organizar"**; depois as categorias usadas por último, com busca. Se a
  categoria tem **campo principal** (≠ Nome), o painel pede só ele (dá para
  pular). **Nova categoria**: só o nome, estrelas ligadas e ícone pela
  palavra-chave (`iconForCategoryName` — "Séries" → 📺). Salvou: aviso com
  **Desfazer** e a categoria aberta.
- Depois, fora desta etapa: extensão do Chrome (abrindo `/compartilhar?text=`),
  links e imagens com preenchimento automático e o iPhone (app nativo).

### Favoritos (`/favoritos`)

- **A aba Favoritos** (na barra, depois de Tags) mostra **categorias
  inteiras**, como nas Coleções — um toque abre a categoria. **Adicionar
  categoria** lista as suas categorias que ainda não estão lá (com busca,
  quando são muitas; a "A organizar" não entra): um toque adiciona, e a lista
  fica aberta para pôr mais. Arrastar ordena; o **X** tira da aba (não apaga
  nada). Cada mudança grava na hora.
- **A estrelinha de um item** é outra coisa: o item preferido de uma
  categoria (no máximo um). A estrela nas ações do card e da linha, e o botão
  na página do item — tocar marca, marcar outro troca, tocar de novo
  desmarca. É só uma marca ao lado do nome: **não** põe nada na aba.
  **Só o dono vê** (não vai para o perfil nem para o cartão).
- Tudo numa tabela à parte, `category_favorites` (migração 20), com RLS só
  do dono — e não em colunas de `categories`/`profiles`, que outras pessoas
  leem. Item apagado ou que muda de categoria deixa de ser o favorito (o banco
  cuida); categoria apagada sai da aba. O backup ainda não leva os favoritos.
  A ordem da aba é `tab_position` (`tabOrder`, `tabCategories` e
  `addableCategories`, em `lib/domain/favorites.ts`).

### Começar de um modelo

- **Nova categoria → "Começar de um modelo"** (só ao criar): busca entre as **categorias públicas de outras pessoas** que
  têm pelo menos um campo — sem busca, as **mais usadas** (ou as mais novas);
  com busca, as de nome mais parecido primeiro. Cada cartão mostra o **@ do
  autor**, os campos e o **"usado por N"**.
- **Usar** traz **só a estrutura**: nome, ícone, cor, estrelas, ordem padrão,
  campo principal e os campos **com os mesmos ids** — é o que deixa trocar um
  item entre as duas categorias sem perder valor (abaixo). Volta para o
  formulário com o aviso "Estrutura de “X”, de @autor" e um **Desfazer**; dá
  para mudar tudo antes de criar.
- A categoria nova guarda `source_category_id` (de onde veio), e um gatilho
  grava em `category_imports` — só quando a original é pública de fato e de
  outra pessoa. Ninguém grava ali à mão, então o "usado por N" (pessoas
  distintas) não dá para inflar; cada pessoa lê só as suas linhas.
- A busca roda no banco (`search_public_categories`, migração 25): só o que é
  público de fato (nenhuma pasta acima fechando), sem a "A organizar", sem as
  suas próprias e sem quem tem bloqueio com você. Compara o **nome
  normalizado** — minúsculas, sem acento e um singular simples ("Filmes" e
  "Filme" caem juntos): `normalizeCategoryName` em `lib/domain/templates.ts`
  e `normalize_category_name` no banco seguem a mesma regra (mudou uma, mude
  a outra).

### Explorar (`/explorar`) e cópias ligadas

- **Explorar** fica na barra de cima (e no menu da conta, no celular): as
  **categorias públicas de outras pessoas que têm itens**, com busca (nome
  normalizado, como nos modelos) e, sem busca, as **mais copiadas** ou as
  **mais novas**. Cada cartão: ícone, nome, @ do autor, quantos itens,
  "usado por N", os 3 melhores itens e os campos. A primeira lista vem pronta
  do servidor (`explore_public_categories`, migração 26).
- **Pegar com itens** (`copy_category_with_items`): cria uma categoria sua, na
  raiz das Coleções, com a estrutura (campos com os mesmos ids) e **até 500
  itens** — nome, imagem e enquadramento, campos, **tags**, **nota** e as
  **localizações já encontradas** (aparecem no Mapa sem gastar busca de
  endereço). Com mais de 500, vêm os 500 primeiros da ordem manual da
  original; os outros chegam aos poucos nas sincronizações. Nome repetido
  vira "Nome (@autor)". A visibilidade é o padrão do seu perfil; subpastas da
  original não vêm (tudo entra na raiz).
- **A cópia fica ligada** (`categories.linked`). Ao abrir a categoria, a
  página chama `sync_linked_category` (no máximo a cada 10 minutos) e, se algo
  mudou, lê de novo:
  - **itens novos do autor chegam** (até 500 por vez);
  - **edição do autor atualiza os itens que você não editou** — mexer no
    nome, nota, imagem, campos ou tags marca o item como seu
    (`edited_after_copy`, por gatilho) e o autor não sobrescreve mais;
  - **item apagado pelo autor continua no seu**, marcado "removido do
    original" (ícone no card e recado na página do item);
  - item que **você** apagou não volta (`linked_entry_receipts` lembra o que a
    cópia já recebeu);
  - original que ficou **privada, de amigos, apagada** ou com bloqueio entre
    vocês: a ligação se desfaz e a cópia fica como está (com um aviso);
  - **Desligar** (na faixa "Ligada a @autor", com confirmação) faz o mesmo à
    mão. Não tem religar — é só pegar de novo.
- Cada cópia conta no "usado por N" da original (o mesmo gatilho dos modelos,
  com `mode = 'linked'`).

### Match (`/matches`): convite e aceite

- **Matches** fica no menu da conta; o atalho **Match** aparece no perfil de
  cada amigo. **Novo match**: escolher até **7 amigos** (8 pessoas com você)
  — só **amigos**, quem você segue e segue você de volta, sem bloqueio.
- **Todos precisam aceitar.** Quem cria já aceitou; cada convidado recebe o
  convite no **sininho** (o toque leva a `/matches`) e responde ali:
  **Aceitar** ou **Recusar**. Uma recusa **cancela o match** para todo mundo,
  com aviso; quem criou pode cancelar, e quem aceitou pode desistir
  (cancela também), enquanto ele estiver pendente. Todos aceitaram: o match
  fica **pronto** e todos são avisados.
- Cada pessoa tem uma **cor automática** (pela ordem: quem criou primeiro;
  `MATCH_COLORS` em `lib/domain/match.ts` e `match_color` no SQL 30 seguem
  a mesma lista).
- As regras moram nas funções do banco (`create_match`, `respond_match`);
  ninguém escreve nas tabelas direto, e só quem está no match o lê. Freio:
  no máximo 20 matches criados por dia.

### Match: a cópia de cada um e a % de compatibilidade

- Match pronto: **Abrir a sua cópia**. Na primeira vez o banco monta
  (`build_my_match_copy`, migração 31) e depois só abre a mesma. Cada pessoa
  monta a sua quando abre — por isso cada cópia mostra só o que **aquela
  pessoa** pode ver.
- A cópia mora em **Coleções › Matches** (a pasta é criada se não existir;
  pode renomear ou apagar — o próximo match recria), com o nome
  **"@você & @amigo · DD/MM/AAAA"** (grupo: todos os @; nome longo demais
  vira "@você & mais N pessoas") e a data em que o match ficou pronto. Por
  dentro, uma **lista solta** — sem subpastas (migração 32) —, com o que é a
  mesma coisa lado a lado (o "Duna" de cada pessoa, um junto do outro).
  Cópia montada antes do SQL 32 é achatada por ele.
- **O que entra** (até 500 itens por pessoa, os mexidos por último): de você,
  o que alguém do match pode ver; dos outros, só o que **você** pode ver —
  público e, se for amigo, o de Amigos. **Privado nunca**, e nada de quem tem
  bloqueio com você. É uma **foto**: não atualiza depois.
- **"Mesma coisa"** (`entries.match_key`, feita pelo banco): o mesmo lugar do
  catálogo comum; o mesmo item do catálogo; ou o mesmo título normalizado em
  **categorias equivalentes** (mesmo nome normalizado, ou o mesmo modelo de
  origem do Explorar).
- **Na tela** (calculado na hora, com o que está na cópia —
  `lib/domain/match.ts`, testado): card com a **cor de quem é** o item;
  **"Em comum"** (2+ pessoas têm); **"Sugestão para você"** (nota ≥ 4 de quem
  tem, e você não tem); a legenda de cores (tocar numa pessoa mostra só os
  itens dela) e os filtros rápidos **Em comum** e **Sugestões para mim**.
- **% de compatibilidade** (a fórmula da Parte 2 do plano): sobreposição =
  itens em comum ÷ 25% da coleção menor (no máximo 1); concordância = média
  de (1 − |nota A − nota B| ÷ 5) no que os dois avaliaram; compatibilidade =
  sobreposição × (0,6 + 0,4 × concordância). Ex.: 100 e 40 itens, 8 em comum,
  meia estrela de diferença → **77%**. Com 2 pessoas mostra o par; em grupo,
  a média dos pares (e cada par ao lado).
- **O item da cópia**: nome, imagem, a **nota do dono** e os **campos do
  original, só leitura** (a Localização com "Abrir no Maps"). Dá para pôr
  **tags suas** e excluir da cópia (a seleção também faz isso em lote); nome,
  nota e campos não se editam, e não há pasta nem item novo ali.
- **Trazer** (no card das sugestões, à vista; nos outros, no hover e na
  página do item): copia **nome, imagem e localização** (já encontrada, se o
  original tinha) para a sua **A organizar** — sem a nota do outro. Trazer de
  novo não duplica (`source = 'trazer'`).
- **Privacidade da cópia**: a categoria do match é **sempre privada** (um
  gatilho força, e ela não deixa de ser de match); pelo app, nada **sai**
  dela (só o Trazer, que leva o mínimo) e nada **entra** (nem item novo, nem
  movido). Assim o que um amigo deixou só para amigos não vira público por
  tabela. O `place_ratings` (o "No Vitrine" de um lugar) ignora as cópias:
  lá o item é seu, mas a nota é do amigo.

### Importar (`/importar`): Google Maps e Letterboxd

- **Configurações → Importar** abre a tela, com o passo a passo de cada
  serviço. Os arquivos são **lidos no aparelho** (soltos ou dentro do .zip) e
  o servidor recebe só as linhas, em lotes; reimportar **não duplica**
  (`entries.source` + `source_id`, migração 24). Categorias novas nascem com
  a visibilidade padrão do perfil. Ao terminar, um aviso no sininho
  (`notify_import_done`, migração 29).
- **O .zip sem dependência**: `lib/import/zip.ts` lê o índice do fim do
  arquivo e só os arquivos que interessam, em pedaços, com o
  `DecompressionStream` do próprio navegador (Chrome, Safari 16.4+, Firefox
  113+) — um Takeout de gigabytes não precisa caber na memória, e ZIP64 (acima
  de 4 GB) também abre. Navegador sem isso: a tela pede os arquivos de dentro.
- **Google Maps (Takeout)** — não existe API dos "Salvos". No
  takeout.google.com, só **Salvos** e **Maps (seus lugares)**, exportar em
  .zip. O `Saved Places.json` (os **salvos com estrela**, com coordenadas) e
  um `.csv` por **lista** da pasta Salvos viram, na pasta **"Google Maps"**,
  uma categoria por lista + **"Salvos com estrela"**, com **Nome,
  Localização e Sua anotação**. O formato é reconhecido pelo **conteúdo**
  (colunas em inglês ou português), não pelo nome do arquivo — o Takeout em
  português traduz nomes. `source_id` = a lista + o link do lugar: o mesmo
  lugar em duas listas vira dois itens (um em cada), e reimportar a lista não
  duplica. Com coordenadas (os com estrela, ou quando o link traz
  `!3d…!4d…`/`@lat,lng`), o lugar já entra no Mapa; sem elas, entra na **fila
  de busca de endereços** do Mapa (pelo nome, que é o que a lista traz): a
  Geoapify grátis localiza até 3.000 por dia, e o que passar disso continua
  no dia seguinte, pelo Mapa.
- **Letterboxd** — em letterboxd.com → Settings → Data → Export your data. Só
  os filmes **assistidos** (a watchlist não entra): `watched.csv`,
  `ratings.csv` (a nota de hoje), `diary.csv` (a data mais recente e, sem
  ratings, a nota do último registro) e `reviews.csv` (a resenha mais
  recente). No diário e nas resenhas a "Letterboxd URI" é a do registro, não
  a do filme: ali a ligação é por **nome + ano**. Vira a categoria **"Filmes"**
  na pasta **"Letterboxd"**, com **Nome, Ano, Nota (as estrelas do item, 0,5
  a 5), Data em que assistiu e Resenha**; `source_id` = a URI do filme.
  Reimportar acrescenta os novos e **atualiza as notas que mudaram**.
- Nome de categoria já usado fora da pasta: "Nome (Google)" / "Filmes
  (Letterboxd)". Leitores puros em `lib/import/` (CSV, zip, Google,
  Letterboxd), com testes.

### "Você está em X?" (lugares por perto)

- Em **Coleções** e no **Mapa**, se a localização **já foi autorizada antes**
  (num toque seu no Mapa, em "Minha localização"), aparece a faixa **"Você
  está em…"** com até **3 lugares** a uns 150 m. O app **nunca pede** a
  localização sozinho: sem autorização — ou num navegador que não diz se ela
  existe —, a faixa não aparece. A posição é usada só para a busca e some
  (nunca é gravada). Fechar (X) esconde até o fim da sessão.
- A busca é o **Places da Geoapify** (`GEOAPIFY_API_KEY`, a mesma do Mapa: 1
  crédito por busca), guardada por **24 h por pedaço do mapa (~55 m)** no
  servidor e por meia hora na aba — o mesmo quarteirão não gasta de novo.
  Leitura testada em `parseNearbyPlaces` (`lib/geo/parse.ts`).
- **O cartão do lugar**: o que é, o endereço, a distância, o horário (do
  OpenStreetMap: "Aberto agora · fecha às 22:00") e **"No Vitrine"** — a nota
  média, quantas avaliações e o **@ e a nota** de cada pessoa, só das
  avaliações que **você** pode ver (públicas; de Amigos, se for amigo; as
  suas). Sem texto livre. Vem de `place_ratings` (migração 28), que acha o
  lugar no catálogo comum (migração 18) pelo id da Geoapify ou do
  OpenStreetMap. Se o lugar já está no seu acervo, o cartão diz onde.
- **Adicionar**: a nota é opcional, e **tocar na categoria já salva** —
  primeiro as categorias com campo Localização, depois a "A organizar", depois
  as outras (só com o nome). O item nasce com o **Nome** e a **Localização**
  já prontos, com as coordenadas e ligado ao catálogo — **sem gastar busca de
  endereço**. O lugar é lido de novo no servidor (do cache da busca), nunca do
  que o navegador mandou: nome e coordenadas não dá para inventar.

### Sugestões de campos (ao criar uma categoria)

- No editor de **categoria nova**, embaixo da lista de
  campos: **"Campos usados em categorias como essa"**. Enquanto você digita o
  nome, o banco (`field_suggestions`, migração 27) procura categorias
  **públicas** de outras pessoas com nome parecido — o mesmo nome normalizado,
  ou ele no começo ou no fim ("Filmes" acha "Filmes de terror") — e conta
  **pessoas distintas** por campo (nome normalizado + tipo). Basta **uma
  pessoa** (migração 32; antes eram 3): a categoria é pública e já aparece no
  Explorar com os campos, então não se expõe nada novo. Vêm as opções mais
  comuns (listas) e a moeda mais usada. Sem nada parecido e sem a IA ligada
  no servidor, o painel diz isso (em vez de sumir); erro do banco aparece ali
  também.
- **Trazer** põe o campo na lista com as opções e a moeda (e um id novo, como
  todo campo novo); **Trazer todos** traz o que sobrou. O que já está na
  categoria (mesmo nome) some da lista.
- **Sem nada parecido**: o botão **"Sugerir campos com IA"** pede ao **Google
  Gemini** (plano gratuito, `GEMINI_API_KEY` só no servidor) mandando **só o
  nome da categoria**; a resposta vem em JSON num formato fixo e passa pela
  mesma conferência das sugestões da comunidade (`parseFieldSuggestions`, em
  `lib/domain/field-suggestions.ts`). É um toque, e não automático, para não
  gastar o limite enquanto você digita.
- **Limites**: até **10 pedidos à IA por pessoa por dia** (fuso de Brasília,
  conferido no banco por `take_ai_suggestion_quota`). A resposta fica no
  **cache** por nome normalizado (`field_suggestion_cache`): o próximo que
  pedir o mesmo nome não gasta nada. Só o servidor grava no cache, com o
  segredo do servidor (`CRON_SECRET`, migração 24) — sem ele, a resposta vale
  só para aquela vez.
- **Privacidade**: no plano gratuito, o Google **pode usar o que recebe para
  treinar** os modelos dele. A Política de privacidade diz isso; por isso só
  o nome da categoria vai.

#### Chave do Gemini

1. Entre em <https://aistudio.google.com/apikey> com uma conta Google e crie
   uma chave (plano gratuito, sem cartão).
2. Ponha em `GEMINI_API_KEY` no `.env.local` e na Vercel.
3. O modelo padrão é o apelido `gemini-flash-lite-latest` (o de limite diário
   mais folgado no plano gratuito); `GEMINI_MODEL` troca, se um dia precisar.

### Trocar um item de categoria

- No **formulário de edição** do item há o seletor **Categoria** (na tela da
  categoria e na página do item). Trocar abre um diálogo dizendo o que **fica
  para trás** (os campos preenchidos que o destino não tem), o que **vai
  junto** e se **a nota some** (destino sem estrelas). Confirmando, o que foi
  mexido no formulário é salvo, o item é movido e **reabre em edição na
  categoria nova** (`/categoria/<destino>?editar=<item>` — o parâmetro sai da
  URL na chegada), na raiz dela.
- Um valor vai junto quando o destino tem **o mesmo campo** (mesmo id e mesmo
  tipo — duas categorias vindas do mesmo modelo) ou um campo de **mesmo nome
  e mesmo tipo**; nome igual com tipo diferente fica em branco. Tags, imagem e
  a localização (que segue o campo) vão junto. Regra em
  `lib/domain/migrate.ts`, a mesma do "Mover" da seleção em massa.

### Campo principal (acesso rápido)

- Toda categoria tem **exatamente um** campo principal: **Nome** (o padrão de
  toda categoria), **Estrelas** (com as estrelas ligadas) ou **um campo da
  estrutura** (`categories.quick_field`, migração 19).
- Escolhido **só no editor de estrutura** ("Campo do acesso rápido"). Não
  precisa estar preenchido nos itens e **não aparece em destaque nos cards**:
  serve para o acesso rápido (compartilhar do celular, "você está em X?") —
  o texto que chega vira o Nome, e o app pede só este campo.
- Campo removido ou estrelas desligadas: **volta para o Nome** — o seletor
  já mostra, o servidor grava assim (`normalizeQuickField`) e, na leitura,
  um valor que não vale mais conta como Nome (`quickFieldOf`, em
  `lib/domain/quick-field.ts`). O backup leva o campo principal junto.

### Catálogo comum (`catalog_items`)

- Uma linha por **coisa** — por enquanto, **lugares** — para saber que dois
  itens (de pessoas diferentes) são a mesma coisa: a base do "Em comum" do
  Match, do "quem avaliou" e dos insights agregados.
- Quando a Geoapify localiza um campo de Localização num lugar **preciso** (um
  estabelecimento — `amenity` — ou um prédio — `building`), um gatilho em
  `entry_places` acha (ou cria) o lugar no catálogo pelo id da Geoapify (ou do
  OSM) e grava o `catalog_item_id`. Bairro, rua e cidade não entram: dois
  restaurantes do mesmo bairro não são a mesma coisa. Os lugares localizados
  antes da migração entram marcados `source: backfill` (precisão
  desconhecida).
- **Ninguém lê o catálogo direto** (RLS sem política): ele guarda endereços
  de itens de todo mundo, inclusive privados. As próximas fases criam funções
  que devolvem só o que quem pergunta pode ver. Escrita só pela função
  `upsert_catalog_place`, chamada pelo gatilho; o primeiro a gravar um lugar
  define o título e as coordenadas.
- Sem id externo (filmes, livros, jogos, por enquanto), a base é o título
  normalizado: `normalizeTitle` em `lib/domain/catalog.ts` (minúsculas, sem
  acento, sem pontuação, sem o artigo do começo — "O Poderoso Chefão" =
  "poderoso chefao").

### "A organizar" (caixa de entrada)

- Toda conta tem **exatamente uma** categoria **"A organizar"** (📥), criada
  pelo banco (migração 17): é onde caem os itens salvos às pressas — o
  compartilhar, o "você está em X?" e o "Trazer" do Match, nas próximas
  fases (`getMyInboxId` em `lib/queries/inbox.ts` acha o id, e cria se
  faltar).
- Estrutura fixa: Nome, Estrelas e **um campo Localização de id fixo**
  (`f_inbox_loc`, em `lib/domain/inbox.ts` e no SQL); abre por "Adicionados
  recentemente" e nasce **privada** (é rascunho — dá para abrir no seletor do
  topo, se quiser).
- Fica **fixa no topo das Coleções**, com cara de caixa de entrada, fora da
  grade arrastável — **só quando tem item**: vazia, ela some das Coleções (e
  continua aparecendo como destino no "Salvar em…" e no "Mover"). **Não pode ser apagada, renomeada, ter a estrutura ou as
  estrelas trocadas, nem ir para dentro de uma pasta** — a tela não oferece,
  e o banco recusa (`inbox_locked`). Os itens dela, sim: marque e use
  **Mover** para levá-los à categoria certa.
- **Backup:** a "A organizar" sai marcada (`"inbox": true`) e, na importação,
  os itens dela entram na "A organizar" de quem importa.

### Termos, privacidade e excluir a conta

- **`/termos`** e **`/privacidade`** abrem sem login, em linguagem simples,
  com a versão e a data no topo. Controladora dos dados: Layla Sabatini
  Tambellini (pessoa física), contato laylatambellini@gmail.com. **Antes de
  lançar, vale a revisão de um advogado.**
- **Idade mínima: 18 anos.** O cadastro tem uma caixa obrigatória ("Tenho 18
  anos ou mais e aceito os Termos e a Política de privacidade"), conferida
  também no servidor. O aceite vai no `user_metadata` da conta e o banco o
  copia para o perfil (migração 16).
- **Contas que já existiam** (e todo mundo, quando a versão muda) passam uma
  vez pela tela **`/aceitar-termos`**: o middleware compara o
  `user_metadata` que o `getUser` já traz com `TERMS_VERSION`
  (`lib/domain/terms.ts`) — nenhuma consulta a mais. **Mudou o texto?**
  Troque `TERMS_VERSION` e `TERMS_EFFECTIVE_DATE`.
- **Excluir minha conta** (Configurações, no fim): digita o próprio @ para
  confirmar; a função `delete_my_account` apaga a conta em `auth.users` e as
  cascatas levam perfil, acervo e relações. A sessão é encerrada e o login
  mostra o aviso. As tags (vocabulário compartilhado, sem dono) ficam.
- Links para os dois textos no rodapé das telas de conta e nas Configurações.

---

## Fora de escopo

- Console SQL / aba "Cmd" (a v1 tinha uma função `SECURITY DEFINER` que dava
  acesso irrestrito ao banco a qualquer autenticado — removida de propósito);
- upload de imagem (só links externos);
- login social (Google etc.) e verificação em duas etapas;
- modo claro, paleta de comandos, comentários;
- no Mapa, por enquanto: descobrir lugares **novos** por perto ("Descobrir",
  com "Salvar no Vitrine") e resumo escrito por IA — próxima fase; mapa na
  página de outras pessoas;
- na privacidade: compartilhar com uma lista escolhida de pessoas (os níveis
  são só Pública, Amigos e Privada), e levar a privacidade no backup — o
  arquivo não guarda o nível, e a importação segue o padrão do perfil;
- no tier list: arrastar entre fileiras (mudaria a nota) e exportar como
  imagem.
