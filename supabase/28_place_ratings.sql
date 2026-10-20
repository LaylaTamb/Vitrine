-- =====================================================================
-- Vitrine v2 — "No Vitrine": quem avaliou um lugar
-- Rode no SQL Editor do Supabase, depois de 01 a 27 (o 14 e o 18 são
-- obrigatórios: este arquivo usa as regras de visibilidade e o catálogo de
-- lugares).
--
-- Aditivo e seguro: só uma função de leitura. Pode rodar mais de uma vez.
--
-- `place_ratings(id da Geoapify, id do OpenStreetMap)` — para o cartão do
-- "Você está em X?": acha o lugar no catálogo comum (migração 18) e devolve,
-- das avaliações que QUEM PERGUNTA pode ver (as públicas; as de Amigos, se
-- for amigo; as próprias), o @ e a nota de cada pessoa (a mais recente de
-- cada uma), a média e a contagem. Sem texto livre. E onde o lugar já está
-- no acervo de quem pergunta.
--
-- O catálogo continua sem leitura direta: a função devolve só isso.
-- =====================================================================

do $$
begin
  if to_regclass('public.catalog_items') is null
     or to_regprocedure('public.category_visible_to(uuid, uuid)') is null then
    raise exception 'Rode antes o supabase/14_visibility_and_follows.sql e o 18_catalog.sql (e os demais anteriores), depois este.';
  end if;
end;
$$;

-- Devolve {"count", "average", "ratings": [{"username", "rating", "is_me"}],
--          "mine": [{"entry_id", "category_id", "category_name"}]}.
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
