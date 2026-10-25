-- =====================================================================
-- Vitrine v2 — Capas das categorias (as fotos dos itens no card)
-- Rode no SQL Editor do Supabase, depois de 01 a 39 (o 14 é obrigatório:
-- a view segue as regras de leitura dele).
--
-- Aditivo e seguro: só uma view. Pode rodar mais de uma vez.
--
--   category_covers — até 3 imagens por categoria: as dos itens com a maior
--     nota (empate pela ordem da categoria). É `security_invoker`, como a
--     `category_entry_counts`: cada pessoa só recebe fotos de itens que ela
--     já pode ver — o privado de outra pessoa não vaza pela capa.
--
-- Sem ela o app funciona igual: os cards ficam com o ícone, sem fotos.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.category_is_visible(uuid)') is null then
    raise exception 'Rode antes os arquivos de 01 a 39 (o 14 inclusive), depois este.';
  end if;
end;
$$;

create or replace view public.category_covers
with (security_invoker = true) as
  select category_id, owner_id, image_url, position
    from (
      select e.category_id,
             e.owner_id,
             e.image_url,
             -- Dono na partição de propósito: assim o `owner_id = …` de quem lê
             -- desce para dentro da janela, e o banco não monta capa de todo mundo.
             row_number() over (
               partition by e.owner_id, e.category_id
               order by e.rating desc nulls last, e.display_order, e.created_at
             )::int as position
        from public.entries e
       where e.image_url is not null and btrim(e.image_url) <> ''
    ) ranked
   where position <= 3;

revoke all on public.category_covers from anon;
grant select on public.category_covers to authenticated;
