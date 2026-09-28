-- =====================================================================
-- Vitrine v2 — tira as regras da conta demo antiga (passo 2 de 2)
-- Rode no SQL Editor do Supabase pelo menos 1 HORA depois do
-- 08_remove_demo_account.sql (o tempo de o último access token da conta
-- demo expirar — ver o comentário do 08).
--
-- Volta as políticas ao modelo do app — todo autenticado lê tudo; tags são
-- do grupo inteiro — e apaga `is_demo_reader()`, que não tem mais quem
-- identificar. É o inverso de 05_demo_scoped_reads.sql e
-- 06_demo_write_restrictions.sql, incluindo a tabela `entry_folders` (07).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Leitura: "todo autenticado lê tudo"
-- ---------------------------------------------------------------------
drop policy if exists "profiles: leitura autenticada" on public.profiles;
create policy "profiles: leitura autenticada"
  on public.profiles for select to authenticated using (true);

do $$
declare
  tbl text;
begin
  foreach tbl in array array['folders', 'categories', 'entries', 'entry_folders'] loop
    execute format(
      'drop policy if exists "%1$s: leitura autenticada" on public.%1$I;
       create policy "%1$s: leitura autenticada"
         on public.%1$I for select to authenticated using (true);',
      tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Tags: vocabulário do grupo — qualquer autenticado cria, edita, apaga
-- ---------------------------------------------------------------------
drop policy if exists "tags: autenticado cria" on public.tags;
create policy "tags: autenticado cria"
  on public.tags for insert to authenticated with check (true);

drop policy if exists "tags: autenticado edita" on public.tags;
create policy "tags: autenticado edita"
  on public.tags for update to authenticated using (true) with check (true);

drop policy if exists "tags: autenticado apaga" on public.tags;
create policy "tags: autenticado apaga"
  on public.tags for delete to authenticated using (true);

-- ---------------------------------------------------------------------
-- 3) Ninguém mais usa a função
-- ---------------------------------------------------------------------
drop function if exists public.is_demo_reader();
