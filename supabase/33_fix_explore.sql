-- =====================================================================
-- Vitrine v2 — Conserto: Explorar e "Começar de um modelo"
-- Rode no SQL Editor do Supabase, depois de 01 a 32 (o 25 e o 26 são
-- obrigatórios: este arquivo refaz uma função de cada um).
--
-- O erro: as duas funções davam à subconsulta o nome `found` — e `FOUND` é
-- uma variável que o PL/pgSQL cria em toda função. Com a configuração padrão
-- do Postgres (`plpgsql.variable_conflict = error`), o nome repetido vira
-- "referência ambígua" e a função falha SEMPRE: o app mostrava "Algo deu
-- errado." no Explorar e nos modelos.
--
-- O conserto: as mesmas funções, com a subconsulta chamada `hit`. Nada mais
-- muda. Pode rodar mais de uma vez.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.search_public_categories(text, text, integer)') is null
     or to_regprocedure('public.explore_public_categories(text, text, integer)') is null then
    raise exception 'Rode antes os arquivos de 01 a 32 (o 25 e o 26 inclusive), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) "Começar de um modelo" (SQL 25)
-- ---------------------------------------------------------------------
create or replace function public.search_public_categories(
  p_query text default '',
  p_sort text default 'relevance',
  p_limit int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_query text := public.normalize_category_name(left(coalesce(p_query, ''), 80));
  v_sort text := case
                   when p_sort in ('popular', 'recent') then p_sort
                   when v_query = '' then 'popular'
                   else 'relevance'
                 end;
begin
  if v_viewer is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(hit)::jsonb - 'rank' - 'normalized' order by
             case when v_sort = 'relevance' then hit.rank end,
             case when v_sort = 'recent' then hit.created_at end desc,
             hit.uses desc,
             hit.created_at desc)
      from (
        select c.id,
               c.name,
               c.icon,
               c.color,
               c.estrutura,
               c.rating_enabled,
               c.default_sort,
               c.quick_field,
               c.created_at,
               jsonb_build_object(
                 'username', p.username,
                 'display_name', p.display_name,
                 'avatar_url', p.avatar_url
               ) as owner,
               (select count(distinct i.user_id)::int
                  from public.category_imports i
                 where i.source_category_id = c.id) as uses,
               public.normalize_category_name(c.name) as normalized,
               case
                 when public.normalize_category_name(c.name) = v_query then 0
                 when public.normalize_category_name(c.name) like v_query || '%' then 1
                 else 2
               end as rank
          from public.categories c
          join public.profiles p on p.id = c.owner_id
         where c.owner_id <> v_viewer
           and c.kind <> 'inbox'
           and jsonb_typeof(c.estrutura) = 'array'
           and jsonb_array_length(c.estrutura) > 0
           and public.visibility_allows(c.owner_id, c.visibility, null)
           and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null))
           and not public.is_blocked(v_viewer, c.owner_id)
           and (v_query = '' or public.normalize_category_name(c.name) like '%' || v_query || '%')
         order by
           case when v_sort = 'relevance' then
             case
               when public.normalize_category_name(c.name) = v_query then 0
               when public.normalize_category_name(c.name) like v_query || '%' then 1
               else 2
             end
           end,
           case when v_sort = 'recent' then c.created_at end desc,
           uses desc,
           c.created_at desc
         limit least(greatest(coalesce(p_limit, 30), 1), 50)
      ) hit
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.search_public_categories(text, text, int) from public, anon;
grant execute on function public.search_public_categories(text, text, int) to authenticated;

-- ---------------------------------------------------------------------
-- 2) O Explorar (SQL 26)
-- ---------------------------------------------------------------------
create or replace function public.explore_public_categories(
  p_query text default '',
  p_sort text default 'relevance',
  p_limit int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_query text := public.normalize_category_name(left(coalesce(p_query, ''), 80));
  v_sort text := case
                   when p_sort in ('popular', 'recent') then p_sort
                   when v_query = '' then 'popular'
                   else 'relevance'
                 end;
begin
  if v_viewer is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(hit)::jsonb - 'rank' order by
             case when v_sort = 'relevance' then hit.rank end,
             case when v_sort = 'recent' then hit.created_at end desc,
             hit.uses desc,
             hit.total desc,
             hit.created_at desc)
      from (
        select c.id,
               c.name,
               c.icon,
               c.color,
               c.estrutura,
               c.rating_enabled,
               c.created_at,
               jsonb_build_object(
                 'username', p.username,
                 'display_name', p.display_name,
                 'avatar_url', p.avatar_url
               ) as owner,
               counts.total,
               (select count(distinct i.user_id)::int
                  from public.category_imports i
                 where i.source_category_id = c.id) as uses,
               coalesce((
                 select jsonb_agg(jsonb_build_object('name', t.name, 'rating', t.rating)
                                  order by t.rank)
                   from (
                     select e.name, e.rating,
                            row_number() over (
                              order by case when c.rating_enabled then e.rating end desc nulls last,
                                       lower(e.name)
                            ) as rank
                       from public.entries e
                      where e.category_id = c.id
                   ) t
                  where t.rank <= 3
               ), '[]'::jsonb) as preview,
               case
                 when public.normalize_category_name(c.name) = v_query then 0
                 when public.normalize_category_name(c.name) like v_query || '%' then 1
                 else 2
               end as rank
          from public.categories c
          join public.profiles p on p.id = c.owner_id
          cross join lateral (
            select count(*)::int as total from public.entries e where e.category_id = c.id
          ) counts
         where c.owner_id <> v_viewer
           and c.kind <> 'inbox'
           and counts.total > 0
           and public.visibility_allows(c.owner_id, c.visibility, null)
           and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null))
           and not public.is_blocked(v_viewer, c.owner_id)
           and (v_query = '' or public.normalize_category_name(c.name) like '%' || v_query || '%')
         order by
           case when v_sort = 'relevance' then
             case
               when public.normalize_category_name(c.name) = v_query then 0
               when public.normalize_category_name(c.name) like v_query || '%' then 1
               else 2
             end
           end,
           case when v_sort = 'recent' then c.created_at end desc,
           uses desc,
           counts.total desc,
           c.created_at desc
         limit least(greatest(coalesce(p_limit, 30), 1), 50)
      ) hit
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.explore_public_categories(text, text, int) from public, anon;
grant execute on function public.explore_public_categories(text, text, int) to authenticated;
