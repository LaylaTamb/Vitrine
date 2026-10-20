-- =====================================================================
-- Vitrine v2 — notificações (o sininho) e o aviso de novo seguidor
-- Rode no SQL Editor do Supabase, depois de 01 a 20 (o 14 é obrigatório:
-- este arquivo usa a tabela `follows` e a função `is_blocked_with_me`).
--
-- Aditivo e seguro: uma tabela nova, vazia. Pode rodar mais de uma vez.
--
--   notifications — o que aparece no sininho de cada pessoa:
--     user_id  — quem recebe;
--     type     — o tipo ('new_follower' agora; as próximas fases trazem
--                outros: amigos pelo QR, convite de Match…);
--     actor_id — quem causou (nulo = o sistema);
--     payload  — detalhes do tipo (ex.: `mutual: true` = seguiu de volta,
--                viraram amigos);
--     read_at  — quando foi vista (nulo = não lida).
--
-- Quem escreve é o banco (gatilhos e funções); a pessoa só lê as dela e
-- marca como lidas (`mark_notifications_read`). Notificação de alguém com
-- quem há bloqueio (em qualquer sentido) não aparece.
--
-- Novo seguidor: gatilho em `follows`. Seguir, deixar de seguir e seguir de
-- novo no mesmo dia não vira enxurrada: um aviso por pessoa a cada 24 h.
-- =====================================================================

do $$
begin
  if to_regclass('public.follows') is null then
    raise exception 'Rode antes o supabase/14_visibility_and_follows.sql (e os anteriores), depois este.';
  end if;
end;
$$;

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  actor_id   uuid references public.profiles(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type ~ '^[a-z_]{1,40}$')
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------
-- RLS: cada pessoa lê e apaga só as dela (e nunca as de quem tem bloqueio).
-- Ninguém insere nem edita direto.
-- ---------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists "notifications: dono lê" on public.notifications;
create policy "notifications: dono lê"
  on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    and (actor_id is null or not public.is_blocked_with_me(actor_id))
  );

drop policy if exists "notifications: dono apaga" on public.notifications;
create policy "notifications: dono apaga"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.notifications from anon;

-- ---------------------------------------------------------------------
-- Marcar como lidas: todas as de quem pergunta, ou só as dos ids dados.
-- ---------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set read_at = now()
   where user_id = (select auth.uid())
     and read_at is null
     and (p_ids is null or id = any (p_ids));
$$;

revoke execute on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- ---------------------------------------------------------------------
-- Novo seguidor
-- ---------------------------------------------------------------------
create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seguir, deixar de seguir e seguir de novo: um aviso por pessoa por dia.
  if exists (
    select 1 from public.notifications n
     where n.user_id = new.followee_id
       and n.actor_id = new.follower_id
       and n.type = 'new_follower'
       and n.created_at > now() - interval '24 hours'
  ) then
    return null;
  end if;

  insert into public.notifications (user_id, type, actor_id, payload)
  values (
    new.followee_id,
    'new_follower',
    new.follower_id,
    jsonb_build_object(
      -- Quem recebe já seguia quem seguiu: agora são amigos.
      'mutual', exists (
        select 1 from public.follows f
         where f.follower_id = new.followee_id and f.followee_id = new.follower_id
      )
    )
  );
  return null;
end;
$$;

revoke execute on function public.notify_new_follower() from public, anon, authenticated;

drop trigger if exists follows_notify_new_follower on public.follows;
create trigger follows_notify_new_follower
  after insert on public.follows
  for each row execute function public.notify_new_follower();
