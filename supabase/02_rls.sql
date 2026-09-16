-- =====================================================================
-- Vitrine v2 — Row Level Security
-- Modelo: todo usuário AUTENTICADO lê tudo; só o dono escreve o que é seu.
-- Exceção: `tags` é um vocabulário compartilhado (a tabela não tem dono),
-- então qualquer autenticado cria, edita e apaga tags.
-- Rode DEPOIS de 01_schema.sql.
-- =====================================================================

alter table public.profiles   enable row level security;
alter table public.folders    enable row level security;
alter table public.categories enable row level security;
alter table public.entries    enable row level security;
alter table public.tags       enable row level security;
alter table public.entry_tags enable row level security;

-- ---------------------------------------------------------------------
-- PROFILES — o profile nasce pelo trigger; o dono só edita o que é dele.
-- ---------------------------------------------------------------------
drop policy if exists "profiles: leitura autenticada" on public.profiles;
create policy "profiles: leitura autenticada"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles: dono insere" on public.profiles;
create policy "profiles: dono insere"
  on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles: dono edita" on public.profiles;
create policy "profiles: dono edita"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- FOLDERS / CATEGORIES / ENTRIES — mesmo padrão: lê todo mundo, escreve o dono
-- ---------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['folders', 'categories', 'entries'] loop
    execute format(
      'drop policy if exists "%1$s: leitura autenticada" on public.%1$I;
       create policy "%1$s: leitura autenticada"
         on public.%1$I for select to authenticated using (true);

       drop policy if exists "%1$s: dono insere" on public.%1$I;
       create policy "%1$s: dono insere"
         on public.%1$I for insert to authenticated
         with check (owner_id = auth.uid());

       drop policy if exists "%1$s: dono edita" on public.%1$I;
       create policy "%1$s: dono edita"
         on public.%1$I for update to authenticated
         using (owner_id = auth.uid()) with check (owner_id = auth.uid());

       drop policy if exists "%1$s: dono apaga" on public.%1$I;
       create policy "%1$s: dono apaga"
         on public.%1$I for delete to authenticated
         using (owner_id = auth.uid());',
      tbl);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- TAGS — vocabulário compartilhado do grupo inteiro
-- ---------------------------------------------------------------------
drop policy if exists "tags: autenticado lê" on public.tags;
create policy "tags: autenticado lê"
  on public.tags for select to authenticated using (true);

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
-- ENTRY_TAGS — a associação segue o dono do item
-- ---------------------------------------------------------------------
drop policy if exists "entry_tags: leitura autenticada" on public.entry_tags;
create policy "entry_tags: leitura autenticada"
  on public.entry_tags for select to authenticated using (true);

drop policy if exists "entry_tags: dono do item insere" on public.entry_tags;
create policy "entry_tags: dono do item insere"
  on public.entry_tags for insert to authenticated
  with check (
    exists (select 1 from public.entries e
            where e.id = entry_id and e.owner_id = auth.uid())
  );

drop policy if exists "entry_tags: dono do item apaga" on public.entry_tags;
create policy "entry_tags: dono do item apaga"
  on public.entry_tags for delete to authenticated
  using (
    exists (select 1 from public.entries e
            where e.id = entry_id and e.owner_id = auth.uid())
  );
