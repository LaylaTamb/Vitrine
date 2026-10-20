-- =====================================================================
-- Vitrine v2 — visibilidade em 3 níveis, seguidores e bloqueios
-- Rode no SQL Editor do Supabase, depois de 01 a 13 (o 12 é obrigatório: este
-- arquivo para logo no começo, com aviso, se ele ainda não rodou).
--
-- Aditivo e seguro: nada some e ninguém perde acesso. Pode rodar mais de uma
-- vez. NÃO rode o 12 de novo depois deste — ele voltaria as regras de leitura
-- para o modelo de 2 níveis.
--
--   folders.visibility / categories.visibility
--       'public'  — qualquer pessoa vê, inclusive sem conta (pelas funções
--                   `public_profile` e `public_category`, abaixo);
--       'friends' — só quem se segue mutuamente com o dono;
--       'private' — só o dono.
--     Preenchida a partir de `is_public` (true → public, false → private).
--     Vale o nível MAIS RESTRITO no caminho de pastas: uma categoria pública
--     dentro de uma pasta de amigos só aparece para os amigos.
--   profiles.default_visibility — o padrão de quem cria (a partir de
--     `default_public`).
--   profiles.public_notice_seen_at — quando a pessoa viu o aviso de que
--     "Pública" agora quer dizer "visível na internet". Contas que já existem
--     começam sem (e veem o aviso, se tiverem algo público); contas novas
--     nascem com a data de criação (nunca viveram a regra antiga).
--
--   follows (seguir, sem aceite) — amigos = os dois se seguem.
--   blocks — bloquear desfaz os follows nos dois sentidos, impede novos e
--     esconde tudo de um para o outro (o perfil de quem bloqueou some para
--     quem foi bloqueado; quem bloqueou continua achando o bloqueado, para
--     poder desbloquear).
--
-- Convivência: `is_public` e `default_public` continuam existindo (o código
-- antigo ainda as usa entre o deploy e esta migração) e ficam SEMPRE
-- coerentes por gatilho: is_public = (visibility = 'public'). Uma migração
-- futura as remove.
--
-- Leitura sem login: as tabelas NÃO são abertas para o papel `anon` (isso
-- facilitaria copiar a base inteira). Quem não tem conta lê por duas funções
-- que entregam UM perfil ou UMA categoria por vez, e só o que é público:
--   public_profile('usuario')   — perfil, pastas e categorias públicas, contagens
--   public_category(<uuid>)     — uma categoria pública, subpastas, itens e tags
--
-- Como conferir no SQL Editor (tudo dentro de begin … rollback, não grava):
--
--   -- 1) Sem login: nenhuma tabela responde; só as duas funções.
--   begin;
--   set local role anon;
--   select * from public.categories limit 1;      -- erro: permission denied
--   select public.public_profile('seu_usuario');  -- só o que é público
--   rollback;
--
--   -- 2) Logado como outra pessoa (troque o uuid pelo `id` de um perfil):
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--     '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
--   select name, visibility from public.categories;  -- só o que ela pode ver
--   rollback;
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) O 12 precisa ter rodado (este arquivo parte das colunas dele)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'categories' and column_name = 'is_public'
  ) then
    raise exception 'Rode antes o supabase/12_privacy_and_rating_sort.sql (e o 13), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) Colunas
--
-- Criadas nulas, preenchidas só onde ainda estão nulas e só então travadas:
-- rodar de novo não desfaz uma escolha "Amigos" feita depois.
-- ---------------------------------------------------------------------
alter table public.folders    add column if not exists visibility text;
alter table public.categories add column if not exists visibility text;

update public.folders
   set visibility = case when is_public then 'public' else 'private' end
 where visibility is null;
update public.categories
   set visibility = case when is_public then 'public' else 'private' end
 where visibility is null;

-- Sem default: linha nova sem `visibility` pega o padrão do dono no gatilho
-- abaixo (o NOT NULL só é conferido depois dele).
alter table public.folders    alter column visibility set not null;
alter table public.categories alter column visibility set not null;

