-- =====================================================================
-- Vitrine v2 — Tags por categoria
-- Rode no SQL Editor do Supabase, depois de 01 a 48 (o 14, o 26 e o 37 são
-- obrigatórios: este arquivo usa a visibilidade, passa pelas cópias do
-- Explorar e refaz duas funções da Lixeira). Rode DEPOIS de a versão do app
-- com as tags por categoria estar no ar.
--
-- MUDA DADOS DE TODO MUNDO, de propósito (escolha da dona), e não tem volta
-- fácil. Pode rodar mais de uma vez: a migração só mexe nas tags antigas.
--
-- Antes: as tags eram um vocabulário só, de todo mundo, sem dono.
-- Agora: cada tag é de UMA categoria de UMA pessoa (`tags.owner_id` e
-- `tags.category_id`), e o nome não se repete dentro da categoria (sem
-- diferenciar maiúscula).
--
--   1) A migração: cada categoria ganha a sua cópia (mesmo nome e cor) de cada
--      tag antiga que os itens dela usam, e os itens passam a apontar para a
--      cópia. Tags antigas com nomes que só mudam na maiúscula viram uma só
--      por categoria. As tags antigas somem — inclusive as que nenhum item
--      usava. Item que está na Lixeira desde antes deste arquivo volta sem as
--      tags antigas.
--   2) Quem vê e quem mexe: lê a tag quem vê a categoria (e o dono); só o
--      dono cria, edita e apaga.
--   3) Um item só usa tag da própria categoria (gatilho
--      `tag_to_entry_category`): ligar um item a uma tag de outra categoria
--      troca pela de mesmo nome na categoria do item (criada se preciso). Vale
--      para o "Pegar com os itens" e as cópias ligadas do Explorar, para a
--      restauração da Lixeira e para o app.
--   4) Item que muda de categoria leva as tags pelo nome (gatilho
--      `tags_follow_entry`).
--   5) A Lixeira guarda as tags da categoria na foto e devolve ao restaurar
--      (refaz `trash_category_snapshot` e `trash_restore_entries` do 37).
-- =====================================================================

do $$
begin
  if to_regclass('public.tags') is null
     or to_regprocedure('public.category_is_visible(uuid)') is null
     or to_regprocedure('public.apply_linked_copy(uuid, uuid)') is null
     or to_regprocedure('public.trash_category_snapshot(uuid)') is null
     or to_regprocedure('public.trash_restore_entries(jsonb, uuid)') is null then
    raise exception 'Rode antes os arquivos de 01 a 48 (o 14, o 26 e o 37 inclusive), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) Dono e categoria
-- ---------------------------------------------------------------------
alter table public.tags
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade;
alter table public.tags
  add column if not exists category_id uuid references public.categories(id) on delete cascade;

-- O nome único valia para o grupo todo; agora vale dentro da categoria (abaixo).
alter table public.tags drop constraint if exists tags_name_key;

-- ---------------------------------------------------------------------
-- 2) A migração das tags antigas (as que não têm categoria)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.tags t where t.category_id is null) then
    return;
  end if;

  -- Trocar as tags não conta como "você editou" uma cópia do Explorar (26).
  perform set_config('vitrine.syncing', 'on', true);

  drop table if exists _tag_new;
  create temporary table _tag_new on commit drop as
    select g.category_id, g.owner_id, g.key, g.name, g.color, g.created_at,
           gen_random_uuid() as new_id
      from (
        select distinct on (e.category_id, lower(btrim(t.name)))
               e.category_id, c.owner_id, lower(btrim(t.name)) as key,
               t.name, t.color, t.created_at
          from public.entry_tags et
          join public.entries e on e.id = et.entry_id
          join public.categories c on c.id = e.category_id
          join public.tags t on t.id = et.tag_id
         where t.category_id is null
         order by e.category_id, lower(btrim(t.name)), t.created_at
      ) g;

  insert into public.tags (id, name, color, created_at, owner_id, category_id)
  select n.new_id, n.name, n.color, n.created_at, n.owner_id, n.category_id
    from _tag_new n;

  insert into public.entry_tags (entry_id, tag_id)
  select et.entry_id, n.new_id
    from public.entry_tags et
    join public.entries e on e.id = et.entry_id
    join public.tags t on t.id = et.tag_id
    join _tag_new n on n.category_id = e.category_id and n.key = lower(btrim(t.name))
   where t.category_id is null
  on conflict do nothing;

  -- As antigas somem (e os vínculos com elas, pelo cascade).
  delete from public.tags t where t.category_id is null;

  perform set_config('vitrine.syncing', '', true);
end;
$$;

alter table public.tags alter column owner_id set not null;
alter table public.tags alter column category_id set not null;

create unique index if not exists tags_category_name_key
  on public.tags (category_id, lower(btrim(name)));
