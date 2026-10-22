-- =====================================================================
-- Vitrine v2 — Cartão de apresentação com até 6 categorias
-- Rode no SQL Editor do Supabase, depois de 01 a 37 (o 23 é obrigatório:
-- este arquivo troca a trava que ele criou).
--
-- Aditivo e seguro: só troca a trava de `profiles.card_category_ids` de
-- 5 para 6 categorias. Nenhum cartão muda. Pode rodar mais de uma vez.
--
-- Sem ele o app funciona igual, e escolher a 6ª categoria no Editar cartão
-- avisa que falta rodar este arquivo.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'card_category_ids'
  ) then
    raise exception 'Rode antes os arquivos de 01 a 37 (o 23 inclusive), depois este.';
  end if;
end;
$$;

alter table public.profiles drop constraint if exists profiles_card_categories_check;
alter table public.profiles add constraint profiles_card_categories_check
  check (cardinality(card_category_ids) <= 6);
