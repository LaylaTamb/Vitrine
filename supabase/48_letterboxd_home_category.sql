-- =====================================================================
-- Vitrine v2 — Letterboxd: a sincronização acha a categoria dos filmes
-- Rode no SQL Editor do Supabase, depois de 01 a 47 (o 39 é obrigatório:
-- este arquivo refaz a `letterboxd_apply` dele).
--
-- Aditivo e seguro: só refaz uma função. Pode rodar mais de uma vez.
--
-- O mesmo conserto do 47 (Steam). A `letterboxd_apply` só sabia qual é a
-- categoria dos filmes pelo `connected_accounts.category_id`, e esse vínculo
-- some quando a categoria vai para a Lixeira — e não volta quando ela é
-- restaurada (o 37 só refaz o da Steam). Sem o vínculo, a sincronização
-- criava outra pasta "Letterboxd" com "Filmes do Letterboxd", e os filmes que
-- já existiam deixavam de ser atualizados. (Desconectar e conectar de novo já
-- religava: a `letterboxd_connect` procura a categoria com mais filmes.)
--
-- Agora, se a categoria ligada não existe mais ou não tem nenhum filme do
-- Letterboxd, a sincronização usa a categoria que tem MAIS filmes do
-- Letterboxd da pessoa (onde quer que esteja) e se liga a ela de novo. Só cria
-- a pasta "Letterboxd" e a categoria quando ainda não há filme nenhum. O resto
-- é igual ao 39.
-- =====================================================================

do $$
begin
  if to_regclass('public.connected_accounts') is null
     or to_regprocedure('public.letterboxd_apply(text, uuid, jsonb, text)') is null then
    raise exception 'Rode antes os arquivos de 01 a 47 (o 39 inclusive), depois este.';
  end if;
end;
$$;

