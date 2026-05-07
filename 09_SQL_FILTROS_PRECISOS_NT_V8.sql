-- RH IMOB • Novos Talentos
-- 09_SQL_FILTROS_PRECISOS_NT_V8.sql
--
-- Execute no Supabase correto da Plataforma Novos Talentos.
--
-- Objetivo:
-- - Corrigir contagem e leitura dos filtros da prévia pública.
-- - Parar de calcular filtros por amostra no navegador.
-- - Fazer a contagem direto no banco sobre a base completa.
-- - Derivar macro região quando regiao_macro estiver vazia.
-- - Derivar micro região com micro_regiao, estação ou bairro.
-- - Manter contato completo protegido.

grant usage on schema public to anon, authenticated;

grant select on public.nt_talentos_publicos to anon, authenticated;
grant select on public.nt_filtro_cidade to anon, authenticated;
grant select on public.nt_filtro_cidade_idade to anon, authenticated;
grant select on public.nt_filtro_cidade_cargo to anon, authenticated;
grant select on public.nt_filtro_cidade_metro to anon, authenticated;

alter table public.nt_talentos_publicos enable row level security;
alter table public.nt_filtro_cidade enable row level security;
alter table public.nt_filtro_cidade_idade enable row level security;
alter table public.nt_filtro_cidade_cargo enable row level security;
alter table public.nt_filtro_cidade_metro enable row level security;

drop policy if exists nt_publicos_preview_anon_v8 on public.nt_talentos_publicos;
drop policy if exists nt_publicos_preview_auth_v8 on public.nt_talentos_publicos;
drop policy if exists nt_filtro_cidade_preview_anon_v8 on public.nt_filtro_cidade;
drop policy if exists nt_filtro_idade_preview_anon_v8 on public.nt_filtro_cidade_idade;
drop policy if exists nt_filtro_cargo_preview_anon_v8 on public.nt_filtro_cidade_cargo;
drop policy if exists nt_filtro_metro_preview_anon_v8 on public.nt_filtro_cidade_metro;

create policy nt_publicos_preview_anon_v8
on public.nt_talentos_publicos
for select
to anon
using (produto_codigo = 'NOVOS_TALENTOS' and ativo = true);

create policy nt_publicos_preview_auth_v8
on public.nt_talentos_publicos
for select
to authenticated
using (produto_codigo = 'NOVOS_TALENTOS' and ativo = true);

create policy nt_filtro_cidade_preview_anon_v8
on public.nt_filtro_cidade
for select
to anon
using (true);

create policy nt_filtro_idade_preview_anon_v8
on public.nt_filtro_cidade_idade
for select
to anon
using (true);

create policy nt_filtro_cargo_preview_anon_v8
on public.nt_filtro_cidade_cargo
for select
to anon
using (true);

create policy nt_filtro_metro_preview_anon_v8
on public.nt_filtro_cidade_metro
for select
to anon
using (true);

create or replace function public.nt_macro_publica_v8(p_regiao text, p_bairro text)
returns text
language sql
stable
as $$
  select case
    when nullif(trim(coalesce(p_regiao, '')), '') is not null then trim(p_regiao)
    when lower(coalesce(p_bairro, '')) like '%zona sul%' then 'Zona Sul'
    when lower(coalesce(p_bairro, '')) like '%zona norte%' then 'Zona Norte'
    when lower(coalesce(p_bairro, '')) like '%zona leste%' then 'Zona Leste'
    when lower(coalesce(p_bairro, '')) like '%zona oeste%' then 'Zona Oeste'
    when lower(coalesce(p_bairro, '')) like '%centro%' then 'Centro'
    when lower(coalesce(p_bairro, '')) like '%sé%' then 'Centro'
    when lower(coalesce(p_bairro, '')) like '%se%' then 'Centro'
    when lower(coalesce(p_bairro, '')) like '%república%' then 'Centro'
    when lower(coalesce(p_bairro, '')) like '%republica%' then 'Centro'
    else ''
  end;
$$;

create or replace function public.nt_micro_publica_v8(p_micro text, p_estacao text, p_bairro text)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(coalesce(p_micro, '')), ''),
    nullif(trim(coalesce(p_estacao, '')), ''),
    nullif(trim(coalesce(p_bairro, '')), ''),
    ''
  );
$$;

