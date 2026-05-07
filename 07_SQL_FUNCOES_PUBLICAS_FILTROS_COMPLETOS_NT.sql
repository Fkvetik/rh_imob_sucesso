-- RH IMOB • Novos Talentos
-- 07_SQL_FUNCOES_PUBLICAS_FILTROS_COMPLETOS_NT.sql
--
-- Execute no Supabase correto da Plataforma Novos Talentos.
--
-- Objetivo:
-- - Criar funções públicas seguras para a prévia sem login.
-- - Evitar o front-end consultar tabelas diretamente.
-- - Entregar filtros completos: cidade, macro região, micro região, bairro,
--   faixa de idade, perfil/cargo e metrô.
-- - Manter telefone, e-mail e detalhes completos protegidos por login/consumo.

create or replace function public.nt_norm_macro_nt(p_regiao text, p_bairro text)
returns text
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(p_regiao, '')), '') is not null then trim(p_regiao)
    when coalesce(p_bairro, '') ilike '%zona sul%' then 'Zona Sul'
    when coalesce(p_bairro, '') ilike '%zona norte%' then 'Zona Norte'
    when coalesce(p_bairro, '') ilike '%zona leste%' then 'Zona Leste'
    when coalesce(p_bairro, '') ilike '%zona oeste%' then 'Zona Oeste'
    when coalesce(p_bairro, '') ilike '%centro%' then 'Centro'
    else 'Região em classificação'
  end;
$$;

create or replace function public.nt_norm_micro_nt(p_micro text, p_bairro text, p_estacao text)
returns text
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(p_micro, '')), '') is not null then trim(p_micro)
    when nullif(trim(coalesce(p_bairro, '')), '') is not null then trim(p_bairro)
    when nullif(trim(coalesce(p_estacao, '')), '') is not null then trim(p_estacao)
    else 'Micro região em classificação'
  end;
$$;

create or replace function public.nt_opcoes_publicas_v2(
  p_cidade text default null,
  p_estado_uf text default null,
  p_regiao_macro text default null,
  p_micro_regiao text default null,
  p_bairro text default null
)
returns table (
  tipo text,
  valor text,
  label text,
  total bigint
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      p.talento_key,
      p.cidade,
      p.estado_uf,
      p.bairro,
      public.nt_norm_macro_nt(p.regiao_macro, p.bairro) as regiao_macro_ui,
      public.nt_norm_micro_nt(p.micro_regiao, p.bairro, p.estacao_mais_proxima) as micro_regiao_ui,
      p.faixa_idade,
      p.cargo,
      p.estacao_mais_proxima,
      p.linha_metro_mais_proxima,
      p.ativo,
      p.produto_codigo
    from public.nt_talentos_publicos p
    where p.produto_codigo = 'NOVOS_TALENTOS'
      and p.ativo = true
  ), filtered_geo as (
    select *
    from base b
    where (nullif(trim(p_cidade), '') is null or b.cidade = p_cidade)
      and (nullif(trim(p_estado_uf), '') is null or b.estado_uf = upper(p_estado_uf))
      and (nullif(trim(p_regiao_macro), '') is null or b.regiao_macro_ui = p_regiao_macro)
      and (nullif(trim(p_micro_regiao), '') is null or b.micro_regiao_ui = p_micro_regiao)
      and (nullif(trim(p_bairro), '') is null or b.bairro = p_bairro)
  )
  select 'cidade'::text as tipo,
         b.cidade || '||' || b.estado_uf as valor,
         b.cidade || '/' || b.estado_uf as label,
         count(*)::bigint as total
  from base b
  where nullif(trim(coalesce(b.cidade, '')), '') is not null
    and nullif(trim(coalesce(b.estado_uf, '')), '') is not null
  group by b.cidade, b.estado_uf

  union all

  select 'regiao_macro',
         b.regiao_macro_ui,
         b.regiao_macro_ui,
         count(*)::bigint
  from base b
  where (nullif(trim(p_cidade), '') is null or b.cidade = p_cidade)
    and (nullif(trim(p_estado_uf), '') is null or b.estado_uf = upper(p_estado_uf))
    and nullif(trim(coalesce(b.regiao_macro_ui, '')), '') is not null
  group by b.regiao_macro_ui

  union all

  select 'micro_regiao',
         b.micro_regiao_ui,
         b.micro_regiao_ui,
         count(*)::bigint
  from base b
  where (nullif(trim(p_cidade), '') is null or b.cidade = p_cidade)
    and (nullif(trim(p_estado_uf), '') is null or b.estado_uf = upper(p_estado_uf))
    and (nullif(trim(p_regiao_macro), '') is null or b.regiao_macro_ui = p_regiao_macro)
    and nullif(trim(coalesce(b.micro_regiao_ui, '')), '') is not null
  group by b.micro_regiao_ui

  union all

  select 'bairro',
         b.bairro,
         b.bairro,
         count(*)::bigint
  from base b
  where (nullif(trim(p_cidade), '') is null or b.cidade = p_cidade)
    and (nullif(trim(p_estado_uf), '') is null or b.estado_uf = upper(p_estado_uf))
    and (nullif(trim(p_regiao_macro), '') is null or b.regiao_macro_ui = p_regiao_macro)
    and (nullif(trim(p_micro_regiao), '') is null or b.micro_regiao_ui = p_micro_regiao)
    and nullif(trim(coalesce(b.bairro, '')), '') is not null
  group by b.bairro

  union all

  select 'faixa_idade',
         b.faixa_idade,
         b.faixa_idade,
         count(*)::bigint
  from filtered_geo b
  where nullif(trim(coalesce(b.faixa_idade, '')), '') is not null
  group by b.faixa_idade

  union all

  select 'cargo',
         b.cargo,
         b.cargo,
         count(*)::bigint
  from filtered_geo b
  where nullif(trim(coalesce(b.cargo, '')), '') is not null
  group by b.cargo

  union all

  select 'metro',
         b.estacao_mais_proxima,
         case
           when nullif(trim(coalesce(b.linha_metro_mais_proxima, '')), '') is not null
           then b.estacao_mais_proxima || ' • ' || b.linha_metro_mais_proxima
           else b.estacao_mais_proxima
         end,
         count(*)::bigint
  from filtered_geo b
  where nullif(trim(coalesce(b.estacao_mais_proxima, '')), '') is not null
  group by b.estacao_mais_proxima, b.linha_metro_mais_proxima

  order by tipo, total desc, label;
