-- =============================================================
-- FIX: metrô calculado sobre coordenada genérica (centróide)
-- =============================================================
-- Problema: a BASE_INTERNA_BAIRRO devolveu a MESMA coordenada para
-- bairros diferentes (ex.: -23.5690419,-46.6367565 usada por Tatuapé,
-- Parque Bristol, Jardim Ângela...). Esses pontos são centróides de
-- região/cidade — o metrô "mais próximo" deles é ficção (todo mundo
-- caiu em Vergueiro, República etc. com a mesma distância).
--
-- Regra: coordenada de BASE_INTERNA_BAIRRO compartilhada por 4+
-- bairros distintos = genérica → anula os campos de metrô do talento.
-- Bairro real geocodificado tem 1 coordenada por bairro (2-3 no máximo
-- por variação de grafia), então 4+ é seguro.
--
-- Reversível: metro_status = 'GEO_GENERICA' marca quem foi afetado;
-- se re-geocodificar depois, é só recalcular para esse grupo.

-- 1) identifica as coordenadas genéricas
drop table if exists public.nt_geo_coord_generica;
create table public.nt_geo_coord_generica as
select latitude, longitude,
       count(distinct lower(trim(coalesce(bairro, '')))) as bairros_distintos,
       count(*) as talentos
from public.nt_talentos
where geo_fonte = 'BASE_INTERNA_BAIRRO'
  and latitude is not null and longitude is not null
group by latitude, longitude
having count(distinct lower(trim(coalesce(bairro, '')))) >= 4;

-- confira antes de aplicar (quantas coords e quantos talentos):
select count(*) as coords_genericas, sum(talentos) as talentos_afetados
from public.nt_geo_coord_generica;

-- 2) anula o metrô na base bruta e marca a origem
update public.nt_talentos t
set estacao_mais_proxima = null,
    linha_metro_mais_proxima = null,
    cor_linha_metro = null,
    distancia_metro_km = null,
    metro_status = 'GEO_GENERICA'
where t.geo_fonte = 'BASE_INTERNA_BAIRRO'
  and exists (
    select 1 from public.nt_geo_coord_generica g
    where g.latitude = t.latitude and g.longitude = t.longitude
  );

-- 3) espelha na tabela pública (sem mexer em updated_at para não
--    reordenar a listagem, que ordena por updated_at desc)
update public.nt_talentos_publicos p
set estacao_mais_proxima = null,
    linha_metro_mais_proxima = null,
    cor_linha_metro = null,
    distancia_metro_km = null
from public.nt_talentos t
where t.talento_key = p.talento_key
  and t.metro_status = 'GEO_GENERICA';

-- 4) atualiza a materialized view e o cache de cidades
select public.nt_refresh_base_pub_mv();

-- 5) força a API a recarregar o schema
notify pgrst, 'reload schema';

-- 6) conferência final
select
  (select count(*) from public.nt_talentos where metro_status = 'GEO_GENERICA') as marcados,
  (select count(*) from public.nt_talentos_publicos
    where ativo = true and estacao_mais_proxima = 'Vergueiro'
      and distancia_metro_km <= 5) as vergueiro_restantes;