alter table public.profiles add column if not exists default_visibility text;
update public.profiles
   set default_visibility = case when default_public then 'public' else 'private' end
 where default_visibility is null;
alter table public.profiles alter column default_visibility set default 'public';
alter table public.profiles alter column default_visibility set not null;

-- Adicionada SEM default (quem já existe fica nulo = ainda não viu); o
-- default entra depois e vale só para as contas novas.
alter table public.profiles add column if not exists public_notice_seen_at timestamptz;
alter table public.profiles alter column public_notice_seen_at set default now();

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'folders_visibility_check'
                    and conrelid = 'public.folders'::regclass) then
    alter table public.folders add constraint folders_visibility_check
      check (visibility in ('public', 'friends', 'private'));
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'categories_visibility_check'
                    and conrelid = 'public.categories'::regclass) then
    alter table public.categories add constraint categories_visibility_check
      check (visibility in ('public', 'friends', 'private'));
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'profiles_default_visibility_check'
                    and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_default_visibility_check
      check (default_visibility in ('public', 'friends', 'private'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Gatilhos: o padrão do dono e a coerência com as colunas antigas
--
-- Substituem o `fill_is_public_from_owner` do 12. Na criação, sem nenhuma das
-- duas colunas, vale o padrão do perfil; com só `is_public` (código antigo),
-- ela decide. Na edição, quem mudou manda: `visibility` primeiro.
-- ---------------------------------------------------------------------
create or replace function public.sync_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.visibility is null then
      if new.is_public is not null then
        new.visibility := case when new.is_public then 'public' else 'private' end;
      else
        new.visibility := coalesce(
          (select p.default_visibility from public.profiles p where p.id = new.owner_id),
          'public'
        );
      end if;
    end if;
  elsif new.visibility is not distinct from old.visibility
        and new.is_public is distinct from old.is_public then
    new.visibility := case when new.is_public then 'public' else 'private' end;
  end if;

  new.is_public := new.visibility = 'public';
  return new;
end;
$$;

revoke execute on function public.sync_visibility() from public, anon, authenticated;

drop trigger if exists categories_fill_is_public on public.categories;
drop trigger if exists folders_fill_is_public on public.folders;

drop trigger if exists categories_sync_visibility on public.categories;
create trigger categories_sync_visibility
  before insert or update on public.categories
  for each row execute function public.sync_visibility();

drop trigger if exists folders_sync_visibility on public.folders;
create trigger folders_sync_visibility
  before insert or update on public.folders
  for each row execute function public.sync_visibility();

drop function if exists public.fill_is_public_from_owner();

create or replace function public.sync_default_visibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.default_visibility is not distinct from old.default_visibility
     and new.default_public is distinct from old.default_public then
    new.default_visibility := case when new.default_public then 'public' else 'private' end;
  end if;

  new.default_public := new.default_visibility = 'public';
  return new;
end;
$$;

revoke execute on function public.sync_default_visibility() from public, anon, authenticated;

drop trigger if exists profiles_sync_default_visibility on public.profiles;
create trigger profiles_sync_default_visibility
  before insert or update of default_visibility, default_public on public.profiles
  for each row execute function public.sync_default_visibility();

-- ---------------------------------------------------------------------
-- 3) Seguir e bloquear
-- ---------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self_check check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id, follower_id);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self_check check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id, blocker_id);

-- Bloquear desfaz os follows nos dois sentidos (deixam de ser amigos na hora).
create or replace function public.drop_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and followee_id = new.blocked_id)
      or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return null;
end;
$$;

revoke execute on function public.drop_follows_on_block() from public, anon, authenticated;

drop trigger if exists blocks_drop_follows on public.blocks;
create trigger blocks_drop_follows
  after insert on public.blocks
  for each row execute function public.drop_follows_on_block();

-- ---------------------------------------------------------------------
-- 4) Quem pode ver o quê
--
-- Funções INTERNAS (sem EXECUTE para ninguém do app): recebem o "quem vê"
-- como parâmetro. Não ficam expostas em /rest/v1/rpc porque permitiriam
-- perguntar sobre terceiros ("fulano bloqueou ciclano?"). Só as funções
-- SECURITY DEFINER abaixo, que já rodam como dono do banco, as chamam.
-- ---------------------------------------------------------------------

