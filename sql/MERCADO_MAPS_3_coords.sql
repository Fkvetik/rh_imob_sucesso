-- ============================================================================
-- MERCADO_MAPS_3 — extrai lat/lng da placeUrl (!3d<lat>!4d<lng>)
-- ----------------------------------------------------------------------------
-- CAUSA do "nada aparece em Perto de mim / Mercado": as linhas entravam SEM
-- coordenada. A lat/lng vem embutida na placeUrl do Google Maps, no trecho
--   ...!3d-16.7336167!4d-49.2284597...
-- mas o GAS não manda lat/lng e a ingestão só lia do payload. Sem lat/lng, a
-- função rhi_mercado_perto (que exige coordenada) conta 0 pra todo mundo.
--
-- Este arquivo resolve nos dois lados, sem mexer no GAS:
--   (a) BACKFILL das linhas que já estão no banco sem coordenada;
--   (b) TRIGGER que preenche lat/lng a partir da placeUrl nas próximas
--       inserções/atualizações (quando vierem sem coordenada).
--
-- RODE UMA VEZ, no SQL Editor do projeto RHI (Corretores):  tnzmxpoxvdlckmjwdala
-- ============================================================================

-- (b) Trigger: deriva lat/lng da placeUrl quando vier sem coordenada.
create or replace function rhi_mercado_coords_trg()
returns trigger
language plpgsql
as $$
begin
  if (new.lat is null or new.lng is null) and new.place_url is not null then
    new.lat := coalesce(new.lat,
      nullif((regexp_match(new.place_url, '!3d(-?[0-9]+\.[0-9]+)'))[1], '')::double precision);
    new.lng := coalesce(new.lng,
      nullif((regexp_match(new.place_url, '!4d(-?[0-9]+\.[0-9]+)'))[1], '')::double precision);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mercado_coords on rhi_mercado_maps;
create trigger trg_mercado_coords
  before insert or update on rhi_mercado_maps
  for each row execute function rhi_mercado_coords_trg();

-- (a) Backfill das linhas já existentes (sem coordenada mas com placeUrl válida).
update rhi_mercado_maps
set lat = nullif((regexp_match(place_url, '!3d(-?[0-9]+\.[0-9]+)'))[1], '')::double precision,
    lng = nullif((regexp_match(place_url, '!4d(-?[0-9]+\.[0-9]+)'))[1], '')::double precision
where (lat is null or lng is null)
  and place_url ~ '!3d-?[0-9]+\.[0-9]+.*!4d-?[0-9]+\.[0-9]+';

-- Conferência rápida (quantas já têm coordenada e um teste de proximidade):
--   select count(*) filter (where lat is not null and lng is not null) as com_coord,
--          count(*) as total
--   from rhi_mercado_maps;
--   select rhi_mercado_perto(-16.6869, -49.2648, 10);  -- ex.: Goiânia, raio 10 km
