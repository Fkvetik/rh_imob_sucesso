-- ============================================================================
-- MERCADO_MAPS_8 — "já tem?" para o coletor do Maps não recoletar o que existe
-- ----------------------------------------------------------------------------
-- A extensão coletora (>= 1.10.0) pergunta ao site, antes de mandar um lugar
-- para a CENTRAL, se ele já está no banco. A conferência é por:
--   • chave do lugar no Maps (o par 0x..:0x.. que vem no link), e
--   • telefone (só dígitos, sem o 55).
-- A função só devolve, da lista que RECEBEU, o que já existe — nenhum telefone
-- ou dado do banco sai daqui. Só o servidor do site (chave de serviço) executa.
--
-- Rode UMA vez no projeto RHI (Corretores): tnzmxpoxvdlckmjwdala
-- Pode rodar mais de uma vez.
-- ============================================================================

-- Telefone só com dígitos, sem o 55 da frente.
create or replace function rhi_mercado_fone_norm(t text)
returns text language sql immutable as $$
  select case when d ~ '^55[0-9]{10,11}$' then substr(d, 3) else d end
  from (select regexp_replace(coalesce(t, ''), '[^0-9]', '', 'g') as d) x
$$;

-- Par 0x..:0x.. do lugar (aparece na place_key ou na place_url).
create or replace function rhi_mercado_hex(t text)
returns text language sql immutable as $$
  select substring(lower(coalesce(t, '')) from '0x[0-9a-f]+:0x[0-9a-f]+')
$$;

-- Índices para a conferência ser instantânea mesmo com a base grande.
create index if not exists idx_mercado_maps_fone_norm on rhi_mercado_maps (rhi_mercado_fone_norm(telefone));
create index if not exists idx_mercado_maps_hex on rhi_mercado_maps ((coalesce(rhi_mercado_hex(place_key), rhi_mercado_hex(place_url))));

-- Recebe chaves e telefones; devolve só os que JÁ existem na base.
create or replace function rhi_mercado_ja_tem(p_keys text[], p_fones text[])
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'keys', coalesce((
      select jsonb_agg(distinct k)
      from unnest(coalesce(p_keys, '{}'::text[])) k
      where exists (
        select 1 from rhi_mercado_maps m
        where coalesce(rhi_mercado_hex(m.place_key), rhi_mercado_hex(m.place_url)) = lower(k)
      )), '[]'::jsonb),
    'fones', coalesce((
      select jsonb_agg(distinct f)
      from unnest(coalesce(p_fones, '{}'::text[])) f
      where length(f) between 10 and 11
        and exists (select 1 from rhi_mercado_maps m where rhi_mercado_fone_norm(m.telefone) = f)
      ), '[]'::jsonb)
  );
$$;

-- Só o servidor do site chama (chave de serviço).
revoke execute on function rhi_mercado_ja_tem(text[], text[]) from public, anon, authenticated;
grant execute on function rhi_mercado_ja_tem(text[], text[]) to service_role;

-- Conferência: pega um lugar qualquer da base e pergunta por ele (deve voltar 1 chave).
select rhi_mercado_ja_tem(
  array(select coalesce(rhi_mercado_hex(place_key), rhi_mercado_hex(place_url)) from rhi_mercado_maps
        where coalesce(rhi_mercado_hex(place_key), rhi_mercado_hex(place_url)) is not null limit 1),
  '{}'::text[]) as teste;
