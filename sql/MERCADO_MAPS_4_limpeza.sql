-- ============================================================================
-- MERCADO_MAPS_4 — limpar do banco o que NÃO é do ramo imobiliário
-- ----------------------------------------------------------------------------
-- Usa a MESMA régua do /api/mercado-ingest: considera imobiliário quando
-- nome + categoria + tipo_local (minúsculo, sem acento) casa com:
--   imobiliar | imove | corretor | corretag | agente imobil | consultora? imobil
--   | real estate | incorporador | loteador | administr... de imove | habitacional
--
-- ⚠️ DELETE é DEFINITIVO. Rode PRIMEIRO os blocos (1) e (2) de PREVIEW, confira,
--    e só então rode o bloco (3). Projeto RHI (Corretores): tnzmxpoxvdlckmjwdala
-- ============================================================================

-- Expressão reaproveitada: base de texto sem acento.
--   translate(...) troca vogais acentuadas e ç por versões simples.
-- Regex "imobiliário":
--   (imobiliar|imove|corretor|corretag|agente imobil|consultora? imobil|real estate|incorporador|loteador|administr[a-z]* de imove|habitacional)

-- (1) PREVIEW — quantos SOBRAM (imobiliário) x quantos SERIAM APAGADOS (fora do ramo):
select
  count(*) filter (where translate(lower(coalesce(nome,'')||' '||coalesce(categoria,'')||' '||coalesce(tipo_local,'')),
        'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
      ~ '(imobiliar|imove|corretor|corretag|agente imobil|consultora? imobil|real estate|incorporador|loteador|administr[a-z]* de imove|habitacional)') as ficam_imobiliario,
  count(*) filter (where translate(lower(coalesce(nome,'')||' '||coalesce(categoria,'')||' '||coalesce(tipo_local,'')),
        'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
      !~ '(imobiliar|imove|corretor|corretag|agente imobil|consultora? imobil|real estate|incorporador|loteador|administr[a-z]* de imove|habitacional)') as apagar_fora_do_ramo,
  count(*) as total
from rhi_mercado_maps;

-- (2) PREVIEW — amostra do que SERIA APAGADO (confira se não vai levar imobiliária junto):
select nome, categoria, tipo_local, cidade
from rhi_mercado_maps
where translate(lower(coalesce(nome,'')||' '||coalesce(categoria,'')||' '||coalesce(tipo_local,'')),
      'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
    !~ '(imobiliar|imove|corretor|corretag|agente imobil|consultora? imobil|real estate|incorporador|loteador|administr[a-z]* de imove|habitacional)'
order by nome
limit 100;

-- (3) APAGAR (rode só depois de conferir os blocos acima):
-- delete from rhi_mercado_maps
-- where translate(lower(coalesce(nome,'')||' '||coalesce(categoria,'')||' '||coalesce(tipo_local,'')),
--       'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
--     !~ '(imobiliar|imove|corretor|corretag|agente imobil|consultora? imobil|real estate|incorporador|loteador|administr[a-z]* de imove|habitacional)';
