-- =====================================================================
-- Vitrine v2 — o campo principal de cada categoria (acesso rápido)
-- Rode no SQL Editor do Supabase, depois de 01 a 18.
--
-- Aditivo e seguro: toda categoria que já existe começa com 'name'. Pode
-- rodar mais de uma vez.
--
--   categories.quick_field — o campo que o acesso rápido (compartilhar do
--     celular, "você está em X?") pede além do Nome:
--       'name'   — nenhum além do Nome (o padrão);
--       'rating' — as Estrelas (só vale com as estrelas ligadas);
--       <id>     — um campo da `estrutura` (o mesmo id de `custom_fields`).
--     Não aparece em destaque nos cards: serve só para o acesso rápido.
--
-- Quem garante que o valor aponta para algo que existe é o app: ao salvar a
-- estrutura, campo removido ou estrelas desligadas voltam para 'name'; e, ao
-- ler, um valor que não vale mais conta como 'name' (`quickFieldOf`).
-- =====================================================================

alter table public.categories
  add column if not exists quick_field text not null default 'name';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'categories_quick_field_check'
                    and conrelid = 'public.categories'::regclass) then
    alter table public.categories add constraint categories_quick_field_check
      check (char_length(quick_field) between 1 and 80);
  end if;
end;
$$;