create or replace function public.nt_base_publica_v8()
returns table (
  talento_key text,
  nome_mascarado text,
  primeiro_nome text,
  cargo text,
  idade_anos integer,
  faixa_idade text,
  cidade text,
  estado_uf text,
  bairro text,
  regiao_macro text,
  micro_regiao text,
  macro_calc text,
  micro_calc text,
  tem_whatsapp boolean,
  tem_email boolean,
  tem_geo boolean,
  estacao_mais_proxima text,
  linha_metro_mais_proxima text,
  cor_linha_metro text,
  distancia_metro_km numeric,
  tags_publicas text,
  ativo boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.talento_key,
    p.nome_mascarado,
    p.primeiro_nome,
    p.cargo,
    p.idade_anos,
    p.faixa_idade,
    p.cidade,
    p.estado_uf,
    p.bairro,
    p.regiao_macro,
    p.micro_regiao,
    public.nt_macro_publica_v8(p.regiao_macro, p.bairro) as macro_calc,
    public.nt_micro_publica_v8(p.micro_regiao, p.estacao_mais_proxima, p.bairro) as micro_calc,
    p.tem_whatsapp,
    p.tem_email,
    p.tem_geo,
    p.estacao_mais_proxima,
    p.linha_metro_mais_proxima,
    p.cor_linha_metro,
    p.distancia_metro_km,
    p.tags_publicas,
    p.ativo,
    p.updated_at
  from public.nt_talentos_publicos p
  where p.produto_codigo = 'NOVOS_TALENTOS'
    and p.ativo = true;
$$;

create or replace function public.nt_opcoes_publicas_v8(
  p_cidade text default null,
  p_estado_uf text default null,
  p_regiao_macro text default null,
  p_micro_regiao text default null,
  p_bairro text default null,
  p_faixa_idade text default null,
  p_cargo text default null,
  p_estacao text default null,
  p_termo text default null
)
returns table (
  tipo text,
  valor text,
  label text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select *
    from public.nt_base_publica_v8() b
    where (nullif(trim(coalesce(p_cidade, '')), '') is null or b.cidade = p_cidade)
      and (nullif(trim(coalesce(p_estado_uf, '')), '') is null or b.estado_uf = p_estado_uf)
      and (nullif(trim(coalesce(p_regiao_macro, '')), '') is null or b.macro_calc = p_regiao_macro)
      and (nullif(trim(coalesce(p_micro_regiao, '')), '') is null or b.micro_calc = p_micro_regiao)
      and (nullif(trim(coalesce(p_bairro, '')), '') is null or b.bairro = p_bairro)
      and (nullif(trim(coalesce(p_faixa_idade, '')), '') is null or b.faixa_idade = p_faixa_idade)
      and (nullif(trim(coalesce(p_cargo, '')), '') is null or b.cargo = p_cargo)
      and (nullif(trim(coalesce(p_estacao, '')), '') is null or b.estacao_mais_proxima = p_estacao)
      and (
        nullif(trim(coalesce(p_termo, '')), '') is null
        or b.nome_mascarado ilike '%' || trim(p_termo) || '%'
        or b.cargo ilike '%' || trim(p_termo) || '%'
        or b.bairro ilike '%' || trim(p_termo) || '%'
        or b.cidade ilike '%' || trim(p_termo) || '%'
        or b.tags_publicas ilike '%' || trim(p_termo) || '%'
      )
  ),
  cidades as (
    select
      'cidade'::text as tipo,
      (b.cidade || '||' || b.estado_uf)::text as valor,
      (b.cidade || '/' || b.estado_uf)::text as label,
      count(*)::bigint as total
    from public.nt_base_publica_v8() b
    where nullif(trim(coalesce(b.cidade, '')), '') is not null
      and nullif(trim(coalesce(b.estado_uf, '')), '') is not null
    group by b.cidade, b.estado_uf
  ),
  regioes as (
    select
      'regiao_macro'::text as tipo,
      macro_calc::text as valor,
      macro_calc::text as label,
      count(*)::bigint as total
    from base
    where nullif(trim(coalesce(macro_calc, '')), '') is not null
    group by macro_calc
  ),
  micros as (
    select
      'micro_regiao'::text as tipo,
      micro_calc::text as valor,
      micro_calc::text as label,
      count(*)::bigint as total
    from base
    where nullif(trim(coalesce(micro_calc, '')), '') is not null
    group by micro_calc
  ),
  bairros as (
    select
      'bairro'::text as tipo,
      bairro::text as valor,
      bairro::text as label,
      count(*)::bigint as total
    from base
    where nullif(trim(coalesce(bairro, '')), '') is not null
    group by bairro
  ),
  idades as (
    select
      'faixa_idade'::text as tipo,
      faixa_idade::text as valor,
      faixa_idade::text as label,
      count(*)::bigint as total
    from base
    where nullif(trim(coalesce(faixa_idade, '')), '') is not null
    group by faixa_idade
  ),
  cargos as (
    select
      'cargo'::text as tipo,
      cargo::text as valor,
      cargo::text as label,
      count(*)::bigint as total
    from base
    where nullif(trim(coalesce(cargo, '')), '') is not null
    group by cargo
  ),
  metros as (
    select
      'metro'::text as tipo,
      estacao_mais_proxima::text as valor,
      (estacao_mais_proxima || coalesce(' • ' || nullif(linha_metro_mais_proxima, ''), ''))::text as label,
      count(*)::bigint as total
    from base
    where nullif(trim(coalesce(estacao_mais_proxima, '')), '') is not null
    group by estacao_mais_proxima, linha_metro_mais_proxima
  )
  select * from cidades
  union all select * from regioes
  union all select * from micros
  union all select * from bairros
  union all select * from idades
  union all select * from cargos
  union all select * from metros
  order by tipo, total desc, label asc;
$$;

create or replace function public.nt_listar_talentos_publico_v8(
  p_cidade text default null,
  p_estado_uf text default null,
  p_regiao_macro text default null,
  p_micro_regiao text default null,
  p_bairro text default null,
  p_faixa_idade text default null,
  p_cargo text default null,
  p_estacao text default null,
  p_termo text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  talento_key text,
  nome_mascarado text,
  primeiro_nome text,
  cargo text,
  idade_anos integer,
  faixa_idade text,
  cidade text,
  estado_uf text,
  bairro text,
  regiao_macro text,
  micro_regiao text,
  macro_calc text,
  micro_calc text,
  tem_whatsapp boolean,
  tem_email boolean,
  tem_geo boolean,
  estacao_mais_proxima text,
  linha_metro_mais_proxima text,
  cor_linha_metro text,
  distancia_metro_km numeric,
  tags_publicas text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select *
    from public.nt_base_publica_v8() b
    where (nullif(trim(coalesce(p_cidade, '')), '') is null or b.cidade = p_cidade)
      and (nullif(trim(coalesce(p_estado_uf, '')), '') is null or b.estado_uf = p_estado_uf)
      and (nullif(trim(coalesce(p_regiao_macro, '')), '') is null or b.macro_calc = p_regiao_macro)
      and (nullif(trim(coalesce(p_micro_regiao, '')), '') is null or b.micro_calc = p_micro_regiao)
      and (nullif(trim(coalesce(p_bairro, '')), '') is null or b.bairro = p_bairro)
      and (nullif(trim(coalesce(p_faixa_idade, '')), '') is null or b.faixa_idade = p_faixa_idade)
      and (nullif(trim(coalesce(p_cargo, '')), '') is null or b.cargo = p_cargo)
      and (nullif(trim(coalesce(p_estacao, '')), '') is null or b.estacao_mais_proxima = p_estacao)
      and (
        nullif(trim(coalesce(p_termo, '')), '') is null
        or b.nome_mascarado ilike '%' || trim(p_termo) || '%'
        or b.cargo ilike '%' || trim(p_termo) || '%'
        or b.bairro ilike '%' || trim(p_termo) || '%'
        or b.cidade ilike '%' || trim(p_termo) || '%'
        or b.tags_publicas ilike '%' || trim(p_termo) || '%'
      )
  )
  select
    b.talento_key,
    b.nome_mascarado,
    b.primeiro_nome,
    b.cargo,
    b.idade_anos,
    b.faixa_idade,
    b.cidade,
    b.estado_uf,
    b.bairro,
    b.regiao_macro,
    b.micro_regiao,
    b.macro_calc,
    b.micro_calc,
    b.tem_whatsapp,
    b.tem_email,
    b.tem_geo,
    b.estacao_mais_proxima,
    b.linha_metro_mais_proxima,
    b.cor_linha_metro,
    b.distancia_metro_km,
    b.tags_publicas,
    count(*) over() as total_count
  from base b
  order by b.updated_at desc nulls last, b.cidade nulls last, b.bairro nulls last
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.nt_macro_publica_v8(text, text) to anon, authenticated;
grant execute on function public.nt_micro_publica_v8(text, text, text) to anon, authenticated;
grant execute on function public.nt_base_publica_v8() to anon, authenticated;
grant execute on function public.nt_opcoes_publicas_v8(text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.nt_listar_talentos_publico_v8(text, text, text, text, text, text, text, text, text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';

-- Diagnóstico rápido: deve retornar filtros com contagens reais.
select *
from public.nt_opcoes_publicas_v8('SÃO Paulo', 'SP', null, null, null, null, null, null, null)
where tipo = 'regiao_macro'
order by total desc;
