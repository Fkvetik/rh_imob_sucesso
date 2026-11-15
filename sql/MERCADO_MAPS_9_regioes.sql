-- ============================================================================
-- MERCADO_MAPS_9 — região e micro-região em cada lugar do Mercado por região
-- ----------------------------------------------------------------------------
-- Cada lugar coletado no Maps passa a ser marcado com REGIÃO (Centro, Zona
-- Norte, Sul, Leste, Oeste…) e MICRO-REGIÃO, em cascata:
--   1) pelo CEP do endereço (São Paulo capital — mesmas faixas do Novos Talentos);
--   2) por cidade + bairro, no mapa de bairros (copiado do Novos Talentos);
--   3) pela geolocalização: o bairro do mapa mais próximo da coordenada do lugar.
-- A marcação é automática em toda entrada/atualização (gatilho). O painel da
-- extensão ganha os filtros Região e Bairro (lista).
--
-- Rode UMA vez no projeto RHI (Corretores): tnzmxpoxvdlckmjwdala
-- Depois, no admin do site (aba Links → "Mercado por região"), clique em
-- "Sincronizar bairros e marcar regiões" para trazer o mapa de bairros.
-- Pode rodar mais de uma vez.
-- ============================================================================

-- Texto minúsculo e sem acento (mesma função do MERCADO_MAPS_5).
create or replace function rhi_sem_acento(t text)
returns text language sql immutable as $$
  select translate(lower(coalesce(t,'')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$$;

-- Colunas novas no lugar.
alter table rhi_mercado_maps add column if not exists regiao text;
alter table rhi_mercado_maps add column if not exists micro_regiao text;
alter table rhi_mercado_maps add column if not exists regiao_fonte text;  -- cep | bairro | geo | sem
create index if not exists idx_mercado_maps_cidade_regiao on rhi_mercado_maps (cidade, regiao);
create index if not exists idx_mercado_maps_regiao_fonte on rhi_mercado_maps (regiao_fonte);

-- (1) Faixas de CEP de São Paulo capital -> região / micro-região.
create table if not exists rhi_cep_ranges (
  id bigserial primary key,
  regiao_macro text not null,
  bairro_micro text not null,
  cep_start int not null,
  cep_end int not null
);
alter table rhi_cep_ranges enable row level security;
revoke all on rhi_cep_ranges from anon, authenticated;
create index if not exists idx_rhi_cep_ranges_range on rhi_cep_ranges (cep_start, cep_end);
truncate table rhi_cep_ranges;
insert into rhi_cep_ranges (regiao_macro, bairro_micro, cep_start, cep_end) values
('Centro', 'CENTRO – Sé / Santa Efigênia / República / Centro', 1000, 1099),
('Centro', 'BOM RETIRO – Barra Funda / Bom Retiro / Luz / Ponte Pequena', 1100, 1199),
('Centro', 'VILA BUARQUE – Santa Cecília/ Pacaembú / Sumaré / Higienópolis / Consolação', 1200, 1299),
('Centro', 'CONSOLAÇÃO – Consolação / Bela Vista', 1300, 1399),
('Centro', 'JARDINS – Cerqueira César / Jardim Paulista / Jardim América / Jardim Europa', 1400, 1499),
('Centro', 'LIBERDADE – Liberdade / Cambuci / Aclimação / Vila Monumento / Jardimda Glória', 1500, 1599),
('Zona Norte', 'SANTANA – Santana / Carandiru / Vila Guilherme / Jardim São Paulo', 2000, 2099),
('Zona Norte', 'VILA MARIA – Vila Maria / Parque Novo Mundo / Jardim Japão', 2100, 2199),
('Zona Norte', 'JAÇANÃ E TUCURUVI – Tucuruvi / Jaçanã / Parque Edu Chaves / Vila Medeiros / Vila Edi', 2200, 2299),
('Zona Norte', 'TREMEMBÉ – Jardim Tremembé / Barro Branco / Água Fria', 2300, 2399),
('Zona Norte', 'MANDAQUI – Mandaqui / Imirim / Lausane Paulista / Santa Teresinha', 2400, 2499),
('Zona Norte', 'CASA VERDE – Casa Verde / Parque Peruche', 2500, 2599),
('Zona Norte', 'CACHOEIRINHA – Vila Nova Cachoeirinha / Jardim Peri Peri', 2600, 2699),
('Zona Norte', 'LIMÃO – Limão / Nossa Senhora do Ó / Itaberaba', 2700, 2799),
('Zona Norte', 'BRASILÂNDIA – Brasilândia / Morro Grande', 2800, 2899),
('Zona Norte', 'FREGUESIA DO Ó – Freguesia do Ó / Pirituba / Piqueri', 2900, 2999),
('Zona Leste', 'BRÁS – Belenzinho / Brás / Belém / Pari / Canindé / Catumbi / ParqueS.Jorge', 3000, 3099),
('Zona Leste', 'MOÓCA – Moóca / Alto da Moóca / Vila Prudente / A. Rosa / Quarta Parada / Parque Moóca / Vila Zelina', 3100, 3199),
('Zona Leste', 'SÃO LUCAS – VilaEma / Parque São Lucas / Vila Alpina / Sapopemba', 3200, 3299),
('Zona Leste', 'ANÁLIA FRANCO – Tatuapé / Vila Formosa / Jardim Colorado / Vila Gomes Cardim / JardimAnália Franco', 3300, 3399),
('Zona Leste', 'CARRÃO E ARICANDUVA – Vila Carrão / Carrãozinho', 3400, 3499),
('Zona Leste', 'VILA MATILDE – Vila Matilde / Cidade Patriarca / Artur Alvim', 3500, 3599),
('Zona Leste', 'PENHA – Penha / Vila Esperança / Vila Ré / Cidade A. E. Carvalho', 3600, 3699),
('Zona Leste', 'CANGAÍBA – Cangaiba / Engenho Goulart / Ponte Rasa', 3700, 3799),
('Zona Leste', 'ERMELINO MATARAZZO – Ermelino Matarazzo / Vila Paranaguá', 3800, 3899),
('Zona Leste', 'SÃO MATEUS – São Mateus / Iguaçu', 3900, 3999),
('Zona Leste', 'SÃO MIGUEL PAULISTA', 8000, 8099),
('Zona Leste', 'ITAIM PAULISTA', 8100, 8199),
('Zona Leste', 'ITAQUERA', 8200, 8299),
('Zona Leste', 'SÃO MATEUS', 8300, 8399),
('Zona Leste', 'GUAIANAZES', 8400, 8499),
('Zona Sul', 'MOEMA E VILA MARIANA (OESTE) – Vila Mariana / Vila Clementino / Paraíso / Indianópolis / Moema / Planalto Paulista / Mirandópolis', 4000, 4099),
('Zona Sul', 'SAÚDE E VILA MARIANA (LESTE) – Jardim Glória / Saúde / Água Funda / Vila Mercês / Vila Liviero', 4100, 4199),
('Zona Sul', 'IPIRANGA – Ipiranga / Vila Carioca / Sacomã / Moinho Velho / São João Clímaco', 4200, 4299),
('Zona Sul', 'JABAQUARA – Jabaquara / Jardim Aeroporto / Vila Sta Catarina / Vila Guarani / Vila Mascote', 4300, 4399),
('Zona Sul', 'CIDADE ADEMAR – Cidade Ademar / Pedreira / Jardim Miriam / Americanópolis', 4400, 4499),
('Zona Sul', 'ITAIM BIBI – Brooklin Novo / Itaim Bibi / Vila Olímpia / Moema / Vila Nova Conceição', 4500, 4599),
('Zona Sul', 'CAMPO BELO – Brooklin Paulista / Campo Belo / Aeroporto / Cidade Ademar / Campo Grande / Jurubatuba / Chácara Flora / Chácara Monte Alegre', 4600, 4699),
('Zona Sul', 'SANTO AMARO – Santo Amaro / Chácara Santo Antônio / Granja Julieta / Socorro / Veleiros / Interlagos / Alto da Boa Vista', 4700, 4799),
('Zona Sul', 'CIDADE DUTRA E GRAJAÚ – Cidade Dutra / Rio Bonito / Parque Grajaú / Parelheiros', 4800, 4899),
('Zona Sul', 'GUARAPIRANGA – Guarapiranga / Capela do Socorro', 4900, 4999),
('Zona Oeste', 'LAPA E PERDIZES – Lapa / Perdizes / Água Branca / Alto da Lapa / Vila Anastácia / Pompéia / Vila Romana', 5000, 5099),
('Zona Oeste', 'PIRITUBA E JARAGUÁ – Vila Jaguara / Pirituba / Parque São Domingos', 5100, 5199),
('Zona Oeste', 'PERUS – Jaraguá / Perus', 5200, 5299),
('Zona Oeste', 'JAGUARÉ E LEOPOLDINA – Vila Leopoldina / Ceasa / Jaguaré / Rio Pequeno / Vila Hamburguesa / Vila Remédios', 5300, 5399),
('Zona Oeste', 'PINHEIROS – Pinheiros / Vila Madalena / Alto de Pinheiros', 5400, 5499),
('Zona Oeste', 'BUTANTÃ – Butantã / Caxingui / Cidade Universitária (USP) / JardimPeri-Peri / JardimBonfiglioli', 5500, 5599),
('Zona Oeste', 'MORUMBI – Cidade Jardim / Morumbi / Vila Sônia / Jardim Guedala / Jardim Leonor / Real Parque', 5600, 5699),
('Zona Oeste', 'CAMPO LIMPO – Campo Limpo / Pirajuçara', 5700, 5799),
('Zona Oeste', 'CAPÃO REDONDO – Capão Redondo / Vila Das Belezas', 5800, 5899);

-- (2) Mapa de bairros (cópia do nt_mapa_bairros do Novos Talentos; quem
-- preenche é o servidor do site, pelo botão do admin).
create table if not exists rhi_mapa_bairros (
  mapa_key     text primary key,
  cidade       text,
  estado_uf    text,
  bairro       text,
  regiao_macro text,
  micro_regiao text,
  latitude     double precision,
  longitude    double precision,
  cidade_norm  text generated always as (rhi_sem_acento(cidade)) stored,
  bairro_norm  text generated always as (rhi_sem_acento(bairro)) stored
);
alter table rhi_mapa_bairros enable row level security;
revoke all on rhi_mapa_bairros from anon, authenticated;
create index if not exists idx_rhi_mapa_bairros_cb on rhi_mapa_bairros (cidade_norm, bairro_norm);
create index if not exists idx_rhi_mapa_bairros_lat on rhi_mapa_bairros (latitude);

-- Nome de região padronizado: "norte" / "zona norte" / "ZN" -> "Zona Norte".
create or replace function rhi_regiao_rotulo(t text)
returns text language sql immutable as $$
  select case
    when x = '' then null
    when x ~ '^(zona )?(norte|zn)$' then 'Zona Norte'
    when x ~ '^(zona )?(sul|zs)$'   then 'Zona Sul'
    when x ~ '^(zona )?(leste|zl)$' then 'Zona Leste'
    when x ~ '^(zona )?(oeste|zo)$' then 'Zona Oeste'
    when x ~ '^(zona )?(centro|central)$' then 'Centro'
    else initcap(btrim(t))
  end
  from (select btrim(rhi_sem_acento(t)) as x) s
$$;

-- Classifica um lugar. Devolve região, micro-região e de onde veio.
create or replace function rhi_mercado_classificar(
  p_endereco text, p_cidade text, p_uf text, p_bairro text,
  p_lat double precision, p_lng double precision
)
returns table(regiao text, micro_regiao text, fonte text)
language plpgsql stable set search_path = public
as $$
declare
  v_cep text; v_cid text := rhi_sem_acento(p_cidade); v_bai text := rhi_sem_acento(p_bairro);
  r record;
begin
  -- 1) CEP (São Paulo capital): "01310-100" ou "01310100" no endereço.
  v_cep := (regexp_match(coalesce(p_endereco, ''), '([0-9]{5})-?[0-9]{3}'))[1];
  if v_cep is not null and (p_uf is null or upper(p_uf) = 'SP') then
    select c.regiao_macro, c.bairro_micro into r
      from rhi_cep_ranges c where v_cep::int between c.cep_start and c.cep_end limit 1;
    if found then
      return query select rhi_regiao_rotulo(r.regiao_macro), r.bairro_micro, 'cep'::text; return;
    end if;
  end if;

  -- 2) Cidade + bairro no mapa de bairros.
  if v_cid <> '' and v_bai <> '' then
    select b.regiao_macro, b.micro_regiao into r
      from rhi_mapa_bairros b
     where b.cidade_norm = v_cid and b.bairro_norm = v_bai
       and nullif(btrim(b.regiao_macro), '') is not null
       and (p_uf is null or b.estado_uf is null or upper(b.estado_uf) = upper(p_uf))
     limit 1;
    if found then
      return query select rhi_regiao_rotulo(r.regiao_macro), nullif(btrim(r.micro_regiao), ''), 'bairro'::text; return;
    end if;
  end if;

  -- 3) Geolocalização: bairro do mapa mais próximo (até ~4 km), de preferência
  -- na mesma cidade.
  if p_lat is not null and p_lng is not null then
    select b.regiao_macro, b.micro_regiao into r
      from rhi_mapa_bairros b
     where b.latitude between p_lat - 0.04 and p_lat + 0.04
       and b.longitude between p_lng - 0.04 and p_lng + 0.04
       and nullif(btrim(b.regiao_macro), '') is not null
     order by (b.cidade_norm = v_cid) desc,
              (b.latitude - p_lat) * (b.latitude - p_lat) + (b.longitude - p_lng) * (b.longitude - p_lng)
     limit 1;
    if found then
      return query select rhi_regiao_rotulo(r.regiao_macro), nullif(btrim(r.micro_regiao), ''), 'geo'::text; return;
    end if;
  end if;

  return query select null::text, null::text, 'sem'::text;
