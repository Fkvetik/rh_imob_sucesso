-- ============================================================================
-- MERCADO_MAPS_10 — coleta por operador (CSV do operador + completar faltantes)
-- Rode no projeto RHI / Corretores CRECI (tnzmxpoxvdlckmjwdala).
-- Depende de MERCADO_MAPS_1 (tabela rhi_mercado_maps). Idempotente.
--
-- Registra QUEM coletou cada lugar (não muda a base central, que é compartilhada):
--   - rhi_mercado_coletas(place_key, login): histórico de coleta por operador.
--   - rhi_mercado_registrar_coleta: chamado pelo /api/ext-mercado-ingest.
--   - rhi_mercado_do_operador: tudo que ESSE login coletou (vira o CSV dele).
--   - rhi_mercado_pendentes_operador: lugares dele ainda 'central' (sem detalhe),
--     para a opção "completar os que faltam".
-- ============================================================================
begin;

create table if not exists public.rhi_mercado_coletas (
  place_key    text not null,
  login        text not null,
  coletado_em  timestamptz default now(),
  primary key (place_key, login)
);
create index if not exists idx_merc_coletas_login on public.rhi_mercado_coletas(login);

create or replace function public.rhi_mercado_registrar_coleta(p_place_keys text[], p_login text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_login text := nullif(btrim(coalesce(p_login, '')), '');
begin
  if v_login is null or p_place_keys is null then return jsonb_build_object('ok', true, 'gravados', 0); end if;
  insert into public.rhi_mercado_coletas (place_key, login)
  select distinct k, v_login from unnest(p_place_keys) k where nullif(btrim(k), '') is not null
  on conflict (place_key, login) do nothing;
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.rhi_mercado_registrar_coleta(text[], text) to anon, authenticated;

-- CSV do operador: tudo que ele coletou, com os dados do mercado.
create or replace function public.rhi_mercado_do_operador(p_login text)
returns setof public.rhi_mercado_maps language sql stable security definer set search_path = public as $$
  select m.*
  from public.rhi_mercado_maps m
  join public.rhi_mercado_coletas c on c.place_key = m.place_key
  where c.login = nullif(btrim(coalesce(p_login, '')), '')
  order by coalesce(m.cidade, ''), coalesce(m.bairro, ''), coalesce(m.nome, '');
$$;
grant execute on function public.rhi_mercado_do_operador(text) to anon, authenticated;

-- Lugares que ESSE login coletou e que ainda estão só no parcial ('central').
create or replace function public.rhi_mercado_pendentes_operador(p_login text, p_limit int default 50)
returns table(place_url text) language sql stable security definer set search_path = public as $$
  select m.place_url
  from public.rhi_mercado_maps m
  join public.rhi_mercado_coletas c on c.place_key = m.place_key
  where c.login = nullif(btrim(coalesce(p_login, '')), '')
    and coalesce(m.estagio, 'central') = 'central'
    and nullif(btrim(coalesce(m.place_url, '')), '') is not null
  order by coalesce(m.nome, '')
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
grant execute on function public.rhi_mercado_pendentes_operador(text, int) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
