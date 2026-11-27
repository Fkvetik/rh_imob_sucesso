-- ============================================================================
-- MERCADO_MAPS_11 — contagem de place_keys já existentes (pro "novos × já no banco")
-- Rode no projeto RHI (tnzmxpoxvdlckmjwdala). Só leitura; não mexe no ingest.
-- O /api/ext-mercado-ingest usa isto ANTES do upsert pra dizer ao painel quantos
-- do lote são novidade e quantos já estavam no banco.
-- ============================================================================
create or replace function public.rhi_mercado_existentes(p_keys text[])
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.rhi_mercado_maps where place_key = any(p_keys);
$$;
revoke all on function public.rhi_mercado_existentes(text[]) from public, anon, authenticated;
grant execute on function public.rhi_mercado_existentes(text[]) to service_role;

notify pgrst, 'reload schema';
select (select count(*) from pg_proc where proname = 'rhi_mercado_existentes') as funcao;
