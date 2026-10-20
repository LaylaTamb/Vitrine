-- =====================================================================
-- Vitrine v2 — aplicativos conectados (a Steam, por enquanto)
-- Rode no SQL Editor do Supabase, depois de 01 a 23 (o 14 e o 17 são
-- obrigatórios: este arquivo cria pasta e categoria do jeito deles).
--
-- Aditivo e seguro: duas tabelas novas, duas colunas novas (vazias) em
-- `entries` e funções. Pode rodar mais de uma vez.
--
--   connected_accounts — a conta de fora ligada a cada perfil:
--     provider       — 'steam' (os próximos entram na lista do check);
--     external_id    — o SteamID64, provado pelo login da Steam (OpenID);
--     category_id    — a categoria que a sincronização mantém ("Jogos");
--     last_synced_at — a última sincronização que deu certo;
--     last_attempt_at— a última tentativa (deu certo ou não);
--     last_error     — o motivo da última falha (ex.: perfil privado).
--   entries.source + entries.source_id — de onde o item veio ('steam' +
--     appid). Únicos por dono: sincronizar de novo atualiza em vez de
--     duplicar. As importações da Fase 4 usam o mesmo par.
--
-- Quem grava a conta e os jogos é o SERVIDOR do app, por funções que só
-- abrem com o segredo do servidor (o mesmo CRON_SECRET da rota diária) —
-- assim o app não precisa da chave secreta do Supabase, que ignora toda a
-- RLS. A pessoa só lê a própria conexão e pode apagá-la (desconectar). Ela
-- não consegue gravar uma conta Steam que não provou ser dela.
--
-- ⚠️ DEPOIS DE RODAR, grave o segredo do servidor (uma vez; para trocar,
-- rode de novo com o novo valor). Use o MESMO valor da variável CRON_SECRET
-- da Vercel (no mínimo 32 caracteres; gere com `openssl rand -hex 32`):
--
--   insert into public.app_secrets (name, secret_hash)
--   values ('cron', encode(sha256(convert_to('COLE_AQUI_O_CRON_SECRET', 'UTF8')), 'hex'))
--   on conflict (name) do update
--     set secret_hash = excluded.secret_hash, updated_at = now();
--
-- O banco guarda só o hash: quem lê a tabela não descobre o segredo.
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

-- ---------------------------------------------------------------------
-- 1) O segredo do servidor (só o hash; ninguém lê pela API)
-- ---------------------------------------------------------------------
create table if not exists public.app_secrets (
  name        text primary key,
  secret_hash text not null,
  updated_at  timestamptz not null default now(),
  constraint app_secrets_hash_check check (secret_hash ~ '^[0-9a-f]{64}$')
);

alter table public.app_secrets enable row level security;
revoke all on table public.app_secrets from anon, authenticated;

-- Confere o segredo do servidor. Interna: só as funções abaixo chamam.
create or replace function public.server_secret_ok(p_secret text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(length(p_secret) >= 32, false)
     and exists (
       select 1 from public.app_secrets s
        where s.name = 'cron'
          and s.secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
     );
$$;

revoke execute on function public.server_secret_ok(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Contas conectadas
-- ---------------------------------------------------------------------
create table if not exists public.connected_accounts (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  provider        text not null,
  external_id     text not null,
  display_name    text,
  category_id     uuid references public.categories(id) on delete set null,
  connected_at    timestamptz not null default now(),
  last_synced_at  timestamptz,
  last_attempt_at timestamptz,
  last_error      text,
  primary key (user_id, provider),
  constraint connected_accounts_provider_check check (provider in ('steam')),
  constraint connected_accounts_external_check check (external_id ~ '^[0-9]{17}$'),
  -- Uma conta Steam liga a um perfil só.
  constraint connected_accounts_external_key unique (provider, external_id)
);

create index if not exists connected_accounts_attempt_idx
  on public.connected_accounts (provider, last_attempt_at nulls first);

alter table public.connected_accounts enable row level security;

drop policy if exists "connected_accounts: dono lê" on public.connected_accounts;
create policy "connected_accounts: dono lê"
  on public.connected_accounts for select to authenticated
  using (user_id = (select auth.uid()));

-- Desconectar: a pessoa apaga a linha. A categoria e os jogos ficam.
drop policy if exists "connected_accounts: dono desconecta" on public.connected_accounts;
create policy "connected_accounts: dono desconecta"
  on public.connected_accounts for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.connected_accounts from anon;
revoke insert, update on table public.connected_accounts from authenticated;

-- ---------------------------------------------------------------------
-- 3) De onde veio cada item
-- ---------------------------------------------------------------------
alter table public.entries add column if not exists source text;
alter table public.entries add column if not exists source_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entries_source_check') then
    alter table public.entries add constraint entries_source_check
      check (
        (source is null) = (source_id is null)
        and (source is null or source ~ '^[a-z0-9_]{1,30}$')
        and (source_id is null or length(source_id) <= 200)
      );
  end if;
end;
$$;

-- Item sem origem (o normal) tem source nulo: não entra no único.
create unique index if not exists entries_source_key
  on public.entries (owner_id, source, source_id);

-- ---------------------------------------------------------------------
-- 4) Funções do servidor (abrem só com o segredo)
-- ---------------------------------------------------------------------

