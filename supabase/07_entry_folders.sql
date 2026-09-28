-- =====================================================================
-- Vitrine v2 — subpastas dentro das categorias
-- Rode no SQL Editor do Supabase, depois de 01 a 06.
--
-- Aditivo e seguro: uma tabela nova e uma coluna nova, nula por padrão.
-- Item com `folder_id` nulo fica na raiz da categoria — que é onde todos os
-- itens que já existem continuam.
--
-- As pastas das Coleções (`folders`) organizam CATEGORIAS; estas aqui
-- organizam os ITENS de uma categoria (ex.: Suco › Feitos em casa | Marca 1).
-- São tabelas separadas de propósito: a tela de Coleções nunca precisa
-- filtrar "só as pastas de coleção", e apagar uma categoria leva as
-- subpastas dela junto pelo `on delete cascade`.
--
-- Integridade: as duas FKs compostas `(…, category_id)` garantem no próprio
-- banco que a pasta-mãe e os itens de uma subpasta são da MESMA categoria.
-- Mover um item para outra categoria exige zerar o `folder_id` no mesmo
-- UPDATE — senão a FK recusa.
-- =====================================================================

create table if not exists public.entry_folders (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id)   on delete cascade,
  category_id      uuid not null references public.categories(id) on delete cascade,
  name             text not null,
  parent_folder_id uuid,
  display_order    int  not null default 0,
  created_at       timestamptz not null default now(),
  constraint entry_folders_id_category_key unique (id, category_id)
);

alter table public.entry_folders
  drop constraint if exists entry_folders_parent_fkey;
alter table public.entry_folders
  add constraint entry_folders_parent_fkey
  foreign key (parent_folder_id, category_id)
  references public.entry_folders (id, category_id)
  on delete cascade;

create index if not exists entry_folders_category_idx on public.entry_folders (category_id);
create index if not exists entry_folders_parent_idx   on public.entry_folders (parent_folder_id);
create index if not exists entry_folders_owner_idx    on public.entry_folders (owner_id);

-- ---------------------------------------------------------------------
-- entries.folder_id — nulo = raiz da categoria
-- ---------------------------------------------------------------------
alter table public.entries
  add column if not exists folder_id uuid;

alter table public.entries
  drop constraint if exists entries_folder_fkey;
alter table public.entries
  add constraint entries_folder_fkey
  foreign key (folder_id, category_id)
  references public.entry_folders (id, category_id)
  on delete cascade;

create index if not exists entries_folder_idx on public.entries (folder_id);

-- ---------------------------------------------------------------------
-- RLS — mesmo modelo das outras tabelas: o grupo lê, o dono escreve.
-- A escrita também confere que a CATEGORIA é de quem está criando a pasta
-- (não basta o owner_id da própria linha).
-- ---------------------------------------------------------------------
alter table public.entry_folders enable row level security;

drop policy if exists "entry_folders: leitura autenticada" on public.entry_folders;
create policy "entry_folders: leitura autenticada"
  on public.entry_folders for select to authenticated
  using (
    not public.is_demo_reader()
    or owner_id = (select auth.uid())
  );

drop policy if exists "entry_folders: dono insere" on public.entry_folders;
create policy "entry_folders: dono insere"
  on public.entry_folders for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.owner_id = (select auth.uid())
    )
  );

drop policy if exists "entry_folders: dono edita" on public.entry_folders;
create policy "entry_folders: dono edita"
  on public.entry_folders for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.owner_id = (select auth.uid())
    )
  );

drop policy if exists "entry_folders: dono apaga" on public.entry_folders;
create policy "entry_folders: dono apaga"
  on public.entry_folders for delete to authenticated
  using (owner_id = (select auth.uid()));
