-- =====================================================================
-- Vitrine v2 — Modo visitante: explorar sem conta
-- Rode no SQL Editor do Supabase, depois de 01 a 49 (o 14, o 25, o 26 e o
-- 33 são obrigatórios: este arquivo usa as regras de leitura do 14, o
-- normalizador de nomes do 25 e refaz a função do Explorar do 26/33).
--
-- Aditivo e seguro: só funções. Pode rodar mais de uma vez.
--
-- Quem não tem conta (o papel `anon`) não lê tabela nenhuma desde o 14 — e
-- continua sem ler. Ele passa a chamar quatro funções, que só devolvem o que
-- é Público de fato (a categoria Pública e todas as pastas acima dela
-- Públicas, a regra de `category_visible_to(…, null)`):
--
--   explore_public_categories — o Explorar (a aba Sugestões do Início). A
--     mesma função do 33, agora também sem login: aí não tem "as suas" para
--     esconder nem bloqueio para conferir. Com login, nada muda.
--
--   public_category_covers — até 3 fotos de cada categoria Pública, pelos
--     ids (a capa dos cartões). Com login, o app segue lendo a view
--     `category_covers` (40), que respeita a RLS de quem lê.
--
--   public_people — as pessoas que têm pelo menos uma categoria Pública,
--     com nome, @, foto e quantas listas públicas têm, e a busca por nome
--     ou @. Quem não tem nada Público não aparece.
--
--   public_follows — os seguidores ou quem um perfil segue (nome, @ e
--     foto) e as duas contagens. Só para perfil com pelo menos uma
--     categoria Pública; nos outros, só as contagens.
--
-- Sem este arquivo o app funciona: o visitante vê as boas-vindas e os links
-- diretos (perfil, categoria, item), e as Sugestões mostram que falta rodar.
-- =====================================================================

do $$
begin
  if to_regclass('public.follows') is null
     or to_regprocedure('public.category_visible_to(uuid, uuid)') is null
     or to_regprocedure('public.normalize_category_name(text)') is null
     or to_regprocedure('public.explore_public_categories(text, text, integer)') is null then
    raise exception 'Rode antes os arquivos de 01 a 49 (o 14, o 25, o 26 e o 33 inclusive), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) O Explorar, também sem login
-- ---------------------------------------------------------------------
-- A mesma do 33. Muda só o começo: sem login não há mais o "É preciso entrar
-- na conta", e as duas condições que dependem de quem lê (esconder as
-- próprias categorias e as de quem está bloqueado) valem só com login.
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
         where (v_viewer is null or c.owner_id <> v_viewer)
           and c.kind <> 'inbox'
           and counts.total > 0
           and public.visibility_allows(c.owner_id, c.visibility, null)
           and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null))
           and (v_viewer is null or not public.is_blocked(v_viewer, c.owner_id))
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

revoke execute on function public.explore_public_categories(text, text, int) from public;
grant execute on function public.explore_public_categories(text, text, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) As capas das categorias Públicas (até 60 de uma vez)
-- ---------------------------------------------------------------------
-- A mesma conta da view `category_covers` (40): as 3 fotos dos itens de maior
-- nota (empate pela ordem da categoria) — só de categoria Pública de fato.
create or replace function public.public_category_covers(p_category_ids uuid[])
returns table (category_id uuid, image_url text, "position" int)
language sql
security definer
set search_path = public
stable
as $$
  select ranked.category_id, ranked.image_url, ranked.position
    from (
      select e.category_id,
             e.image_url,
             row_number() over (
               partition by e.category_id
               order by e.rating desc nulls last, e.display_order, e.created_at
             )::int as position
        from public.entries e
       where e.category_id = any ((coalesce(p_category_ids, '{}'::uuid[]))[1:60])
         and e.image_url is not null
         and btrim(e.image_url) <> ''
         and public.category_visible_to(e.category_id, null)
    ) ranked
   where ranked.position <= 3;
$$;

revoke execute on function public.public_category_covers(uuid[]) from public;
grant execute on function public.public_category_covers(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) As pessoas com alguma lista Pública
-- ---------------------------------------------------------------------
-- A busca usa o mesmo normalizador dos nomes de categoria (sem acento, sem
-- maiúscula), nos dois lados. Com login, esconde a própria pessoa e quem
-- está bloqueado (o app logado usa a sua própria lista, mas não custa).
create or replace function public.public_people(
  p_query text default '',
  p_limit int default 24
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
begin
  return coalesce((
    select jsonb_agg(row_to_json(hit)::jsonb - 'created_at' order by hit.lists desc, hit.created_at desc)
      from (
        select p.id,
               p.username,
               p.display_name,
               p.avatar_url,
               p.created_at,
               pub.lists
          from public.profiles p
          cross join lateral (
            select count(*)::int as lists
              from public.categories c
             where c.owner_id = p.id
               and c.kind = 'normal'
               and public.category_visible_to(c.id, null)
          ) pub
         where pub.lists > 0
           and (v_viewer is null or (p.id <> v_viewer and not public.is_blocked(v_viewer, p.id)))
           and (
             v_query = ''
             or p.username like '%' || v_query || '%'
             or public.normalize_category_name(coalesce(p.display_name, '')) like '%' || v_query || '%'
           )
         order by pub.lists desc, p.created_at desc
         limit least(greatest(coalesce(p_limit, 24), 1), 60)
      ) hit
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.public_people(text, int) from public;
grant execute on function public.public_people(text, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Seguidores e seguindo de um perfil
-- ---------------------------------------------------------------------
-- `p_kind`: 'followers' (quem segue o perfil) ou 'following' (quem ele
-- segue). Devolve `null` se o @ não existe (ou, com login, se há bloqueio).
-- As contagens vêm sempre; a lista só para perfil com alguma categoria
-- Pública (`hidden` = true nos outros). De cada pessoa, só nome, @ e foto —
-- o mesmo que o `public_profile` já mostra para quem sabe o @.
create or replace function public.public_follows(
  p_username text,
  p_kind text default 'followers',
  p_limit int default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_profile_id uuid;
  v_following boolean := p_kind = 'following';
  v_public boolean;
begin
  select p.id into v_profile_id
    from public.profiles p
   where p.username = lower(btrim(coalesce(p_username, '')));
  if v_profile_id is null then
    return null;
  end if;
  if v_viewer is not null and public.is_blocked(v_viewer, v_profile_id) then
    return null;
  end if;

  v_public := exists (
    select 1
      from public.categories c
     where c.owner_id = v_profile_id
       and c.kind = 'normal'
       and public.category_visible_to(c.id, null)
  );

  return jsonb_build_object(
    'followers', (select count(*)::int from public.follows f where f.followee_id = v_profile_id),
    'following', (select count(*)::int from public.follows f where f.follower_id = v_profile_id),
    'hidden', not v_public,
    'people', case when not v_public then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', person.id,
               'username', person.username,
               'display_name', person.display_name,
               'avatar_url', person.avatar_url
             ) order by person.since desc)
        from (
          select p.id, p.username, p.display_name, p.avatar_url, f.created_at as since
            from public.follows f
            join public.profiles p
              on p.id = case when v_following then f.followee_id else f.follower_id end
           where (case when v_following then f.follower_id else f.followee_id end) = v_profile_id
             and (v_viewer is null or not public.is_blocked(v_viewer, p.id))
           order by f.created_at desc
           limit least(greatest(coalesce(p_limit, 200), 1), 500)
        ) person
    ), '[]'::jsonb) end
  );
end;
$$;

revoke execute on function public.public_follows(text, text, int) from public;
grant execute on function public.public_follows(text, text, int) to anon, authenticated;
