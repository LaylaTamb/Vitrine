-- =====================================================================
-- Vitrine v2 — Match no modelo do Blend: a base da lista do match
-- Rode no SQL Editor do Supabase, depois de 01 a 44 (o 14, o 25, o 30 e o
-- 31 são obrigatórios: este arquivo usa a visibilidade, o nome normalizado
-- das categorias, os matches e o `kind` 'match').
--
-- Aditivo e seguro: só uma função nova. Pode rodar mais de uma vez.
--
--   match_blend_pool(match) — o que pode entrar na lista do match, para
--     quem está nele (e só com ele pronto). A lista em si (os pontos, as
--     cotas de cada pessoa, a ordem do dia) e a % o app monta com isto.
--
-- A regra de quem vê: entra só o que TODAS as pessoas do match podem ver
-- (o nível mais restrito vence — um item de Amigos só entra se todos forem
-- amigos do dono). Assim a lista é a mesma para todo mundo e nada vaza para
-- quem não podia ver. Nunca o privado, nada de quem tem bloqueio, nada da
-- "A organizar" nem das cópias antigas de match (`kind` 'normal' apenas).
--
-- O que volta (jsonb; nulo se o match não é seu ou não está pronto):
--   families — cada pessoa e as "famílias" de categoria que ela tem (o nome
--     normalizado que junta as equivalentes, a mesma regra do 34:
--     "Restaurante" = "restaurantes" = "Restaurantes japoneses");
--   items — de cada pessoa, até 500 itens das famílias que 2+ pessoas têm
--     (os mexidos por último) e até 30 "descobertas" de famílias que só ela
--     tem (nota 4 ou mais, as melhores), com a chave de "mesma coisa"
--     (`match_key`, a mesma do 34: o mesmo lugar do catálogo, ou o mesmo
--     título normalizado na mesma família).
-- =====================================================================

do $$
begin
  if to_regclass('public.match_members') is null
     or to_regprocedure('public.normalize_category_name(text)') is null
     or to_regprocedure('public.category_visible_to(uuid, uuid)') is null
     or to_regprocedure('public.build_my_match_copy(uuid)') is null then
    raise exception 'Rode antes os arquivos de 01 a 44 (o 14, o 25, o 30 e o 31 inclusive), depois este.';
  end if;
end;
$$;

create or replace function public.match_blend_pool(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    -- Só quem está no match, e só com ele pronto.
    select m.id
      from public.matches m
     where m.id = p_match_id
       and m.status = 'ready'
       and exists (
         select 1 from public.match_members mm
          where mm.match_id = m.id and mm.user_id = (select auth.uid())
       )
  ),
  members as (
    select mm.user_id
      from public.match_members mm
     where mm.match_id in (select a.id from allowed a)
  ),
  seen as (
    -- As categorias que TODOS os outros do match podem ver (a
    -- `category_visible_to` já confere o caminho de pastas e o bloqueio).
    select c.id as category_id,
           c.owner_id,
           c.name,
           c.icon,
           -- O nome que vale: o do modelo de origem, se veio de um.
           public.normalize_category_name(coalesce(src.name, c.name)) as norm
      from public.categories c
      join members o on o.user_id = c.owner_id
      left join public.categories src on src.id = c.source_category_id
     where c.kind = 'normal'
       and exists (select 1 from public.entries e where e.category_id = c.id)
       and not exists (
         select 1 from members v
          where v.user_id <> c.owner_id
            and not public.category_visible_to(c.id, v.user_id)
       )
  ),
  grouped as (
    -- A família: o nome mais curto, entre as categorias do match, que é ela
    -- mesma ou está nela como palavra inteira no começo ou no fim.
    select k.category_id,
           k.owner_id,
           k.name,
           k.icon,
           (select n.norm
              from seen n
             where n.norm = k.norm
                or k.norm like n.norm || ' %'
                or k.norm like '% ' || n.norm
             order by length(n.norm), n.norm
             limit 1) as family
      from seen k
     where k.norm <> ''
  ),
  shared as (
    select g.family from grouped g group by g.family having count(distinct g.owner_id) >= 2
  ),
  candidates as (
    select e.id,
           e.owner_id,
           e.name,
           e.rating,
           e.image_url,
           e.image_display,
           e.updated_at,
           e.catalog_item_id,
           g.category_id,
           g.name as category_name,
           g.icon as category_icon,
           g.family,
           s.family is not null as is_shared
      from grouped g
      join public.entries e on e.category_id = g.category_id
      left join shared s on s.family = g.family
  ),
  picked as (
    -- Das famílias em comum, os mexidos por último; das outras (as
    -- descobertas), só nota 4 ou mais, as melhores primeiro.
    select c.*,
           row_number() over (
             partition by c.owner_id, c.is_shared
             order by case when c.is_shared then 0 else c.rating end desc nulls last,
                      c.updated_at desc
           ) as rn
      from candidates c
     where c.is_shared or c.rating >= 4
  )
  select jsonb_build_object(
           'families',
           coalesce((
             select jsonb_agg(jsonb_build_object('owner_id', f.owner_id, 'family', f.family))
               from (select distinct g.owner_id, g.family from grouped g) f
           ), '[]'::jsonb),
           'items',
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'entry_id', p.id,
                      'owner_id', p.owner_id,
                      'category_id', p.category_id,
                      'category_name', p.category_name,
                      'category_icon', p.category_icon,
                      'family', p.family,
                      'shared', p.is_shared,
                      'match_key', coalesce(
                        'lugar:' || (
                          select ep.catalog_item_id::text
                            from public.entry_places ep
                           where ep.entry_id = p.id and ep.catalog_item_id is not null
                           limit 1
                        ),
                        'cat:' || p.catalog_item_id::text,
                        't:' || p.family || '|' || public.normalize_category_name(p.name)
                      ),
                      'name', p.name,
                      'rating', p.rating,
                      'image_url', p.image_url,
                      'image_display', p.image_display,
                      'updated_at', p.updated_at
                    ))
               from picked p
              where p.rn <= case when p.is_shared then 500 else 30 end
           ), '[]'::jsonb)
         )
   where exists (select 1 from allowed);
$$;

revoke execute on function public.match_blend_pool(uuid) from public, anon;
grant execute on function public.match_blend_pool(uuid) to authenticated;
