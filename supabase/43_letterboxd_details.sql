-- =====================================================================
-- Vitrine v2 — Letterboxd: diretor, gênero, duração, país e sinopse
-- Rode no SQL Editor do Supabase, depois de 01 a 42 (o 39 é obrigatório:
-- é ele que liga o Letterboxd pelo @).
--
-- Aditivo e seguro: só duas funções novas. Pode rodar mais de uma vez.
--
--   letterboxd_details_todo(segredo, pessoa, quantos) — os filmes da
--     categoria do Letterboxd que ainda não receberam os detalhes (os mais
--     novos primeiro): o id do item, o nome e o ano. Vale para os que vieram
--     pelo @ e para os que vieram do arquivo, se estão nessa categoria.
--
--   letterboxd_apply_details(segredo, pessoa, detalhes) — grava o que o
--     servidor do app achou no TMDB: Diretor, Gênero, Duração (minutos), País
--     e Sinopse, só onde ainda estão vazios (o que a pessoa escreveu fica).
--     Os campos são achados pelo nome (a categoria pode ser uma da pessoa, com
--     outros ids); na primeira vez, os que faltam entram no fim da categoria —
--     se depois ela apagar algum, ele não volta. Cada filme fica marcado
--     (`tmdb_info`), achado ou não, para não ser procurado de novo.
--     `detalhes`: [{"id": "<uuid do item>", "tmdb": 550,
--                   "diretor": "David Fincher", "genero": "Drama",
--                   "duracao": 139, "pais": "Estados Unidos",
--                   "sinopse": "…"}] (chaves ausentes = não sabe).
--
-- Como as outras funções das contas conectadas, abrem só com o segredo do
-- servidor (`server_secret_ok`): a rodada diária roda sem sessão.
--
-- Sem ele o app funciona igual: os filmes só não ganham os campos novos.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.letterboxd_apply(text, uuid, jsonb, text)') is null
     or to_regprocedure('public.server_secret_ok(text)') is null then
    raise exception 'Rode antes os arquivos de 01 a 42 (o 39 inclusive), depois este.';
  end if;
end;
$$;

create or replace function public.letterboxd_details_todo(
  p_secret text,
  p_user uuid,
  p_limit int default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category uuid;
  v_year_field text;
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;

  select a.category_id into v_category
    from public.connected_accounts a
   where a.user_id = p_user and a.provider = 'letterboxd';
  if v_category is null then
    return '[]'::jsonb;
  end if;

  -- O campo Ano pelo nome (como no letterboxd_apply).
  select f->>'id' into v_year_field
    from public.categories c,
         jsonb_array_elements(coalesce(c.estrutura, '[]'::jsonb)) f
   where c.id = v_category and lower(f->>'nome') = 'ano' and f->>'tipo' = 'int'
   limit 1;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', todo.id, 'name', todo.name, 'year', todo.year))
      from (
        select e.id,
               e.name,
               case when v_year_field is not null
                         and (e.custom_fields->>v_year_field) ~ '^[0-9]{4}$'
                    then (e.custom_fields->>v_year_field)::int end as year
          from public.entries e
         where e.owner_id = p_user
           and e.category_id = v_category
           and not (e.custom_fields ? 'tmdb_info')
         order by e.created_at desc
         limit least(greatest(coalesce(p_limit, 25), 1), 50)
      ) todo
  ), '[]'::jsonb);
end;
$$;

