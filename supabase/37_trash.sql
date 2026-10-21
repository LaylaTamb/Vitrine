-- =====================================================================
-- Vitrine v2 — Lixeira: pastas, categorias e subpastas por 30 dias
-- Rode no SQL Editor do Supabase, depois de 01 a 36 (usa tabelas do 11, 18,
-- 20, 24, 25, 26 e 31).
--
-- Aditivo e seguro: uma tabela nova e funções. Pode rodar mais de uma vez.
--
-- Apagar uma PASTA, uma CATEGORIA ou uma SUBPASTA (com o que tem dentro)
-- passa por aqui: uma "foto" completa vai para `trash_items` — a categoria
-- com os itens, as subpastas, as tags, as localizações, o favorito e as
-- ligações das cópias — e só então a original é apagada. Itens soltos não
-- passam pela lixeira (apagar item continua direto, com a confirmação).
--
--   trash_category / trash_folder / trash_entry_folder — apagar para a lixeira;
--   restore_trash_item — devolve tudo, com os mesmos ids. Se o lugar de origem
--     não existe mais, volta para a raiz (das Coleções, ou da categoria);
--     nome de categoria repetido ganha "(restaurada)". Subpasta precisa da
--     categoria dela de volta antes. O que pode ter sumido nesse meio-tempo
--     (um lugar do catálogo, a conta de um amigo, a original de uma cópia)
--     fica em branco, em vez de travar a restauração;
--   delete_trash_item / empty_my_trash — excluir de vez, agora;
--   purge_my_expired_trash — o que passou de 30 dias some (a tela chama ao abrir);
--   purge_expired_trash(segredo) — o mesmo para todo mundo, pelo Cron da
--     Vercel (`/api/cron/lixeira`), com o segredo do servidor (migração 24).
--
-- Só o dono lê a própria lixeira (RLS); ninguém escreve nela direto.
-- =====================================================================

do $$
begin
  if to_regclass('public.entry_places') is null
     or to_regclass('public.catalog_items') is null
     or to_regclass('public.category_favorites') is null
     or to_regprocedure('public.server_secret_ok(text)') is null
     or to_regclass('public.connected_accounts') is null
     or to_regclass('public.category_imports') is null
     or to_regclass('public.linked_entry_receipts') is null
     or to_regprocedure('public.build_my_match_copy(uuid)') is null then
    raise exception 'Rode antes os arquivos de 01 a 36, depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) A tabela
-- ---------------------------------------------------------------------
create table if not exists public.trash_items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  name        text not null,
  icon        text,
  -- onde morava, em palavras ("Coleções › Comida", "em Restaurantes")
  location    text,
  item_count  int not null default 0,
  payload     jsonb not null,
  deleted_at  timestamptz not null default now(),
  purge_after timestamptz not null default now() + interval '30 days',
  constraint trash_items_kind_check check (kind in ('folder', 'category', 'entry_folder'))
);

create index if not exists trash_items_owner_idx on public.trash_items (owner_id, deleted_at desc);
create index if not exists trash_items_purge_idx on public.trash_items (purge_after);

alter table public.trash_items enable row level security;
revoke all on table public.trash_items from anon, authenticated;
grant select on table public.trash_items to authenticated;

drop policy if exists "trash_items: dono lê" on public.trash_items;
create policy "trash_items: dono lê"
  on public.trash_items for select to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 2) Ajudantes (internos)
-- ---------------------------------------------------------------------

-- "Coleções › Bebidas › Suco" — o caminho de uma pasta (nula = a raiz).
create or replace function public.folder_path_label(p_folder_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select f.id, f.name, f.parent_folder_id, 1 as depth
      from public.folders f
     where f.id = p_folder_id
    union all
    select f.id, f.name, f.parent_folder_id, c.depth + 1
      from public.folders f
      join chain c on f.id = c.parent_folder_id
     where c.depth < 64
  )
  select 'Coleções' || coalesce(
           (select string_agg(' › ' || name, '' order by depth desc) from chain), ''
         );
$$;

revoke execute on function public.folder_path_label(uuid) from public, anon, authenticated;

