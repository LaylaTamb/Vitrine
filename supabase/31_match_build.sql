-- =====================================================================
-- Vitrine v2 — Match (parte 2): a cópia de cada pessoa
-- Rode no SQL Editor do Supabase, depois de 01 a 30 (o 30 é obrigatório; o
-- 18, o 24, o 25 e o 28 também: este arquivo usa o catálogo,
-- `entries.source`, `normalize_category_name` e refaz `place_ratings`).
--
-- Aditivo e seguro: colunas novas (vazias) e funções. Pode rodar mais de
-- uma vez.
--
--   categories.kind ganha 'match' — a categoria da cópia de um match;
--   categories.match_id — de qual match ela é;
--   match_members.category_id — a cópia de cada pessoa;
--   entries.match_owner_id / match_color — de quem é o item original e a cor
--     dessa pessoa no match;
--   entries.match_key — a "mesma coisa": o mesmo lugar do catálogo comum
--     ('lugar:<id>'), o mesmo item do catálogo ('cat:<id>') ou o mesmo título
--     normalizado em categorias equivalentes ('t:<categoria>|<título>' — a
--     categoria vale pelo nome normalizado do MODELO de onde veio, se veio de
--     um, senão pelo próprio);
--   entries.match_fields — os campos do original (estrutura + valores), só
--     leitura na tela.
--
-- `build_my_match_copy(match)` monta a cópia de QUEM PEDE, na primeira vez
-- que a pessoa abre o match pronto (e devolve a mesma depois): uma foto do
-- momento, que não atualiza. Pasta "Matches" (criada se não houver), a
-- categoria "@você & @amigo · DD/MM/AAAA" (a data em que o match ficou
-- pronto), uma subpasta por categoria de origem (as equivalentes juntas) e,
-- de cada pessoa, até 500 itens (os mexidos por último):
--   • de quem pede: o que alguém do match pode ver (nunca o privado);
--   • dos outros: só o que QUEM PEDE pode ver (público; de Amigos, se for
--     amigo) — nunca o privado, e nada de quem tem bloqueio.
-- Vêm nome, imagem, nota do dono, tags, as localizações já encontradas e os
-- campos originais (só leitura). As marcações "Em comum", "Sugestão para…"
-- e a % de compatibilidade a tela calcula na hora, com o que está na cópia.
--
-- Privacidade da cópia: a categoria do match é SEMPRE privada (gatilho), não
-- deixa de ser 'match', e os itens não saem dela (para levar algo para o seu
-- acervo, o "Trazer" copia só nome, imagem e localização para a "A
-- organizar"). Assim o que um amigo deixou só para amigos não vira público
-- por tabela. Pelo app, nada entra nela também (nem item novo, nem item
-- movido de outra categoria).
--
-- E `place_ratings` (SQL 28) passa a ignorar as cópias: o item da cópia é
-- seu, mas a nota é a do amigo.
-- =====================================================================

do $$
begin
  if to_regclass('public.matches') is null
     or to_regprocedure('public.normalize_category_name(text)') is null
     or to_regprocedure('public.place_ratings(text, text)') is null
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'entries' and column_name = 'source'
     ) then
    raise exception 'Rode antes os arquivos de 01 a 30 (o 24, o 25, o 28 e o 30 inclusive), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) Colunas
-- ---------------------------------------------------------------------
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories add constraint categories_kind_check
  check (kind in ('normal', 'inbox', 'match'));

alter table public.categories
  add column if not exists match_id uuid references public.matches(id) on delete set null;
alter table public.match_members
  add column if not exists category_id uuid references public.categories(id) on delete set null;

alter table public.entries
  add column if not exists match_owner_id uuid references public.profiles(id) on delete set null;
alter table public.entries add column if not exists match_color text;
alter table public.entries add column if not exists match_key text;
alter table public.entries add column if not exists match_fields jsonb;

