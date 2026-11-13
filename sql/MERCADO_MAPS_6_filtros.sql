-- ============================================================================
-- MERCADO_MAPS_6 — (A) junta distritos de SP na cidade "São Paulo";
--                  (B) organiza a ESPECIALIZAÇÃO em grupos limpos.
-- Rode no projeto RHI (Corretores): tnzmxpoxvdlckmjwdala
-- Requer o MERCADO_MAPS_5 já rodado (usa rhi_sem_acento()).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (A) DISTRITOS DE SP -> "São Paulo"
-- Em alguns endereços o Google devolveu o DISTRITO no lugar da cidade
-- (ex.: "..., República - SP, 01037-010"), então a cidade ficou "República".
-- (A1) DIAGNÓSTICO — veja todas as "cidades" com UF=SP (distrito aparece aqui):
select cidade, count(*) as n
from rhi_mercado_maps
where uf = 'SP'
group by cidade
order by n desc;

-- (A2) BACKFILL — move os distritos conhecidos de SP capital para "São Paulo"
-- (o nome do distrito vira o bairro). Edite a lista se faltar/sobrar algum.
-- update rhi_mercado_maps
-- set bairro = coalesce(nullif(btrim(bairro),''), cidade),
--     cidade = 'São Paulo'
-- where uf = 'SP'
--   and rhi_sem_acento(cidade) in (
--     'republica','se','bela vista','consolacao','santa cecilia','bom retiro',
--     'barra funda','higienopolis','vila buarque','centro historico de sao paulo',
--     'liberdade','cambuci','bras','pari','belem','mooca','agua rasa','tatuape',
--     'ipiranga','sacoma','cursino','vila mariana','moema','saude','jabaquara',
--     'vila olimpia','itaim bibi','jardim paulista','pinheiros','alto de pinheiros',
--     'perdizes','lapa','butanta','morumbi','vila sonia','vila andrade','santo amaro',
--     'campo belo','santana','tucuruvi','mandaqui','casa verde','limao','freguesia do o',
--     'pirituba','itaquera','penha','vila prudente','jardim satelite'
--   )
--   and cidade <> 'São Paulo';
-- OBS: 'jardim satelite' costuma ser de São José dos Campos — só deixei pra você
--      conferir no diagnóstico (A1). Se for de SJC, tire da lista.

-- ----------------------------------------------------------------------------
-- (B) ESPECIALIZAÇÃO em grupos limpos
-- A coluna `categoria` veio poluída (nomes/bios). Normaliza em poucos grupos.
-- ----------------------------------------------------------------------------
create or replace function rhi_mercado_categoria_norm(c text)
returns text language sql immutable as $$
  select case
    when c is null or btrim(c) = '' then 'Sem categoria'
    when rhi_sem_acento(c) ~ 'incorporador|empreend|construtor' then 'Incorporadora / Construtora'
    when rhi_sem_acento(c) ~ 'imobiliar'                         then 'Imobiliária'
    when rhi_sem_acento(c) ~ 'consultor'                         then 'Consultor imobiliário'
    when rhi_sem_acento(c) ~ 'corretor|creci'                    then 'Corretor de imóveis'
    when rhi_sem_acento(c) ~ 'administr'                         then 'Administradora'
    else 'Outro'
  end;
$$;

-- Dropdown de especialização: grupos normalizados (poucas opções, limpas).
create or replace function rhi_mercado_opcoes_especializacao(p_cidade text default null)
returns table(especializacao text, total bigint)
language sql stable security definer set search_path = public
as $$
  select rhi_mercado_categoria_norm(categoria) as especializacao, count(*)::bigint as total
  from rhi_mercado_maps
  where (p_cidade is null or p_cidade = '' or rhi_sem_acento(cidade) = rhi_sem_acento(p_cidade))
  group by rhi_mercado_categoria_norm(categoria)
  order by total desc, especializacao
$$;

-- Busca: filtra pela especialização NORMALIZADA (o dropdown manda o grupo),
-- e mantém nome/bairro sem acento (MERCADO_MAPS_5).
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
      and (p_bairro is null or p_bairro = '' or rhi_sem_acento(m.bairro) like '%'||rhi_sem_acento(p_bairro)||'%')
      and (p_espec  is null or p_espec  = '' or rhi_mercado_categoria_norm(m.categoria) = p_espec)
      and (p_busca  is null or p_busca  = '' or rhi_sem_acento(m.nome)   like '%'||rhi_sem_acento(p_busca)||'%')
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

grant execute on function rhi_mercado_categoria_norm(text) to authenticated;
grant execute on function rhi_mercado_opcoes_especializacao(text) to authenticated;
grant execute on function rhi_mercado_search(text,text,text,text,integer,integer,boolean) to authenticated;

-- Confira: deve listar poucos grupos (Imobiliária / Corretor / Incorporadora...):
-- select * from rhi_mercado_opcoes_especializacao();
