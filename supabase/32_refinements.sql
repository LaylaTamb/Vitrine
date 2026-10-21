-- =====================================================================
-- Vitrine v2 — Refinamentos: sugestões de campos com 1 pessoa e o match
-- em lista solta
-- Rode no SQL Editor do Supabase, depois de 01 a 31 (o 27 e o 31 são
-- obrigatórios: este arquivo refaz uma função de cada um).
--
-- Aditivo e seguro: só refaz duas funções e arruma as cópias de match que já
-- existem. Pode rodar mais de uma vez.
--
--   1) `field_suggestions` (SQL 27): um campo já aparece quando UMA pessoa
--      tem uma categoria pública parecida (antes eram 3). Não expõe nada de
--      novo: a categoria é pública e já aparece no Explorar, com os campos.
--   2) `build_my_match_copy` (SQL 31): a cópia do match vira uma lista
--      SOLTA — sem as subpastas por categoria de origem. Os itens iguais
--      ficam lado a lado.
--   3) As cópias já montadas: os itens saem das subpastas (vão para a raiz
--      da categoria, na mesma ordem nova) e as subpastas das cópias somem.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.field_suggestions(text)') is null
     or to_regprocedure('public.build_my_match_copy(uuid)') is null then
    raise exception 'Rode antes os arquivos de 01 a 31 (o 27 e o 31 inclusive), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) Sugestões de campos: basta uma pessoa
-- ---------------------------------------------------------------------
create or replace function public.field_suggestions(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_name text := public.normalize_category_name(left(coalesce(p_name, ''), 80));
begin
  if v_viewer is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;
  if length(v_name) < 3 then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with categories_like as (
      select c.owner_id, c.estrutura
        from public.categories c
       where c.owner_id <> v_viewer
         and c.kind <> 'inbox'
         and jsonb_typeof(c.estrutura) = 'array'
         and public.visibility_allows(c.owner_id, c.visibility, null)
         and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null))
         and not public.is_blocked(v_viewer, c.owner_id)
         and (
           public.normalize_category_name(c.name) = v_name
           or public.normalize_category_name(c.name) like v_name || ' %'
           or public.normalize_category_name(c.name) like '% ' || v_name
         )
    ),
    fields as (
      select cl.owner_id,
             btrim(f->>'nome') as nome,
             f->>'tipo' as tipo,
             f->'opcoes' as opcoes,
             f->>'moeda' as moeda,
             public.normalize_category_name(f->>'nome') as field_key
        from categories_like cl
        cross join lateral jsonb_array_elements(cl.estrutura) f
       where jsonb_typeof(f) = 'object'
         and f->>'tipo' in ('star', 'date', 'str', 'int', 'decimal', 'time', 'currency', 'select', 'location')
         and coalesce(btrim(f->>'nome'), '') <> ''
         and length(f->>'nome') <= 60
    ),
    grouped as (
      select field_key,
             tipo,
             count(distinct owner_id)::int as owners,
             mode() within group (order by nome) as nome,
             mode() within group (order by moeda) filter (where moeda is not null) as moeda
        from fields
       where field_key <> ''
       group by field_key, tipo
      having count(distinct owner_id) >= 1
    )
    select jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'nome', g.nome,
               'tipo', g.tipo,
               'owners', g.owners,
               'moeda', case when g.tipo = 'currency' then g.moeda end,
               'opcoes', case when g.tipo = 'select' then (
                 select jsonb_agg(o.option order by o.users desc, o.option)
                   from (
                     select opt.value as option, count(distinct fl.owner_id) as users
                       from fields fl
                       cross join lateral jsonb_array_elements_text(
                         case when jsonb_typeof(fl.opcoes) = 'array' then fl.opcoes else '[]'::jsonb end
                       ) opt
                      where fl.field_key = g.field_key and fl.tipo = 'select'
                        and length(opt.value) between 1 and 40
                      group by opt.value
                      order by users desc, opt.value
                      limit 10
                   ) o
               ) end
             ))
             order by g.owners desc, g.nome
           )
      from (select * from grouped order by owners desc, nome limit 12) g
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.field_suggestions(text) from public, anon;
grant execute on function public.field_suggestions(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2) A cópia do match, sem subpastas
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
  drop table if exists _match_src;
  create temporary table _match_src (
    entry_id uuid,
    owner_id uuid,
    color text,
    position int,
    group_key text,
    match_key text,
    fields jsonb,
    rn int
  ) on commit drop;

  insert into _match_src
  select ranked.entry_id, ranked.owner_id, ranked.color, ranked.position, ranked.group_key,
         ranked.match_key, ranked.fields, ranked.rn
    from (
      select e.id as entry_id,
             e.owner_id,
             m.color,
             m.position,
             public.normalize_category_name(coalesce(src.name, c.name)) as group_key,
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

  -- Os itens, soltos na categoria, com a origem em `source`/`source_id`
  -- (montar de novo não duplica). A ordem junta o que é a mesma coisa: o
  -- "Duna" de cada pessoa fica um do lado do outro.
  insert into public.entries
    (category_id, owner_id, folder_id, name, rating, image_url, image_display, custom_fields,
     display_order, created_at, source, source_id, match_owner_id, match_color, match_key, match_fields)
  select v_category,
         v_me,
         null,
         e.name,
         e.rating,
         e.image_url,
         e.image_display,
         '{}'::jsonb,
         row_number() over (order by s.group_key, s.match_key, s.position, e.name),
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
-- 3) As cópias que já existem: tudo solto, na ordem nova
--
-- Primeiro os itens saem das subpastas (a raiz da categoria); só depois as
-- subpastas vazias são apagadas.
-- ---------------------------------------------------------------------
with ranked as (
  select e.id,
         row_number() over (
           partition by e.category_id
           order by e.match_key, e.display_order, e.name
         ) as rn
    from public.entries e
    join public.categories c on c.id = e.category_id
   where c.kind = 'match'
)
update public.entries e
   set folder_id = null,
       display_order = ranked.rn
  from ranked
 where e.id = ranked.id
   and (e.folder_id is not null or e.display_order is distinct from ranked.rn);

delete from public.entry_folders f
 using public.categories c
 where c.id = f.category_id
   and c.kind = 'match';
