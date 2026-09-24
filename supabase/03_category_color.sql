-- =====================================================================
-- Vitrine v2 — cor de categoria
-- Rode no SQL Editor do Supabase, depois de 01_schema.sql e 02_rls.sql.
--
-- Aditivo e seguro: coluna nova, nula por padrão. Categorias existentes
-- continuam sem cor (visual de sempre) até o dono escolher uma na tela de
-- estrutura. A validação de que a cor pertence à paleta de 8 cores é feita
-- na aplicação (como já acontece com `tags.color`) — não há CHECK aqui.
-- =====================================================================

alter table public.categories
  add column if not exists color text;
