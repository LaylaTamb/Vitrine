-- =====================================================================
-- Vitrine v2 — catálogo comum de "coisas" (lugares primeiro)
-- Rode no SQL Editor do Supabase, depois de 01 a 17.
--
-- Aditivo e seguro: nada some, ninguém vê nada novo. Pode rodar mais de uma
-- vez.
--
-- Para saber que dois itens (de pessoas diferentes, ou da mesma) são a MESMA
-- coisa: o mesmo lugar no mapa e, nas próximas fases, o mesmo filme, livro ou
-- jogo. É a base do "Em comum" do Match, do "No Vitrine: quem avaliou" e dos
-- insights agregados.
--
--   catalog_items — uma linha por coisa: tipo, título, ano, coordenadas, os
--     ids externos (`external_ids`: geoapify, osm e, no futuro, google e
--     wikidata — cada um único na tabela) e dados extras (`data`).
--   entry_places.catalog_item_id — o lugar do catálogo de um campo
--     Localização. Preenchido pelo banco (gatilho) quando a geocodificação
--     acha um lugar PRECISO: um estabelecimento ('amenity') ou um prédio
--     ('building'). Bairro, rua e cidade NÃO entram — dois restaurantes do
--     mesmo bairro não são a mesma coisa.
--   entry_places.place_name / result_type / osm_id — o que a Geoapify disse
--     do lugar (o app grava junto da geocodificação).
--   entries.catalog_item_id — para filmes, livros e jogos (Fases 4 e 5).
--
-- Ninguém lê o catálogo direto: ele guarda endereços digitados em itens de
-- todo mundo, inclusive privados (a casa de alguém). Só funções do sistema
-- (SECURITY DEFINER) o usam — as próximas fases criam as que precisarem, e
-- cada uma devolve só o que quem pergunta pode ver.
--
-- Escrita: só pela função `upsert_catalog_place`, chamada pelo gatilho de
-- `entry_places`. O primeiro a gravar um lugar define o título e as
-- coordenadas; os seguintes só se ligam a ele. (Limitação conhecida: como
-- o app grava com a sessão de quem usa, alguém mal-intencionado poderia
-- "inventar" um lugar pelo próprio acervo. Quando o servidor tiver a chave
-- secreta do Supabase, o catálogo passa a ser escrito só por ele.)
--
-- Os lugares que já estavam localizados entram agora (marcados como
-- `source: backfill`, sem o tipo — a precisão deles é desconhecida até o
-- endereço ser procurado de novo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) O catálogo
-- ---------------------------------------------------------------------
create table if not exists public.catalog_items (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  title        text not null,
  year         int,
  lat          double precision,
  lng          double precision,
  external_ids jsonb not null default '{}'::jsonb,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint catalog_items_kind_check check (kind in ('place', 'movie', 'book', 'game')),
  constraint catalog_items_title_check check (char_length(title) between 1 and 300),
  constraint catalog_items_coords_check check (
    (lat is null or lat between -90 and 90) and (lng is null or lng between -180 and 180)
  )
);

create unique index if not exists catalog_items_geoapify_key
  on public.catalog_items ((external_ids->>'geoapify')) where external_ids ? 'geoapify';
create unique index if not exists catalog_items_osm_key
  on public.catalog_items ((external_ids->>'osm')) where external_ids ? 'osm';
create unique index if not exists catalog_items_google_key
  on public.catalog_items ((external_ids->>'google')) where external_ids ? 'google';
create unique index if not exists catalog_items_wikidata_key
  on public.catalog_items ((external_ids->>'wikidata')) where external_ids ? 'wikidata';

drop trigger if exists catalog_items_touch_updated_at on public.catalog_items;
create trigger catalog_items_touch_updated_at
  before update on public.catalog_items
  for each row execute function public.touch_updated_at();

-- RLS ligada e NENHUMA política: nem logado nem anônimo lê ou escreve direto.
alter table public.catalog_items enable row level security;
revoke all on table public.catalog_items from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) As ligações
-- ---------------------------------------------------------------------
alter table public.entry_places add column if not exists place_name text;
alter table public.entry_places add column if not exists result_type text;
alter table public.entry_places add column if not exists osm_id text;
alter table public.entry_places
  add column if not exists catalog_item_id uuid references public.catalog_items(id) on delete set null;
create index if not exists entry_places_catalog_idx on public.entry_places (catalog_item_id);

alter table public.entries
  add column if not exists catalog_item_id uuid references public.catalog_items(id) on delete set null;
create index if not exists entries_catalog_idx on public.entries (catalog_item_id);

