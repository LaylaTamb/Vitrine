-- =====================================================================
-- Vitrine v2 — Banner do perfil
-- Rode no SQL Editor do Supabase, depois de 01 a 35 (o 23 é obrigatório:
-- este arquivo refaz o `profile_card` dele).
--
-- Aditivo e seguro: duas colunas novas (vazias) e a mesma função com o
-- banner junto. Pode rodar mais de uma vez.
--
--   profiles.banner_url — o link da imagem (só o endereço: nada é enviado
--     nem guardado aqui, como a foto e as imagens dos itens);
--   profiles.banner_position — que parte da imagem aparece na faixa (0 =
--     topo, 50 = meio, 100 = pé), como o "ajustar" do Twitter.
--   profile_card — devolve também `banner` ({ url, position }), e por ele o
--     `public_profile` (que usa o `profile_card`). Todo mundo vê, com ou sem
--     login, como o resto do cartão.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.profile_card(text)') is null then
    raise exception 'Rode antes os arquivos de 01 a 35 (o 23 inclusive), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) As colunas
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists banner_position smallint not null default 50;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_banner_url_check') then
    alter table public.profiles add constraint profiles_banner_url_check
      check (banner_url is null or (banner_url ~* '^https?://' and length(banner_url) <= 2048));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_banner_position_check') then
    alter table public.profiles add constraint profiles_banner_position_check
      check (banner_position between 0 and 100);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) O cartão, agora com o banner (igual ao do 23 fora a chave `banner`)
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
    -- O banner (migração 36): o link e a posição (0 = topo da imagem, 100 = pé).
    'banner', case
                when v_profile.banner_url is not null then jsonb_build_object(
                  'url', v_profile.banner_url,
                  'position', coalesce(v_profile.banner_position, 50)
                )
              end,
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