-- A foto completa de uma categoria.
create or replace function public.trash_category_snapshot(p_category_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'category', to_jsonb(c),
    'entry_folders', coalesce((
      select jsonb_agg(to_jsonb(f)) from public.entry_folders f where f.category_id = c.id
    ), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(to_jsonb(e)) from public.entries e where e.category_id = c.id
    ), '[]'::jsonb),
    'entry_tags', coalesce((
      select jsonb_agg(to_jsonb(t))
        from public.entry_tags t
        join public.entries e on e.id = t.entry_id
       where e.category_id = c.id
    ), '[]'::jsonb),
    'entry_places', coalesce((
      select jsonb_agg(to_jsonb(p))
        from public.entry_places p
        join public.entries e on e.id = p.entry_id
       where e.category_id = c.id
    ), '[]'::jsonb),
    'favorite', (
      select to_jsonb(fv) from public.category_favorites fv where fv.category_id = c.id
    ),
    'imports', coalesce((
      select jsonb_agg(to_jsonb(i) - 'id')
        from public.category_imports i
       where i.source_category_id = c.id
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(to_jsonb(r))
        from public.linked_entry_receipts r
       where r.category_id = c.id
    ), '[]'::jsonb)
  )
  from public.categories c
  where c.id = p_category_id;
$$;

revoke execute on function public.trash_category_snapshot(uuid) from public, anon, authenticated;

-- Um item da foto, com o que pode ter sumido nesse meio-tempo em branco: o
-- lugar do catálogo e a conta de quem era o original (numa cópia de match).
create or replace function public.trash_entry_row(p_entry jsonb)
returns public.entries
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_populate_record(
           null::public.entries,
           p_entry || jsonb_build_object(
             'catalog_item_id', case
               when exists (select 1 from public.catalog_items ci
                             where ci.id = (p_entry->>'catalog_item_id')::uuid)
               then p_entry->'catalog_item_id' end,
             'match_owner_id', case
               when exists (select 1 from public.profiles pr
                             where pr.id = (p_entry->>'match_owner_id')::uuid)
               then p_entry->'match_owner_id' end
           )
         );
$$;

revoke execute on function public.trash_entry_row(jsonb) from public, anon, authenticated;

