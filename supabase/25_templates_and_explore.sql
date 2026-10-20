-- =====================================================================
-- Vitrine v2 — modelos: começar uma categoria da estrutura de outra
-- Rode no SQL Editor do Supabase, depois de 01 a 24 (o 14, o 17 e o 19 são
-- obrigatórios: este arquivo usa as regras de visibilidade,
-- `categories.kind` e `categories.quick_field`).
--
-- Aditivo e seguro: duas colunas novas em `categories` (vazias), uma tabela
-- nova e funções. Pode rodar mais de uma vez.
--
--   categories.source_category_id — de qual categoria esta veio (modelo ou,
--     na Etapa 4.2, cópia com itens). Os ids dos campos vêm iguais: é o que
--     deixa trocar um item entre as duas sem perder valor.
--   categories.linked — a cópia continua ligada à original (Etapa 4.2).
--   category_imports — cada vez que alguém criou uma categoria a partir de
--     outra pública: é daí que saem o "usado por N" e o "mais copiadas".
--     Quem grava é um gatilho (ninguém insere à mão, então a contagem não dá
--     para inflar); cada pessoa lê só as suas.
--
-- `search_public_categories(busca, ordem)` lista as categorias públicas de
-- fato (nível Pública e nenhuma pasta acima fechando), com campos, de outras
-- pessoas, para usar como modelo: com o @ do autor, a estrutura inteira e
-- quantas pessoas já usaram. A busca compara o nome normalizado
-- (`normalize_category_name`: minúsculas, sem acento, singular simples —
-- a mesma regra de `normalizeCategoryName` em lib/domain/templates.ts;
-- mudou uma, mude a outra).
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'categories' and column_name = 'quick_field'
  ) or not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'categories' and column_name = 'kind'
  ) then
    raise exception 'Rode antes os arquivos de 01 a 24 (o 17 e o 19 inclusive), depois este.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1) Nome normalizado
-- ---------------------------------------------------------------------
create or replace function public.normalize_category_name(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select btrim(regexp_replace(
           -- 5) o resto: tira o "s" final de palavra com 4+ letras (filmes → filme)
           regexp_replace(
             -- 4) álbuns → album, bens → bem
             regexp_replace(
               -- 3) bares → bar, flores → flor, luzes → luz
               regexp_replace(
                 -- 2) animais → animal
                 regexp_replace(
                   -- 1) lições → licao
                   regexp_replace(
                     regexp_replace(
                       translate(
                         lower(coalesce(p_name, '')),
                         'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
                         'aaaaaaeeeeiiiiooooouuuucnyy'
                       ),
                       '[^a-z0-9]+', ' ', 'g'
                     ),
                     '([a-z]{2,})oes\M', '\1ao', 'g'
                   ),
                   '([a-z]{2,})ais\M', '\1al', 'g'
                 ),
                 '([a-z]{2,})(r|z)es\M', '\1\2', 'g'
               ),
               '([a-z]{2,})ns\M', '\1m', 'g'
             ),
             '([a-z]{3,})s\M', '\1', 'g'
           ),
           '\s+', ' ', 'g'
         ));
$$;

-- ---------------------------------------------------------------------
-- 2) De onde a categoria veio
-- ---------------------------------------------------------------------
alter table public.categories
  add column if not exists source_category_id uuid references public.categories(id) on delete set null;
alter table public.categories add column if not exists linked boolean not null default false;

create index if not exists categories_source_idx
  on public.categories (source_category_id) where source_category_id is not null;

create table if not exists public.category_imports (
  id                 bigint generated always as identity primary key,
  source_category_id uuid not null references public.categories(id) on delete cascade,
  target_category_id uuid references public.categories(id) on delete set null,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  mode               text not null,
  created_at         timestamptz not null default now(),
  constraint category_imports_mode_check check (mode in ('structure', 'linked'))
);

create index if not exists category_imports_source_idx
  on public.category_imports (source_category_id, user_id);
create index if not exists category_imports_user_idx on public.category_imports (user_id);

alter table public.category_imports enable row level security;

drop policy if exists "category_imports: dono lê" on public.category_imports;
create policy "category_imports: dono lê"
  on public.category_imports for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.category_imports from anon;
revoke insert, update, delete on table public.category_imports from authenticated;

-- Criou uma categoria a partir de outra PÚBLICA de outra pessoa: conta. (A
-- própria categoria, ou uma que não é pública, não entra na contagem.)
create or replace function public.record_category_import()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_category_id is not null and exists (
    select 1 from public.categories c
     where c.id = new.source_category_id
       and c.owner_id <> new.owner_id
       and public.visibility_allows(c.owner_id, c.visibility, null)
       and (c.folder_id is null or public.folder_chain_allows(c.folder_id, null))
  ) then
    insert into public.category_imports (source_category_id, target_category_id, user_id, mode)
    values (
      new.source_category_id,
      new.id,
      new.owner_id,
      case when new.linked then 'linked' else 'structure' end
    );
  end if;
  return null;
end;
$$;

revoke execute on function public.record_category_import() from public, anon, authenticated;

drop trigger if exists categories_record_import on public.categories;
create trigger categories_record_import
  after insert on public.categories
  for each row execute function public.record_category_import();

-- ---------------------------------------------------------------------
-- 3) A busca de modelos
-- ---------------------------------------------------------------------
-- p_sort: 'relevance' (com busca: nome igual, depois começando, depois
-- contendo; empate pelo mais usado), 'popular' (mais copiadas) ou 'recent'.
-- Sem busca, 'relevance' vira 'popular'. Até 50 por vez.
create or replace function public.search_public_categories(
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
    select jsonb_agg(row_to_json(found)::jsonb - 'rank' - 'normalized' order by
             case when v_sort = 'relevance' then found.rank end,
             case when v_sort = 'recent' then found.created_at end desc,
             found.uses desc,
             found.created_at desc)
      from (
        select c.id,
               c.name,
               c.icon,
               c.color,
               c.estrutura,
               c.rating_enabled,
               c.default_sort,
               c.quick_field,
               c.created_at,
               jsonb_build_object(
                 'username', p.username,
                 'display_name', p.display_name,
                 'avatar_url', p.avatar_url
               ) as owner,
               (select count(distinct i.user_id)::int
                  from public.category_imports i
                 where i.source_category_id = c.id) as uses,
               public.normalize_category_name(c.name) as normalized,
               case
                 when public.normalize_category_name(c.name) = v_query then 0
                 when public.normalize_category_name(c.name) like v_query || '%' then 1
                 else 2
               end as rank
          from public.categories c
          join public.profiles p on p.id = c.owner_id
         where c.owner_id <> v_viewer
           and c.kind <> 'inbox'
           and jsonb_typeof(c.estrutura) = 'array'
           and jsonb_array_length(c.estrutura) > 0
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
           c.created_at desc
         limit least(greatest(coalesce(p_limit, 30), 1), 50)
      ) found
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.search_public_categories(text, text, int) from public, anon;
grant execute on function public.search_public_categories(text, text, int) to authenticated;
