-- =====================================================================
-- Vitrine v2 — aceite dos Termos (18+) e "Excluir minha conta"
-- Rode no SQL Editor do Supabase, depois de 01 a 15.
--
-- Aditivo e seguro: nada some ao rodar. Pode rodar mais de uma vez.
--
--   profiles.terms_version      — a versão dos Termos e da Política que a
--                                 pessoa aceitou por último (ex.: 2026-10-19);
--   profiles.terms_accepted_at  — quando aceitou;
--   profiles.adult_confirmed_at — quando confirmou ter 18 anos ou mais.
--
-- De onde vem o aceite: o app grava no `user_metadata` da conta (Supabase
-- Auth) — no cadastro (`signUp`, com a caixa marcada) ou na tela
-- /aceitar-termos (contas que já existiam). É ali que o middleware olha, sem
-- custar consulta nenhuma ao banco. Estes gatilhos copiam o aceite para o
-- perfil, que é o registro que fica:
--   * o perfil nasce (na confirmação do e-mail, 13) já com o aceite do
--     cadastro, datado da criação da conta;
--   * aceitar de novo (versão nova) atualiza o perfil na hora, com a data do
--     banco.
--
-- delete_my_account() — apaga a conta de quem está logado em `auth.users`.
-- O resto vai junto pelas cascatas que já existem: `profiles` → auth.users
-- (01) e pastas, categorias, itens, subpastas, tags dos itens, localizações,
-- seguidores, bloqueios e trocas de @ → profiles. As `tags` em si são o
-- vocabulário compartilhado (sem dono) e ficam.
-- Se der "permission denied for table users", o papel que roda o SQL Editor
-- não pode apagar em auth.users nesse projeto: avise antes de seguir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Colunas
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists adult_confirmed_at timestamptz;

-- ---------------------------------------------------------------------
-- 2) O perfil nasce com o aceite do cadastro
-- ---------------------------------------------------------------------
create or replace function public.fill_terms_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta    jsonb;
  v_created timestamptz;
begin
  if new.terms_version is not null then
    return new;
  end if;

  select u.raw_user_meta_data, u.created_at
    into v_meta, v_created
    from auth.users u
   where u.id = new.id;

  if v_meta ? 'terms_version' then
    -- A caixa é marcada no cadastro: a data é a da criação da conta.
    new.terms_version := v_meta->>'terms_version';
    new.terms_accepted_at := coalesce(v_created, now());
    if (v_meta->>'adult_confirmed') = 'true' then
      new.adult_confirmed_at := coalesce(v_created, now());
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.fill_terms_from_auth() from public, anon, authenticated;
grant execute on function public.fill_terms_from_auth() to supabase_auth_admin;

drop trigger if exists profiles_fill_terms on public.profiles;
create trigger profiles_fill_terms
  before insert on public.profiles
  for each row execute function public.fill_terms_from_auth();

-- ---------------------------------------------------------------------
-- 3) Aceitar depois (versão nova, conta antiga): o perfil acompanha
-- ---------------------------------------------------------------------
create or replace function public.sync_terms_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.raw_user_meta_data->>'terms_version') is not null
     and (new.raw_user_meta_data->>'terms_version')
         is distinct from (old.raw_user_meta_data->>'terms_version') then
    update public.profiles
       set terms_version = new.raw_user_meta_data->>'terms_version',
           terms_accepted_at = now(),
           adult_confirmed_at = case
             when (new.raw_user_meta_data->>'adult_confirmed') = 'true' then now()
             else adult_confirmed_at
           end
     where id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_terms_from_auth() from public, anon, authenticated;
grant execute on function public.sync_terms_from_auth() to supabase_auth_admin;

drop trigger if exists on_auth_user_terms on auth.users;
create trigger on_auth_user_terms
  after update of raw_user_meta_data on auth.users
  for each row execute function public.sync_terms_from_auth();

-- ---------------------------------------------------------------------
-- 4) Quem aceitou antes desta migração (o app já gravava no user_metadata)
--
-- A data vem do próprio metadata, que o app grava; se ela não for uma data
-- válida, fica a da criação da conta. Só preenche quem ainda está vazio.
-- ---------------------------------------------------------------------
do $$
declare
  r        record;
  v_when   timestamptz;
begin
  for r in
    select p.id, u.raw_user_meta_data as meta, u.created_at
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.terms_version is null
       and u.raw_user_meta_data ? 'terms_version'
  loop
    begin
      v_when := (r.meta->>'terms_accepted_at')::timestamptz;
    exception when others then
      v_when := null;
    end;
    v_when := coalesce(v_when, r.created_at);

    update public.profiles
       set terms_version = r.meta->>'terms_version',
           terms_accepted_at = v_when,
           adult_confirmed_at = case when (r.meta->>'adult_confirmed') = 'true' then v_when end
     where id = r.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Excluir minha conta
--
-- Só a própria conta (auth.uid()). A tela pede para digitar o @ antes; a
-- função não precisa de mais nada.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
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
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
