-- =====================================================================
-- Vitrine v2 — o @ de cada pessoa: troca com limite, @ antigo redireciona
-- Rode no SQL Editor do Supabase, depois de 01 a 14.
--
-- Aditivo e seguro: ninguém muda de @ ao rodar. Pode rodar mais de uma vez.
--
--   username_changes — o histórico das trocas (quem, de qual @, para qual,
--     quando). É dele que saem as três regras:
--       * no máximo 2 trocas a cada 14 dias;
--       * o @ antigo REDIRECIONA para o novo por 14 dias
--         (`resolve_username`, que funciona também sem login);
--       * nesses 14 dias ele fica RESERVADO: ninguém mais pega (a própria
--         pessoa pode voltar a ele).
--   change_username('novo') — a ÚNICA forma de trocar o @. Confere o formato
--     (3 a 30 caracteres: a–z, 0–9 e _), as palavras reservadas, o limite e a
--     reserva. Um gatilho recusa trocar o @ direto na tabela `profiles`.
--   derive_username (01) — o @ automático de conta nova passa a respeitar o
--     formato, as palavras reservadas e os @ reservados.
--
-- Erros (a tela traduz): username_invalid, username_reserved, username_taken,
-- username_rate_limited.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Histórico das trocas
-- ---------------------------------------------------------------------
create table if not exists public.username_changes (
  id           bigint generated always as identity primary key,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  old_username text not null,
  new_username text not null,
  changed_at   timestamptz not null default now()
);

create index if not exists username_changes_profile_idx
  on public.username_changes (profile_id, changed_at desc);
create index if not exists username_changes_old_idx
  on public.username_changes (old_username, changed_at desc);

-- Cada pessoa lê só as próprias trocas (para a tela dizer quantas ainda
-- pode fazer). Ninguém escreve direto: só `change_username`.
alter table public.username_changes enable row level security;

drop policy if exists "username_changes: dono lê" on public.username_changes;
create policy "username_changes: dono lê"
  on public.username_changes for select to authenticated
  using (profile_id = (select auth.uid()));

revoke all on table public.username_changes from anon;

-- ---------------------------------------------------------------------
-- 2) Palavras reservadas — a mesma lista de `lib/domain/username.ts`
--    (mudou uma, mude a outra).
-- ---------------------------------------------------------------------
create or replace function public.is_reserved_username(p_username text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(btrim(coalesce(p_username, ''))) = any (array[
    'admin', 'administrador', 'adm', 'root', 'suporte', 'ajuda', 'sistema', 'oficial',
    'vitrine', 'equipe', 'contato', 'seguranca',
    'v', 'u', 'api', 'app', 'www', 'auth', 'demo',
    'login', 'entrar', 'sair', 'cadastro', 'conta',
    'mapa', 'filtro', 'tags', 'explorar', 'favoritos', 'configuracoes', 'usuarios',
    'pessoas', 'categoria', 'compartilhar', 'termos', 'privacidade', 'matches',
    'notificacoes', 'importar',
    'null', 'undefined'
  ]);
$$;

revoke execute on function public.is_reserved_username(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Trocar o @ — só por aqui
-- ---------------------------------------------------------------------
create or replace function public.change_username(p_new text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new text := lower(btrim(coalesce(p_new, '')));
  v_old text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- `for update`: duas trocas ao mesmo tempo esperam uma pela outra (e o
  -- limite de 2 vale de verdade).
  select p.username into v_old
    from public.profiles p
   where p.id = v_uid
     for update;
  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_new = v_old then
    return v_old;
  end if;

  if v_new !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'username_invalid';
  end if;

  if public.is_reserved_username(v_new) then
    raise exception 'username_reserved';
  end if;

  if (select count(*)
        from public.username_changes c
       where c.profile_id = v_uid
         and c.changed_at > now() - interval '14 days') >= 2 then
    raise exception 'username_rate_limited';
  end if;

  -- Em uso agora, ou largado por OUTRA pessoa há menos de 14 dias (o link
  -- antigo dela ainda leva até ela).
  if exists (select 1 from public.profiles p where p.username = v_new and p.id <> v_uid)
     or exists (
       select 1 from public.username_changes c
        where c.old_username = v_new
          and c.profile_id <> v_uid
          and c.changed_at > now() - interval '14 days'
     ) then
    raise exception 'username_taken';
  end if;

  update public.profiles set username = v_new where id = v_uid;

  insert into public.username_changes (profile_id, old_username, new_username)
  values (v_uid, v_old, v_new);

  return v_new;
end;
$$;

revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

-- O @ direto na tabela não muda: a política "profiles: dono edita" deixaria
-- qualquer pessoa pular o limite e a reserva. SECURITY INVOKER de propósito:
-- `current_user` é quem rodou o UPDATE — `authenticated` vindo do app, ou o
-- dono do banco dentro de `change_username` (e no Table Editor do painel).
create or replace function public.guard_username_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username is distinct from old.username and current_user = 'authenticated' then
    raise exception 'username_change_requires_function'
      using hint = 'Use a função change_username.';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_username_change() from public, anon, authenticated;

drop trigger if exists profiles_guard_username on public.profiles;
create trigger profiles_guard_username
  before update of username on public.profiles
  for each row execute function public.guard_username_change();

-- ---------------------------------------------------------------------
-- 4) @ antigo → @ atual (para o redirecionamento de /v/<@ antigo>)
--
-- Devolve o @ ATUAL da pessoa que largou `p_username` nos últimos 14 dias
-- (mesmo que ela já tenha trocado de novo). Nulo = ninguém.
-- ---------------------------------------------------------------------
create or replace function public.resolve_username(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.username
    from public.username_changes c
    join public.profiles p on p.id = c.profile_id
   where c.old_username = lower(btrim(p_username))
     and c.changed_at > now() - interval '14 days'
   order by c.changed_at desc
   limit 1;
$$;

revoke execute on function public.resolve_username(text) from public;
grant execute on function public.resolve_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) O @ automático de conta nova (mesma assinatura do 01; os privilégios
--    do 04 continuam valendo). Agora: no máximo 26 caracteres de base (sobra
--    lugar para o número), pelo menos 3, e nunca uma palavra reservada nem um
--    @ reservado por uma troca recente.
-- ---------------------------------------------------------------------
create or replace function public.derive_username(raw_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username  text;
  final_username text;
  suffix         int := 0;
begin
  base_username := left(lower(
    regexp_replace(split_part(coalesce(raw_email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g')
  ), 26);
  if base_username = '' then
    base_username := 'user';
  elsif char_length(base_username) < 3 then
    base_username := base_username || '_vt';
  end if;
  final_username := base_username;

  while public.is_reserved_username(final_username)
        or exists (select 1 from public.profiles p where p.username = final_username)
        or exists (
          select 1 from public.username_changes c
           where c.old_username = final_username
             and c.changed_at > now() - interval '14 days'
        ) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  return final_username;
end;
$$;
