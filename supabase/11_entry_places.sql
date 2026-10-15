-- =====================================================================
-- Vitrine v2 — localização dos itens (o Mapa)
-- Rode no SQL Editor do Supabase, depois de 01 a 10.
--
-- Aditivo e seguro: uma tabela nova, uma chave única nova em `entries` e uma
-- função. Nada muda para quem já usa o app.
--
-- Um campo do tipo "Localização" guarda em `entries.custom_fields` o TEXTO do
-- endereço — busca, filtro, ordenação e backup continuam iguais. Esta tabela
-- é só o cache da busca desse texto na Geoapify (Geocoding API, dados do
-- OpenStreetMap): uma linha por (item, campo de Localização), com
-- coordenadas, place_id (o id da Geoapify) e a situação.
-- `address` é o texto exato que foi procurado: o app só mostra o pino quando
-- ele bate com o texto atual do campo.
--
-- Sem prazo: os termos da Geoapify deixam guardar o resultado. A coordenada
-- só é procurada de novo quando o texto do endereço muda.
--
-- Integridade: a FK composta `(entry_id, owner_id)` garante no próprio banco
-- que a linha é do mesmo dono do item, e `on delete cascade` leva a linha
-- junto quando o item (ou a categoria dele) é excluído.
-- =====================================================================

-- O alvo da FK composta: (id, owner_id) de `entries` precisa ser único. É,
-- porque `id` já é a chave primária — a restrição só formaliza isso.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'entries_id_owner_key'
       and conrelid = 'public.entries'::regclass
  ) then
    alter table public.entries
      add constraint entries_id_owner_key unique (id, owner_id);
  end if;
end;
$$;

create table if not exists public.entry_places (
  entry_id          uuid not null,
  -- o id estável do campo na `estrutura` da categoria (não é único entre
  -- categorias: o Restaurantes de exemplo usa o mesmo id para todo mundo)
  field_id          text not null,
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  address           text not null,
  formatted_address text,
  lat               double precision,
  lng               double precision,
  place_id          text,
  status            text not null default 'pending',
  -- quando o endereço foi procurado pela última vez
  geocoded_at       timestamptz,
  primary key (entry_id, field_id),
  constraint entry_places_entry_fkey
    foreign key (entry_id, owner_id)
    references public.entries (id, owner_id)
    on delete cascade,
  constraint entry_places_status_check
    check (status in ('pending', 'ok', 'not_found', 'error')),
  constraint entry_places_address_check
    check (char_length(address) between 1 and 300),
  constraint entry_places_ok_has_coords_check
    check (status <> 'ok' or (lat is not null and lng is not null))
);

create index if not exists entry_places_owner_status_idx
  on public.entry_places (owner_id, status);

-- ---------------------------------------------------------------------
-- RLS — mesmo modelo das outras tabelas: o grupo lê, o dono escreve.
-- A escrita também confere que o ITEM é de quem está gravando (não basta o
-- owner_id da própria linha).
-- ---------------------------------------------------------------------
alter table public.entry_places enable row level security;

drop policy if exists "entry_places: leitura autenticada" on public.entry_places;
create policy "entry_places: leitura autenticada"
  on public.entry_places for select to authenticated
  using (true);

drop policy if exists "entry_places: dono insere" on public.entry_places;
create policy "entry_places: dono insere"
  on public.entry_places for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.entries e
      where e.id = entry_id and e.owner_id = (select auth.uid())
    )
  );

drop policy if exists "entry_places: dono edita" on public.entry_places;
create policy "entry_places: dono edita"
  on public.entry_places for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.entries e
      where e.id = entry_id and e.owner_id = (select auth.uid())
    )
  );

drop policy if exists "entry_places: dono apaga" on public.entry_places;
create policy "entry_places: dono apaga"
  on public.entry_places for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Limpeza depois de editar a estrutura de uma categoria: apaga as linhas
-- dos itens dela cujo campo NÃO é mais de Localização (campo removido, ou
-- trocado para outro tipo — inclusive pelo modo JSON do editor).
-- `p_field_ids` são os campos de Localização que continuam existindo.
--
-- SECURITY INVOKER: roda com o papel de quem chama, então a RLS de delete
-- (só o dono) continua valendo.
-- ---------------------------------------------------------------------
create or replace function public.prune_entry_places(
  p_category_id uuid,
  p_field_ids text[]
)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.entry_places p
   using public.entries e
   where e.id = p.entry_id
     and e.category_id = p_category_id
     and not (p.field_id = any (coalesce(p_field_ids, '{}'::text[])));
$$;

-- Só quem está logado chama (o Supabase dá EXECUTE a anon por padrão).
revoke execute on function public.prune_entry_places(uuid, text[]) from public, anon;
grant execute on function public.prune_entry_places(uuid, text[]) to authenticated;
