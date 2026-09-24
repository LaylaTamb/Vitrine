-- =====================================================================
-- Vitrine v2 — hardening de segurança e performance
-- Rode no SQL Editor do Supabase, depois de 01, 02 e 03.
--
-- Achados pelo Advisor de segurança/performance do próprio Supabase:
--
-- 1) `derive_username`, `handle_new_user` e `seed_profile` são
--    SECURITY DEFINER (rodam com privilégio elevado) e só deveriam ser
--    chamadas pelo gatilho `on_auth_user_created`. Por serem
--    SECURITY DEFINER, o PostgREST expunha as três em
--    `/rest/v1/rpc/<nome>` pra qualquer papel — até `anon`, sem login.
--
--    O Postgres concede EXECUTE a `PUBLIC` por padrão em toda função
--    nova — revogar só de `anon`/`authenticated` NÃO fecha isso, porque
--    a concessão a `PUBLIC` vale pra todo mundo independente de revoke
--    em role nomeada. Por isso o revoke abaixo é de `public` mesmo.
--
--    Mas quem dispara o gatilho `on_auth_user_created` é o serviço de
--    Auth do Supabase, conectado como `supabase_auth_admin` — uma role
--    que NÃO é superusuário nem membro de `postgres`/`service_role`.
--    Sem um grant explícito pra ela, revogar de `public` quebraria o
--    cadastro de gente nova. Por isso o grant final, só pra ela.
--    (Verificado via ACL num projeto real: sem o grant, o convite de um
--    usuário novo pararia de criar o perfil dele.)
--
-- 2) `touch_updated_at` não tinha `search_path` fixo — mesmo hardening
--    que as funções SECURITY DEFINER já tinham em 01_schema.sql.
--
-- 3) Toda política de RLS chamava `auth.uid()` direto, que o Postgres
--    reavalia LINHA A LINHA. Trocar por `(select auth.uid())` deixa o
--    otimizador avaliar uma vez só por consulta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Funções internas do trigger de novo usuário: tira do RPC público,
-- mas mantém quem de fato precisa continuar chamando.
-- ---------------------------------------------------------------------
revoke execute on function public.derive_username(text)   from public;
revoke execute on function public.handle_new_user()        from public;
revoke execute on function public.seed_profile(uuid, text)  from public;

grant execute on function public.derive_username(text)   to supabase_auth_admin;
grant execute on function public.handle_new_user()        to supabase_auth_admin;
grant execute on function public.seed_profile(uuid, text)  to supabase_auth_admin;

-- ---------------------------------------------------------------------
-- 2) search_path fixo
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) RLS: auth.uid() → (select auth.uid()) em toda política de escrita
-- (as políticas de leitura usam `using (true)` — não chamam auth.uid(),
-- não precisam mudar)
-- ---------------------------------------------------------------------
drop policy if exists "profiles: dono insere" on public.profiles;
create policy "profiles: dono insere"
  on public.profiles for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "profiles: dono edita" on public.profiles;
create policy "profiles: dono edita"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare
  tbl text;
begin
  foreach tbl in array array['folders', 'categories', 'entries'] loop
    execute format(
      'drop policy if exists "%1$s: dono insere" on public.%1$I;
       create policy "%1$s: dono insere"
         on public.%1$I for insert to authenticated
         with check (owner_id = (select auth.uid()));

       drop policy if exists "%1$s: dono edita" on public.%1$I;
       create policy "%1$s: dono edita"
         on public.%1$I for update to authenticated
         using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

       drop policy if exists "%1$s: dono apaga" on public.%1$I;
       create policy "%1$s: dono apaga"
         on public.%1$I for delete to authenticated
         using (owner_id = (select auth.uid()));',
      tbl);
  end loop;
end;
$$;

drop policy if exists "entry_tags: dono do item insere" on public.entry_tags;
create policy "entry_tags: dono do item insere"
  on public.entry_tags for insert to authenticated
  with check (
    exists (select 1 from public.entries e
            where e.id = entry_id and e.owner_id = (select auth.uid()))
  );

drop policy if exists "entry_tags: dono do item apaga" on public.entry_tags;
create policy "entry_tags: dono do item apaga"
  on public.entry_tags for delete to authenticated
  using (
    exists (select 1 from public.entries e
            where e.id = entry_id and e.owner_id = (select auth.uid()))
  );
