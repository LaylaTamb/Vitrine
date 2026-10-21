-- =====================================================================
-- Vitrine v2 — Match: só as categorias em comum, e "Excluir" da sua lista
-- Rode no SQL Editor do Supabase, depois de 01 a 33 (o 30, o 31 e o 32 são
-- obrigatórios).
--
-- Aditivo e seguro. Pode rodar mais de uma vez (as cópias montadas com a
-- regra nova não são apagadas de novo).
--
--   1) A cópia do match passa a ter SÓ as categorias em comum: as que duas
--      ou mais pessoas do match têm, com nome equivalente — o mesmo nome sem
--      acento, maiúscula e plural ("Restaurante" = "restaurantes"), o mesmo
--      modelo de origem, ou uma contida na outra como palavra inteira
--      ("Restaurantes" e "Restaurantes japoneses"). Dentro delas entram os
--      itens de cada um (o que está em comum e o que vira sugestão). Uma
--      categoria que só uma pessoa tem fica de fora.
--      `categories.match_rule` = 2 marca a cópia montada assim.
--   2) As cópias montadas antes (com TODOS os itens) são apagadas: ao abrir o
--      match de novo, ele remonta com a regra nova. O que alguém já trouxe
--      para a "A organizar" fica.
--   3) "Excluir" um match da sua lista: `match_members.hidden_at` e a função
--      `hide_my_match`. Some só para você (para os outros, nada muda), e só
--      depois de pronto ou cancelado — pendente se responde antes. A sua
--      cópia continua nas Coleções.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.build_my_match_copy(uuid)') is null
     or to_regclass('public.match_members') is null then
    raise exception 'Rode antes os arquivos de 01 a 33 (o 30, o 31 e o 32 inclusive), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) Colunas
-- ---------------------------------------------------------------------
alter table public.categories add column if not exists match_rule smallint;
alter table public.match_members add column if not exists hidden_at timestamptz;

-- ---------------------------------------------------------------------
-- 2) A montagem: só as categorias em comum
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
    (owner_id, name, icon, folder_id, display_order, estrutura, rating_enabled, kind, match_id,
     visibility, match_rule)
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
    'private',
    2
  )
  returning id into v_category;

  update public.match_members
     set category_id = v_category
   where match_id = p_match_id and user_id = v_me;

  -- Os itens que entram: de cada pessoa, o que a regra de visibilidade deixa
  -- (ver o topo) — e SÓ das categorias em comum.
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

  with candidates as (
    -- O que cada pessoa deixa à vista (a mesma regra de antes).
    select e.id as entry_id,
           e.owner_id,
           m.color,
           m.position,
           c.id as category_id,
           c.name as category_name,
           c.estrutura,
           e.name as entry_name,
           e.catalog_item_id,
           e.custom_fields,
           e.updated_at,
           -- O nome que vale: o do modelo de origem, se veio de um.
           public.normalize_category_name(coalesce(src.name, c.name)) as norm
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
  ),
  categories_seen as (
    select distinct category_id, owner_id, norm from candidates where norm <> ''
  ),
  grouped as (
    -- A "família" de cada categoria: o nome mais curto, entre as categorias do
    -- match, que é ela mesma ou está nela como palavra inteira no começo ou no
    -- fim ("restaurante" ⊂ "restaurante japones"; "filme" ⊂ "melhor filme").
    select k.category_id,
           k.owner_id,
           (select n.norm
              from categories_seen n
             where n.norm = k.norm
                or k.norm like n.norm || ' %'
                or k.norm like '% ' || n.norm
             order by length(n.norm), n.norm
             limit 1) as group_key
      from categories_seen k
  ),
  shared as (
    -- Só a família que 2 ou mais pessoas do match têm.
    select group_key from grouped group by group_key having count(distinct owner_id) >= 2
  ),
  ranked as (
    select c.*,
           g.group_key,
           row_number() over (partition by c.owner_id order by c.updated_at desc) as rn
      from candidates c
      join grouped g on g.category_id = c.category_id
     where g.group_key in (select s.group_key from shared s)
  )
  insert into _match_src
  select r.entry_id,
         r.owner_id,
         r.color,
         r.position,
         r.group_key,
         coalesce(
           'lugar:' || (
             select ep.catalog_item_id::text
               from public.entry_places ep
              where ep.entry_id = r.entry_id and ep.catalog_item_id is not null
              limit 1
           ),
           'cat:' || r.catalog_item_id::text,
           't:' || r.group_key || '|' || public.normalize_category_name(r.entry_name)
         ),
         jsonb_build_object('category', r.category_name, 'estrutura', r.estrutura, 'values', r.custom_fields),
         r.rn
    from ranked r
   where r.rn <= 500;

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
-- 3) As cópias antigas (com tudo) saem; ao abrir, o match remonta
--
-- Só as de antes da regra nova (`match_rule` vazio): rodar de novo não
-- apaga as que já foram remontadas. A categoria leva junto os itens dela
-- (e o `match_members.category_id` volta a vazio sozinho).
-- ---------------------------------------------------------------------
delete from public.categories
 where kind = 'match'
   and match_rule is null;

-- ---------------------------------------------------------------------
-- 4) "Excluir" da minha lista
-- ---------------------------------------------------------------------
create or replace function public.hide_my_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_status text;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  select m.status into v_status
    from public.matches m
    join public.match_members mm on mm.match_id = m.id and mm.user_id = v_me
   where m.id = p_match_id;
  if v_status is null then
    raise exception 'Match não encontrado.' using errcode = 'P0002';
  end if;
  if v_status = 'pending' then
    raise exception 'Este match ainda espera respostas: aceite, recuse ou cancele antes.'
      using errcode = '22023';
  end if;

  update public.match_members
     set hidden_at = coalesce(hidden_at, now())
   where match_id = p_match_id and user_id = v_me;
end;
$$;

revoke execute on function public.hide_my_match(uuid) from public, anon;
grant execute on function public.hide_my_match(uuid) to authenticated;