create or replace function public.letterboxd_apply_details(
  p_secret text,
  p_user uuid,
  p_details jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category uuid;
  v_estrutura jsonb;
  v_first boolean;
  v_specs jsonb := '[
    {"key": "diretor", "id": "f_diretor", "nome": "Diretor", "tipo": "str"},
    {"key": "genero", "id": "f_genero", "nome": "Gênero", "tipo": "str"},
    {"key": "duracao", "id": "f_duracao", "nome": "Duração", "tipo": "time"},
    {"key": "pais", "id": "f_pais", "nome": "País", "tipo": "str"},
    {"key": "sinopse", "id": "f_sinopse", "nome": "Sinopse", "tipo": "str"}
  ]'::jsonb;
  v_spec jsonb;
  v_field text;
  v_map jsonb := '{}'::jsonb;
  v_added jsonb := '[]'::jsonb;
  v_detail jsonb;
  v_entry public.entries%rowtype;
  v_fields jsonb;
  v_value jsonb;
  v_updated int := 0;
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_details) is distinct from 'array' or jsonb_array_length(p_details) > 200 then
    raise exception 'Lista de detalhes inválida.' using errcode = '22023';
  end if;

  select c.id, c.estrutura into v_category, v_estrutura
    from public.connected_accounts a
    join public.categories c on c.id = a.category_id and c.owner_id = p_user
   where a.user_id = p_user and a.provider = 'letterboxd';
  if v_category is null then
    return jsonb_build_object('status', 'not_connected');
  end if;

  -- Primeira vez = nenhum filme da categoria marcado ainda.
  v_first := not exists (
    select 1 from public.entries e
     where e.owner_id = p_user and e.category_id = v_category and e.custom_fields ? 'tmdb_info'
  );

  -- Cada dado vai para o campo de mesmo nome que a categoria já tem; senão,
  -- na primeira vez, para um campo novo.
  for v_spec in select value from jsonb_array_elements(v_specs) loop
    select f->>'id' into v_field
      from jsonb_array_elements(coalesce(v_estrutura, '[]'::jsonb)) f
     where lower(f->>'nome') = lower(v_spec->>'nome')
       and f->>'tipo' = v_spec->>'tipo'
     limit 1;
    if v_field is null and v_first then
      v_field := v_spec->>'id';
      -- O id novo não pode bater com um campo que já existe (com outro nome).
      if exists (select 1 from jsonb_array_elements(coalesce(v_estrutura, '[]'::jsonb)) f
                  where f->>'id' = v_field) then
        v_field := null;
      else
        v_added := v_added || jsonb_build_array(jsonb_build_object(
          'id', v_field, 'nome', v_spec->>'nome', 'tipo', v_spec->>'tipo'));
      end if;
    end if;
    if v_field is not null then
      v_map := v_map || jsonb_build_object(v_spec->>'key', v_field);
    end if;
  end loop;

  if jsonb_array_length(v_added) > 0 then
    update public.categories c
       set estrutura = coalesce(c.estrutura, '[]'::jsonb) || v_added
     where c.id = v_category;
  end if;

  for v_detail in select value from jsonb_array_elements(p_details) loop
    continue when coalesce(v_detail->>'id', '') !~ '^[0-9a-f-]{36}$';
    select * into v_entry
      from public.entries e
     where e.id = (v_detail->>'id')::uuid and e.owner_id = p_user and e.category_id = v_category;
    continue when not found;

    v_fields := coalesce(v_entry.custom_fields, '{}'::jsonb);
    for v_spec in select value from jsonb_array_elements(v_specs) loop
      v_field := v_map->>(v_spec->>'key');
      continue when v_field is null;
      continue when coalesce(v_fields->>v_field, '') <> '';
      v_value := case
        when v_spec->>'key' = 'duracao' then
          case when (v_detail->>'duracao') ~ '^[0-9]{1,4}$' and (v_detail->>'duracao')::int > 0
               then to_jsonb((v_detail->>'duracao')::int) end
        when v_spec->>'key' = 'sinopse' then
          to_jsonb(nullif(left(btrim(coalesce(v_detail->>'sinopse', '')), 3000), ''))
        else
          to_jsonb(nullif(left(btrim(coalesce(v_detail->>(v_spec->>'key'), '')), 300), ''))
      end;
      if v_value is not null then
        v_fields := v_fields || jsonb_build_object(v_field, v_value);
      end if;
    end loop;
    v_fields := v_fields || jsonb_build_object(
      'tmdb_info',
      case when (v_detail->>'tmdb') ~ '^[0-9]{1,10}$' then v_detail->>'tmdb' else 'nao-achou' end
    );

    update public.entries e set custom_fields = v_fields where e.id = v_entry.id;
    v_updated := v_updated + 1;
  end loop;

  return jsonb_build_object('status', 'ok', 'updated', v_updated);
end;
$$;

-- O segredo é a tranca; quem chama é o servidor do app (com ou sem sessão).
revoke execute on function public.letterboxd_details_todo(text, uuid, int) from public;
revoke execute on function public.letterboxd_apply_details(text, uuid, jsonb) from public;
grant execute on function public.letterboxd_details_todo(text, uuid, int) to anon, authenticated;
grant execute on function public.letterboxd_apply_details(text, uuid, jsonb) to anon, authenticated;
