-- =====================================================================
-- Vitrine v2 — a conta demo só enxerga o que é dela
-- Rode no SQL Editor do Supabase, depois de 01, 02, 03 e 04.
--
-- O app trata todo autenticado como parte do mesmo grupo: qualquer um lê o
-- perfil, as pastas, categorias e itens de qualquer outro (é assim que
-- /usuarios e /u/[username] funcionam, de propósito). A conta demo
-- (`/demo`, sem login) usa essa mesma sessão autenticada — sem esta
-- migração, qualquer visitante do link de demonstração enxergaria o acervo
-- de verdade de quem convidou.
--
-- `is_demo_reader()` é SECURITY DEFINER: a subconsulta em `profiles` roda
-- com o privilégio de quem definiu a função (o dono da tabela), não fica
-- sujeita à própria política de RLS que está ajudando a decidir — evita a
-- política se referenciar em ciclo.
-- =====================================================================

create or replace function public.is_demo_reader()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select auth.uid()) = (
    select id from public.profiles where username = 'demo-vitrine' limit 1
  ), false);
$$;

-- `anon`/`authenticated` ganham EXECUTE em toda função nova deste projeto por
-- padrão (configuração do próprio Supabase, não do Postgres) — por isso o
-- revoke de `anon` explícito abaixo, além do de `public`. `authenticated`
-- fica com o grant mesmo: é quem de fato avalia esta política em toda
-- consulta a estas tabelas, então precisa continuar podendo chamar.
revoke execute on function public.is_demo_reader() from public, anon;
grant execute on function public.is_demo_reader() to authenticated;

-- profiles: todo mundo lê tudo, exceto a demo, que só lê a si mesma
drop policy if exists "profiles: leitura autenticada" on public.profiles;
create policy "profiles: leitura autenticada"
  on public.profiles for select to authenticated
  using (
    not public.is_demo_reader()
    or id = (select auth.uid())
  );

-- folders / categories / entries: mesma regra, chaveada por owner_id
do $$
declare
  tbl text;
begin
  foreach tbl in array array['folders', 'categories', 'entries'] loop
    execute format(
      'drop policy if exists "%1$s: leitura autenticada" on public.%1$I;
       create policy "%1$s: leitura autenticada"
         on public.%1$I for select to authenticated
         using (
           not public.is_demo_reader()
           or owner_id = (select auth.uid())
         );',
      tbl);
  end loop;
end;
$$;
