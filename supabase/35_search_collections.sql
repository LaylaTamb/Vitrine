-- =====================================================================
-- Vitrine v2 — Busca nas Coleções: os itens
-- Rode no SQL Editor do Supabase, depois de 01 a 34.
--
-- Aditivo e seguro: só funções novas. Pode rodar mais de uma vez.
--
--   search_text(texto) — minúsculas, sem acento e com os espaços juntos: a
--     forma que a busca compara ("Café  da Manhã" → "cafe da manha"). A tela
--     faz o mesmo com o que se digita (`normalizeSearch`, em
--     lib/domain/search.ts) — mudou uma, mude a outra.
--   search_my_items(busca, limite) — os SEUS itens cujo nome, alguma tag ou o
--     valor de algum campo contém o que foi digitado (pelo menos 2 letras).
--     Ficam de fora os itens das cópias de match (são dos amigos). Cada um
--     volta com a categoria e o motivo de ter sido achado (o nome, a tag ou
--     o campo com o valor). Os que batem no nome vêm primeiro.
--
-- Pastas e categorias a tela já tem: ela mesma procura nelas.
-- =====================================================================

create or replace function public.search_text(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select btrim(regexp_replace(
           translate(
             lower(coalesce(p_text, '')),
             'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
             'aaaaaaeeeeiiiiooooouuuucnyy'
           ),
           '\s+', ' ', 'g'
         ));
$$;

create or replace function public.search_my_items(p_query text, p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_me uuid := (select auth.uid());
  v_query text := public.search_text(left(coalesce(p_query, ''), 80));
  v_escaped text;
  v_contains text;
  v_prefix text;
begin
  if v_me is null then
    raise exception 'É preciso entrar na conta.' using errcode = '42501';
  end if;
  if length(v_query) < 2 then
    return '[]'::jsonb;
  end if;

  -- O que foi digitado vale ao pé da letra: % e _ não viram curinga.
  v_escaped := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');
  v_contains := '%' || v_escaped || '%';
  v_prefix := v_escaped || '%';

  return coalesce((
    select jsonb_agg(to_jsonb(hit) - 'name_key' order by hit.rank, hit.name_key)
      from (
        select e.id,
               e.name,
               e.category_id,
               e.rating,
               e.image_url,
               e.image_display,
               c.name as category_name,
               c.icon as category_icon,
               c.color as category_color,
               c.folder_id as category_folder_id,
               case
                 when public.search_text(e.name) like v_prefix then 0
                 when public.search_text(e.name) like v_contains then 1
                 when tag.name is not null then 2
                 else 3
               end as rank,
               case
                 when public.search_text(e.name) like v_contains then 'name'
                 when tag.name is not null then 'tag'
                 else 'field'
               end as matched,
               coalesce(tag.name, field.value) as match_value,
               field.label as match_label,
               public.search_text(e.name) as name_key
          from public.entries e
          join public.categories c on c.id = e.category_id
          left join lateral (
            select t.name
              from public.entry_tags et
              join public.tags t on t.id = et.tag_id
             where et.entry_id = e.id
               and public.search_text(t.name) like v_contains
             order by t.name
             limit 1
          ) tag on true
          left join lateral (
            select f.value,
                   (select d->>'nome'
                      from jsonb_array_elements(
                             case when jsonb_typeof(c.estrutura) = 'array' then c.estrutura
                                  else '[]'::jsonb end
                           ) d
                     where d->>'id' = f.key
                     limit 1) as label
              from jsonb_each_text(
                     case when jsonb_typeof(e.custom_fields) = 'object' then e.custom_fields
                          else '{}'::jsonb end
                   ) f
             where public.search_text(f.value) like v_contains
             limit 1
          ) field on true
         where e.owner_id = v_me
           and coalesce(c.kind, 'normal') <> 'match'
           and (
             public.search_text(e.name) like v_contains
             or tag.name is not null
             or field.value is not null
           )
         order by rank, name_key
         limit least(greatest(coalesce(p_limit, 40), 1), 100)
      ) hit
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.search_my_items(text, int) from public, anon;
grant execute on function public.search_my_items(text, int) to authenticated;
