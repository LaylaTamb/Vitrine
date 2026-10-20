-- =====================================================================
-- Vitrine v2 — "A organizar": a caixa de entrada de cada conta
-- Rode no SQL Editor do Supabase, depois de 01 a 16 (o 14 é obrigatório:
-- este arquivo para logo no começo, com aviso, se ele ainda não rodou).
--
-- Aditivo e seguro: nada some. Pode rodar mais de uma vez.
--
--   categories.kind — 'normal' (todas as que já existem) ou 'inbox'. (O
--     'match' entra na Fase 5.) No máximo UMA 'inbox' por conta (índice
--     único parcial).
--   "A organizar" — criada agora para todo perfil que ainda não tem, e
--     automaticamente para cada perfil novo (gatilho). É onde caem os itens
--     salvos às pressas: compartilhar, "você está em X?", "Trazer" do Match.
--     Estrutura fixa: Nome, Estrelas e UM campo Localização de id fixo
--     (`f_inbox_loc` — o mesmo de `lib/domain/inbox.ts`), ordem "Adicionados
--     recentemente", ícone 📥, na raiz das Coleções e PRIVADA (é rascunho;
--     a pessoa pode abrir depois, se quiser).
--   Se a pessoa já tiver uma categoria chamada "A organizar", a nova ganha
--     um número ("A organizar 2") — a dela não é tocada.
--
-- Travas no banco (só para o app; o painel do Supabase e as funções do
-- sistema continuam podendo tudo): a "A organizar" não pode ser apagada,
-- renomeada, ter a estrutura ou as estrelas trocadas, nem sair da raiz; e
-- ninguém cria outra 'inbox' nem transforma uma categoria em 'inbox'.
-- Apagar a CONTA leva a "A organizar" junto, como todo o resto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) O 14 precisa ter rodado (a "A organizar" nasce privada)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'categories' and column_name = 'visibility'
  ) then
    raise exception 'Rode antes o supabase/14_visibility_and_follows.sql (e os anteriores), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) O tipo da categoria
-- ---------------------------------------------------------------------
alter table public.categories add column if not exists kind text not null default 'normal';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'categories_kind_check'
                    and conrelid = 'public.categories'::regclass) then
    alter table public.categories add constraint categories_kind_check
      check (kind in ('normal', 'inbox'));
  end if;
end;
$$;

create unique index if not exists categories_one_inbox_per_owner
  on public.categories (owner_id) where kind = 'inbox';

-- ---------------------------------------------------------------------
-- 2) Criar a "A organizar" de uma conta (se ainda não tiver). Devolve o id.
--    Interna: só o gatilho e `ensure_my_inbox` chamam.
-- ---------------------------------------------------------------------
create or replace function public.ensure_inbox(p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text := 'A organizar';
  v_n    int := 1;
begin
  select c.id into v_id
    from public.categories c
   where c.owner_id = p_owner and c.kind = 'inbox';
  if found then
    return v_id;
  end if;

  while exists (
    select 1 from public.categories c where c.owner_id = p_owner and c.name = v_name
  ) loop
    v_n := v_n + 1;
    v_name := 'A organizar ' || v_n;
  end loop;

  insert into public.categories
    (owner_id, name, icon, display_order, estrutura, rating_enabled, default_sort, kind, visibility)
  values (
    p_owner, v_name, '📥', 0,
    '[{"id": "f_inbox_loc", "nome": "Localização", "tipo": "location"}]'::jsonb,
    true, 'recent', 'inbox', 'private'
  )
  -- Duas criações ao mesmo tempo: o índice único segura, e a segunda só lê.
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select c.id into v_id
      from public.categories c
     where c.owner_id = p_owner and c.kind = 'inbox';
  end if;
  return v_id;
end;
$$;

revoke execute on function public.ensure_inbox(uuid) from public, anon, authenticated;

-- Para o app: a "A organizar" de quem está logado (cria se faltar).
create or replace function public.ensure_my_inbox()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  return public.ensure_inbox(v_uid);
end;
$$;

revoke execute on function public.ensure_my_inbox() from public, anon;
grant execute on function public.ensure_my_inbox() to authenticated;

-- Perfil novo (confirmação do e-mail, 13) já nasce com a sua.
create or replace function public.create_inbox_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_inbox(new.id);
  return new;
end;
$$;

revoke execute on function public.create_inbox_for_profile() from public, anon, authenticated;
grant execute on function public.create_inbox_for_profile() to supabase_auth_admin;

drop trigger if exists profiles_create_inbox on public.profiles;
create trigger profiles_create_inbox
  after insert on public.profiles
  for each row execute function public.create_inbox_for_profile();

-- Quem já existe.
do $$
declare
  p record;
begin
  for p in
    select pr.id
      from public.profiles pr
     where not exists (
       select 1 from public.categories c where c.owner_id = pr.id and c.kind = 'inbox'
     )
  loop
    perform public.ensure_inbox(p.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) Travas
--
-- SECURITY INVOKER de propósito: `current_user` é quem rodou o comando —
-- `authenticated` vindo do app; o dono do banco dentro das funções acima, de
-- `delete_my_account` e no painel.
-- ---------------------------------------------------------------------
create or replace function public.guard_inbox_category()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.kind = 'inbox' then
      raise exception 'inbox_locked';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Sem o perfil, é a conta inteira indo embora (cascata): pode.
    if old.kind = 'inbox'
       and exists (select 1 from public.profiles p where p.id = old.owner_id) then
      raise exception 'inbox_locked';
    end if;
    return old;
  end if;

  -- UPDATE
  if old.kind = 'inbox' then
    if new.kind is distinct from old.kind
       or new.name is distinct from old.name
       or new.estrutura is distinct from old.estrutura
       or new.rating_enabled is distinct from old.rating_enabled
       or new.folder_id is not null then
      raise exception 'inbox_locked';
    end if;
  elsif new.kind = 'inbox' then
    raise exception 'inbox_locked';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_inbox_category() from public, anon, authenticated;

drop trigger if exists categories_guard_inbox on public.categories;
create trigger categories_guard_inbox
  before insert or update or delete on public.categories
  for each row execute function public.guard_inbox_category();
