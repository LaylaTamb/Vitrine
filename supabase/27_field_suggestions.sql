-- =====================================================================
-- Vitrine v2 — sugestões de campos ("Campos usados em categorias como essa")
-- Rode no SQL Editor do Supabase, depois de 01 a 26 (o 25 é obrigatório:
-- este arquivo usa `normalize_category_name`; o 24 também, para gravar o
-- cache da IA com o segredo do servidor).
--
-- Aditivo e seguro: duas tabelas novas, vazias, e funções. Pode rodar mais
-- de uma vez.
--
-- Duas fontes, nesta ordem (só ao CRIAR uma categoria):
--   A) `field_suggestions(nome)` — os campos das categorias PÚBLICAS de outras
--      pessoas com nome parecido (o mesmo nome normalizado, ou ele no começo
--      ou no fim: "Filmes" acha "Filmes de terror"). Conta DONOS DISTINTOS por
--      (nome do campo normalizado, tipo) e só devolve o que pelo menos 3
--      pessoas usam — ninguém é exposto sozinho. Vem com as opções mais
--      comuns (listas) e a moeda mais usada.
--   B) Sem nada em A, o app pode pedir à IA (Google Gemini, plano gratuito),
--      mandando SÓ o nome da categoria:
--        field_suggestion_cache — a resposta por nome normalizado (o mesmo
--          nome não gasta outra chamada); só o servidor grava, com o segredo
--          do servidor (o mesmo CRON_SECRET da migração 24);
--        ai_suggestion_usage — quantas vezes cada pessoa pediu hoje: no
--          máximo 10 por dia (`take_ai_suggestion_quota`).
-- =====================================================================

do $$
begin
  if to_regprocedure('public.normalize_category_name(text)') is null then
    raise exception 'Rode antes o supabase/25_templates_and_explore.sql (e os anteriores), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) Fonte A: o que outras pessoas usam
-- Devolve [{"nome", "tipo", "opcoes"?, "moeda"?, "owners"}], do mais usado
-- para o menos, até 12.
-- ---------------------------------------------------------------------
create or replace function public.field_suggestions(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_name text := public.normalize_category_name(left(coalesce(p_name, ''), 80));
begin
  if v_viewer is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;
  if length(v_name) < 3 then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with categories_like as (
      select c.owner_id, c.estrutura
        from public.categories c
       where c.owner_id <> v_viewer
         and c.kind <> 'inbox'
         and jsonb_typeof(c.estrutura) = 'array'
         and public.visibility_allows(c.owner_id, c.visibility, null)
         and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null))
         and not public.is_blocked(v_viewer, c.owner_id)
         and (
           public.normalize_category_name(c.name) = v_name
           or public.normalize_category_name(c.name) like v_name || ' %'
           or public.normalize_category_name(c.name) like '% ' || v_name
         )
    ),
    fields as (
      select cl.owner_id,
             btrim(f->>'nome') as nome,
             f->>'tipo' as tipo,
             f->'opcoes' as opcoes,
             f->>'moeda' as moeda,
             public.normalize_category_name(f->>'nome') as field_key
        from categories_like cl
        cross join lateral jsonb_array_elements(cl.estrutura) f
       where jsonb_typeof(f) = 'object'
         and f->>'tipo' in ('star', 'date', 'str', 'int', 'decimal', 'time', 'currency', 'select', 'location')
         and coalesce(btrim(f->>'nome'), '') <> ''
         and length(f->>'nome') <= 60
    ),
    grouped as (
      select field_key,
             tipo,
             count(distinct owner_id)::int as owners,
             mode() within group (order by nome) as nome,
             mode() within group (order by moeda) filter (where moeda is not null) as moeda
        from fields
       where field_key <> ''
       group by field_key, tipo
      having count(distinct owner_id) >= 3
    )
    select jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'nome', g.nome,
               'tipo', g.tipo,
               'owners', g.owners,
               'moeda', case when g.tipo = 'currency' then g.moeda end,
               'opcoes', case when g.tipo = 'select' then (
                 select jsonb_agg(o.option order by o.users desc, o.option)
                   from (
                     select opt.value as option, count(distinct fl.owner_id) as users
                       from fields fl
                       cross join lateral jsonb_array_elements_text(
                         case when jsonb_typeof(fl.opcoes) = 'array' then fl.opcoes else '[]'::jsonb end
                       ) opt
                      where fl.field_key = g.field_key and fl.tipo = 'select'
                        and length(opt.value) between 1 and 40
                      group by opt.value
                      order by users desc, opt.value
                      limit 10
                   ) o
               ) end
             ))
             order by g.owners desc, g.nome
           )
      from (select * from grouped order by owners desc, nome limit 12) g
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.field_suggestions(text) from public, anon;
grant execute on function public.field_suggestions(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Fonte B: o cache da IA e o limite diário
-- ---------------------------------------------------------------------
create table if not exists public.field_suggestion_cache (
  normalized_name text primary key,
  fields          jsonb not null,
  source          text not null default 'ai',
  created_at      timestamptz not null default now(),
  constraint field_suggestion_cache_source_check check (source in ('ai')),
  constraint field_suggestion_cache_fields_check
    check (jsonb_typeof(fields) = 'array' and length(fields::text) <= 8000)
);

create table if not exists public.ai_suggestion_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  count   int not null default 0,
  primary key (user_id, day)
);

