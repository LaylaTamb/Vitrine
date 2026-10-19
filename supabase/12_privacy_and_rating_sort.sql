-- =====================================================================
-- Vitrine v2 — privacidade das coleções e ordem padrão por nota
-- Rode no SQL Editor do Supabase, depois de 01 a 11.
--
-- Aditivo e seguro: nada some, e tudo que já existe continua PÚBLICO — o
-- comportamento de hoje. Pode rodar mais de uma vez.
--
--   categories.is_public  — `false` = só o dono vê a categoria e os itens.
--   folders.is_public     — `false` = só o dono vê a pasta e TUDO o que está
--                           dentro dela, em qualquer profundidade (mesmo
--                           uma categoria marcada como pública).
--   profiles.default_public — o padrão de quem cria: novas pastas e
--                           categorias nascem públicas (`true`, o inicial)
--                           ou privadas. Não mexe nas que já existem.
--
-- A privacidade vale NO BANCO, não só na tela: as políticas de leitura (RLS)
-- de pastas, categorias, itens, subpastas, tags dos itens e localizações
-- passam a esconder de terceiros o que é privado. Trocar para privada vale
-- na hora, na próxima consulta de quem quer que seja. O dono continua lendo
-- tudo o que é dele. As views de contagem já são `security_invoker` (01),
-- então também só contam o que quem pergunta pode ver.
--
-- Ordem padrão: categorias novas passam a abrir por "Nota (maior primeiro)",
-- e as que tinham estrelas e abriam em "Adicionados recentemente" (o padrão
-- antigo) mudam junto. Quem escolheu Nome ou Ordem manual fica como está.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Colunas
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists default_public boolean not null default true;

-- Quem já existe fica público (o `default true` preenche as linhas atuais).
alter table public.categories
  add column if not exists is_public boolean not null default true;
alter table public.folders
  add column if not exists is_public boolean not null default true;

-- Daqui para frente, linha nova SEM `is_public` pega o padrão do dono (o
-- gatilho abaixo). Sem o default da coluna, o valor chega nulo ao gatilho —
-- e o NOT NULL só é conferido depois dele.
alter table public.categories alter column is_public drop default;
alter table public.folders alter column is_public drop default;

create or replace function public.fill_is_public_from_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_public is null then
    new.is_public := coalesce(
      (select p.default_public from public.profiles p where p.id = new.owner_id),
      true
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.fill_is_public_from_owner() from public, anon;

drop trigger if exists categories_fill_is_public on public.categories;
create trigger categories_fill_is_public
  before insert on public.categories
  for each row execute function public.fill_is_public_from_owner();

drop trigger if exists folders_fill_is_public on public.folders;
create trigger folders_fill_is_public
  before insert on public.folders
  for each row execute function public.fill_is_public_from_owner();

-- ---------------------------------------------------------------------
-- 2) Quem pode ver o quê
--
-- SECURITY DEFINER: as funções olham pastas e categorias sem passar pela
-- RLS — senão a política de `folders` chamaria a si mesma. Elas só devolvem
-- verdadeiro/falso, nunca dado.
-- ---------------------------------------------------------------------

-- A pasta e todas as ancestrais são públicas? (Pasta que não existe: não.)
create or replace function public.folder_chain_is_public(p_folder_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with recursive chain as (
    select f.id, f.parent_folder_id, f.is_public, 1 as depth
      from public.folders f
     where f.id = p_folder_id
    union all
    select f.id, f.parent_folder_id, f.is_public, c.depth + 1
      from public.folders f
      join chain c on f.id = c.parent_folder_id
     where c.depth < 64
  )
  select exists (select 1 from chain)
     and not exists (select 1 from chain where not is_public);
$$;

-- A categoria aparece para quem está logado agora?
create or replace function public.category_is_visible(p_category_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select c.owner_id = (select auth.uid())
        or (c.is_public
            and (c.folder_id is null or public.folder_chain_is_public(c.folder_id)))
      from public.categories c
     where c.id = p_category_id
  ), false);
$$;

-- O item aparece? (É o da categoria dele.)
create or replace function public.entry_is_visible(p_entry_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select e.owner_id = (select auth.uid()) or public.category_is_visible(e.category_id)
      from public.entries e
     where e.id = p_entry_id
  ), false);
$$;

-- `authenticated` avalia estas funções em toda leitura: precisa do EXECUTE.
revoke execute on function public.folder_chain_is_public(uuid) from public, anon;
revoke execute on function public.category_is_visible(uuid) from public, anon;
revoke execute on function public.entry_is_visible(uuid) from public, anon;
grant execute on function public.folder_chain_is_public(uuid) to authenticated;
grant execute on function public.category_is_visible(uuid) to authenticated;
grant execute on function public.entry_is_visible(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Políticas de leitura — substituem as "leitura autenticada" de antes
--    (02, 07, 09 e 11). Escrever continua igual: só o dono.
-- ---------------------------------------------------------------------
drop policy if exists "folders: leitura autenticada" on public.folders;
create policy "folders: leitura autenticada"
  on public.folders for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (is_public
        and (parent_folder_id is null or public.folder_chain_is_public(parent_folder_id)))
  );

drop policy if exists "categories: leitura autenticada" on public.categories;
create policy "categories: leitura autenticada"
  on public.categories for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (is_public
        and (folder_id is null or public.folder_chain_is_public(folder_id)))
  );

drop policy if exists "entries: leitura autenticada" on public.entries;
create policy "entries: leitura autenticada"
  on public.entries for select to authenticated
  using (owner_id = (select auth.uid()) or public.category_is_visible(category_id));

drop policy if exists "entry_folders: leitura autenticada" on public.entry_folders;
create policy "entry_folders: leitura autenticada"
  on public.entry_folders for select to authenticated
  using (owner_id = (select auth.uid()) or public.category_is_visible(category_id));

drop policy if exists "entry_tags: leitura autenticada" on public.entry_tags;
create policy "entry_tags: leitura autenticada"
  on public.entry_tags for select to authenticated
  using (public.entry_is_visible(entry_id));

drop policy if exists "entry_places: leitura autenticada" on public.entry_places;
create policy "entry_places: leitura autenticada"
  on public.entry_places for select to authenticated
  using (owner_id = (select auth.uid()) or public.entry_is_visible(entry_id));

-- ---------------------------------------------------------------------
-- 4) Ordem padrão: Nota (maior primeiro)
-- ---------------------------------------------------------------------
alter table public.categories alter column default_sort set default 'rating_desc';

update public.categories
   set default_sort = 'rating_desc'
 where default_sort = 'recent'
   and rating_enabled;