$$;

create or replace function public.nt_listar_talentos_publico_v2(
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
  regiao_macro_ui text,
  micro_regiao_ui text,
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
security definer
set search_path = public
as $$
  with me as (
    select u.conta_id, u.produto_codigo
    from public.nt_usuarios_conta u
    join public.nt_contas c on c.conta_id = u.conta_id and c.produto_codigo = u.produto_codigo
    where auth.uid() is not null
      and u.auth_user_id = auth.uid()
      and u.status = 'ATIVO'
      and c.status = 'ATIVA'
      and u.produto_codigo = 'NOVOS_TALENTOS'
    limit 1
  ), base as (
    select
      p.*,
      public.nt_norm_macro_nt(p.regiao_macro, p.bairro) as macro_ui,
      public.nt_norm_micro_nt(p.micro_regiao, p.bairro, p.estacao_mais_proxima) as micro_ui
    from public.nt_talentos_publicos p
    where p.produto_codigo = 'NOVOS_TALENTOS'
      and p.ativo = true
  ), filtered as (
    select b.*
    from base b
    where not exists (
        select 1
        from me m
        join public.nt_talento_consumos lc
          on lc.conta_id = m.conta_id
         and lc.produto_codigo = m.produto_codigo
         and lc.talento_key = b.talento_key
      )
      and (nullif(trim(p_cidade), '') is null or b.cidade = p_cidade)
      and (nullif(trim(p_estado_uf), '') is null or b.estado_uf = upper(p_estado_uf))
      and (nullif(trim(p_regiao_macro), '') is null or b.macro_ui = p_regiao_macro)
      and (nullif(trim(p_micro_regiao), '') is null or b.micro_ui = p_micro_regiao)
      and (nullif(trim(p_bairro), '') is null or b.bairro = p_bairro)
      and (nullif(trim(p_faixa_idade), '') is null or b.faixa_idade = p_faixa_idade)
      and (nullif(trim(p_cargo), '') is null or b.cargo = p_cargo)
      and (nullif(trim(p_estacao), '') is null or b.estacao_mais_proxima = p_estacao)
      and (
        nullif(trim(p_termo), '') is null
        or b.nome_mascarado ilike '%' || trim(p_termo) || '%'
        or b.primeiro_nome ilike '%' || trim(p_termo) || '%'
        or b.cargo ilike '%' || trim(p_termo) || '%'
        or b.cidade ilike '%' || trim(p_termo) || '%'
        or b.bairro ilike '%' || trim(p_termo) || '%'
        or b.macro_ui ilike '%' || trim(p_termo) || '%'
        or b.micro_ui ilike '%' || trim(p_termo) || '%'
        or b.tags_publicas ilike '%' || trim(p_termo) || '%'
      )
  )
  select
    f.talento_key,
    f.nome_mascarado,
    f.primeiro_nome,
    f.cargo,
    f.idade_anos,
    f.faixa_idade,
    f.cidade,
    f.estado_uf,
    f.bairro,
    f.regiao_macro,
    f.micro_regiao,
    f.macro_ui as regiao_macro_ui,
    f.micro_ui as micro_regiao_ui,
    f.tem_whatsapp,
    f.tem_email,
    f.tem_geo,
    f.estacao_mais_proxima,
    f.linha_metro_mais_proxima,
    f.cor_linha_metro,
    f.distancia_metro_km,
    f.tags_publicas,
    count(*) over() as total_count
  from filtered f
  order by f.cidade nulls last, f.bairro nulls last, f.cargo nulls last, f.primeiro_nome nulls last
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.nt_norm_macro_nt(text, text) to anon, authenticated;
grant execute on function public.nt_norm_micro_nt(text, text, text) to anon, authenticated;
grant execute on function public.nt_opcoes_publicas_v2(text, text, text, text, text) to anon, authenticated;
grant execute on function public.nt_listar_talentos_publico_v2(text, text, text, text, text, text, text, text, text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';

-- Conferência:
select * from public.nt_opcoes_publicas_v2(null, null, null, null, null)
where tipo in ('cidade', 'regiao_macro', 'faixa_idade')
limit 30;

select count(*) as talentos_preview
from public.nt_listar_talentos_publico_v2(null, null, null, null, null, null, null, null, null, 24, 0);
