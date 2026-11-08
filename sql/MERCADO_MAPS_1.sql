-- ============================================================================
-- MERCADO_MAPS_1 — base "Mercado por região" (dados do Google Maps)
--
-- >>> RODE NO PROJETO **RHI / Corretores CRECI** (ref tnzmxpoxvdlckmjwdala) <<<
--     NÃO rode no COLETOR, NÃO rode no mercado-guaruja.
--     É o mesmo projeto do Banco de Corretores CRECI, de propósito:
--     o acesso a esta base usa o MESMO flag (acesso_creci_cidade) e a
--     ferramenta do operador reaproveita a mecânica do CRECI.
--
-- O que é esta base: imobiliárias e corretores achados no Google Maps.
--   CRECI **não verificado** — é prospecção, não vale como corretor ativo.
--   Telefone fica guardado como dado INTERNO (nunca aparece no "Perto de mim",
--   que mostra só CONTAGEM).
-- ============================================================================

create table if not exists rhi_mercado_maps (
  place_key       text primary key,          -- chave de dedup (normPlaceUrl_ do Apps Script)
  place_url       text,
  nome            text,
  categoria       text,                        -- CATEGORIA_MAPS (especialização bruta)
  tipo_local      text,                        -- tipo_local do Maps
  telefone        text,                        -- fone_maps — INTERNO, nunca público
  endereco        text,
  bairro          text,
  cidade          text,
  uf              text,
  lat             double precision,
  lng             double precision,
  site            text,                        -- site_maps
  instagram_url   text,
  instagram_user  text,                        -- igUsername
  seguidores      integer,
  avaliacao       numeric,
  num_avaliacoes  integer,
  creci           text,                         -- CRECI do Maps/Instagram — NÃO verificado
  status          text,                         -- situação/estágio bruto da planilha
  estagio         text,                         -- 'central' (parcial) | 'coleta' (completo)
  origem          text default 'maps',
  criado_em       timestamptz default now(),
  atualizado_em   timestamptz default now()
);

create index if not exists ix_mercado_maps_cidade    on rhi_mercado_maps (cidade);
create index if not exists ix_mercado_maps_bairro    on rhi_mercado_maps (bairro);
create index if not exists ix_mercado_maps_categoria on rhi_mercado_maps (categoria);
create index if not exists ix_mercado_maps_lat       on rhi_mercado_maps (lat);
create index if not exists ix_mercado_maps_lng       on rhi_mercado_maps (lng);

-- RLS ligado e SEM policy: ninguém lê a tabela direto com a chave anon.
-- Só o servidor (service_role) grava, e o público só enxerga CONTAGEM pela
-- função rhi_mercado_perto (abaixo). A ferramenta do operador vai ler por uma
-- função própria, criada depois.
alter table rhi_mercado_maps enable row level security;

