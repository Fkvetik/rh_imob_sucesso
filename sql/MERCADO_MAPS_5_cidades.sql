-- ============================================================================
-- MERCADO_MAPS_5 — organiza o filtro de CIDADE (tira bairro do lugar de cidade)
-- e deixa a busca por nome/bairro/especialização SEM ACENTO (com ou sem acha).
-- ----------------------------------------------------------------------------
-- Problema: o dropdown "Cidade" mostrava bairros de SP (Vila Mariana, Mooca,
-- Butantã...) porque a coluna `cidade` pegou o bairro em muitas linhas.
-- Fonte confiável = o `endereco`, que termina em "..., <Bairro>, <Cidade> - <UF>, <CEP>".
--
-- RODE no SQL Editor do projeto RHI (Corretores): tnzmxpoxvdlckmjwdala
-- Ordem: (1) PREVIEW -> confira -> (2) BACKFILL -> (3) funções sem acento.
-- ============================================================================

-- (1) PREVIEW — compara a cidade atual com a cidade/bairro extraídos do endereço.
--     Rode e confira: a coluna cidade_nova deve ser a CIDADE de verdade.
select
  cidade as cidade_atual,
  (regexp_match(endereco, ',\s*([^,]+?)\s*-\s*[A-Za-z]{2}\s*,\s*\d{4,5}'))[1]                     as cidade_nova,
  (regexp_match(endereco, '[-,]\s*([^,\-]+?)\s*,\s*[^,]+?\s*-\s*[A-Za-z]{2}\s*,\s*\d'))[1]         as bairro_novo,
  upper((regexp_match(endereco, '-\s*([A-Za-z]{2})\s*,\s*\d{4,5}'))[1])                            as uf_novo,
  endereco
from rhi_mercado_maps
where endereco ~ '-\s*[A-Za-z]{2}\s*,\s*\d{4,5}'
order by random()
limit 40;

-- Quantas linhas serão corrigidas (têm endereço no padrão):
-- select count(*) as corrigiveis,
--        (select count(*) from rhi_mercado_maps) as total
-- from rhi_mercado_maps
-- where endereco ~ '-\s*[A-Za-z]{2}\s*,\s*\d{4,5}';

-- ----------------------------------------------------------------------------
-- (2) BACKFILL — grava cidade/bairro/UF corretos a partir do endereço.
--     Só mexe em quem tem endereço no padrão e cidade_nova não vazia.
-- ----------------------------------------------------------------------------
-- update rhi_mercado_maps m
-- set cidade = p.cid,
--     uf     = coalesce(p.uf, m.uf),
--     bairro = coalesce(nullif(btrim(p.bai), ''), m.bairro)
-- from (
--   select place_key,
--     (regexp_match(endereco, ',\s*([^,]+?)\s*-\s*[A-Za-z]{2}\s*,\s*\d{4,5}'))[1]             as cid,
--     upper((regexp_match(endereco, '-\s*([A-Za-z]{2})\s*,\s*\d{4,5}'))[1])                   as uf,
--     (regexp_match(endereco, '[-,]\s*([^,\-]+?)\s*,\s*[^,]+?\s*-\s*[A-Za-z]{2}\s*,\s*\d'))[1] as bai
--   from rhi_mercado_maps
--   where endereco ~ '-\s*[A-Za-z]{2}\s*,\s*\d{4,5}'
-- ) p
-- where m.place_key = p.place_key
--   and p.cid is not null and btrim(p.cid) <> '';

-- Confira depois do backfill (deve listar CIDADES, sem bairro):
-- select * from rhi_mercado_opcoes_cidade() limit 30;

-- ----------------------------------------------------------------------------
-- (3) BUSCA SEM ACENTO — nome/bairro/especialização acham com ou sem acento.
--     Helper simples (não depende da extensão unaccent).
-- ----------------------------------------------------------------------------
create or replace function rhi_sem_acento(t text)
returns text language sql immutable as $$
  select translate(lower(coalesce(t,'')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$$;

create or replace function rhi_mercado_search(
  p_cidade text default null,
  p_bairro text default null,
  p_espec  text default null,
  p_busca  text default null,
  p_page   integer default 1,
  p_page_size integer default 40,
  p_ocultar_consumidos boolean default true
)
returns table(
  place_key text, nome text, categoria text, bairro text, cidade text, uf text,
  avaliacao numeric, num_avaliacoes integer, instagram_url text, place_url text,
  tem_telefone boolean, tem_instagram boolean, total_count bigint
)
language sql stable security definer set search_path = public
as $$
  with filtrado as (
    select m.*
    from rhi_mercado_maps m
    where (p_cidade is null or p_cidade = '' or rhi_sem_acento(m.cidade) = rhi_sem_acento(p_cidade))
      and (p_bairro is null or p_bairro = '' or rhi_sem_acento(m.bairro)    like '%'||rhi_sem_acento(p_bairro)||'%')
      and (p_espec  is null or p_espec  = '' or rhi_sem_acento(m.categoria) like '%'||rhi_sem_acento(p_espec)||'%')
      and (p_busca  is null or p_busca  = '' or rhi_sem_acento(m.nome)      like '%'||rhi_sem_acento(p_busca)||'%')
      and (not p_ocultar_consumidos
           or not exists (select 1 from rhi_mercado_consumidos c where c.place_key = m.place_key))
  )
  select
    f.place_key, f.nome, f.categoria, f.bairro, f.cidade, f.uf,
    f.avaliacao, f.num_avaliacoes, f.instagram_url, f.place_url,
    (f.telefone is not null and btrim(f.telefone) <> '') as tem_telefone,
    (f.instagram_url is not null and btrim(f.instagram_url) <> '') as tem_instagram,
    count(*) over()::bigint as total_count
  from filtrado f
  order by (f.avaliacao is null), f.avaliacao desc nulls last, f.nome
  limit greatest(1, least(100, coalesce(p_page_size, 40)))
  offset greatest(0, (coalesce(p_page, 1) - 1) * greatest(1, least(100, coalesce(p_page_size, 40))))
$$;

grant execute on function rhi_sem_acento(text) to authenticated;
grant execute on function rhi_mercado_search(text,text,text,text,integer,integer,boolean) to authenticated;
