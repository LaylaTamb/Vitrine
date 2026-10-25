-- =====================================================================
-- Vitrine v2 — Índice do feed do Início
-- Rode no SQL Editor do Supabase, depois de 01 a 40 (só o 01 é obrigatório:
-- é ele que cria a tabela dos itens).
--
-- Aditivo e seguro: só um índice. Pode rodar mais de uma vez.
--
--   entries_owner_created_idx — o Início lê os itens mais novos de quem você
--     segue ("dono em tal lista, do mais novo para o mais velho"). Com este
--     índice o banco vai direto aos mais recentes de cada pessoa, em vez de
--     ler todos os itens delas e ordenar. Quem decide o que você vê continua
--     sendo a RLS dos itens (a mesma do resto do app).
--
-- Sem ele o app funciona igual: o Início só fica mais lento com acervos grandes.
-- =====================================================================

do $$
begin
  if to_regclass('public.entries') is null then
    raise exception 'Rode antes o 01_schema.sql, depois este.';
  end if;
end;
$$;

create index if not exists entries_owner_created_idx
  on public.entries (owner_id, created_at desc);
