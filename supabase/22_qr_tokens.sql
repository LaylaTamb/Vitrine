-- =====================================================================
-- Vitrine v2 — QR pessoal: escanear o QR de alguém faz os dois virarem
-- amigos na hora (os dois se seguem).
-- Rode no SQL Editor do Supabase, depois de 01 a 21 (o 14 e o 21 são
-- obrigatórios: este arquivo usa `follows`, `blocks` e `notifications`).
--
-- Aditivo e seguro: uma tabela nova, vazia, e três funções. Pode rodar mais
-- de uma vez.
--
--   qr_tokens — os códigos que estão na tela "Meu QR" agora:
--     token_hash — o SHA-256 do código (o código mesmo só existe no QR: quem
--                  lê o banco não consegue montar um link que funcione);
--     profile_id — de quem é o QR;
--     expires_at — vale 5 minutos. A tela troca o código a cada ~4, então o
--                  anterior ainda vale enquanto alguém termina de escanear.
--
-- Ninguém lê nem escreve na tabela direto (RLS ligada, sem política):
--   issue_qr_token()   — cria um código para quem pede e devolve o código
--                        (só desta vez — o banco guarda só o hash);
--   redeem_qr(código)  — quem escaneou: cria os follows nos dois sentidos
--                        (respeitando bloqueios) e avisa os dois no sininho.
--
-- O código vale para mais de uma pessoa nesses 5 minutos (numa roda, todo
-- mundo escaneia o mesmo QR). Cada pessoa tem no máximo 3 códigos vivos.
-- =====================================================================

do $$
begin
  if to_regclass('public.follows') is null then
    raise exception 'Rode antes o supabase/14_visibility_and_follows.sql (e os anteriores), depois este.';
  end if;
  if to_regclass('public.notifications') is null then
    raise exception 'Rode antes o supabase/21_notifications.sql, depois este.';
  end if;
end;
$$;

create table if not exists public.qr_tokens (
  token_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint qr_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists qr_tokens_profile_idx on public.qr_tokens (profile_id, created_at desc);
create index if not exists qr_tokens_expires_idx on public.qr_tokens (expires_at);

-- RLS ligada e nenhuma política: só as funções abaixo mexem na tabela.
alter table public.qr_tokens enable row level security;
revoke all on table public.qr_tokens from anon, authenticated;

-- O hash guardado de um código. (sha256 é do próprio Postgres, sem extensão.)
create or replace function public.qr_token_hash(p_token text)
returns text
language sql
stable
set search_path = public
as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

revoke execute on function public.qr_token_hash(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Criar um código (a tela "Meu QR" chama ao abrir e a cada ~4 minutos).
-- Devolve {"token": "...", "expires_at": "..."}.
-- ---------------------------------------------------------------------
create or replace function public.issue_qr_token()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  -- Dois UUID v4 sem hífens: 64 caracteres hexadecimais, ~244 bits aleatórios.
  v_token text := replace(gen_random_uuid()::text, '-', '')
               || replace(gen_random_uuid()::text, '-', '');
  v_expires timestamptz := now() + interval '5 minutes';
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  -- Faxina: os vencidos (de todo mundo — o índice deixa isso barato).
  delete from public.qr_tokens where expires_at < now();

  insert into public.qr_tokens (token_hash, profile_id, expires_at)
  values (public.qr_token_hash(v_token), v_me, v_expires);

  -- No máximo 3 vivos por pessoa (o atual, o anterior e folga para outra aba).
  delete from public.qr_tokens q
   where q.profile_id = v_me
     and q.token_hash not in (
       select r.token_hash from public.qr_tokens r
        where r.profile_id = v_me
        order by r.created_at desc
        limit 3
     );

  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$$;

revoke execute on function public.issue_qr_token() from public, anon;
grant execute on function public.issue_qr_token() to authenticated;

-- ---------------------------------------------------------------------
-- Usar um código (quem escaneou abre o link logado).
-- Devolve {"status": ..., "username": ...}, com status:
--   friends          — viraram amigos agora;
--   already_friends  — já eram;
--   self             — é o próprio QR;
--   blocked          — quem escaneou bloqueou o dono do QR (desbloqueie antes);
--   invalid          — vencido, inexistente — ou o dono bloqueou quem
--                      escaneou (não dá para saber qual, de propósito).
-- ---------------------------------------------------------------------
create or replace function public.redeem_qr(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_owner uuid;
  v_username text;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  select q.profile_id into v_owner
    from public.qr_tokens q
   where q.token_hash = public.qr_token_hash(p_token)
     and q.expires_at > now();

  if v_owner is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select p.username into v_username from public.profiles p where p.id = v_owner;

  if v_owner = v_me then
    return jsonb_build_object('status', 'self', 'username', v_username);
  end if;

  if exists (select 1 from public.blocks b where b.blocker_id = v_me and b.blocked_id = v_owner) then
    return jsonb_build_object('status', 'blocked', 'username', v_username);
  end if;
  if public.is_blocked(v_me, v_owner) then
    return jsonb_build_object('status', 'invalid');
  end if;

  if public.are_friends(v_me, v_owner) then
    return jsonb_build_object('status', 'already_friends', 'username', v_username);
  end if;

  insert into public.follows (follower_id, followee_id)
  values (v_me, v_owner), (v_owner, v_me)
  on conflict do nothing;

  -- O gatilho do 21 acabou de avisar "novo seguidor" aos dois; aqui o aviso
  -- certo é um só, o de amigos pelo QR. (`now()` é o início desta transação:
  -- só apaga os avisos criados agora, nunca os de antes.)
  delete from public.notifications n
   where n.type = 'new_follower'
     and n.created_at = now()
     and ((n.user_id = v_owner and n.actor_id = v_me)
       or (n.user_id = v_me and n.actor_id = v_owner));

  -- Quem escaneou acabou de ver na tela: o aviso dele já nasce lido.
  insert into public.notifications (user_id, type, actor_id, payload, read_at)
  values
    (v_owner, 'qr_friend', v_me, '{}'::jsonb, null),
    (v_me, 'qr_friend', v_owner, '{}'::jsonb, now());

  return jsonb_build_object('status', 'friends', 'username', v_username);
end;
$$;

revoke execute on function public.redeem_qr(text) from public, anon;
grant execute on function public.redeem_qr(text) to authenticated;
