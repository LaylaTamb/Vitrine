-- =====================================================================
-- Vitrine v2 — importações (Google Maps pelo Takeout e Letterboxd)
-- Rode no SQL Editor do Supabase, depois de 01 a 28 (o 21 e o 24 são
-- obrigatórios: este arquivo usa o sininho e `entries.source`/`source_id`).
--
-- Aditivo e seguro: só uma função. Pode rodar mais de uma vez.
--
-- O resto das importações já estava no banco: `entries.source` +
-- `entries.source_id` (migração 24, únicos por dono) é o que faz reimportar
-- não duplicar; a visibilidade das categorias novas é o padrão do perfil
-- (gatilho do 14); e os lugares sem coordenadas entram na fila de busca de
-- endereços que o Mapa já tem.
--
-- `notify_import_done(origem, novos, sem_endereço)` — o aviso no sininho de
-- quem importou, quando a importação termina. Só para si mesmo.
-- =====================================================================

do $$
begin
  if to_regclass('public.notifications') is null
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'entries' and column_name = 'source'
     ) then
    raise exception 'Rode antes o supabase/21_notifications.sql e o 24_connected_accounts.sql (e os demais anteriores), depois este.';
  end if;
end;
$$;

create or replace function public.notify_import_done(p_source text, p_added int, p_pending int default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;
  if p_source not in ('google', 'letterboxd') then
    raise exception 'Origem desconhecida.' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, type, actor_id, payload)
  values (
    v_me,
    'import_done',
    null,
    jsonb_build_object(
      'source', p_source,
      'added', greatest(0, least(coalesce(p_added, 0), 1000000)),
      'pending', greatest(0, least(coalesce(p_pending, 0), 1000000))
    )
  );
end;
$$;

revoke execute on function public.notify_import_done(text, int, int) from public, anon;
grant execute on function public.notify_import_done(text, int, int) to authenticated;
