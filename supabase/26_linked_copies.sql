-- =====================================================================
-- Vitrine v2 — Explorar: pegar uma categoria pública COM os itens, numa
-- cópia ligada à original
-- Rode no SQL Editor do Supabase, depois de 01 a 25 (o 25 é obrigatório:
-- este arquivo usa `categories.source_category_id`, `categories.linked` e a
-- contagem de cópias).
--
-- Aditivo e seguro: colunas novas (vazias), uma tabela nova e funções.
-- Pode rodar mais de uma vez.
--
--   entries.source_entry_id   — de qual item da original este veio;
--   entries.edited_after_copy — você mexeu nele depois da cópia (nome, nota,
--     imagem, campos ou tags): o autor não sobrescreve mais;
--   entries.source_removed_at — o autor apagou (ou tirou da categoria) o
--     item original: o seu fica, marcado "removido do original";
--   categories.linked_synced_at — a última sincronização da cópia ligada;
--   linked_entry_receipts — os itens da original que a cópia já recebeu: um
--     item que você apagou da cópia não volta.
--
-- As regras da ligação (`sync_linked_category`, ao abrir a categoria, no
-- máximo a cada 10 minutos):
--   • itens novos do autor chegam (até 500 por vez);
--   • edição do autor atualiza os itens que você NÃO editou;
--   • item apagado pelo autor continua no seu, marcado;
--   • original que ficou privada (ou de amigos), foi apagada, ou com
--     bloqueio entre vocês: a ligação se desfaz (`linked = false`) e a sua
--     cópia fica como está;
--   • você pode desligar quando quiser (a categoria é sua: `linked = false`).
--
-- `copy_category_with_items(origem)` cria a cópia (até 500 itens: nome,
-- imagem, enquadramento, campos — com os mesmos ids —, tags, nota e as
-- localizações já encontradas) e `explore_public_categories(busca, ordem)`
-- lista as categorias públicas com itens para o Explorar.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'categories' and column_name = 'linked'
  ) then
    raise exception 'Rode antes o supabase/25_templates_and_explore.sql (e os anteriores), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) Colunas e tabela
-- ---------------------------------------------------------------------
-- Sem chave estrangeira de propósito: quando o autor apaga o original, o id
-- continua aqui — é assim que a cópia sabe que ele foi "removido do original".
alter table public.entries add column if not exists source_entry_id uuid;
alter table public.entries add column if not exists edited_after_copy boolean not null default false;
alter table public.entries add column if not exists source_removed_at timestamptz;
alter table public.categories add column if not exists linked_synced_at timestamptz;

create index if not exists entries_source_entry_idx
  on public.entries (category_id, source_entry_id) where source_entry_id is not null;

create table if not exists public.linked_entry_receipts (
  category_id     uuid not null references public.categories(id) on delete cascade,
  source_entry_id uuid not null,
  received_at     timestamptz not null default now(),
  primary key (category_id, source_entry_id)
);

-- Só as funções abaixo mexem (RLS ligada, sem política).
alter table public.linked_entry_receipts enable row level security;
revoke all on table public.linked_entry_receipts from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) "Você editou": qualquer mudança sua num item copiado (fora a
--    sincronização, que avisa por `vitrine.syncing`)
-- ---------------------------------------------------------------------
create or replace function public.mark_copy_edited()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_entry_id is not null
     and coalesce(current_setting('vitrine.syncing', true), '') <> 'on'
     and (new.name, new.rating, new.image_url, new.image_display, new.custom_fields)
         is distinct from
         (old.name, old.rating, old.image_url, old.image_display, old.custom_fields) then
    new.edited_after_copy := true;
  end if;
  return new;
end;
$$;

revoke execute on function public.mark_copy_edited() from public, anon, authenticated;

drop trigger if exists entries_mark_copy_edited on public.entries;
create trigger entries_mark_copy_edited
  before update on public.entries
  for each row execute function public.mark_copy_edited();

create or replace function public.mark_copy_edited_by_tags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry uuid := coalesce(new.entry_id, old.entry_id);
begin
  if coalesce(current_setting('vitrine.syncing', true), '') <> 'on' then
    update public.entries
       set edited_after_copy = true
     where id = v_entry
       and source_entry_id is not null
       and not edited_after_copy;
  end if;
  return null;
end;
$$;