-- Os dois se seguem?
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_a is not null and p_b is not null and p_a <> p_b
     and exists (select 1 from public.follows f where f.follower_id = p_a and f.followee_id = p_b)
     and exists (select 1 from public.follows f where f.follower_id = p_b and f.followee_id = p_a);
$$;

-- Há bloqueio entre os dois, em qualquer sentido?
create or replace function public.is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_a is not null and p_b is not null
     and exists (
       select 1 from public.blocks b
        where (b.blocker_id = p_a and b.blocked_id = p_b)
           or (b.blocker_id = p_b and b.blocked_id = p_a)
     );
$$;

-- Uma linha com este dono e este nível aparece para `p_viewer`?
-- `p_viewer` nulo = quem não tem conta: só o que é público.
create or replace function public.visibility_allows(
  p_owner uuid,
  p_visibility text,
  p_viewer uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when p_viewer is not null and p_viewer = p_owner then true
    when public.is_blocked(p_owner, p_viewer) then false
    when p_visibility = 'public' then true
    when p_visibility = 'friends' then public.are_friends(p_owner, p_viewer)
    else false
  end;
$$;

-- A pasta e todas as ancestrais aparecem para `p_viewer`? (= o nível mais
-- restrito do caminho permite.) Pasta que não existe: não.
create or replace function public.folder_chain_allows(p_folder_id uuid, p_viewer uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with recursive chain as (
    select f.id, f.parent_folder_id, f.owner_id, f.visibility, 1 as depth
      from public.folders f
     where f.id = p_folder_id
    union all
    select f.id, f.parent_folder_id, f.owner_id, f.visibility, c.depth + 1
      from public.folders f
      join chain c on f.id = c.parent_folder_id
     where c.depth < 64
  )
  select exists (select 1 from chain)
     and not exists (
       select 1 from chain
        where not public.visibility_allows(chain.owner_id, chain.visibility, p_viewer)
     );
$$;

-- A categoria aparece para `p_viewer`?
create or replace function public.category_visible_to(p_category_id uuid, p_viewer uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select public.visibility_allows(c.owner_id, c.visibility, p_viewer)
       and (c.folder_id is null or public.folder_chain_allows(c.folder_id, p_viewer))
      from public.categories c
     where c.id = p_category_id
  ), false);
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.visibility_allows(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.folder_chain_allows(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.category_visible_to(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Funções das POLÍTICAS: "quem vê" é sempre quem está logado agora
-- (`auth.uid()`), então só respondem perguntas sobre a própria pessoa.
-- `authenticated` precisa do EXECUTE: a RLS as avalia em toda leitura.
-- ---------------------------------------------------------------------
create or replace function public.visibility_allows_me(p_owner uuid, p_visibility text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.visibility_allows(p_owner, p_visibility, (select auth.uid()));
$$;

create or replace function public.folder_is_visible(p_folder_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.folder_chain_allows(p_folder_id, (select auth.uid()));
$$;

-- Mesmo nome e assinatura do 12: o `create or replace` só troca a regra.
create or replace function public.category_is_visible(p_category_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.category_visible_to(p_category_id, (select auth.uid()));
$$;

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

-- Há bloqueio entre mim e `p_other`?
create or replace function public.is_blocked_with_me(p_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_blocked((select auth.uid()), p_other);
$$;

-- `p_profile_id` me bloqueou? (A tabela `blocks` só mostra a quem bloqueou.)
create or replace function public.has_blocked_me(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.blocks b
     where b.blocker_id = p_profile_id
       and b.blocked_id = (select auth.uid())
  );
$$;

revoke execute on function public.visibility_allows_me(uuid, text) from public, anon;
revoke execute on function public.folder_is_visible(uuid) from public, anon;
revoke execute on function public.category_is_visible(uuid) from public, anon;
revoke execute on function public.entry_is_visible(uuid) from public, anon;
revoke execute on function public.is_blocked_with_me(uuid) from public, anon;
revoke execute on function public.has_blocked_me(uuid) from public, anon;
grant execute on function public.visibility_allows_me(uuid, text) to authenticated;
grant execute on function public.folder_is_visible(uuid) to authenticated;
grant execute on function public.category_is_visible(uuid) to authenticated;
grant execute on function public.entry_is_visible(uuid) to authenticated;
grant execute on function public.is_blocked_with_me(uuid) to authenticated;
grant execute on function public.has_blocked_me(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Políticas de leitura — substituem as do 12. Escrever continua igual:
--    só o dono.
-- ---------------------------------------------------------------------
drop policy if exists "profiles: leitura autenticada" on public.profiles;
create policy "profiles: leitura autenticada"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or not public.has_blocked_me(id));

drop policy if exists "folders: leitura autenticada" on public.folders;
create policy "folders: leitura autenticada"
  on public.folders for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (public.visibility_allows_me(owner_id, visibility)
        and (parent_folder_id is null or public.folder_is_visible(parent_folder_id)))
  );

drop policy if exists "categories: leitura autenticada" on public.categories;
create policy "categories: leitura autenticada"
  on public.categories for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (public.visibility_allows_me(owner_id, visibility)
        and (folder_id is null or public.folder_is_visible(folder_id)))
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

-- O 12 já não é usado por nenhuma política (as de cima o substituíram).
drop function if exists public.folder_chain_is_public(uuid);

-- RLS de follows: todo mundo logado lê (contagens e listas); seguir só em
-- nome próprio e nunca com bloqueio no meio; apagar = deixar de seguir OU
-- remover um seguidor seu.
alter table public.follows enable row level security;

drop policy if exists "follows: leitura autenticada" on public.follows;
create policy "follows: leitura autenticada"
  on public.follows for select to authenticated
  using (true);

drop policy if exists "follows: seguir" on public.follows;
create policy "follows: seguir"
  on public.follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not public.is_blocked_with_me(followee_id)
  );

drop policy if exists "follows: deixar de seguir ou remover seguidor" on public.follows;
create policy "follows: deixar de seguir ou remover seguidor"
  on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

-- RLS de blocks: só quem bloqueou vê, cria e desfaz.
alter table public.blocks enable row level security;

drop policy if exists "blocks: dono lê" on public.blocks;
create policy "blocks: dono lê"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists "blocks: dono bloqueia" on public.blocks;
create policy "blocks: dono bloqueia"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

drop policy if exists "blocks: dono desbloqueia" on public.blocks;
create policy "blocks: dono desbloqueia"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 6) Leitura sem login — um perfil ou uma categoria por vez, só o público.
-- O formato das linhas é o mesmo das tabelas, para o app reaproveitar o
-- código das telas.
-- ---------------------------------------------------------------------
create or replace function public.public_profile(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_profile public.profiles%rowtype;
  v_category_ids uuid[];
begin
  select * into v_profile
    from public.profiles p
   where p.username = lower(btrim(p_username));
  if not found then
    return null;
  end if;

  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_category_ids
    from public.categories c
   where c.owner_id = v_profile.id
     and public.visibility_allows(c.owner_id, c.visibility, null)
     and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null));

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'username', v_profile.username,
      'display_name', v_profile.display_name,
      'avatar_url', v_profile.avatar_url,
      'created_at', v_profile.created_at
    ),
    'folders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id,
               'owner_id', f.owner_id,
               'name', f.name,
               'parent_folder_id', f.parent_folder_id,
               'display_order', f.display_order,
               'created_at', f.created_at,
               'visibility', f.visibility
             ) order by f.display_order, f.name)
        from public.folders f
       where f.owner_id = v_profile.id
         and public.folder_chain_allows(f.id, null)
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'owner_id', c.owner_id,
               'name', c.name,
               'icon', c.icon,
               'color', c.color,
               'folder_id', c.folder_id,
               'display_order', c.display_order,
               'estrutura', c.estrutura,
               'rating_enabled', c.rating_enabled,
               'default_sort', c.default_sort,
               'created_at', c.created_at,
               'visibility', c.visibility
             ) order by c.display_order, c.name)
        from public.categories c
       where c.id = any (v_category_ids)
    ), '[]'::jsonb),
    -- category_id → total de itens
    'counts', coalesce((
      select jsonb_object_agg(t.category_id, t.total)
        from (
          select e.category_id, count(*)::int as total
            from public.entries e
           where e.category_id = any (v_category_ids)
           group by e.category_id
        ) t
    ), '{}'::jsonb)
  );
