-- ============================================================================
-- MERCADO_MAPS_2 — leitura/abordagem do operador ("Mercado por região")
--
-- >>> RODE NO PROJETO **RHI / Corretores CRECI** (ref tnzmxpoxvdlckmjwdala) <<<
--     Mesmo projeto do MERCADO_MAPS_1 e do Banco de Corretores CRECI.
--
-- A extensão (worker.js) chama estas funções direto, com o login compartilhado
-- do RHI (papel 'authenticated') — por isso o grant é para authenticated, não
-- anon. O TELEFONE nunca sai na busca/lista; só aparece na hora de "liberar"
-- (abrir), para montar o lead da fila de disparo — dado interno.
-- ============================================================================

-- Marca quem já foi "liberado" (enviado pra fila), para não reaparecer na busca.
create table if not exists rhi_mercado_consumidos (
  place_key  text primary key,
  login      text,
  criado_em  timestamptz default now()
);
alter table rhi_mercado_consumidos enable row level security;

-- ---------------------------------------------------------------------------
-- Opções de CIDADE (com contagem) — alimenta o dropdown.
-- ---------------------------------------------------------------------------
create or replace function rhi_mercado_opcoes_cidade()
returns table(cidade text, total bigint)
language sql stable security definer set search_path = public
as $$
  select cidade, count(*)::bigint as total
  from rhi_mercado_maps
  where cidade is not null and btrim(cidade) <> ''
  group by cidade
  order by total desc, cidade
$$;

-- ---------------------------------------------------------------------------
-- Opções de ESPECIALIZAÇÃO (categoria do Maps), opcionalmente por cidade.
-- ---------------------------------------------------------------------------
create or replace function rhi_mercado_opcoes_especializacao(p_cidade text default null)
returns table(especializacao text, total bigint)
language sql stable security definer set search_path = public
as $$
  select categoria as especializacao, count(*)::bigint as total
  from rhi_mercado_maps
  where categoria is not null and btrim(categoria) <> ''
    and (p_cidade is null or p_cidade = '' or cidade = p_cidade)
  group by categoria
  order by total desc, categoria
$$;

-- ---------------------------------------------------------------------------
-- BUSCA paginada — SEM telefone. Devolve só o que a tela mostra + flags de
-- canal (tem_telefone / tem_instagram) e total_count para a paginação.
-- ---------------------------------------------------------------------------
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
    where (p_cidade is null or p_cidade = '' or m.cidade = p_cidade)
      and (p_bairro is null or p_bairro = '' or m.bairro ilike '%'||p_bairro||'%')
      and (p_espec  is null or p_espec  = '' or m.categoria ilike '%'||p_espec||'%')
      and (p_busca  is null or p_busca  = '' or m.nome ilike '%'||p_busca||'%')
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

-- ---------------------------------------------------------------------------
-- ABRIR um lugar: devolve o registro COM telefone (para montar o lead da fila).
-- NÃO marca consumido — quem marca é o rhi_mercado_consumir, só para quem de
-- fato entrou na fila (com telefone). Assim, lugar só-Instagram continua na
-- lista para abordagem manual. Telefone é dado interno.
-- ---------------------------------------------------------------------------
create or replace function rhi_mercado_abrir(p_place_key text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v jsonb;
begin
  select to_jsonb(m) into v from rhi_mercado_maps m where m.place_key = p_place_key;
  if v is null then
    return jsonb_build_object('ok', false, 'error', 'Lugar não encontrado');
  end if;
  return jsonb_build_object('ok', true, 'place', v);
end
$$;

-- Marca os que entraram na fila (não reaparecem na busca). Lote.
create or replace function rhi_mercado_consumir(p_place_keys text[], p_login text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  insert into rhi_mercado_consumidos(place_key, login)
  select k, nullif(btrim(coalesce(p_login,'')), '')
  from unnest(coalesce(p_place_keys, array[]::text[])) as k
  where nullif(btrim(k), '') is not null
  on conflict (place_key) do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'marcados', v_n);
end
$$;

-- Permissões: o login compartilhado do RHI (authenticated) executa estas.
grant execute on function rhi_mercado_opcoes_cidade()                       to authenticated;
grant execute on function rhi_mercado_opcoes_especializacao(text)           to authenticated;
grant execute on function rhi_mercado_search(text,text,text,text,integer,integer,boolean) to authenticated;
grant execute on function rhi_mercado_abrir(text)                           to authenticated;
grant execute on function rhi_mercado_consumir(text[],text)                 to authenticated;

-- Confira (deve listar cidades com contagem):
-- select * from rhi_mercado_opcoes_cidade() limit 10;