revoke execute on function public.mark_copy_edited_by_tags() from public, anon, authenticated;

drop trigger if exists entry_tags_mark_copy_edited on public.entry_tags;
create trigger entry_tags_mark_copy_edited
  after insert or delete on public.entry_tags
  for each row execute function public.mark_copy_edited_by_tags();

-- ---------------------------------------------------------------------
-- 3) O coração: aplica a original na cópia (interna — sem EXECUTE para o app)
-- ---------------------------------------------------------------------
create or replace function public.apply_linked_copy(p_category uuid, p_source uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat public.categories%rowtype;
  v_updated_ids uuid[] := '{}';
  v_new_ids uuid[] := '{}';
  v_removed int := 0;
  v_base int;
begin
  select * into v_cat from public.categories where id = p_category;

  -- A sincronização não conta como "você editou".
  perform set_config('vitrine.syncing', 'on', true);

  -- a) Apagado (ou tirado da categoria) pelo autor: marca, não apaga.
  update public.entries e
     set source_removed_at = now()
   where e.category_id = p_category
     and e.source_entry_id is not null
     and e.source_removed_at is null
     and not exists (
       select 1 from public.entries s
        where s.id = e.source_entry_id and s.category_id = p_source
     );
  get diagnostics v_removed = row_count;

  -- b) Editado pelo autor: atualiza só o que você não editou.
  with changed as (
    update public.entries e
       set name          = s.name,
           rating        = case when v_cat.rating_enabled then s.rating end,
           image_url     = s.image_url,
           image_display = s.image_display,
           custom_fields = s.custom_fields
      from public.entries s
     where e.category_id = p_category
       and e.source_entry_id = s.id
       and s.category_id = p_source
       and not e.edited_after_copy
       and e.source_removed_at is null
       and (e.name, e.rating, e.image_url, e.image_display, e.custom_fields)
           is distinct from
           (s.name, case when v_cat.rating_enabled then s.rating end, s.image_url,
            s.image_display, s.custom_fields)
    returning e.id
  )
  select coalesce(array_agg(id), '{}') into v_updated_ids from changed;

  -- Tags dos que você não editou: iguais às do original.
  delete from public.entry_tags et
   using public.entries e
   where et.entry_id = e.id
     and e.category_id = p_category
     and e.source_entry_id is not null
     and not e.edited_after_copy
     and e.source_removed_at is null
     and not exists (
       select 1 from public.entry_tags st
        where st.entry_id = e.source_entry_id and st.tag_id = et.tag_id
     );
  insert into public.entry_tags (entry_id, tag_id)
  select e.id, st.tag_id
    from public.entries e
    join public.entry_tags st on st.entry_id = e.source_entry_id
   where e.category_id = p_category
     and not e.edited_after_copy
     and e.source_removed_at is null
  on conflict do nothing;

  -- c) Novos do autor (os que a cópia ainda não recebeu), até 500 por vez,
  --    no fim da ordem manual da cópia.
  select coalesce(max(e.display_order), -1) into v_base
    from public.entries e
   where e.category_id = p_category and e.folder_id is null;

  with fresh as (
    select s.*, row_number() over (order by s.display_order, s.created_at) as position
      from public.entries s
     where s.category_id = p_source
       and not exists (
         select 1 from public.linked_entry_receipts r
          where r.category_id = p_category and r.source_entry_id = s.id
       )
     order by s.display_order, s.created_at
     limit 500
  ),
  inserted as (
    insert into public.entries
    select r.*
      from fresh f
      cross join lateral jsonb_populate_record(
              null::public.entries,
              to_jsonb(f) || jsonb_build_object(
                'id', gen_random_uuid(),
                'category_id', p_category,
                'owner_id', v_cat.owner_id,
                'folder_id', null,
                'display_order', v_base + f.position,
                'rating', case when v_cat.rating_enabled then f.rating end,
                'source', null,
                'source_id', null,
                'source_entry_id', f.id,
                'edited_after_copy', false,
                'source_removed_at', null,
                'updated_at', now()
              )
            ) as r
    returning id, source_entry_id
  ),
  received as (
    insert into public.linked_entry_receipts (category_id, source_entry_id)
    select p_category, source_entry_id from inserted
    on conflict do nothing
  )
  select coalesce(array_agg(id), '{}') into v_new_ids from inserted;

  insert into public.entry_tags (entry_id, tag_id)
  select e.id, st.tag_id
    from public.entries e
    join public.entry_tags st on st.entry_id = e.source_entry_id
   where e.id = any (v_new_ids)
  on conflict do nothing;

  -- As localizações já encontradas vêm junto (sem gastar busca de endereço).
  delete from public.entry_places where entry_id = any (v_updated_ids);
  insert into public.entry_places
  select r.*
    from public.entries e
    join public.entry_places ep on ep.entry_id = e.source_entry_id
    cross join lateral jsonb_populate_record(
            null::public.entry_places,
            to_jsonb(ep) || jsonb_build_object('entry_id', e.id, 'owner_id', v_cat.owner_id)
          ) as r
   where e.id = any (v_new_ids || v_updated_ids)
  on conflict do nothing;

  update public.categories set linked_synced_at = now() where id = p_category;

  return jsonb_build_object(
    'added', coalesce(array_length(v_new_ids, 1), 0),
    'updated', coalesce(array_length(v_updated_ids, 1), 0),
    'removed', v_removed
  );
