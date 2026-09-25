-- =====================================================================
-- Vitrine v2 — trava a conta demo contra mexer no acervo compartilhado
-- Rode no SQL Editor do Supabase, depois de 01 a 05.
--
-- Dois reforços, depois de revisar a segurança do modo demonstração:
--
-- 1) `is_demo_reader()` (criada em 05_demo_scoped_reads.sql) identificava a
--    conta demo pelo `username`. Mas `username` é editável pelo próprio
--    dono do perfil (tela de Configurações) — um visitante malicioso podia
--    renomear a própria conta demo e, com isso, deixar de "ser" a conta
--    demo aos olhos da política, recuperando a leitura de todo mundo.
--    Troca para o `id` da conta, que é fixo e não muda.
--
--    ATENÇÃO: se a conta demo for recriada do zero (apagada e criada de
--    novo por fora do app), o id abaixo precisa ser atualizado — é o id
--    de hoje, pego com:
--      select id from public.profiles where username = 'demo-vitrine';
--
-- 2) `tags` é vocabulário compartilhado por TODO o grupo (não tem owner_id).
--    A conta demo conseguia criar, renomear e apagar qualquer tag — inclusive
--    as que usuários de verdade já usam. Agora só quem não é a demo pode.
-- =====================================================================

create or replace function public.is_demo_reader()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (select auth.uid()) = '5a67a72f-6737-42c1-a7c3-ecce6554f27f'::uuid;
$$;

drop policy if exists "tags: autenticado cria" on public.tags;
create policy "tags: autenticado cria"
  on public.tags for insert to authenticated
  with check (not public.is_demo_reader());

drop policy if exists "tags: autenticado edita" on public.tags;
create policy "tags: autenticado edita"
  on public.tags for update to authenticated
  using (not public.is_demo_reader()) with check (not public.is_demo_reader());

drop policy if exists "tags: autenticado apaga" on public.tags;
create policy "tags: autenticado apaga"
  on public.tags for delete to authenticated
  using (not public.is_demo_reader());