-- ---------------------------------------------------------------------------
-- Ingestão (chamada só pelo servidor, com a service_role). Recebe um array de
-- objetos já limpos pelo /api/mercado-ingest. Faz upsert por place_key:
--   - CENTRAL grava o registro parcial (nome, telefone, status…);
--   - COLETA completa o resto (coordenada, categoria, avaliação, Instagram…);
--   - nunca apaga um campo já preenchido com um valor vazio que chega depois
--     (coalesce mantém o que já existe);
--   - estágio só "sobe" central -> coleta, nunca volta.
-- ---------------------------------------------------------------------------
create or replace function rhi_mercado_ingest(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'p_rows deve ser um array');
  end if;

  insert into rhi_mercado_maps as m (
    place_key, place_url, nome, categoria, tipo_local, telefone, endereco,
    bairro, cidade, uf, lat, lng, site, instagram_url, instagram_user,
    seguidores, avaliacao, num_avaliacoes, creci, status, estagio, atualizado_em
  )
  -- Deduplica dentro do próprio lote: se o mesmo place_key vier repetido,
  -- fica só a ÚLTIMA ocorrência (ordinalidade maior). Sem isto, o
  -- "ON CONFLICT DO UPDATE" tentaria mexer na mesma linha duas vezes e falha.
  select
    nullif(btrim(d.place_key), ''),
    nullif(btrim(d.place_url), ''),
    nullif(btrim(d.nome), ''),
    nullif(btrim(d.categoria), ''),
    nullif(btrim(d.tipo_local), ''),
    nullif(btrim(d.telefone), ''),
    nullif(btrim(d.endereco), ''),
    nullif(btrim(d.bairro), ''),
    nullif(btrim(d.cidade), ''),
    nullif(btrim(d.uf), ''),
    d.lat, d.lng,
    nullif(btrim(d.site), ''),
    nullif(btrim(d.instagram_url), ''),
    nullif(btrim(d.instagram_user), ''),
    d.seguidores, d.avaliacao, d.num_avaliacoes,
    nullif(btrim(d.creci), ''),
    nullif(btrim(d.status), ''),
    nullif(btrim(d.estagio), ''),
    now()
  from (
    select r.*,
           row_number() over (
             partition by nullif(btrim(r.place_key), '')
             order by e.ord desc
           ) as rn
    from jsonb_array_elements(p_rows) with ordinality as e(obj, ord)
    cross join lateral jsonb_to_record(e.obj) as r(
      place_key text, place_url text, nome text, categoria text, tipo_local text,
      telefone text, endereco text, bairro text, cidade text, uf text,
      lat double precision, lng double precision, site text, instagram_url text,
      instagram_user text, seguidores integer, avaliacao numeric, num_avaliacoes integer,
      creci text, status text, estagio text
    )
    where nullif(btrim(r.place_key), '') is not null
  ) d
  where d.rn = 1
  on conflict (place_key) do update set
    place_url      = coalesce(excluded.place_url,      m.place_url),
    nome           = coalesce(excluded.nome,           m.nome),
    categoria      = coalesce(excluded.categoria,      m.categoria),
    tipo_local     = coalesce(excluded.tipo_local,     m.tipo_local),
    telefone       = coalesce(excluded.telefone,       m.telefone),
    endereco       = coalesce(excluded.endereco,       m.endereco),
    bairro         = coalesce(excluded.bairro,         m.bairro),
    cidade         = coalesce(excluded.cidade,         m.cidade),
    uf             = coalesce(excluded.uf,             m.uf),
    lat            = coalesce(excluded.lat,            m.lat),
    lng            = coalesce(excluded.lng,            m.lng),
    site           = coalesce(excluded.site,           m.site),
    instagram_url  = coalesce(excluded.instagram_url,  m.instagram_url),
    instagram_user = coalesce(excluded.instagram_user, m.instagram_user),
    seguidores     = coalesce(excluded.seguidores,     m.seguidores),
    avaliacao      = coalesce(excluded.avaliacao,      m.avaliacao),
    num_avaliacoes = coalesce(excluded.num_avaliacoes, m.num_avaliacoes),
    creci          = coalesce(excluded.creci,          m.creci),
    status         = coalesce(excluded.status,         m.status),
    estagio        = case when m.estagio = 'coleta' then m.estagio
                          else coalesce(excluded.estagio, m.estagio) end,
    atualizado_em  = now();

  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'gravados', v_n);
end
$$;

-- ---------------------------------------------------------------------------
-- "Perto de mim" — SÓ CONTAGEM. Público (anon pode executar). Nenhum nome,
-- telefone ou endereço sai daqui: devolve quantas imobiliárias/contatos do
-- Maps existem no raio. O ponto de quem consulta já chega arredondado (~1 km)
-- da /api/perto.
-- ---------------------------------------------------------------------------
create or replace function rhi_mercado_perto(
  p_lat double precision, p_lng double precision, p_raio_km double precision default 5
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with box as (
    select
      p_raio_km / 111.045 as dlat,
      p_raio_km / (111.045 * greatest(cos(radians(p_lat)), 0.01)) as dlng
  )
  select jsonb_build_object(
    'ok', true,
    'imobiliarias', count(*)
  )
  from rhi_mercado_maps m, box b
  where m.lat is not null and m.lng is not null
    and m.lat between p_lat - b.dlat and p_lat + b.dlat
    and m.lng between p_lng - b.dlng and p_lng + b.dlng
    and 6371 * acos(least(1,
          cos(radians(p_lat)) * cos(radians(m.lat)) * cos(radians(m.lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(m.lat))
        )) <= p_raio_km;
$$;

grant execute on function rhi_mercado_perto(double precision, double precision, double precision) to anon;

-- Confira (deve devolver 0 agora, cresce conforme o GAS alimenta):
-- select rhi_mercado_perto(-23.56, -46.64, 5);
