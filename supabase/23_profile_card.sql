-- =====================================================================
-- Vitrine v2 — cartão de apresentação do perfil
-- Rode no SQL Editor do Supabase, depois de 01 a 22 (o 14 e o 17 são
-- obrigatórios: este arquivo usa as regras de visibilidade e
-- `categories.kind`).
--
-- Aditivo e seguro: três colunas novas em `profiles`, com valor padrão
-- vazio, e duas funções de leitura. Pode rodar mais de uma vez.
--
--   profiles.bio               — até 220 caracteres;
--   profiles.card_category_ids — até 5 categorias escolhidas, na ordem do
--                                cartão (pode ser nenhuma);
--   profiles.social_links      — {"instagram", "x", "discord", "spotify",
--                                "youtube"}: o app normaliza (@ ou link)
--                                antes de gravar e confere de novo ao ler.
--
-- O cartão (`profile_card`) é público — abre sem login, como o perfil. Só
-- entram nele as categorias públicas DE FATO (nível Pública e nenhuma pasta
-- acima fechando), conferido a cada leitura: categoria que deixou de ser
-- pública some do cartão na hora, sem gatilho nenhum. Cada categoria traz os
-- 3 melhores itens: maior nota (empate pelo nome); sem estrelas, os 3
-- primeiros da ordem manual.
--
-- `public_profile` (do 14) passa a trazer o cartão junto.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'categories' and column_name = 'kind'
  ) then
    raise exception 'Rode antes o supabase/17_inbox_category.sql (e os anteriores, o 14 inclusive), depois este.';
  end if;
end;
$$;

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists card_category_ids uuid[] not null default '{}';
alter table public.profiles add column if not exists social_links jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_length_check') then
    alter table public.profiles add constraint profiles_bio_length_check
      check (bio is null or char_length(bio) <= 220);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_card_categories_check') then
    alter table public.profiles add constraint profiles_card_categories_check
      check (cardinality(card_category_ids) <= 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_social_links_check') then
    -- Um objeto, só com as cinco redes, e pequeno.
    alter table public.profiles add constraint profiles_social_links_check
      check (
        jsonb_typeof(social_links) = 'object'
        and (social_links - array['instagram', 'x', 'discord', 'spotify', 'youtube']) = '{}'::jsonb
        and length(social_links::text) <= 2000
      );
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- O cartão de um perfil. `null` = ninguém com esse @ (ou há bloqueio entre
-- quem pergunta e o dono — aí o perfil inteiro some, como no resto do app).
-- ---------------------------------------------------------------------
create or replace function public.profile_card(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_profile public.profiles%rowtype;
  v_viewer uuid := (select auth.uid());
begin
  select * into v_profile
    from public.profiles p
   where p.username = lower(btrim(p_username));
  if not found then
    return null;
  end if;

  if v_viewer is not null and v_viewer <> v_profile.id
     and public.is_blocked(v_viewer, v_profile.id) then
    return null;
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'username', v_profile.username,
      'display_name', v_profile.display_name,
      'avatar_url', v_profile.avatar_url
    ),
    'bio', v_profile.bio,
    'social_links', coalesce(v_profile.social_links, '{}'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'name', c.name,
               'icon', c.icon,
               'color', c.color,
               'rating_enabled', c.rating_enabled,
               'total', (select count(*) from public.entries e where e.category_id = c.id),
               'top', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', t.id,
                          'name', t.name,
                          'rating', t.rating,
                          'image_url', t.image_url
                        ) order by t.rank)
                   from (
                     select e.id, e.name, e.rating, e.image_url,
                            row_number() over (
                              order by
                                -- Com estrelas: a maior nota primeiro (sem nota, por último).
                                case when c.rating_enabled then e.rating end desc nulls last,
                                -- Sem estrelas: a ordem manual (a raiz antes das subpastas).
                                case when c.rating_enabled then 0 else (e.folder_id is not null)::int end,
                                case when c.rating_enabled then 0 else e.display_order end,
                                lower(e.name)
                            ) as rank
                       from public.entries e
                      where e.category_id = c.id
                   ) t
                  where t.rank <= 3
               ), '[]'::jsonb)
             ) order by pick.ord)
        from (
          -- A ordem escolhida (repetida, vale a primeira vez).
          select u.id, min(u.ord) as ord
            from unnest(v_profile.card_category_ids) with ordinality as u(id, ord)
           group by u.id
        ) pick
        join public.categories c on c.id = pick.id
       where c.owner_id = v_profile.id
         and c.kind <> 'inbox'
         and public.visibility_allows(c.owner_id, c.visibility, null)
         and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null))
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.profile_card(text) from public;
grant execute on function public.profile_card(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- `public_profile` (do 14), agora com o cartão. Igual ao do 14 fora a
-- chave `card`.
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
    'card', public.profile_card(v_profile.username),
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

revoke execute on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;
