-- =====================================================================
-- Vitrine v2 — schema
-- Rode no SQL Editor do Supabase, ANTES de 02_rls.sql.
--
-- ATENÇÃO: o bloco `drop` logo abaixo APAGA as seis tabelas do app e tudo
-- que há nelas. É proposital: a v2 mudou o formato de `categories.estrutura`
-- e de `entries.custom_fields`, e não existe migração dos dados da v1.
--
-- Os perfis são recriados no fim deste arquivo para todos os usuários que
-- já existem em auth.users — ninguém precisa ser convidado de novo.
-- =====================================================================

drop view  if exists public.category_entry_counts;
drop view  if exists public.tag_usage_counts;
drop table if exists public.entry_tags cascade;
drop table if exists public.tags       cascade;
drop table if exists public.entries    cascade;
drop table if exists public.categories cascade;
drop table if exists public.folders    cascade;
drop table if exists public.profiles   cascade;

-- A v1 tinha uma função SECURITY DEFINER que rodava SQL arbitrário para a
-- aba "Cmd": acesso irrestrito ao banco para qualquer autenticado. Está
-- fora de escopo na v2 — derrubamos aqui se ainda existir.
drop function if exists public.run_sql(text);

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FOLDERS — pastas da tela de Coleções, aninháveis sem limite
-- ---------------------------------------------------------------------
create table public.folders (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  parent_folder_id uuid references public.folders(id) on delete cascade,
  display_order    int  not null default 0,
  created_at       timestamptz not null default now()
);

create index folders_owner_idx  on public.folders (owner_id, display_order);
create index folders_parent_idx on public.folders (parent_folder_id);

-- ---------------------------------------------------------------------
-- CATEGORIES — cada uma define a própria estrutura de campos.
--
-- `estrutura` é uma lista ORDENADA (lista, e não objeto: o jsonb do
-- Postgres não preserva a ordem das chaves, e a ordem de exibição importa):
--
--   [{"id": "f_8x2k1a", "nome": "Visitas", "tipo": "int"},
--    {"id": "f_v7c4ln", "nome": "Modo", "tipo": "select",
--     "opcoes": ["Salão", "Delivery"]}]
--
-- O `id` é estável e é ele que chaveia `entries.custom_fields`. Na v1 a
-- chave era o NOME do campo, então renomear um campo órfãava silenciosamente
-- o valor em todos os itens. Com id estável, renomear é seguro e barato.
-- ---------------------------------------------------------------------
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  icon          text,
  folder_id     uuid references public.folders(id) on delete cascade,
  display_order int  not null default 0,
  estrutura     jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  unique (owner_id, name)
);

create index categories_owner_idx  on public.categories (owner_id, display_order);
create index categories_folder_idx on public.categories (folder_id);

-- ---------------------------------------------------------------------
-- ENTRIES — os itens. Campos garantidos: nome, imagem e avaliação.
-- Todo o resto vive em custom_fields, chaveado pelo ID do campo:
--   {"f_8x2k1a": 4, "f_p0m3zq": 4.5, "f_v7c4ln": "Salão"}
-- ---------------------------------------------------------------------
create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  rating        numeric(2,1) check (rating >= 0 and rating <= 5),
  -- URL de uma imagem hospedada fora: nada é baixado nem armazenado aqui.
  image_url     text,
  -- Só o enquadramento na tela: {"x": 50, "y": 50, "zoom": 1}
  image_display jsonb not null default '{}'::jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index entries_category_idx on public.entries (category_id, created_at desc);
create index entries_owner_idx    on public.entries (owner_id);
create index entries_custom_idx   on public.entries using gin (custom_fields);

-- ---------------------------------------------------------------------
-- TAGS — vocabulário compartilhado entre todas as categorias e todos os
-- usuários do grupo. A tabela não tem dono, de propósito.
-- ---------------------------------------------------------------------
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#B98CC2',
  created_at timestamptz not null default now()
);

create table public.entry_tags (
  entry_id uuid not null references public.entries(id) on delete cascade,
  tag_id   uuid not null references public.tags(id)    on delete cascade,
  primary key (entry_id, tag_id)
);

create index entry_tags_tag_idx on public.entry_tags (tag_id);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entries_touch_updated_at on public.entries;
create trigger entries_touch_updated_at
  before update on public.entries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- CONTAGENS — views, para o app nunca precisar puxar linhas só para contar.
-- `security_invoker` faz a view respeitar a RLS das tabelas de base, em vez
-- de rodar com os privilégios de quem a criou.
-- ---------------------------------------------------------------------
create or replace view public.category_entry_counts
with (security_invoker = true) as
  select category_id, owner_id, count(*)::int as total
  from public.entries
  group by category_id, owner_id;

create or replace view public.tag_usage_counts
with (security_invoker = true) as
  select tag_id, count(*)::int as total
  from public.entry_tags
  group by tag_id;

grant select on public.category_entry_counts to authenticated;
grant select on public.tag_usage_counts      to authenticated;

-- ---------------------------------------------------------------------
-- Username a partir do e-mail: minúsculas, só alfanumérico e `_`, com
-- sufixo numérico enquanto houver colisão.
-- ---------------------------------------------------------------------
create or replace function public.derive_username(raw_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  base_username  text;
  final_username text;
  suffix         int := 0;
begin
  base_username := lower(
    regexp_replace(split_part(coalesce(raw_email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g')
  );
  if base_username = '' then
    base_username := 'user';
  end if;
  final_username := base_username;

  while exists (select 1 from public.profiles p where p.username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  return final_username;
end;
$$;

-- ---------------------------------------------------------------------
-- Primeiro acesso: cria o profile e UMA categoria de exemplo.
-- Nenhuma outra categoria é sugerida pelo sistema — o usuário monta as
-- suas do zero, definindo a estrutura campo a campo.
-- ---------------------------------------------------------------------
create or replace function public.seed_profile(user_id uuid, raw_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uname text;
begin
  if exists (select 1 from public.profiles p where p.id = user_id) then
    return;
  end if;

  uname := public.derive_username(raw_email);

  insert into public.profiles (id, username, display_name)
  values (user_id, uname, uname);

  insert into public.categories (owner_id, name, icon, display_order, estrutura)
  values (user_id, 'Restaurantes', '🍽️', 0, '[
    {"id": "f_v1s1t5", "nome": "Visitas",         "tipo": "int"},
    {"id": "f_at3nd1", "nome": "Atendimento",     "tipo": "star"},
    {"id": "f_c0m1d4", "nome": "Comida",          "tipo": "star"},
    {"id": "f_t3mp0e", "nome": "Tempo de Espera", "tipo": "time"},
    {"id": "f_0bs3rv", "nome": "Observações",     "tipo": "str"},
    {"id": "f_p3d1d0", "nome": "Pedido",          "tipo": "str"},
    {"id": "f_l0c4l1", "nome": "Localização",     "tipo": "str"}
  ]'::jsonb)
  on conflict (owner_id, name) do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_profile(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Backfill: quem já foi convidado antes deste schema existir também precisa
-- de um profile. Roda uma vez; nas próximas execuções não faz nada.
-- ---------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in select id, email from auth.users order by created_at loop
    perform public.seed_profile(u.id, u.email);
  end loop;
end;
$$;