end;
$$;

revoke execute on function public.apply_linked_copy(uuid, uuid) from public, anon, authenticated;

-- A original ainda vale para a ligação? (Pública de fato, sem bloqueio.)
create or replace function public.linked_source_ok(p_source uuid, p_viewer uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select public.visibility_allows(c.owner_id, c.visibility, null)
       and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null))
       and not public.is_blocked(p_viewer, c.owner_id)
      from public.categories c
     where c.id = p_source
  ), false);
$$;

revoke execute on function public.linked_source_ok(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Pegar com itens
-- Devolve {"category_id", "copied", "total"} — `total` = itens da original
-- (se passar de 500, vêm os 500 primeiros da ordem manual dela).
-- ---------------------------------------------------------------------
create or replace function public.copy_category_with_items(p_source uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_src public.categories%rowtype;
  v_author text;
  v_name text;
  v_try int := 1;
  v_new uuid;
  v_result jsonb;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  select * into v_src from public.categories where id = p_source;
  if not found or v_src.owner_id = v_me or v_src.kind = 'inbox'
     or not public.linked_source_ok(p_source, v_me) then
    raise exception 'Esta categoria não está disponível para pegar.' using errcode = 'P0002';
  end if;

  select p.username into v_author from public.profiles p where p.id = v_src.owner_id;

  -- O nome é único por dono: "Vinhos", senão "Vinhos (@ana)", "Vinhos (@ana) 2"…
  v_name := v_src.name;
  while exists (select 1 from public.categories c where c.owner_id = v_me and c.name = v_name) loop
    v_try := v_try + 1;
    v_name := case
                when v_try = 2 then v_src.name || ' (@' || v_author || ')'
                else v_src.name || ' (@' || v_author || ') ' || (v_try - 1)
              end;
  end loop;

  -- A visibilidade fica com o padrão do perfil (gatilho do 14); o gatilho do
  -- 25 conta mais uma cópia ('linked') na original.
  insert into public.categories
    (owner_id, name, icon, color, folder_id, display_order, estrutura, rating_enabled,
     default_sort, quick_field, source_category_id, linked)
  values (
    v_me,
    v_name,
    v_src.icon,
    v_src.color,
    null,
    coalesce((select max(c.display_order) + 1 from public.categories c
               where c.owner_id = v_me and c.folder_id is null), 0),
    v_src.estrutura,
    v_src.rating_enabled,
    v_src.default_sort,
    v_src.quick_field,
    p_source,
    true
  )
  returning id into v_new;

  v_result := public.apply_linked_copy(v_new, p_source);

  return jsonb_build_object(
    'category_id', v_new,
    'copied', (v_result->>'added')::int,
    'total', (select count(*) from public.entries e where e.category_id = p_source)
  );
end;
$$;

revoke execute on function public.copy_category_with_items(uuid) from public, anon;
grant execute on function public.copy_category_with_items(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Sincronizar a cópia ligada (a página da categoria chama ao abrir)
-- Devolve {"status": "not_linked" | "unlinked" | "fresh" | "synced",
--          "author", "added", "updated", "removed"}.
-- ---------------------------------------------------------------------
create or replace function public.sync_linked_category(p_category uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_cat public.categories%rowtype;
  v_author text;
  v_result jsonb;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  select * into v_cat
    from public.categories
   where id = p_category and owner_id = v_me
     for update;
  if not found or not v_cat.linked or v_cat.source_category_id is null then
    return jsonb_build_object('status', 'not_linked');
  end if;

  if not public.linked_source_ok(v_cat.source_category_id, v_me) then
    update public.categories set linked = false where id = p_category;
    return jsonb_build_object('status', 'unlinked');
  end if;

  select p.username into v_author
    from public.categories c
    join public.profiles p on p.id = c.owner_id
   where c.id = v_cat.source_category_id;

  if not p_force and v_cat.linked_synced_at is not null
     and v_cat.linked_synced_at > now() - interval '10 minutes' then
    return jsonb_build_object('status', 'fresh', 'author', v_author);
  end if;

  v_result := public.apply_linked_copy(p_category, v_cat.source_category_id);
  return v_result || jsonb_build_object('status', 'synced', 'author', v_author);
end;
$$;

revoke execute on function public.sync_linked_category(uuid, boolean) from public, anon;
grant execute on function public.sync_linked_category(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 6) O Explorar: categorias públicas COM itens, de outras pessoas
-- p_sort: 'relevance' (com busca), 'popular' (mais copiadas) ou 'recent'.
-- Cada uma traz o @ do autor, os campos, quantos itens, quantas pessoas já
-- pegaram e os 3 melhores itens (maior nota; empate pelo nome).
-- ---------------------------------------------------------------------
create or replace function public.explore_public_categories(
  p_query text default '',
  p_sort text default 'relevance',
  p_limit int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_query text := public.normalize_category_name(left(coalesce(p_query, ''), 80));
  v_sort text := case
                   when p_sort in ('popular', 'recent') then p_sort
                   when v_query = '' then 'popular'
                   else 'relevance'
                 end;
begin
  if v_viewer is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(found)::jsonb - 'rank' order by
             case when v_sort = 'relevance' then found.rank end,
             case when v_sort = 'recent' then found.created_at end desc,
             found.uses desc,
             found.total desc,
             found.created_at desc)
      from (
        select c.id,
               c.name,
               c.icon,
               c.color,
               c.estrutura,
               c.rating_enabled,
               c.created_at,
               jsonb_build_object(
                 'username', p.username,
                 'display_name', p.display_name,
                 'avatar_url', p.avatar_url
               ) as owner,
               counts.total,
               (select count(distinct i.user_id)::int
                  from public.category_imports i
                 where i.source_category_id = c.id) as uses,
               coalesce((
                 select jsonb_agg(jsonb_build_object('name', t.name, 'rating', t.rating)
                                  order by t.rank)
                   from (
                     select e.name, e.rating,
                            row_number() over (
                              order by case when c.rating_enabled then e.rating end desc nulls last,
                                       lower(e.name)
                            ) as rank
                       from public.entries e
                      where e.category_id = c.id
                   ) t
                  where t.rank <= 3
               ), '[]'::jsonb) as preview,
               case
                 when public.normalize_category_name(c.name) = v_query then 0
                 when public.normalize_category_name(c.name) like v_query || '%' then 1
                 else 2
               end as rank
          from public.categories c
          join public.profiles p on p.id = c.owner_id
          cross join lateral (
            select count(*)::int as total from public.entries e where e.category_id = c.id
          ) counts
         where c.owner_id <> v_viewer
           and c.kind <> 'inbox'
           and counts.total > 0
           and public.visibility_allows(c.owner_id, c.visibility, null)
           and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null))
           and not public.is_blocked(v_viewer, c.owner_id)
           and (v_query = '' or public.normalize_category_name(c.name) like '%' || v_query || '%')
         order by
           case when v_sort = 'relevance' then
             case
               when public.normalize_category_name(c.name) = v_query then 0
               when public.normalize_category_name(c.name) like v_query || '%' then 1
               else 2
             end
           end,
           case when v_sort = 'recent' then c.created_at end desc,
           uses desc,
           counts.total desc,
           c.created_at desc
         limit least(greatest(coalesce(p_limit, 30), 1), 50)
      ) found
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.explore_public_categories(text, text, int) from public, anon;
grant execute on function public.explore_public_categories(text, text, int) to authenticated;
