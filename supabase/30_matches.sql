-- =====================================================================
-- Vitrine v2 — Match (parte 1): convite e aceite
-- Rode no SQL Editor do Supabase, depois de 01 a 29 (o 14 e o 21 são
-- obrigatórios: este arquivo usa "amigos", bloqueios e o sininho).
--
-- Aditivo e seguro: duas tabelas novas, vazias, e funções. Pode rodar mais
-- de uma vez.
--
--   matches — um match: quem criou, o estado ('pending' esperando as
--     respostas, 'ready' todos aceitaram, 'canceled' alguém recusou) e, na
--     próxima migração, a % de compatibilidade (`compat`).
--   match_members — quem está nele (até 8 pessoas, quem criou incluído), a
--     resposta de cada um e a COR de cada pessoa (automática, pela ordem).
--
-- As regras (nas funções; ninguém escreve nas tabelas direto):
--   • convite só para AMIGOS (os dois se seguem) de quem cria, sem
--     bloqueio, até 7 por match (8 pessoas no total);
--   • quem cria já aceitou; TODOS os convidados precisam aceitar;
--   • uma recusa cancela o match (e avisa todo mundo); quem criou também
--     pode cancelar enquanto ele estiver pendente;
--   • todos aceitaram: o match fica pronto (a migração 31 monta a cópia de
--     cada pessoa nessa hora).
-- Só quem está no match lê o match e quem mais está nele.
-- =====================================================================

do $$
begin
  if to_regclass('public.notifications') is null
     or to_regprocedure('public.are_friends(uuid, uuid)') is null then
    raise exception 'Rode antes o supabase/14_visibility_and_follows.sql e o 21_notifications.sql (e os demais anteriores), depois este.';
  end if;
end;
$$;

create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  status      text not null default 'pending',
  compat      jsonb,
  ready_at    timestamptz,
  canceled_at timestamptz,
  constraint matches_status_check check (status in ('pending', 'ready', 'canceled'))
);

create index if not exists matches_created_by_idx on public.matches (created_by, created_at desc);

