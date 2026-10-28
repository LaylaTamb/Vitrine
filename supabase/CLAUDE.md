# CLAUDE.md — migrações SQL (`supabase/`)

Este arquivo complementa o `CLAUDE.md` da raiz e vale para quem mexe nos `.sql` daqui.

## Como as migrações funcionam aqui

- Não há Supabase CLI nem pasta `migrations/`. São arquivos numerados (`01_schema.sql` …
  `37_trash.sql`) que **a dona roda à mão no SQL Editor, em ordem**. A ordem e as dependências de
  cada um estão no `GUIA-LOCAL.md`, em "Configuração do Supabase → 1. Banco".
- **Claude nunca roda SQL**: nem `execute_sql` / `apply_migration` por MCP, nem script, nem
  `psql`. Também não altera um arquivo que já foi rodado. Conserto vira um arquivo novo (exemplo: o
  `33_fix_explore.sql` refaz duas funções do 25).
- Não dá para saber pelo repositório quais arquivos já rodaram em produção. O código do app tolera
  o que falta (veja abaixo).

## Arquivo novo

- Use o próximo número livre e um nome curto em inglês (`38_<assunto>.sql`).
- Abra com um cabeçalho em comentário, em pt-BR, no mesmo formato dos outros:
  - o título `Vitrine v2 — …`;
  - "Rode no SQL Editor do Supabase, depois de 01 a N" (e quais são obrigatórios);
  - se é aditivo e se pode rodar mais de uma vez;
  - o que cada tabela e cada função faz.
- Logo depois, uma trava que para cedo se faltar uma migração anterior:

  ```sql
  do $$
  begin
    if to_regclass('public.<tabela>') is null
       or to_regprocedure('public.<funcao>(<tipos>)') is null then
      raise exception 'Rode antes os arquivos de 01 a N, depois este.';
    end if;
  end $$;
  ```
- **Aditivo e idempotente:**
  - `create table if not exists`, `add column if not exists` e `create or replace function`;
  - `drop policy if exists` antes do `create policy`, e o mesmo com os gatilhos.
- **Segurança, em toda tabela nova:**
  - `enable row level security`;
  - `revoke all … from anon, authenticated` e depois só os `grant`s necessários;
  - políticas com `(select auth.uid())`.
- **Segurança, em toda função:**
  - função `security definer` leva `set search_path = public`;
  - helper interno leva `revoke execute … from public, anon, authenticated`;
  - função pública leva `grant execute … to authenticated`;
  - funções chamadas pelo servidor sem sessão (Cron, Steam) recebem `p_secret`, conferem com
    `public.server_secret_ok(p_secret)` e são liberadas para `anon`.
- O `anon` não lê tabela nenhuma desde a migração 14. A leitura sem login passa só pelas funções
  `public_profile` / `public_category`.
- **Nunca ponha um segredo de verdade num arquivo.** O `app_secrets` guarda só o hash sha256. O
  `insert` que a dona roda com o valor dela está no topo do `24_connected_accounts.sql`, como
  exemplo.

## Do lado do app

- **O app tem de funcionar antes de o arquivo rodar.** Leitura e escrita que dependem do SQL novo
  tratam `isMissingSchema` / `isMissingColumn` (`lib/domain/errors.ts`) e mostram um aviso de que
  falta rodar, em vez de quebrar. A Lixeira, por exemplo, apaga direto se o 37 não rodou.
- **Documente o arquivo novo** no `GUIA-LOCAL.md` (a lista numerada em "1. Banco", com o que ele
  faz e do que precisa). No `README.md`, só se mudar algo visível.

## Arquivos com efeito destrutivo (não reaplicar à toa)

- `01_schema.sql` começa **apagando as tabelas do app** (proposital: é a recriação da v2).
  Nunca rode num projeto com dados.
- `08_remove_demo_account.sql` apaga a conta demo antiga. O `09_drop_demo_policies.sql` só deve
  rodar uma hora depois dele.
- Não rode o `12` de novo depois do `14`.
- `34_match_common.sql` apaga as cópias de Match montadas com a regra antiga
  (`match_rule is null`) e monta de novo.
- `46_remove_match_copies.sql` apaga de vez todas as cópias de Match (`kind` 'match') e a
  pasta "Matches" vazia. Só depois de a versão com a lista nova (45) estar no ar.

## Armadilhas de PL/pgSQL já vistas aqui

- **Nunca dê o apelido `found` a uma subconsulta.** Ele colide com a variável `FOUND` do PL/pgSQL
  (`variable_conflict = error`), e a função falha sempre com "referência ambígua". Foi o bug do
  Explorar, consertado no 33 com o apelido `hit`.
- `(minha_funcao()).*` chama a função **uma vez por coluna**. Use
  `cross join lateral minha_funcao() f` (como em `31_match_build.sql` e `32_refinements.sql`).
- Gatilho que só deve barrar a pessoa (e não as funções internas) confere o `current_user`. Veja
  `keep_match_category_private` / `keep_match_entries_inside` no 31, que valem só para
  `authenticated`.