create or replace function public.letterboxd_apply(
  p_secret text,
  p_user uuid,
  p_films jsonb,
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
  v_estrutura jsonb;
  v_rating_enabled boolean;
  v_folder uuid;
  v_name text := 'Filmes';
  v_try int := 1;
  v_year_field text;
  v_date_field text;
  v_review_field text;
  v_top int;
  v_created int := 0;
  v_updated int := 0;
  v_film jsonb;
  v_key text;
  v_title text;
  v_year int;
  v_rating numeric;
  v_watched text;
  v_poster text;
  v_review text;
  v_entry public.entries%rowtype;
  v_fields jsonb;
  v_changed boolean;
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_films) is distinct from 'array' or jsonb_array_length(p_films) > 500 then
    raise exception 'Lista de filmes inválida.' using errcode = '22023';
  end if;

  select * into v_account
    from public.connected_accounts a
   where a.user_id = p_user and a.provider = 'letterboxd'
     for update;
  if not found then
    return jsonb_build_object('status', 'not_connected');
  end if;

  -- A categoria ligada ainda existe? (A pessoa pode ter apagado.)
  select c.id into v_category
    from public.categories c
   where c.id = v_account.category_id and c.owner_id = p_user and c.kind = 'normal';

  -- Sem ela, ou com ela sem nenhum filme do Letterboxd: a categoria onde estão
  -- os filmes da pessoa (a que tem mais), onde quer que ela esteja agora.
  if v_category is null
     or not exists (
       select 1 from public.entries e
        where e.category_id = v_category and e.owner_id = p_user and e.source = 'letterboxd'
     ) then
    select e.category_id into v_home
      from public.entries e
      join public.categories c on c.id = e.category_id
     where e.owner_id = p_user and e.source = 'letterboxd' and c.kind = 'normal'
     group by e.category_id
     order by count(*) desc, min(e.created_at)
     limit 1;
    v_category := coalesce(v_home, v_category);
  end if;

  select c.estrutura, c.rating_enabled into v_estrutura, v_rating_enabled
    from public.categories c
   where c.id = v_category;

  -- Ainda nenhum filme do Letterboxd: cria a pasta "Letterboxd" e a categoria.
  if v_category is null then
    select f.id into v_folder
      from public.folders f
     where f.owner_id = p_user and f.parent_folder_id is null and lower(f.name) = 'letterboxd'
     order by f.created_at
     limit 1;
    if v_folder is null then
      insert into public.folders (owner_id, name, display_order)
      values (
        p_user,
        'Letterboxd',
        coalesce((select max(f.display_order) + 1 from public.folders f
                   where f.owner_id = p_user and f.parent_folder_id is null), 0)
      )
      returning id into v_folder;
    end if;

    -- O nome é único por dono: "Filmes", senão "Filmes do Letterboxd", "Filmes do Letterboxd 2"…
    while exists (select 1 from public.categories c where c.owner_id = p_user and c.name = v_name) loop
      v_try := v_try + 1;
      v_name := case when v_try = 2 then 'Filmes do Letterboxd' else 'Filmes do Letterboxd ' || (v_try - 1) end;
    end loop;

    -- Os mesmos campos da importação do arquivo. A visibilidade fica com o
    -- padrão do perfil (gatilho do 14).
    insert into public.categories (owner_id, name, icon, folder_id, display_order, estrutura, rating_enabled)
    values (
      p_user,
      v_name,
      '🎬',
      v_folder,
      coalesce((select max(c.display_order) + 1 from public.categories c
                 where c.owner_id = p_user and c.folder_id = v_folder), 0),
      '[{"id": "f_ano", "nome": "Ano", "tipo": "int"},
        {"id": "f_assistido", "nome": "Data em que assistiu", "tipo": "date"},
        {"id": "f_resenha", "nome": "Resenha", "tipo": "str"}]'::jsonb,
      true
    )
    returning id, estrutura, rating_enabled into v_category, v_estrutura, v_rating_enabled;
  end if;

  -- Os campos pelo nome: a categoria pode ser uma da pessoa, com outros ids.
  select f->>'id' into v_year_field
    from jsonb_array_elements(coalesce(v_estrutura, '[]'::jsonb)) f
   where lower(f->>'nome') = 'ano' and f->>'tipo' = 'int'
   limit 1;
  select f->>'id' into v_date_field
    from jsonb_array_elements(coalesce(v_estrutura, '[]'::jsonb)) f
   where lower(f->>'nome') = 'data em que assistiu' and f->>'tipo' = 'date'
   limit 1;
  select f->>'id' into v_review_field
    from jsonb_array_elements(coalesce(v_estrutura, '[]'::jsonb)) f
   where lower(f->>'nome') = 'resenha' and f->>'tipo' = 'str'
   limit 1;

  select coalesce(max(e.display_order), -1) into v_top
    from public.entries e
   where e.category_id = v_category and e.folder_id is null;

  for v_film in select value from jsonb_array_elements(p_films) loop
    v_title := left(btrim(coalesce(v_film->>'name', '')), 200);
    v_key := left(btrim(coalesce(v_film->>'key', '')), 200);
    continue when v_title = '' or v_key = '';
    v_year := case when (v_film->>'year') ~ '^[0-9]{4}$' then (v_film->>'year')::int end;
    v_rating := case when (v_film->>'rating') ~ '^[0-5](\.[05])?$'
                     then least(5, (v_film->>'rating')::numeric) end;
    if v_rating = 0 then v_rating := null; end if;
    v_watched := case when (v_film->>'watched') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                      then v_film->>'watched' end;
    v_poster := case when (v_film->>'poster') ~ '^https://[a-z0-9.-]*ltrbxd\.com/'
                     then left(v_film->>'poster', 500) end;
    v_review := nullif(left(btrim(coalesce(v_film->>'review', '')), 5000), '');

    -- Já está aqui? Pela chave; senão pelo nome + ano (o do arquivo tem a
    -- chave do arquivo), entre os do Letterboxd e os desta categoria.
    select * into v_entry
      from public.entries e
     where e.owner_id = p_user and e.source = 'letterboxd' and e.source_id = v_key
     limit 1;
    if not found then
      select * into v_entry
        from public.entries e
       where e.owner_id = p_user
         and (e.source = 'letterboxd' or e.category_id = v_category)
         and lower(btrim(e.name)) = lower(v_title)
         and (v_year is null or v_year_field is null
              or e.custom_fields->>v_year_field is null
              or e.custom_fields->>v_year_field = v_year::text)
       order by (e.category_id = v_category) desc, e.created_at
       limit 1;
    end if;

    if not found then
      v_fields := '{}'::jsonb;
      if v_year_field is not null and v_year is not null then
        v_fields := v_fields || jsonb_build_object(v_year_field, v_year);
      end if;
      if v_date_field is not null and v_watched is not null then
        v_fields := v_fields || jsonb_build_object(v_date_field, v_watched);
      end if;
      if v_review_field is not null and v_review is not null then
        v_fields := v_fields || jsonb_build_object(v_review_field, v_review);
      end if;
      v_top := v_top + 1;
      insert into public.entries
        (category_id, owner_id, name, rating, image_url, custom_fields, source, source_id, display_order)
      values (
        v_category, p_user, v_title,
        case when v_rating_enabled then v_rating end,
        v_poster, v_fields, 'letterboxd', v_key, v_top
      )
      on conflict (owner_id, source, source_id) do nothing;
      if found then
        v_created := v_created + 1;
      end if;
    elsif v_entry.category_id = v_category then
      v_changed := false;
      v_fields := coalesce(v_entry.custom_fields, '{}'::jsonb);
      if v_date_field is not null and v_watched is not null
         and coalesce(v_fields->>v_date_field, '') < v_watched then
        v_fields := jsonb_set(v_fields, array[v_date_field], to_jsonb(v_watched));
        v_changed := true;
      end if;
      if v_year_field is not null and v_year is not null and v_fields->>v_year_field is null then
        v_fields := jsonb_set(v_fields, array[v_year_field], to_jsonb(v_year));
        v_changed := true;
      end if;
      if v_review_field is not null and v_review is not null
         and coalesce(v_fields->>v_review_field, '') = '' then
        v_fields := jsonb_set(v_fields, array[v_review_field], to_jsonb(v_review));
        v_changed := true;
      end if;

      update public.entries e
         set rating = case when v_rating_enabled and v_rating is not null then v_rating else e.rating end,
             image_url = coalesce(e.image_url, v_poster),
             custom_fields = v_fields
       where e.id = v_entry.id
         and (v_changed
              or (v_rating_enabled and v_rating is not null and e.rating is distinct from v_rating)
              or (e.image_url is null and v_poster is not null));
      if found then
        v_updated := v_updated + 1;
      end if;
    end if;
  end loop;

  update public.connected_accounts
     set category_id     = v_category,
         last_synced_at  = now(),
         last_attempt_at = now(),
         last_error      = null,
         display_name    = coalesce(left(nullif(btrim(p_display_name), ''), 100), display_name)
   where user_id = p_user and provider = 'letterboxd';

  return jsonb_build_object(
    'status', 'ok',
    'category_id', v_category,
    'created', v_created,
    'updated', v_updated
  );
end;
$$;

-- O mesmo acesso do 39 (o servidor do app chama, com ou sem sessão, com o segredo).
revoke execute on function public.letterboxd_apply(text, uuid, jsonb, text) from public;
grant execute on function public.letterboxd_apply(text, uuid, jsonb, text) to anon, authenticated;