end;
$$;

create or replace function public.public_category(p_category_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_category public.categories%rowtype;
begin
  select * into v_category
    from public.categories c
   where c.id = p_category_id;
  if not found
     or not public.visibility_allows(v_category.owner_id, v_category.visibility, null)
     or (v_category.folder_id is not null
         and not public.folder_chain_allows(v_category.folder_id, null)) then
    return null;
  end if;

  return jsonb_build_object(
    'owner', (
      select jsonb_build_object(
               'id', p.id,
               'username', p.username,
               'display_name', p.display_name,
               'avatar_url', p.avatar_url,
               'created_at', p.created_at
             )
        from public.profiles p
       where p.id = v_category.owner_id
    ),
    'category', jsonb_build_object(
      'id', v_category.id,
      'owner_id', v_category.owner_id,
      'name', v_category.name,
      'icon', v_category.icon,
      'color', v_category.color,
      'folder_id', v_category.folder_id,
      'display_order', v_category.display_order,
      'estrutura', v_category.estrutura,
      'rating_enabled', v_category.rating_enabled,
      'default_sort', v_category.default_sort,
      'created_at', v_category.created_at,
      'visibility', v_category.visibility
    ),
    'entry_folders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ef.id,
               'owner_id', ef.owner_id,
               'category_id', ef.category_id,
               'name', ef.name,
               'parent_folder_id', ef.parent_folder_id,
               'display_order', ef.display_order,
               'created_at', ef.created_at
             ) order by ef.display_order, ef.name)
        from public.entry_folders ef
       where ef.category_id = v_category.id
    ), '[]'::jsonb),
    -- Mesmo formato do embedding da página (`entries(*, entry_tags(tag_id))`).
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id,
               'category_id', e.category_id,
               'owner_id', e.owner_id,
               'folder_id', e.folder_id,
               'name', e.name,
               'rating', e.rating,
               'image_url', e.image_url,
               'image_display', e.image_display,
               'custom_fields', e.custom_fields,
               'display_order', e.display_order,
               'created_at', e.created_at,
               'updated_at', e.updated_at,
               'entry_tags', coalesce((
                 select jsonb_agg(jsonb_build_object('tag_id', et.tag_id))
                   from public.entry_tags et
                  where et.entry_id = e.id
               ), '[]'::jsonb)
             ) order by e.created_at desc)
        from public.entries e
       where e.category_id = v_category.id
    ), '[]'::jsonb),
    -- Só as tags que os itens desta categoria usam.
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
             order by t.name)
        from public.tags t
       where exists (
         select 1
           from public.entry_tags et
           join public.entries e on e.id = et.entry_id
          where et.tag_id = t.id
            and e.category_id = v_category.id
       )
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.public_profile(text) from public;
revoke execute on function public.public_category(uuid) from public;
grant execute on function public.public_profile(text) to anon, authenticated;
grant execute on function public.public_category(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7) `anon` não lê tabela nenhuma, nem por engano
--
-- As políticas acima são só `to authenticated`, então `anon` já não veria
-- linha nenhuma. Tirar o privilégio de vez é a segunda tranca: se um dia
-- alguém criar uma política sem `to authenticated`, nada vaza.
-- (O Supabase dá privilégio a `anon` em toda tabela nova do schema public:
-- tabelas novas das próximas migrações repetem este revoke.)
-- ---------------------------------------------------------------------
revoke all on table
  public.profiles,
  public.folders,
  public.categories,
  public.entries,
  public.entry_folders,
  public.tags,
  public.entry_tags,
  public.entry_places,
  public.follows,
  public.blocks,
  public.category_entry_counts,
  public.tag_usage_counts
from anon;
