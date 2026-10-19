-- =====================================================================
-- Vitrine v2 — perfil só depois de confirmar o e-mail
-- Rode no SQL Editor do Supabase, depois de 01 a 12.
--
-- Por quê: com o cadastro aberto (e-mail e senha), quem se cadastra já vira
-- uma linha em `auth.users` antes de confirmar o e-mail. Até aqui, o gatilho
-- do 01 criava o perfil nessa hora — e uma conta que nunca confirmou (e-mail
-- digitado errado, robô) aparecia em "Pessoas" e prendia um nome de usuário.
--
-- Agora o perfil (e a categoria de exemplo) nasce quando o e-mail é
-- confirmado: no cadastro com confirmação desligada, no link de confirmação,
-- ou ao aceitar um convite.
--
-- Aditivo e seguro: não apaga nada. Quem já tem perfil continua com ele, com
-- o MESMO id da conta (`profiles.id = auth.users.id`) — os dados de todo
-- mundo seguem ligados como estão. Pode rodar mais de uma vez.
-- =====================================================================

-- Cadastro: só cria o perfil se a conta já nasce confirmada.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null then
    perform public.seed_profile(new.id, new.email);
  end if;
  return new;
end;
$$;

-- Confirmação (link do cadastro ou do convite): cria o perfil que faltava.
-- `seed_profile` não faz nada se o perfil já existir.
create or replace function public.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_profile(new.id, new.email);
  return new;
end;
$$;

revoke execute on function public.handle_user_confirmed() from public, anon, authenticated;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- Conta já confirmada que, por qualquer motivo, ficou sem perfil: cria agora.
do $$
declare
  u record;
begin
  for u in
    select au.id, au.email
      from auth.users au
     where au.email_confirmed_at is not null
       and not exists (select 1 from public.profiles p where p.id = au.id)
     order by au.created_at
  loop
    perform public.seed_profile(u.id, u.email);
  end loop;
end;
$$;