end;
$$;

-- Gatilho: marca a região em toda entrada/atualização. O nome começa com
-- "trg_mercado_regiao" para rodar DEPOIS do trg_mercado_norm (que arruma
-- cidade/bairro/UF a partir do endereço).
create or replace function rhi_mercado_regiao_trg()
returns trigger language plpgsql as $$
declare c record;
begin
  select * into c from rhi_mercado_classificar(new.endereco, new.cidade, new.uf, new.bairro, new.lat, new.lng);
  new.regiao := c.regiao;
  new.micro_regiao := c.micro_regiao;
  new.regiao_fonte := c.fonte;
  return new;
end;
$$;
drop trigger if exists trg_mercado_regiao on rhi_mercado_maps;
create trigger trg_mercado_regiao
  before insert or update on rhi_mercado_maps
  for each row execute function rhi_mercado_regiao_trg();

-- Remarca em lotes (chamado pelo servidor do site depois de copiar o mapa de
-- bairros). Percorre a base pela chave: passe em p_apos a "ultima" devolvida
-- pela chamada anterior, até "feitos" vir 0. Só mexe em quem ainda não tem
-- região (pendente ou "sem"); quem já foi marcado por CEP/bairro/geo fica.
create or replace function rhi_mercado_reclassificar(p_limite int default 2000, p_apos text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_feitos int; v_ultima text;
begin
  with alvo as (
    select place_key from rhi_mercado_maps
     where (p_apos is null or place_key > p_apos)
       and (regiao_fonte is null or regiao_fonte = 'sem')
     order by place_key
     limit greatest(1, least(5000, p_limite))
  ), feito as (
    update rhi_mercado_maps m set endereco = m.endereco
      from alvo where m.place_key = alvo.place_key
    returning m.place_key
  )
  select count(*), max(place_key) into v_feitos, v_ultima from feito;
  return jsonb_build_object(
    'ok', true, 'feitos', v_feitos, 'ultima', v_ultima,
    'total', (select count(*) from rhi_mercado_maps),
    'com_regiao', (select count(*) from rhi_mercado_maps where regiao is not null),
    'por_fonte', (select coalesce(jsonb_object_agg(f, n), '{}'::jsonb) from (select coalesce(regiao_fonte, 'pendente') as f, count(*) as n from rhi_mercado_maps group by 1) t),
    'bairros_no_mapa', (select count(*) from rhi_mapa_bairros));
end;
$$;
revoke execute on function rhi_mercado_reclassificar(int, text) from public, anon, authenticated;
grant execute on function rhi_mercado_reclassificar(int, text) to service_role;

-- ----------------------------------------------------------------------------
-- Painel da extensão: opções de região, de bairro (por região) e a busca nova.
-- A busca antiga (rhi_mercado_search) continua igual, para versões antigas.
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

create or replace function rhi_mercado_opcoes_regiao(p_cidade text default null)
returns table(regiao text, total bigint)
language sql stable security definer set search_path = public
as $$
  select coalesce(m.regiao, 'Sem região') as regiao, count(*)::bigint as total
  from rhi_mercado_maps m
  where (p_cidade is null or p_cidade = '' or rhi_sem_acento(m.cidade) = rhi_sem_acento(p_cidade))
  group by 1
  order by (coalesce(m.regiao, 'Sem região') = 'Sem região'), 2 desc, 1
$$;

create or replace function rhi_mercado_opcoes_bairro(p_cidade text default null, p_regiao text default null)
returns table(bairro text, total bigint)
language sql stable security definer set search_path = public
as $$
  select min(btrim(m.bairro)) as bairro, count(*)::bigint as total
  from rhi_mercado_maps m
  where nullif(btrim(m.bairro), '') is not null
    and (p_cidade is null or p_cidade = '' or rhi_sem_acento(m.cidade) = rhi_sem_acento(p_cidade))
    and (p_regiao is null or p_regiao = '' or coalesce(m.regiao, 'Sem região') = p_regiao)
  group by rhi_sem_acento(btrim(m.bairro))
  order by 2 desc, 1
  limit 400
$$;

create or replace function rhi_mercado_search2(
  p_cidade text default null,
  p_regiao text default null,
  p_bairro text default null,
  p_espec  text default null,
  p_busca  text default null,
  p_page   integer default 1,
  p_page_size integer default 40,
  p_ocultar_consumidos boolean default true
)
returns table(
  place_key text, nome text, categoria text, bairro text, cidade text, uf text,
  regiao text, micro_regiao text,
  avaliacao numeric, num_avaliacoes integer, instagram_url text, place_url text,
  tem_telefone boolean, tem_instagram boolean, total_count bigint
)
language sql stable security definer set search_path = public
as $$
  with filtrado as (
    select m.*
    from rhi_mercado_maps m
    where (p_cidade is null or p_cidade = '' or rhi_sem_acento(m.cidade) = rhi_sem_acento(p_cidade))
      and (p_regiao is null or p_regiao = '' or coalesce(m.regiao, 'Sem região') = p_regiao)
      and (p_bairro is null or p_bairro = '' or rhi_sem_acento(btrim(m.bairro)) = rhi_sem_acento(btrim(p_bairro)))
      and (p_espec  is null or p_espec  = '' or rhi_mercado_categoria_norm(m.categoria) = p_espec)
      and (p_busca  is null or p_busca  = '' or rhi_sem_acento(m.nome) like '%'||rhi_sem_acento(p_busca)||'%'
           or rhi_sem_acento(m.bairro) like '%'||rhi_sem_acento(p_busca)||'%')
      and (not p_ocultar_consumidos
           or not exists (select 1 from rhi_mercado_consumidos c where c.place_key = m.place_key))
  )
  select
    f.place_key, f.nome, f.categoria, f.bairro, f.cidade, f.uf,
    f.regiao, f.micro_regiao,
    f.avaliacao, f.num_avaliacoes, f.instagram_url, f.place_url,
    (f.telefone is not null and btrim(f.telefone) <> '') as tem_telefone,
    (f.instagram_url is not null and btrim(f.instagram_url) <> '') as tem_instagram,
    count(*) over()::bigint as total_count
  from filtrado f
  order by (f.avaliacao is null), f.avaliacao desc nulls last, f.nome
  limit greatest(1, least(100, coalesce(p_page_size, 40)))
  offset greatest(0, (coalesce(p_page, 1) - 1) * greatest(1, least(100, coalesce(p_page_size, 40))))
$$;

grant execute on function rhi_mercado_opcoes_regiao(text) to authenticated;
grant execute on function rhi_mercado_opcoes_bairro(text, text) to authenticated;
grant execute on function rhi_mercado_search2(text,text,text,text,text,integer,integer,boolean) to authenticated;

-- Marca agora o que já está na base (por CEP já sai certo; bairro e
-- geolocalização entram depois do botão "Sincronizar" no admin).
update rhi_mercado_maps set endereco = endereco;

-- Conferência: quantos lugares por região (São Paulo capital já deve aparecer dividido).
select coalesce(regiao, 'Sem região') as regiao, regiao_fonte, count(*) as lugares
from rhi_mercado_maps group by 1, 2 order by 3 desc;