create index if not exists tags_owner_idx on public.tags (owner_id);

-- ---------------------------------------------------------------------
-- 3) Quem vê e quem mexe
-- ---------------------------------------------------------------------
drop policy if exists "tags: autenticado lê" on public.tags;
drop policy if exists "tags: autenticado cria" on public.tags;
drop policy if exists "tags: autenticado edita" on public.tags;
drop policy if exists "tags: autenticado apaga" on public.tags;

drop policy if exists "tags: quem vê a categoria lê" on public.tags;
create policy "tags: quem vê a categoria lê"
  on public.tags for select to authenticated
  using (owner_id = (select auth.uid()) or public.category_is_visible(category_id));

drop policy if exists "tags: dono cria" on public.tags;
create policy "tags: dono cria"
  on public.tags for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.categories c
                 where c.id = category_id and c.owner_id = (select auth.uid()))
  );

drop policy if exists "tags: dono edita" on public.tags;
create policy "tags: dono edita"
  on public.tags for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.categories c
                 where c.id = category_id and c.owner_id = (select auth.uid()))
  );

drop policy if exists "tags: dono apaga" on public.tags;
create policy "tags: dono apaga"
  on public.tags for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 4) Um item só usa tag da própria categoria
-- ---------------------------------------------------------------------
create or replace function public.tag_to_entry_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category uuid;
  v_owner uuid;
  v_tag public.tags%rowtype;
  v_id uuid;
begin
  select e.category_id, e.owner_id into v_category, v_owner
    from public.entries e
   where e.id = new.entry_id;
  select * into v_tag from public.tags t where t.id = new.tag_id;
  if v_category is null or v_tag.id is null or v_tag.category_id = v_category then
    return new;
  end if;

  -- Tag de outra categoria: a de mesmo nome nesta, criada se preciso.
  select t.id into v_id
    from public.tags t
   where t.category_id = v_category and lower(btrim(t.name)) = lower(btrim(v_tag.name));
  if v_id is null then
    insert into public.tags (name, color, owner_id, category_id)
    values (v_tag.name, v_tag.color, v_owner, v_category)
    on conflict do nothing
    returning id into v_id;
    -- Duas ao mesmo tempo: vale a que entrou primeiro.
    if v_id is null then
      select t.id into v_id
        from public.tags t
       where t.category_id = v_category and lower(btrim(t.name)) = lower(btrim(v_tag.name));
    end if;
  end if;
  new.tag_id := v_id;
  return new;
end;
$$;

revoke execute on function public.tag_to_entry_category() from public, anon, authenticated;

drop trigger if exists entry_tags_to_entry_category on public.entry_tags;
create trigger entry_tags_to_entry_category
  before insert on public.entry_tags
  for each row execute function public.tag_to_entry_category();

-- ---------------------------------------------------------------------
-- 5) Item que muda de categoria leva as tags pelo nome
-- ---------------------------------------------------------------------
create or replace function public.tags_follow_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_syncing text := coalesce(current_setting('vitrine.syncing', true), '');
begin
  -- Levar as tags junto não conta como "você editou" (a mudança em si já conta).
  perform set_config('vitrine.syncing', 'on', true);

  -- O gatilho do passo 4 troca cada uma pela de mesmo nome na categoria nova.
  insert into public.entry_tags (entry_id, tag_id)
  select et.entry_id, et.tag_id
    from public.entry_tags et
    join public.tags t on t.id = et.tag_id
   where et.entry_id = new.id and t.category_id <> new.category_id
  on conflict do nothing;

  delete from public.entry_tags et
   using public.tags t
   where et.entry_id = new.id
     and t.id = et.tag_id
     and t.category_id <> new.category_id;

  perform set_config('vitrine.syncing', v_syncing, true);
  return null;
end;
$$;

revoke execute on function public.tags_follow_entry() from public, anon, authenticated;

drop trigger if exists entries_tags_follow on public.entries;
create trigger entries_tags_follow
  after update of category_id on public.entries
  for each row
  when (new.category_id is distinct from old.category_id)
  execute function public.tags_follow_entry();

-- ---------------------------------------------------------------------
-- 6) A Lixeira guarda e devolve as tags da categoria
-- ---------------------------------------------------------------------
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
    -- As tags da categoria (49): voltam com os mesmos ids ao restaurar.
    'tags', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.tags t where t.category_id = c.id
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

  -- As tags da categoria, antes dos vínculos (49). Foto de antes do 49 não
  -- tem: os itens dela voltam sem as tags antigas.
  insert into public.tags
  select r.*
    from jsonb_array_elements(coalesce(p_snapshot->'tags', '[]'::jsonb)) x
    cross join lateral jsonb_populate_record(null::public.tags, x) r
   where r.owner_id = p_owner
     and exists (select 1 from public.categories c
                  where c.id = r.category_id and c.owner_id = p_owner)
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