-- ---------------------------------------------------------------------
-- 3) Gravar (ou achar) um lugar. Interna: só o gatilho e o backfill chamam.
--    Devolve o id, ou nulo se os dados não servem (o lugar simplesmente não
--    entra no catálogo — a localização do item continua gravada).
-- ---------------------------------------------------------------------
create or replace function public.upsert_catalog_place(
  p_geoapify_id text,
  p_osm_id text,
  p_title text,
  p_lat double precision,
  p_lng double precision,
  p_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_geo   text := nullif(btrim(coalesce(p_geoapify_id, '')), '');
  v_osm   text := nullif(btrim(coalesce(p_osm_id, '')), '');
  v_title text := left(nullif(btrim(coalesce(p_title, '')), ''), 300);
  v_id    uuid;
begin
  if (v_geo is null and v_osm is null)
     or v_title is null
     or p_lat is null or p_lng is null
     or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    return null;
  end if;

  select c.id into v_id
    from public.catalog_items c
   where (v_geo is not null and c.external_ids->>'geoapify' = v_geo)
      or (v_osm is not null and c.external_ids->>'osm' = v_osm)
   limit 1;

  if v_id is null then
    insert into public.catalog_items (kind, title, lat, lng, external_ids, data)
    values (
      'place', v_title, p_lat, p_lng,
      jsonb_strip_nulls(jsonb_build_object('geoapify', v_geo, 'osm', v_osm)),
      coalesce(p_data, '{}'::jsonb)
    )
    -- Dois ao mesmo tempo: o índice único segura, e o segundo só lê.
    on conflict do nothing
    returning id into v_id;

    if v_id is null then
      select c.id into v_id
        from public.catalog_items c
       where (v_geo is not null and c.external_ids->>'geoapify' = v_geo)
          or (v_osm is not null and c.external_ids->>'osm' = v_osm)
       limit 1;
    end if;
    return v_id;
  end if;

  -- Já existe: o que já estava manda. Só completa o que faltava (um id
  -- externo novo, se ninguém mais o usa; chaves novas em `data`).
  update public.catalog_items c
     set external_ids = case
           when v_osm is not null
                and not (c.external_ids ? 'osm')
                and not exists (
                  select 1 from public.catalog_items o where o.external_ids->>'osm' = v_osm
                )
             then c.external_ids || jsonb_build_object('osm', v_osm)
           else c.external_ids
         end,
         data = coalesce(p_data, '{}'::jsonb) || c.data
   where c.id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.upsert_catalog_place(text, text, text, double precision, double precision, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) O gatilho: cada localização PRECISA vira (ou acha) o seu lugar
-- ---------------------------------------------------------------------
create or replace function public.link_entry_place_to_catalog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'ok' or new.place_id is null then
    new.catalog_item_id := null;
    return new;
  end if;

  -- Sem o tipo (linha antiga, ou gravada pelo código de antes deste SQL):
  -- fica como está.
  if new.result_type is null then
    return new;
  end if;

  if new.result_type in ('amenity', 'building') then
    new.catalog_item_id := public.upsert_catalog_place(
      new.place_id,
      new.osm_id,
      coalesce(new.place_name, new.formatted_address, new.address),
      new.lat,
      new.lng,
      jsonb_strip_nulls(jsonb_build_object(
        'result_type', new.result_type,
        'name', new.place_name,
        'formatted_address', new.formatted_address
      ))
    );
  else
    new.catalog_item_id := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.link_entry_place_to_catalog() from public, anon, authenticated;

drop trigger if exists entry_places_link_catalog on public.entry_places;
create trigger entry_places_link_catalog
  before insert or update on public.entry_places
  for each row execute function public.link_entry_place_to_catalog();

-- ---------------------------------------------------------------------
-- 5) O que já estava localizado
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select ep.entry_id, ep.field_id, ep.place_id, ep.lat, ep.lng,
           coalesce(ep.formatted_address, ep.address) as title,
           ep.formatted_address
      from public.entry_places ep
     where ep.status = 'ok'
       and ep.place_id is not null
       and ep.catalog_item_id is null
       and ep.result_type is null
  loop
    update public.entry_places
       set catalog_item_id = public.upsert_catalog_place(
             r.place_id, null, r.title, r.lat, r.lng,
             jsonb_strip_nulls(jsonb_build_object(
               'formatted_address', r.formatted_address,
               'source', 'backfill'
             ))
           )
     where entry_id = r.entry_id and field_id = r.field_id;
  end loop;
end;
$$;