-- ---------------------------------------------------------------------
-- 2) As travas da cópia
-- ---------------------------------------------------------------------
-- O nome começa com "a_" de propósito: gatilhos BEFORE rodam em ordem
-- alfabética, e este tem que rodar antes do `categories_sync_visibility`.
-- SECURITY INVOKER de propósito (como a trava da "A organizar"): vindo do app
-- (`authenticated`), ninguém cria categoria de match nem mexe no `kind` ou no
-- `match_id`; só `build_my_match_copy` (que roda como dono do banco).
create or replace function public.keep_match_category_private()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' and (new.kind = 'match' or new.match_id is not null) then
      raise exception 'A categoria de um match nasce do próprio match.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE'
       and (new.kind is distinct from old.kind and 'match' in (new.kind, old.kind)
            or new.match_id is distinct from old.match_id) then
      raise exception 'A categoria de um match continua sendo de match.' using errcode = '42501';
    end if;
  end if;
  if new.kind = 'match' then
    new.visibility := 'private';
    new.is_public := false;
  end if;
  return new;
end;
$$;

revoke execute on function public.keep_match_category_private() from public, anon, authenticated;

drop trigger if exists categories_a_match_private on public.categories;
create trigger categories_a_match_private
  before insert or update on public.categories
  for each row execute function public.keep_match_category_private();

-- Também SECURITY INVOKER: só vale para o app; `build_my_match_copy` passa.
create or replace function public.keep_match_entries_inside()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.category_id is distinct from old.category_id
     and exists (select 1 from public.categories c where c.id = old.category_id and c.kind = 'match') then
    raise exception 'Itens de um match não saem dele: use "Trazer" para levar para a A organizar.'
      using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)
     and exists (select 1 from public.categories c where c.id = new.category_id and c.kind = 'match') then
    raise exception 'A cópia de um match só tem o que veio do match.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.keep_match_entries_inside() from public, anon, authenticated;

drop trigger if exists entries_keep_match_inside on public.entries;
create trigger entries_keep_match_inside
  before insert or update of category_id on public.entries
  for each row execute function public.keep_match_entries_inside();

