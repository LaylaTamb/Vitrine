-- =====================================================================
-- Vitrine v2 — avaliação opcional por categoria e ordem manual
-- Rode no SQL Editor do Supabase, depois de 01 a 09.
--
-- Aditivo e seguro: colunas novas com padrão, e duas funções de
-- reordenação. Nada muda para quem já usa o app:
--
--   categories.rating_enabled  — `true` (padrão) = a categoria usa a nota de
--                                0 a 5 estrelas. `false` = lista simples, sem
--                                nota nenhuma (o app apaga as notas dos itens
--                                ao desligar, e recusa nota nova).
--   categories.default_sort    — a ordenação que a categoria abre por padrão:
--                                recent | rating_desc | rating_asc | name_asc
--                                | manual. Validada na aplicação.
--   entries.display_order      — a "ordem manual" dos itens dentro do mesmo
--                                nível (categoria + subpasta). Os itens que
--                                já existem ganham a ordem em que foram
--                                criados.
--
-- As funções `reorder_*` gravam a ordem nova de um nível inteiro em UM
-- update. São SECURITY INVOKER: rodam com o papel de quem chama, então a RLS
-- de update (só o dono) continua valendo — id de outra pessoa é ignorado
-- em silêncio.
-- =====================================================================

alter table public.categories
  add column if not exists rating_enabled boolean not null default true;

alter table public.categories
  add column if not exists default_sort text not null default 'recent';

alter table public.entries
  add column if not exists display_order int not null default 0;

-- Reordenar não é editar: o `updated_at` só anda quando muda alguma coisa
-- além da posição. (Vale já para o preenchimento logo abaixo.)
drop trigger if exists entries_touch_updated_at on public.entries;
create trigger entries_touch_updated_at
  before update on public.entries
  for each row
  when (
    (to_jsonb(old) - 'display_order' - 'updated_at')
      is distinct from (to_jsonb(new) - 'display_order' - 'updated_at')
  )
  execute function public.touch_updated_at();

-- Ordem inicial = ordem de criação, nível a nível (categoria + subpasta).
with ranked as (
  select id,
         row_number() over (
           partition by category_id, folder_id
           order by created_at, id
         ) - 1 as position
  from public.entries
)
update public.entries e
   set display_order = ranked.position
  from ranked
 where ranked.id = e.id
   and e.display_order is distinct from ranked.position;

-- Subpastas que ainda estão todas em 0: ordem alfabética vira a ordem salva.
with ranked as (
  select id,
         row_number() over (
           partition by category_id, parent_folder_id
           order by display_order, name, id
         ) - 1 as position
  from public.entry_folders
)
update public.entry_folders f
   set display_order = ranked.position
  from ranked
 where ranked.id = f.id
   and f.display_order is distinct from ranked.position;

create index if not exists entries_level_order_idx
  on public.entries (category_id, folder_id, display_order);

-- ---------------------------------------------------------------------
-- Reordenar um nível inteiro: a posição de cada id em `p_ids` vira o
-- display_order (começando em `p_start`).
-- ---------------------------------------------------------------------
create or replace function public.reorder_entries(
  p_category_id uuid,
  p_ids uuid[],
  p_start int default 0
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.entries e
     set display_order = p_start + array_position(p_ids, e.id) - 1
   where e.category_id = p_category_id
     and e.id = any (p_ids);
$$;

create or replace function public.reorder_entry_folders(
  p_category_id uuid,
  p_ids uuid[]
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.entry_folders f
     set display_order = array_position(p_ids, f.id) - 1
   where f.category_id = p_category_id
     and f.id = any (p_ids);
$$;

-- Só quem está logado chama (o Supabase dá EXECUTE a anon por padrão).
revoke execute on function public.reorder_entries(uuid, uuid[], int) from public, anon;
revoke execute on function public.reorder_entry_folders(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_entries(uuid, uuid[], int) to authenticated;
grant execute on function public.reorder_entry_folders(uuid, uuid[]) to authenticated;