create table if not exists public.match_members (
  match_id     uuid not null references public.matches(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'invited',
  color        text not null,
  position     int not null default 0,
  responded_at timestamptz,
  primary key (match_id, user_id),
  constraint match_members_status_check check (status in ('invited', 'accepted', 'declined')),
  constraint match_members_color_check check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create index if not exists match_members_user_idx on public.match_members (user_id);

-- Está no match? (Função à parte: a política de match_members não pode
-- consultar match_members de novo — daria recursão.)
create or replace function public.is_match_member(p_match_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.match_members m
     where m.match_id = p_match_id and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_match_member(uuid) from public, anon;
grant execute on function public.is_match_member(uuid) to authenticated;

alter table public.matches enable row level security;
alter table public.match_members enable row level security;

drop policy if exists "matches: membros leem" on public.matches;
create policy "matches: membros leem"
  on public.matches for select to authenticated
  using (public.is_match_member(id));

drop policy if exists "match_members: membros leem" on public.match_members;
create policy "match_members: membros leem"
  on public.match_members for select to authenticated
  using (public.is_match_member(match_id));

revoke all on table public.matches, public.match_members from anon;
revoke insert, update, delete on table public.matches, public.match_members from authenticated;

-- As cores, na ordem (mudou aqui, mude MATCH_COLORS em lib/domain/match.ts).
create or replace function public.match_color(p_position int)
returns text
language sql
immutable
set search_path = public
as $$
  select (array['#B98CC2', '#8FB3C9', '#8FC9A6', '#D6C08A', '#C97B7B', '#C79BD0', '#B08A6A', '#9A9AA4'])
         [1 + (greatest(p_position, 0) % 8)];
$$;

-- ---------------------------------------------------------------------
-- Criar: quem cria + até 7 amigos. Devolve o id do match.
-- ---------------------------------------------------------------------
create or replace function public.create_match(p_user_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_others uuid[];
  v_match uuid;
  v_other uuid;
  v_position int := 1;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct u), '{}') into v_others
    from unnest(coalesce(p_user_ids, '{}')) u
   where u is not null and u <> v_me;

  if cardinality(v_others) = 0 then
    raise exception 'Escolha pelo menos um amigo.' using errcode = '22023';
  end if;
  if cardinality(v_others) > 7 then
    raise exception 'No máximo 8 pessoas por match (você e mais 7).' using errcode = '22023';
  end if;

  foreach v_other in array v_others loop
    if not public.are_friends(v_me, v_other) or public.is_blocked(v_me, v_other) then
      raise exception 'Só dá para chamar amigos (quem você segue e segue você de volta).'
        using errcode = '42501';
    end if;
  end loop;

  -- Freio: no máximo 20 matches criados por dia.
  if (select count(*) from public.matches m
       where m.created_by = v_me and m.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Muitos matches criados hoje. Tente amanhã.' using errcode = '54000';
  end if;

  insert into public.matches (created_by) values (v_me) returning id into v_match;

  insert into public.match_members (match_id, user_id, status, color, position, responded_at)
  values (v_match, v_me, 'accepted', public.match_color(0), 0, now());

  foreach v_other in array v_others loop
    insert into public.match_members (match_id, user_id, status, color, position)
    values (v_match, v_other, 'invited', public.match_color(v_position), v_position);
    v_position := v_position + 1;

    insert into public.notifications (user_id, type, actor_id, payload)
    values (
      v_other,
      'match_invite',
      v_me,
      jsonb_build_object('match_id', v_match, 'size', cardinality(v_others) + 1)
    );
  end loop;

  return v_match;
end;
$$;

revoke execute on function public.create_match(uuid[]) from public, anon;
grant execute on function public.create_match(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Responder: aceitar ou recusar. Quem criou "recusar" = cancelar.
-- Devolve {"status": "pending" | "ready" | "canceled"}.
-- ---------------------------------------------------------------------
create or replace function public.respond_match(p_match_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_match public.matches%rowtype;
  v_member public.match_members%rowtype;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  select * into v_member
    from public.match_members
   where match_id = p_match_id and user_id = v_me;
  if v_match.id is null or v_member.match_id is null then
    raise exception 'Match não encontrado.' using errcode = 'P0002';
  end if;
  if v_match.status <> 'pending' then
    return jsonb_build_object('status', v_match.status);
  end if;

  if not coalesce(p_accept, false) then
    update public.match_members
       set status = 'declined', responded_at = now()
     where match_id = p_match_id and user_id = v_me;
    update public.matches
       set status = 'canceled', canceled_at = now()
     where id = p_match_id;
    insert into public.notifications (user_id, type, actor_id, payload)
    select m.user_id, 'match_canceled', v_me, jsonb_build_object('match_id', p_match_id)
      from public.match_members m
     where m.match_id = p_match_id and m.user_id <> v_me;
    return jsonb_build_object('status', 'canceled');
  end if;

  if v_member.status = 'invited' then
    update public.match_members
       set status = 'accepted', responded_at = now()
     where match_id = p_match_id and user_id = v_me;
  end if;

  if exists (
    select 1 from public.match_members m
     where m.match_id = p_match_id and m.status <> 'accepted'
  ) then
    return jsonb_build_object('status', 'pending');
  end if;

  -- Todos aceitaram. (A migração 31 monta aqui a cópia de cada pessoa.)
  update public.matches set status = 'ready', ready_at = now() where id = p_match_id;
  insert into public.notifications (user_id, type, actor_id, payload)
  select m.user_id, 'match_ready', null, jsonb_build_object('match_id', p_match_id)
    from public.match_members m
   where m.match_id = p_match_id;
  return jsonb_build_object('status', 'ready');
end;
$$;

revoke execute on function public.respond_match(uuid, boolean) from public, anon;
grant execute on function public.respond_match(uuid, boolean) to authenticated;
