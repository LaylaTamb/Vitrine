-- =====================================================================
-- Vitrine v2 — Steam: a sincronização acha a categoria onde os jogos estão
-- Rode no SQL Editor do Supabase, depois de 01 a 46 (o 24 é obrigatório:
-- este arquivo refaz a `steam_apply` dele).
--
-- Aditivo e seguro: só refaz uma função. Pode rodar mais de uma vez.
--
-- O problema: a `steam_apply` só sabia qual é a categoria dos jogos pelo
-- `connected_accounts.category_id`. Esse vínculo some quando a categoria vai
-- para a Lixeira (o "on delete set null" do 24) ou quando a conta é
-- desconectada e conectada de novo (a linha é apagada e volta sem ele). Sem o
-- vínculo, a sincronização criava outra pasta "Steam" com uma "Jogos da
-- Steam" — vazia, porque os jogos que já existem continuam onde a pessoa os
-- deixou (e param de ter as horas atualizadas). Apagar essa pasta vazia
-- apagava o vínculo de novo, e no dia seguinte ela voltava.
--
-- Agora, se a categoria ligada não existe mais ou não tem nenhum jogo da
-- Steam, a sincronização usa a categoria que tem MAIS jogos da Steam da
-- pessoa (onde quer que esteja: movida, renomeada, em outra pasta) e se liga
-- a ela de novo. Só cria a pasta "Steam" e a categoria quando a pessoa ainda
-- não tem jogo nenhum da Steam. O resto é igual ao 24.
-- =====================================================================

do $$
begin
  if to_regclass('public.connected_accounts') is null
     or to_regprocedure('public.steam_apply(text, uuid, jsonb, text)') is null then
    raise exception 'Rode antes os arquivos de 01 a 46 (o 24 inclusive), depois este.';
  end if;
end;
$$;

create or replace function public.steam_apply(
  p_secret text,
  p_user uuid,
  p_games jsonb,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.connected_accounts%rowtype;
  v_category uuid;
  v_home uuid;
  v_folder uuid;
  v_name text := 'Jogos';
  v_try int := 1;
  v_created int := 0;
  v_updated int := 0;
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_games) is distinct from 'array' or jsonb_array_length(p_games) > 20000 then
    raise exception 'Lista de jogos inválida.' using errcode = '22023';
  end if;

  select * into v_account
    from public.connected_accounts a
   where a.user_id = p_user and a.provider = 'steam'
     for update;
  if not found then
    return jsonb_build_object('status', 'not_connected');
  end if;

  -- A categoria ligada ainda existe? (A pessoa pode ter apagado.)
  select c.id into v_category
    from public.categories c
   where c.id = v_account.category_id and c.owner_id = p_user and c.kind = 'normal';

  -- Sem ela, ou com ela sem nenhum jogo da Steam: a categoria onde estão os
  -- jogos da pessoa (a que tem mais), onde quer que ela esteja agora.
  if v_category is null
     or not exists (
       select 1 from public.entries e
        where e.category_id = v_category and e.owner_id = p_user and e.source = 'steam'
     ) then
    select e.category_id into v_home
      from public.entries e
      join public.categories c on c.id = e.category_id
     where e.owner_id = p_user and e.source = 'steam' and c.kind = 'normal'
     group by e.category_id
     order by count(*) desc, min(e.created_at)
     limit 1;
    v_category := coalesce(v_home, v_category);
  end if;

  -- Ainda nenhum jogo da Steam: cria a pasta "Steam" e a categoria.
  if v_category is null then
    select f.id into v_folder
      from public.folders f
     where f.owner_id = p_user and f.parent_folder_id is null and lower(f.name) = 'steam'
     order by f.created_at
     limit 1;
    if v_folder is null then
      insert into public.folders (owner_id, name, display_order)
      values (
        p_user,
        'Steam',
        coalesce((select max(f.display_order) + 1 from public.folders f
                   where f.owner_id = p_user and f.parent_folder_id is null), 0)
      )
      returning id into v_folder;
    end if;

    -- O nome é único por dono: "Jogos", senão "Jogos da Steam", "Jogos da Steam 2"…
    while exists (select 1 from public.categories c where c.owner_id = p_user and c.name = v_name) loop
      v_try := v_try + 1;
      v_name := case when v_try = 2 then 'Jogos da Steam' else 'Jogos da Steam ' || (v_try - 1) end;
    end loop;

    -- A visibilidade fica com o padrão do perfil (gatilho do 14).
    insert into public.categories (owner_id, name, icon, folder_id, display_order, estrutura, rating_enabled)
    values (
      p_user,
      v_name,
      '🎮',
      v_folder,
      coalesce((select max(c.display_order) + 1 from public.categories c
                 where c.owner_id = p_user and c.folder_id = v_folder), 0),
      '[{"id": "horas", "nome": "Horas jogadas", "tipo": "time"}]'::jsonb,
      true
    )
    returning id into v_category;
  end if;

  with games as (
    select distinct on (appid) appid, name, minutes
      from (
        select (g->>'appid')::bigint as appid,
               left(btrim(g->>'name'), 200) as name,
               greatest(0, least(coalesce((g->>'minutes')::numeric, 0), 100000000))::int as minutes
          from jsonb_array_elements(p_games) g
         where (g->>'appid') ~ '^[0-9]{1,10}$'
           and coalesce(btrim(g->>'name'), '') <> ''
           and coalesce(g->>'minutes', '0') ~ '^[0-9]{1,12}$'
      ) parsed
     order by appid
  ),
  base as (
    select coalesce(max(e.display_order), -1) as top
      from public.entries e
     where e.category_id = v_category and e.folder_id is null
  ),
  upserted as (
    insert into public.entries as e
      (category_id, owner_id, name, image_url, custom_fields, source, source_id, display_order)
    select v_category,
           p_user,
           g.name,
           'https://cdn.cloudflare.steamstatic.com/steam/apps/' || g.appid || '/header.jpg',
           jsonb_build_object('horas', g.minutes),
           'steam',
           g.appid::text,
           base.top + row_number() over (order by g.minutes desc, g.name)
      from games g cross join base
    on conflict (owner_id, source, source_id) do update
       set custom_fields = jsonb_set(e.custom_fields, '{horas}', excluded.custom_fields->'horas')
     where e.category_id = v_category
       and e.custom_fields->'horas' is distinct from excluded.custom_fields->'horas'
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into v_created, v_updated
    from upserted;

  update public.connected_accounts
     set category_id     = v_category,
         last_synced_at  = now(),
         last_attempt_at = now(),
         last_error      = null,
         display_name    = coalesce(left(nullif(btrim(p_display_name), ''), 100), display_name)
   where user_id = p_user and provider = 'steam';

  return jsonb_build_object(
    'status', 'ok',
    'category_id', v_category,
    'created', v_created,
    'updated', v_updated
  );
end;
$$;

-- O mesmo acesso do 24 (o servidor do app chama sem sessão, com o segredo).
grant execute on function public.steam_apply(text, uuid, jsonb, text) to anon, authenticated;