-- Só as funções abaixo mexem (RLS ligada, sem política).
alter table public.field_suggestion_cache enable row level security;
alter table public.ai_suggestion_usage enable row level security;
revoke all on table public.field_suggestion_cache from anon, authenticated;
revoke all on table public.ai_suggestion_usage from anon, authenticated;

-- A resposta guardada para este nome (ou null).
create or replace function public.cached_field_suggestions(p_name text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select c.fields
    from public.field_suggestion_cache c
   where c.normalized_name = public.normalize_category_name(left(coalesce(p_name, ''), 80))
     and (select auth.uid()) is not null;
$$;

revoke execute on function public.cached_field_suggestions(text) from public, anon;
grant execute on function public.cached_field_suggestions(text) to authenticated;

-- Grava a resposta da IA. Só o servidor (com o segredo da migração 24):
-- senão qualquer pessoa poderia plantar sugestões para os outros.
create or replace function public.store_field_suggestions(p_secret text, p_name text, p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := public.normalize_category_name(left(coalesce(p_name, ''), 80));
begin
  if to_regprocedure('public.server_secret_ok(text)') is null
     or not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;
  if length(v_name) < 3 or jsonb_typeof(p_fields) is distinct from 'array' then
    return;
  end if;
  insert into public.field_suggestion_cache (normalized_name, fields)
  values (v_name, p_fields)
  on conflict (normalized_name) do update
    set fields = excluded.fields, created_at = now();
end;
$$;

revoke execute on function public.store_field_suggestions(text, text, jsonb) from public;
grant execute on function public.store_field_suggestions(text, text, jsonb) to anon, authenticated;

-- Gasta uma das 10 pedidas do dia (no fuso de Brasília). `false` = acabou.
create or replace function public.take_ai_suggestion_quota()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_count int;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  -- Faxina: os dias que já passaram não servem para nada.
  delete from public.ai_suggestion_usage where user_id = v_me and day < v_day;

  insert into public.ai_suggestion_usage (user_id, day, count)
  values (v_me, v_day, 1)
  on conflict (user_id, day) do update
    set count = public.ai_suggestion_usage.count + 1
    where public.ai_suggestion_usage.count < 10
  returning count into v_count;

  return v_count is not null;
end;
$$;

revoke execute on function public.take_ai_suggestion_quota() from public, anon;
grant execute on function public.take_ai_suggestion_quota() to authenticated;
