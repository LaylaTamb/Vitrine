-- =====================================================================
-- Vitrine v2 — Steam: gênero, desenvolvedora, ano e conquistas
-- Rode no SQL Editor do Supabase, depois de 01 a 41 (o 24 é obrigatório:
-- é ele que liga a Steam e cria o segredo do servidor).
--
-- Aditivo e seguro: só duas funções novas. Pode rodar mais de uma vez.
--
--   steam_details_todo(segredo, pessoa, quantos) — os jogos da categoria da
--     Steam que ainda não receberam os detalhes (os mais jogados primeiro).
--     O servidor do app busca esses na loja da Steam, aos poucos.
--
--   steam_apply_details(segredo, pessoa, detalhes) — grava os detalhes:
--     Gênero, Desenvolvedora e Ano de lançamento só onde ainda estão vazios
--     (o que a pessoa escreveu fica); Conquistas ("23 de 50") sempre, porque
--     muda conforme ela joga. Na primeira vez, acrescenta esses quatro campos
--     à categoria — se depois ela apagar algum, ele não volta.
--     `detalhes`: [{"appid": "620", "genero": "Ação, Aventura",
--                   "desenvolvedora": "Valve", "ano": 2011,
--                   "conquistas": "23 de 51"}] (chaves ausentes = não sabe).
--
-- Como as outras funções da Steam, abrem só com o segredo do servidor
-- (`server_secret_ok`): a rodada diária roda sem sessão.
--
-- Sem ele o app funciona igual: os jogos só não ganham os campos novos.
-- =====================================================================

do $$
begin
  if to_regclass('public.connected_accounts') is null
     or to_regprocedure('public.server_secret_ok(text)') is null then
    raise exception 'Rode antes os arquivos de 01 a 41 (o 24 inclusive), depois este.';
  end if;
end;
$$;

create or replace function public.steam_details_todo(
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
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;

  select a.category_id into v_category
    from public.connected_accounts a
   where a.user_id = p_user and a.provider = 'steam';
  if v_category is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(todo.source_id)
      from (
        select e.source_id
          from public.entries e
         where e.owner_id = p_user
           and e.category_id = v_category
           and e.source = 'steam'
           and not (e.custom_fields ? 'steam_info')
         order by (case when jsonb_typeof(e.custom_fields->'horas') = 'number'
                        then (e.custom_fields->>'horas')::numeric end) desc nulls last,
                  e.name
         limit least(greatest(coalesce(p_limit, 25), 1), 50)
      ) todo
  ), '[]'::jsonb);
end;
$$;

create or replace function public.steam_apply_details(
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
  v_updated int := 0;
  v_fields jsonb := '[
    {"id": "genero", "nome": "Gênero", "tipo": "str"},
    {"id": "desenvolvedora", "nome": "Desenvolvedora", "tipo": "str"},
    {"id": "ano", "nome": "Ano de lançamento", "tipo": "int"},
    {"id": "conquistas", "nome": "Conquistas", "tipo": "str"}
  ]'::jsonb;
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_details) is distinct from 'array' or jsonb_array_length(p_details) > 200 then
    raise exception 'Lista de detalhes inválida.' using errcode = '22023';
  end if;

  select a.category_id into v_category
    from public.connected_accounts a
   where a.user_id = p_user and a.provider = 'steam';
  if v_category is null
     or not exists (select 1 from public.categories c where c.id = v_category and c.owner_id = p_user) then
    return jsonb_build_object('status', 'not_connected');
  end if;

  -- Primeira vez (nenhum jogo com detalhes ainda): os campos entram na
  -- categoria, no fim, sem repetir os que ela já tem.
  if not exists (
    select 1 from public.entries e
     where e.owner_id = p_user and e.category_id = v_category
       and e.source = 'steam' and e.custom_fields ? 'steam_info'
  ) then
    update public.categories c
       set estrutura = c.estrutura || coalesce((
             select jsonb_agg(field)
               from jsonb_array_elements(v_fields) field
              where not exists (
                select 1 from jsonb_array_elements(c.estrutura) existing
                 where existing->>'id' = field->>'id'
              )
           ), '[]'::jsonb)
     where c.id = v_category;
  end if;

  with details as (
    select d->>'appid' as appid,
           nullif(left(btrim(d->>'genero'), 200), '') as genero,
           nullif(left(btrim(d->>'desenvolvedora'), 200), '') as desenvolvedora,
           case when (d->>'ano') ~ '^(19|20)[0-9]{2}$' then (d->>'ano')::int end as ano,
           nullif(left(btrim(d->>'conquistas'), 40), '') as conquistas
      from jsonb_array_elements(p_details) d
     where (d->>'appid') ~ '^[0-9]{1,10}$'
  ),
  changed as (
    update public.entries e
       set custom_fields = e.custom_fields
             || jsonb_strip_nulls(jsonb_build_object(
                  'genero', case when e.custom_fields ? 'genero' then null else d.genero end,
                  'desenvolvedora', case when e.custom_fields ? 'desenvolvedora' then null else d.desenvolvedora end,
                  'ano', case when e.custom_fields ? 'ano' then null else d.ano end,
                  'conquistas', d.conquistas
                ))
             || jsonb_build_object('steam_info', to_char(now(), 'YYYY-MM-DD'))
      from details d
     where e.owner_id = p_user
       and e.category_id = v_category
       and e.source = 'steam'
       and e.source_id = d.appid
    returning 1
  )
  select count(*) into v_updated from changed;

  return jsonb_build_object('status', 'ok', 'updated', v_updated);
end;
$$;

-- O segredo é a tranca; quem chama é o servidor do app (com ou sem sessão).
revoke execute on function public.steam_details_todo(text, uuid, int) from public;
revoke execute on function public.steam_apply_details(text, uuid, jsonb) from public;
grant execute on function public.steam_details_todo(text, uuid, int) to anon, authenticated;
grant execute on function public.steam_apply_details(text, uuid, jsonb) to anon, authenticated;