-- Liga a conta Steam (já provada pelo OpenID da Steam) ao perfil.
-- Devolve {"status": "ok" | "taken"} — "taken" = ligada a outro perfil.
create or replace function public.steam_connect(
  p_secret text,
  p_user uuid,
  p_steam_id text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;
  if coalesce(p_steam_id, '') !~ '^[0-9]{17}$' then
    raise exception 'SteamID inválido.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.connected_accounts a
     where a.provider = 'steam' and a.external_id = p_steam_id and a.user_id <> p_user
  ) then
    return jsonb_build_object('status', 'taken');
  end if;

  insert into public.connected_accounts (user_id, provider, external_id, display_name)
  values (p_user, 'steam', p_steam_id, left(nullif(btrim(p_display_name), ''), 100))
  on conflict (user_id, provider) do update
    set external_id  = excluded.external_id,
        display_name = excluded.display_name,
        connected_at = now(),
        last_error   = null;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- Grava os jogos: cria (se preciso) a pasta "Steam" e a categoria "Jogos"
-- com o campo Horas jogadas, insere os jogos novos e atualiza as horas dos
-- que já estão lá — só as horas: nome, nota, imagem e o resto que a pessoa
-- mexeu ficam como estão. Item que a pessoa levou para outra categoria não é
-- tocado. `p_games`: [{"appid": 620, "name": "Portal 2", "minutes": 754}].
-- Devolve {"status": "ok", "category_id", "created", "updated"} ou
-- {"status": "not_connected"}.
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

  -- A categoria da sincronização ainda existe? (A pessoa pode ter apagado.)
  select c.id into v_category
    from public.categories c
   where c.id = v_account.category_id and c.owner_id = p_user;

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

-- Registra uma tentativa que falhou (perfil privado, Steam fora do ar…).
create or replace function public.steam_report_error(p_secret text, p_user uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;
  update public.connected_accounts
     set last_error = left(coalesce(nullif(btrim(p_error), ''), 'Erro desconhecido.'), 300),
         last_attempt_at = now()
   where user_id = p_user and provider = 'steam';
end;
$$;

-- As contas para a rodada diária: sem tentativa nas últimas 20 horas, as
-- mais antigas primeiro. Devolve [{"user_id", "steam_id"}].
create or replace function public.steam_due_accounts(p_secret text, p_limit int default 25)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', due.user_id, 'steam_id', due.external_id))
      from (
        select a.user_id, a.external_id
          from public.connected_accounts a
         where a.provider = 'steam'
           and (a.last_attempt_at is null or a.last_attempt_at < now() - interval '20 hours')
         order by a.last_attempt_at nulls first
         limit least(greatest(coalesce(p_limit, 25), 1), 100)
      ) due
  ), '[]'::jsonb);
end;
$$;

-- O segredo é a tranca; quem chama é o servidor do app (com ou sem sessão).
revoke execute on function public.steam_connect(text, uuid, text, text) from public;
revoke execute on function public.steam_apply(text, uuid, jsonb, text) from public;
revoke execute on function public.steam_report_error(text, uuid, text) from public;
revoke execute on function public.steam_due_accounts(text, int) from public;
grant execute on function public.steam_connect(text, uuid, text, text) to anon, authenticated;
grant execute on function public.steam_apply(text, uuid, jsonb, text) to anon, authenticated;
grant execute on function public.steam_report_error(text, uuid, text) to anon, authenticated;
grant execute on function public.steam_due_accounts(text, int) to anon, authenticated;
