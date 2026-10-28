-- =====================================================================
-- Vitrine v2 — Match: apaga as cópias antigas
-- Rode no SQL Editor do Supabase, depois de 01 a 45 — e só DEPOIS de a
-- versão do app com a lista nova do match estar no ar (a versão antiga
-- remonta a cópia quando alguém toca em "Ver o match").
--
-- DESTRUTIVO, de propósito (escolha da dona): apaga DE VEZ, de todo mundo,
-- as categorias de cópia de match (`kind` 'match', SQL 31) com os itens
-- delas — não passam pela Lixeira. Pode rodar mais de uma vez.
--
-- O que fica: os matches em si (viram a lista nova, do 45), o que alguém já
-- trouxe para a "A organizar" (são itens próprios) e qualquer outra coisa
-- das Coleções. A pasta "Matches" (a da raiz, onde as cópias moravam) só é
-- apagada se ficar vazia — sem categoria e sem subpasta.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.match_blend_pool(uuid)') is null then
    raise exception 'Rode antes os arquivos de 01 a 45, depois este.';
  end if;
end;
$$;

-- `match_members.category_id` vira nulo sozinho (on delete set null, SQL 31);
-- os itens, as tags e as localizações deles vão junto (cascade).
delete from public.categories where kind = 'match';

delete from public.folders f
 where f.parent_folder_id is null
   and lower(btrim(f.name)) = 'matches'
   and not exists (select 1 from public.categories c where c.folder_id = f.id)
   and not exists (select 1 from public.folders s where s.parent_folder_id = f.id);