-- ---------------------------------------------------------------------
-- 3) Montar a cópia de quem pede
-- ---------------------------------------------------------------------
create or replace function public.build_my_match_copy(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_match public.matches%rowtype;
  v_member public.match_members%rowtype;
  v_folder uuid;
  v_category uuid;
  v_handles text[];
  v_name text;
  v_date text;
  v_try int := 1;
  v_group record;
  v_order int := 0;
  v_entry_folder uuid;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  select * into v_member from public.match_members where match_id = p_match_id and user_id = v_me
     for update;
  if v_match.id is null or v_member.match_id is null then
    raise exception 'Match não encontrado.' using errcode = 'P0002';
  end if;
  if v_match.status <> 'ready' then
    raise exception 'O match ainda não está pronto: falta gente aceitar.' using errcode = '22023';
  end if;

  -- Já montada (e não apagada): a mesma.
  if v_member.category_id is not null
     and exists (select 1 from public.categories c where c.id = v_member.category_id and c.owner_id = v_me) then
    return v_member.category_id;
  end if;

  -- A pasta "Matches" (renomeada ou apagada? o próximo match recria).
  select f.id into v_folder
    from public.folders f
   where f.owner_id = v_me and f.parent_folder_id is null and lower(btrim(f.name)) = 'matches'
   order by f.created_at
   limit 1;
  if v_folder is null then
    insert into public.folders (owner_id, name, display_order, visibility)
    values (
      v_me,
      'Matches',
      coalesce((select max(f.display_order) + 1 from public.folders f
                 where f.owner_id = v_me and f.parent_folder_id is null), 0),
      'private'
    )
    returning id into v_folder;
  end if;

  -- "@você & @amigo · 20/10/2026": você primeiro, os outros na ordem do match.
  select array_agg('@' || p.username order by (m.user_id <> v_me), m.position)
    into v_handles
    from public.match_members m
    join public.profiles p on p.id = m.user_id
   where m.match_id = p_match_id;
  v_date := to_char(coalesce(v_match.ready_at, now()) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY');
  v_name := case
              when cardinality(v_handles) <= 2 then array_to_string(v_handles, ' & ')
              else array_to_string(v_handles[1:cardinality(v_handles) - 1], ', ')
                   || ' & ' || v_handles[cardinality(v_handles)]
            end;
  if length(v_name) > 64 then
    v_name := v_handles[1] || ' & mais ' || (cardinality(v_handles) - 1) || ' pessoas';
  end if;
  v_name := v_name || ' · ' || v_date;
  while exists (select 1 from public.categories c where c.owner_id = v_me and c.name = v_name) loop
    v_try := v_try + 1;
    v_name := regexp_replace(v_name, ' \(\d+\)$', '') || ' (' || v_try || ')';
  end loop;

  insert into public.categories
    (owner_id, name, icon, folder_id, display_order, estrutura, rating_enabled, kind, match_id, visibility)
  values (
    v_me,
    left(v_name, 80),
    '💞',
    v_folder,
    coalesce((select max(c.display_order) + 1 from public.categories c
               where c.owner_id = v_me and c.folder_id = v_folder), 0),
    '[]'::jsonb,
    true,
    'match',
    p_match_id,
    'private'
  )
  returning id into v_category;

  update public.match_members
     set category_id = v_category
   where match_id = p_match_id and user_id = v_me;

  -- Os itens que entram: de cada pessoa, o que a regra deixa (ver o topo).
  create temporary table if not exists _match_src (
    entry_id uuid,
    owner_id uuid,
    color text,
    position int,
    group_key text,
    group_name text,
    match_key text,
    fields jsonb,
    rn int,
    folder_id uuid
  ) on commit drop;
  truncate _match_src;

  insert into _match_src
  select ranked.entry_id, ranked.owner_id, ranked.color, ranked.position, ranked.group_key,
         ranked.group_name, ranked.match_key, ranked.fields, ranked.rn, null
    from (
      select e.id as entry_id,
             e.owner_id,
             m.color,
             m.position,
             public.normalize_category_name(coalesce(src.name, c.name)) as group_key,
             c.name as group_name,
             coalesce(
               'lugar:' || (
                 select ep.catalog_item_id::text
                   from public.entry_places ep
                  where ep.entry_id = e.id and ep.catalog_item_id is not null
                  limit 1
               ),
               'cat:' || e.catalog_item_id::text,
               't:' || public.normalize_category_name(coalesce(src.name, c.name))
                    || '|' || public.normalize_category_name(e.name)
             ) as match_key,
             jsonb_build_object('category', c.name, 'estrutura', c.estrutura, 'values', e.custom_fields)
               as fields,
             row_number() over (partition by e.owner_id order by e.updated_at desc) as rn
        from public.match_members m
        join public.categories c on c.owner_id = m.user_id
        left join public.categories src on src.id = c.source_category_id
        join public.entries e on e.category_id = c.id
       where m.match_id = p_match_id
         and c.kind = 'normal'
         and (
           (m.user_id = v_me and exists (
              select 1 from public.match_members o
               where o.match_id = p_match_id and o.user_id <> v_me
                 and public.category_visible_to(c.id, o.user_id)
            ))
           or (m.user_id <> v_me
               and public.category_visible_to(c.id, v_me)
               and not public.is_blocked(v_me, m.user_id))
         )
    ) ranked
   where ranked.rn <= 500;

  -- Uma subpasta por grupo de categorias equivalentes (o nome: o da
  -- categoria de quem entrou primeiro no match).
  for v_group in
    select s.group_key, (array_agg(s.group_name order by s.position, s.group_name))[1] as name
      from _match_src s
     group by s.group_key
     order by min(s.position), 2
  loop
    insert into public.entry_folders (owner_id, category_id, name, display_order)
    values (v_me, v_category, left(v_group.name, 80), v_order)
    returning id into v_entry_folder;
    update _match_src set folder_id = v_entry_folder where group_key = v_group.group_key;
    v_order := v_order + 1;
  end loop;

  -- Os itens, com a origem em `source`/`source_id` (montar de novo não duplica).
  insert into public.entries
    (category_id, owner_id, folder_id, name, rating, image_url, image_display, custom_fields,
     display_order, created_at, source, source_id, match_owner_id, match_color, match_key, match_fields)
  select v_category,
         v_me,
         s.folder_id,
         e.name,
         e.rating,
         e.image_url,
         e.image_display,
         '{}'::jsonb,
         row_number() over (partition by s.folder_id order by s.position, e.display_order, e.name),
         e.created_at,
         'match',
         p_match_id::text || ':' || e.id::text,
         s.owner_id,
         s.color,
         s.match_key,
         s.fields
    from _match_src s
    join public.entries e on e.id = s.entry_id
  on conflict (owner_id, source, source_id) do nothing;

  insert into public.entry_tags (entry_id, tag_id)
  select copy.id, et.tag_id
    from public.entries copy
    join public.entry_tags et on et.entry_id = split_part(copy.source_id, ':', 2)::uuid
   where copy.category_id = v_category and copy.source = 'match'
  on conflict do nothing;

  -- As localizações já encontradas (para o "Trazer" levar sem buscar de novo).
  insert into public.entry_places
  select r.*
    from public.entries copy
    join public.entry_places ep on ep.entry_id = split_part(copy.source_id, ':', 2)::uuid
    cross join lateral jsonb_populate_record(
      null::public.entry_places,
      to_jsonb(ep) || jsonb_build_object('entry_id', copy.id, 'owner_id', v_me)
    ) as r
   where copy.category_id = v_category and copy.source = 'match'
  on conflict do nothing;

  return v_category;
end;
$$;

revoke execute on function public.build_my_match_copy(uuid) from public, anon;
grant execute on function public.build_my_match_copy(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4) As notas de um lugar (SQL 28) sem as cópias de match
--
-- Os itens da cópia são "seus" (dono = você), mas a nota é a do amigo: sem
-- este filtro, a nota dele viraria a sua no cartão do lugar, e o "você já
-- tem este lugar em…" apontaria para a cópia. Mesma função, mais o filtro.
-- ---------------------------------------------------------------------
create or replace function public.place_ratings(p_geoapify_id text, p_osm_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_geo text := nullif(btrim(coalesce(p_geoapify_id, '')), '');
  v_osm text := nullif(btrim(coalesce(p_osm_id, '')), '');
  v_item uuid;
begin
  if v_viewer is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  select c.id into v_item
    from public.catalog_items c
   where c.kind = 'place'
     and ((v_geo is not null and c.external_ids->>'geoapify' = v_geo)
       or (v_osm is not null and c.external_ids->>'osm' = v_osm))
   limit 1;

  if v_item is null then
    return jsonb_build_object('count', 0, 'average', null, 'ratings', '[]'::jsonb, 'mine', '[]'::jsonb);
  end if;

  return (
    with rated as (
      -- Uma nota por pessoa: a do item mexido por último.
      select distinct on (e.owner_id) e.owner_id, p.username, e.rating
        from public.entry_places ep
        join public.entries e on e.id = ep.entry_id
        join public.categories c on c.id = e.category_id
        join public.profiles p on p.id = e.owner_id
       where ep.catalog_item_id = v_item
         and e.rating is not null
         and c.rating_enabled
         and c.kind <> 'match'
         and (
           e.owner_id = v_viewer
           or (public.category_visible_to(c.id, v_viewer)
               and not public.is_blocked(v_viewer, e.owner_id))
         )
       order by e.owner_id, e.updated_at desc
    ),
    mine as (
      select distinct on (e.id) e.id as entry_id, c.id as category_id, c.name as category_name
        from public.entry_places ep
        join public.entries e on e.id = ep.entry_id
        join public.categories c on c.id = e.category_id
       where ep.catalog_item_id = v_item
         and e.owner_id = v_viewer
         and c.kind <> 'match'
    )
    select jsonb_build_object(
      'count', (select count(*) from rated),
      'average', (select round(avg(rating)::numeric, 1) from rated),
      'ratings', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'username', r.username,
                 'rating', r.rating,
                 'is_me', r.owner_id = v_viewer
               ) order by r.owner_id = v_viewer desc, r.rating desc, r.username)
          from (
            select * from rated
             order by owner_id = v_viewer desc, rating desc, username
             limit 20
          ) r
      ), '[]'::jsonb),
      'mine', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'entry_id', m.entry_id,
                 'category_id', m.category_id,
                 'category_name', m.category_name
               ))
          from mine m
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.place_ratings(text, text) from public, anon;
grant execute on function public.place_ratings(text, text) to authenticated;
