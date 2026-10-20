-- =====================================================================
-- Vitrine v2 — Favoritos: o favorito de cada categoria e a aba Favoritos
-- Rode no SQL Editor do Supabase, depois de 01 a 19.
--
-- Aditivo e seguro: uma tabela nova, vazia. Pode rodar mais de uma vez.
--
--   category_favorites — uma linha por categoria que tem favorito OU está na
--     aba Favoritos (as duas coisas são independentes: marcar a estrela não
--     põe a categoria na aba, e uma categoria pode estar na aba sem favorito).
--       entry_id     — o favorito da categoria (no máximo um; nulo = nenhum);
--       tab_position — a posição na aba Favoritos (nulo = fora da aba).
--
-- Por que uma tabela à parte (e não uma coluna em `categories`/`profiles`,
-- como o plano previa): o favorito é "só você vê". `categories` e `profiles`
-- são lidas por outras pessoas (categoria pública, perfil), e a coluna iria
-- junto. Aqui a RLS é só do dono: ninguém mais lê, nem logado.
--
-- Integridade: o favorito é sempre um item DA categoria (gatilho); item
-- apagado solta o favorito; item que muda de categoria deixa de ser o
-- favorito da antiga; categoria apagada leva a linha junto.
-- =====================================================================

create table if not exists public.category_favorites (
  category_id  uuid primary key references public.categories(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  entry_id     uuid references public.entries(id) on delete set null,
  tab_position int,
  updated_at   timestamptz not null default now(),
  constraint category_favorites_tab_position_check check (tab_position is null or tab_position >= 0)
);

create index if not exists category_favorites_owner_idx
  on public.category_favorites (owner_id, tab_position);
create index if not exists category_favorites_entry_idx
  on public.category_favorites (entry_id);

drop trigger if exists category_favorites_touch_updated_at on public.category_favorites;
create trigger category_favorites_touch_updated_at
  before update on public.category_favorites
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- O favorito tem de ser um item da própria categoria.
-- ---------------------------------------------------------------------
create or replace function public.check_category_favorite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.entry_id is not null and not exists (
    select 1 from public.entries e
     where e.id = new.entry_id and e.category_id = new.category_id
  ) then
    raise exception 'favorite_entry_mismatch';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_category_favorite() from public, anon, authenticated;

drop trigger if exists category_favorites_check on public.category_favorites;
create trigger category_favorites_check
  before insert or update on public.category_favorites
  for each row execute function public.check_category_favorite();

-- Item que muda de categoria deixa de ser o favorito da antiga.
create or replace function public.drop_favorite_on_entry_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.category_favorites
     set entry_id = null
   where entry_id = new.id
     and category_id <> new.category_id;
  return null;
end;
$$;

revoke execute on function public.drop_favorite_on_entry_move() from public, anon, authenticated;

drop trigger if exists entries_drop_favorite_on_move on public.entries;
create trigger entries_drop_favorite_on_move
  after update of category_id on public.entries
  for each row
  when (old.category_id is distinct from new.category_id)
  execute function public.drop_favorite_on_entry_move();

-- ---------------------------------------------------------------------
-- RLS: só o dono, para tudo. A categoria também tem de ser dele.
-- ---------------------------------------------------------------------
alter table public.category_favorites enable row level security;

drop policy if exists "category_favorites: dono lê" on public.category_favorites;
create policy "category_favorites: dono lê"
  on public.category_favorites for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "category_favorites: dono grava" on public.category_favorites;
create policy "category_favorites: dono grava"
  on public.category_favorites for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.categories c
       where c.id = category_id and c.owner_id = (select auth.uid())
    )
  );

drop policy if exists "category_favorites: dono edita" on public.category_favorites;
create policy "category_favorites: dono edita"
  on public.category_favorites for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.categories c
       where c.id = category_id and c.owner_id = (select auth.uid())
    )
  );

drop policy if exists "category_favorites: dono apaga" on public.category_favorites;
create policy "category_favorites: dono apaga"
  on public.category_favorites for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke all on table public.category_favorites from anon;