-- Os itens, as tags e as localizações de uma foto (de categoria ou de
-- subpasta), já com as subpastas no lugar. Item que voltaria repetido (a
-- mesma origem, ex.: a Steam já trouxe o jogo de novo) fica de fora.
create or replace function public.trash_restore_entries(p_snapshot jsonb, p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.entries
  select r.*
    from jsonb_array_elements(coalesce(p_snapshot->'entries', '[]'::jsonb)) x
    cross join lateral public.trash_entry_row(x) r
   where r.owner_id = p_owner
  on conflict do nothing;

  insert into public.entry_tags (entry_id, tag_id)
  select (x->>'entry_id')::uuid, (x->>'tag_id')::uuid
    from jsonb_array_elements(coalesce(p_snapshot->'entry_tags', '[]'::jsonb)) x
   where exists (select 1 from public.entries e
                  where e.id = (x->>'entry_id')::uuid and e.owner_id = p_owner)
     and exists (select 1 from public.tags t where t.id = (x->>'tag_id')::uuid)
  on conflict do nothing;

  insert into public.entry_places
  select r.*
    from jsonb_array_elements(coalesce(p_snapshot->'entry_places', '[]'::jsonb)) x
    cross join lateral jsonb_populate_record(
      null::public.entry_places,
      x || jsonb_build_object(
        'catalog_item_id', case
          when exists (select 1 from public.catalog_items ci
                        where ci.id = (x->>'catalog_item_id')::uuid)
          then x->'catalog_item_id' end
      )
    ) r
   where exists (select 1 from public.entries e
                  where e.id = r.entry_id and e.owner_id = p_owner)
  on conflict do nothing;
end;
$$;

revoke execute on function public.trash_restore_entries(jsonb, uuid) from public, anon, authenticated;

-- As subpastas de uma foto: primeiro todas soltas, depois as mães de volta
-- (assim a ordem de inserção não importa). A de cima vai para `p_top_parent`.
create or replace function public.trash_restore_entry_folders(
  p_folders jsonb,
  p_top_id uuid,
  p_top_parent uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.entry_folders
  select r.*
    from jsonb_array_elements(coalesce(p_folders, '[]'::jsonb)) x
    cross join lateral jsonb_populate_record(
      null::public.entry_folders, x || jsonb_build_object('parent_folder_id', null)
    ) r
  on conflict do nothing;

  update public.entry_folders f
     set parent_folder_id = case
           when f.id = p_top_id then p_top_parent
           else (x->>'parent_folder_id')::uuid
         end
    from jsonb_array_elements(coalesce(p_folders, '[]'::jsonb)) x
   where f.id = (x->>'id')::uuid
     and (f.id = p_top_id or x->>'parent_folder_id' is not null);
end;
$$;

revoke execute on function public.trash_restore_entry_folders(jsonb, uuid, uuid)
  from public, anon, authenticated;

-- Uma categoria de volta (na pasta `p_folder_id`, ou na raiz).
create or replace function public.trash_restore_category(
  p_snapshot jsonb,
  p_owner uuid,
  p_folder_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category public.categories;
  v_base text;
  v_name text;
  v_try int := 1;
  v_favorite jsonb := p_snapshot->'favorite';
begin
  v_category := jsonb_populate_record(null::public.categories, p_snapshot->'category');
  if v_category.owner_id is distinct from p_owner then
    raise exception 'Isto não é seu.' using errcode = '42501';
  end if;

  v_category.folder_id := case
    when exists (select 1 from public.folders f where f.id = p_folder_id and f.owner_id = p_owner)
    then p_folder_id end;
  -- O que pode ter sumido: a original (modelo ou cópia) e o match.
  if not exists (select 1 from public.categories c where c.id = v_category.source_category_id) then
    v_category.source_category_id := null;
    v_category.linked := false;
  end if;
  if not exists (select 1 from public.matches m where m.id = v_category.match_id) then
    v_category.match_id := null;
  end if;

  -- O nome é único por pessoa: repetido ganha "(restaurada)".
  v_base := left(v_category.name, 64);
  v_name := v_category.name;
  while exists (select 1 from public.categories c where c.owner_id = p_owner and c.name = v_name) loop
    v_name := v_base || case when v_try = 1 then ' (restaurada)' else ' (restaurada ' || v_try || ')' end;
    v_try := v_try + 1;
  end loop;
  v_category.name := v_name;

  insert into public.categories select (v_category).*;

  perform public.trash_restore_entry_folders(p_snapshot->'entry_folders', null, null);
  perform public.trash_restore_entries(p_snapshot, p_owner);

  if v_favorite is not null and jsonb_typeof(v_favorite) = 'object' then
    insert into public.category_favorites (category_id, owner_id, entry_id, tab_position)
    values (
      v_category.id,
      p_owner,
      case when exists (select 1 from public.entries e
                         where e.id = (v_favorite->>'entry_id')::uuid
                           and e.category_id = v_category.id)
           then (v_favorite->>'entry_id')::uuid end,
      (v_favorite->>'tab_position')::int
    )
    on conflict do nothing;
  end if;

  insert into public.category_imports
    (source_category_id, target_category_id, user_id, mode, created_at)
  select v_category.id,
         case when exists (select 1 from public.categories c
                            where c.id = (x->>'target_category_id')::uuid)
              then (x->>'target_category_id')::uuid end,
         (x->>'user_id')::uuid,
         x->>'mode',
         coalesce((x->>'created_at')::timestamptz, now())
    from jsonb_array_elements(coalesce(p_snapshot->'imports', '[]'::jsonb)) x
   where exists (select 1 from public.profiles pr where pr.id = (x->>'user_id')::uuid);

  insert into public.linked_entry_receipts
  select r.*
    from jsonb_array_elements(coalesce(p_snapshot->'receipts', '[]'::jsonb)) x
    cross join lateral jsonb_populate_record(null::public.linked_entry_receipts, x) r
  on conflict do nothing;

  -- A categoria da Steam volta a ser a da Steam (senão, a próxima sincronização
  -- criaria outra "Jogos").
  if exists (select 1
               from jsonb_array_elements(coalesce(p_snapshot->'entries', '[]'::jsonb)) x
              where x->>'source' = 'steam') then
    update public.connected_accounts ca
       set category_id = v_category.id
     where ca.user_id = p_owner
       and ca.provider = 'steam'
       and (ca.category_id is null
            or not exists (select 1 from public.categories c where c.id = ca.category_id));
  end if;

  -- A cópia de um match volta a ser a do match (senão, abrir montaria outra).
  if v_category.kind = 'match' and v_category.match_id is not null then
    update public.match_members mm
       set category_id = v_category.id
     where mm.match_id = v_category.match_id
       and mm.user_id = p_owner
       and (mm.category_id is null
            or not exists (select 1 from public.categories c where c.id = mm.category_id));
  end if;

  return jsonb_build_object(
    'id', v_category.id,
    'name', v_category.name,
    'renamed', v_category.name <> (p_snapshot->'category'->>'name')
  );
end;
$$;

revoke execute on function public.trash_restore_category(jsonb, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Apagar para a lixeira
-- ---------------------------------------------------------------------
create or replace function public.trash_category(p_category_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_category public.categories;
  v_trash uuid;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;
  select * into v_category from public.categories c where c.id = p_category_id and c.owner_id = v_me;
  if v_category.id is null then
    raise exception 'Categoria não encontrada.' using errcode = 'P0002';
  end if;
  if v_category.kind = 'inbox' then
    raise exception 'inbox_locked';
  end if;

  insert into public.trash_items (owner_id, kind, name, icon, location, item_count, payload)
  values (
    v_me,
    'category',
    v_category.name,
    v_category.icon,
    public.folder_path_label(v_category.folder_id),
    (select count(*) from public.entries e where e.category_id = v_category.id),
    jsonb_build_object(
      'folder_id', v_category.folder_id,
      'category', public.trash_category_snapshot(v_category.id)
    )
  )
  returning id into v_trash;

  delete from public.categories c where c.id = v_category.id;
  return v_trash;
end;
$$;

revoke execute on function public.trash_category(uuid) from public, anon;
grant execute on function public.trash_category(uuid) to authenticated;

create or replace function public.trash_folder(p_folder_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_folder public.folders;
  v_trash uuid;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;
  select * into v_folder from public.folders f where f.id = p_folder_id and f.owner_id = v_me;
  if v_folder.id is null then
    raise exception 'Pasta não encontrada.' using errcode = 'P0002';
  end if;

  with recursive tree as (
    select f.id, 0 as depth from public.folders f where f.id = v_folder.id
    union all
    select f.id, t.depth + 1
      from public.folders f
      join tree t on f.parent_folder_id = t.id
     where t.depth < 64
  )
  insert into public.trash_items (owner_id, kind, name, icon, location, item_count, payload)
  select v_me,
         'folder',
         v_folder.name,
         null,
         public.folder_path_label(v_folder.parent_folder_id),
         (select count(*)
            from public.entries e
            join public.categories c on c.id = e.category_id
           where c.folder_id in (select id from tree)),
         jsonb_build_object(
           'parent_id', v_folder.parent_folder_id,
           'folders', (select jsonb_agg(to_jsonb(f) order by t.depth)
                         from tree t join public.folders f on f.id = t.id),
           'categories', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'folder_id', c.folder_id,
                      'category', public.trash_category_snapshot(c.id)
                    ))
               from public.categories c
              where c.folder_id in (select id from tree)
           ), '[]'::jsonb)
         )
  returning id into v_trash;

  -- O `on delete cascade` leva as subpastas, as categorias e os itens.
  delete from public.folders f where f.id = v_folder.id;
  return v_trash;
end;
$$;

revoke execute on function public.trash_folder(uuid) from public, anon;
grant execute on function public.trash_folder(uuid) to authenticated;

create or replace function public.trash_entry_folder(p_entry_folder_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_folder public.entry_folders;
  v_trash uuid;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;
  select * into v_folder from public.entry_folders f where f.id = p_entry_folder_id and f.owner_id = v_me;
  if v_folder.id is null then
    raise exception 'Subpasta não encontrada.' using errcode = 'P0002';
  end if;

  with recursive tree as (
    select f.id, 0 as depth from public.entry_folders f where f.id = v_folder.id
    union all
    select f.id, t.depth + 1
      from public.entry_folders f
      join tree t on f.parent_folder_id = t.id
     where t.depth < 64
  )
  insert into public.trash_items (owner_id, kind, name, icon, location, item_count, payload)
  select v_me,
         'entry_folder',
         v_folder.name,
         null,
         'em ' || coalesce((select c.name from public.categories c where c.id = v_folder.category_id), '?'),
         (select count(*) from public.entries e where e.folder_id in (select id from tree)),
         jsonb_build_object(
           'category_id', v_folder.category_id,
           'parent_id', v_folder.parent_folder_id,
           'entry_folders', (select jsonb_agg(to_jsonb(f) order by t.depth)
                               from tree t join public.entry_folders f on f.id = t.id),
           'entries', coalesce((
             select jsonb_agg(to_jsonb(e))
               from public.entries e where e.folder_id in (select id from tree)
           ), '[]'::jsonb),
           'entry_tags', coalesce((
             select jsonb_agg(to_jsonb(et))
               from public.entry_tags et
               join public.entries e on e.id = et.entry_id
              where e.folder_id in (select id from tree)
           ), '[]'::jsonb),
           'entry_places', coalesce((
             select jsonb_agg(to_jsonb(p))
               from public.entry_places p
               join public.entries e on e.id = p.entry_id
              where e.folder_id in (select id from tree)
           ), '[]'::jsonb)
         )
  returning id into v_trash;

  -- O `on delete cascade` leva as subpastas de dentro e os itens.
  delete from public.entry_folders f where f.id = v_folder.id;
  return v_trash;
end;
$$;

revoke execute on function public.trash_entry_folder(uuid) from public, anon;
grant execute on function public.trash_entry_folder(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4) Restaurar
-- ---------------------------------------------------------------------
create or replace function public.restore_trash_item(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_item public.trash_items;
  v_result jsonb;
  v_parent uuid;
  v_category uuid;
  v_top uuid;
  v_entry jsonb;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;
  select * into v_item from public.trash_items t where t.id = p_id and t.owner_id = v_me for update;
  if v_item.id is null then
    raise exception 'Isso não está mais na lixeira.' using errcode = 'P0002';
  end if;

  -- Voltar não conta como "você mexeu" numa cópia ligada.
  perform set_config('vitrine.syncing', 'on', true);

  if v_item.kind = 'category' then
    v_result := public.trash_restore_category(
      v_item.payload->'category', v_me, (v_item.payload->>'folder_id')::uuid
    );

  elsif v_item.kind = 'folder' then
    v_parent := (v_item.payload->>'parent_id')::uuid;
    if not exists (select 1 from public.folders f where f.id = v_parent and f.owner_id = v_me) then
      v_parent := null;
    end if;
    v_top := (v_item.payload->'folders'->0->>'id')::uuid;

    -- As pastas soltas primeiro; depois as mães de volta (a de cima: `v_parent`).
    insert into public.folders
    select r.*
      from jsonb_array_elements(v_item.payload->'folders') x
      cross join lateral jsonb_populate_record(
        null::public.folders, x || jsonb_build_object('parent_folder_id', null)
      ) r
    on conflict do nothing;
    update public.folders f
       set parent_folder_id = case when f.id = v_top then v_parent
                                   else (x->>'parent_folder_id')::uuid end
      from jsonb_array_elements(v_item.payload->'folders') x
     where f.id = (x->>'id')::uuid
       and (f.id = v_top or x->>'parent_folder_id' is not null);

    for v_entry in select value from jsonb_array_elements(coalesce(v_item.payload->'categories', '[]'::jsonb))
    loop
      perform public.trash_restore_category(
        v_entry->'category', v_me, (v_entry->>'folder_id')::uuid
      );
    end loop;
    v_result := jsonb_build_object('id', v_top, 'name', v_item.name, 'renamed', false);

  else
    v_category := (v_item.payload->>'category_id')::uuid;
    if not exists (select 1 from public.categories c where c.id = v_category and c.owner_id = v_me) then
      raise exception 'A categoria desta subpasta não existe mais. Se ela estiver na lixeira, restaure a categoria primeiro.'
        using errcode = '22023';
    end if;
    v_parent := (v_item.payload->>'parent_id')::uuid;
    if not exists (select 1 from public.entry_folders f
                    where f.id = v_parent and f.category_id = v_category) then
      v_parent := null;
    end if;
    v_top := (v_item.payload->'entry_folders'->0->>'id')::uuid;
    perform public.trash_restore_entry_folders(v_item.payload->'entry_folders', v_top, v_parent);
    perform public.trash_restore_entries(v_item.payload, v_me);
    v_result := jsonb_build_object(
      'id', v_top, 'name', v_item.name, 'renamed', false, 'category_id', v_category
    );
  end if;

  delete from public.trash_items t where t.id = v_item.id;
  return v_result || jsonb_build_object('kind', v_item.kind);
end;
$$;

revoke execute on function public.restore_trash_item(uuid) from public, anon;
grant execute on function public.restore_trash_item(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Excluir de vez
-- ---------------------------------------------------------------------
create or replace function public.delete_trash_item(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.trash_items t where t.id = p_id and t.owner_id = (select auth.uid());
$$;

revoke execute on function public.delete_trash_item(uuid) from public, anon;
grant execute on function public.delete_trash_item(uuid) to authenticated;

create or replace function public.empty_my_trash()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.trash_items t where t.owner_id = (select auth.uid());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.empty_my_trash() from public, anon;
grant execute on function public.empty_my_trash() to authenticated;

create or replace function public.purge_my_expired_trash()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.trash_items t
   where t.owner_id = (select auth.uid()) and t.purge_after < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_my_expired_trash() from public, anon;
grant execute on function public.purge_my_expired_trash() to authenticated;

-- Para o Cron da Vercel: o que passou de 30 dias, de todo mundo.
create or replace function public.purge_expired_trash(p_secret text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.server_secret_ok(p_secret) then
    raise exception 'Segredo do servidor inválido.' using errcode = '42501';
  end if;
  delete from public.trash_items t where t.purge_after < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_expired_trash(text) from public;
grant execute on function public.purge_expired_trash(text) to anon, authenticated;
