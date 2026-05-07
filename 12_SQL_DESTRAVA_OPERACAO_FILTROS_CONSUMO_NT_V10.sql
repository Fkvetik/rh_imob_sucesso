-- RH IMOB • Novos Talentos
-- V10 — OPERAÇÃO, FILTROS, CONSUMO E RELATÓRIO CORRIGIDOS
--
-- Execute no Supabase correto dos Novos Talentos:
-- https://pufxvskozfdvfscqnays.supabase.co

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

-- 1) Estrutura da tabela de consumo
alter table public.nt_talento_consumos add column if not exists consumo_id uuid default gen_random_uuid();
alter table public.nt_talento_consumos add column if not exists conta_id text;
alter table public.nt_talento_consumos add column if not exists produto_codigo text default 'NOVOS_TALENTOS';
alter table public.nt_talento_consumos add column if not exists talento_key text;
alter table public.nt_talento_consumos add column if not exists usuario_id uuid;
alter table public.nt_talento_consumos add column if not exists auth_user_id uuid;
alter table public.nt_talento_consumos add column if not exists operador_nome text;
alter table public.nt_talento_consumos add column if not exists origem text;
alter table public.nt_talento_consumos add column if not exists created_at timestamptz not null default now();

alter table public.nt_talento_consumos alter column consumo_id set default gen_random_uuid();
alter table public.nt_talento_consumos alter column produto_codigo set default 'NOVOS_TALENTOS';
alter table public.nt_talento_consumos alter column created_at set default now();

update public.nt_talento_consumos
set produto_codigo = 'NOVOS_TALENTOS'
where produto_codigo is null or produto_codigo = '';

create index if not exists idx_nt_consumos_conta_talento_v10 on public.nt_talento_consumos (conta_id, talento_key);
create index if not exists idx_nt_consumos_conta_produto_v10 on public.nt_talento_consumos (conta_id, produto_codigo);
create index if not exists idx_nt_consumos_data_v10 on public.nt_talento_consumos (created_at desc);

-- 2) Prévia pública mascarada
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

drop policy if exists nt_publicos_preview_anon_v10 on public.nt_talentos_publicos;
drop policy if exists nt_publicos_preview_auth_v10 on public.nt_talentos_publicos;
drop policy if exists nt_filtro_cidade_preview_anon_v10 on public.nt_filtro_cidade;
drop policy if exists nt_filtro_idade_preview_anon_v10 on public.nt_filtro_cidade_idade;
drop policy if exists nt_filtro_cargo_preview_anon_v10 on public.nt_filtro_cidade_cargo;
drop policy if exists nt_filtro_metro_preview_anon_v10 on public.nt_filtro_cidade_metro;

create policy nt_publicos_preview_anon_v10 on public.nt_talentos_publicos
for select to anon
using (produto_codigo = 'NOVOS_TALENTOS' and ativo = true);

create policy nt_publicos_preview_auth_v10 on public.nt_talentos_publicos
for select to authenticated
using (produto_codigo = 'NOVOS_TALENTOS' and ativo = true);

create policy nt_filtro_cidade_preview_anon_v10 on public.nt_filtro_cidade
for select to anon using (true);

create policy nt_filtro_idade_preview_anon_v10 on public.nt_filtro_cidade_idade
for select to anon using (true);

create policy nt_filtro_cargo_preview_anon_v10 on public.nt_filtro_cidade_cargo
for select to anon using (true);

create policy nt_filtro_metro_preview_anon_v10 on public.nt_filtro_cidade_metro
for select to anon using (true);

-- 3) Filtros públicos por tipo
create or replace function public.nt_macro_publica_v10(p_regiao text, p_bairro text)
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

create or replace function public.nt_micro_publica_v10(p_micro text, p_estacao text, p_bairro text)
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

create or replace function public.nt_base_publica_v10()
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
  ativo boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.talento_key::text,
    p.nome_mascarado::text,
    p.primeiro_nome::text,
    p.cargo::text,
    p.idade_anos::integer,
    p.faixa_idade::text,
    p.cidade::text,
    p.estado_uf::text,
    p.bairro::text,
    p.regiao_macro::text,
    p.micro_regiao::text,
    public.nt_macro_publica_v10(p.regiao_macro::text, p.bairro::text) as macro_calc,
    public.nt_micro_publica_v10(p.micro_regiao::text, p.estacao_mais_proxima::text, p.bairro::text) as micro_calc,
    p.tem_whatsapp::boolean,
    p.tem_email::boolean,
    p.tem_geo::boolean,
    p.estacao_mais_proxima::text,
    p.linha_metro_mais_proxima::text,
    p.cor_linha_metro::text,
    p.distancia_metro_km::numeric,
    p.tags_publicas::text,
    p.ativo::boolean
  from public.nt_talentos_publicos p
  where p.produto_codigo = 'NOVOS_TALENTOS'
    and p.ativo = true;
$$;

create or replace function public.nt_opcoes_filtro_publico_v10(
  p_tipo text,
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
    from public.nt_base_publica_v10() b
    where
      (p_tipo = 'cidade' or nullif(trim(coalesce(p_cidade, '')), '') is null or b.cidade = p_cidade)
      and (p_tipo = 'cidade' or nullif(trim(coalesce(p_estado_uf, '')), '') is null or b.estado_uf = p_estado_uf)
      and (p_tipo = 'regiao_macro' or nullif(trim(coalesce(p_regiao_macro, '')), '') is null or b.macro_calc = p_regiao_macro)
      and (p_tipo = 'micro_regiao' or nullif(trim(coalesce(p_micro_regiao, '')), '') is null or b.micro_calc = p_micro_regiao)
      and (p_tipo = 'bairro' or nullif(trim(coalesce(p_bairro, '')), '') is null or b.bairro = p_bairro)
      and (p_tipo = 'faixa_idade' or nullif(trim(coalesce(p_faixa_idade, '')), '') is null or b.faixa_idade = p_faixa_idade)
      and (p_tipo = 'cargo' or nullif(trim(coalesce(p_cargo, '')), '') is null or b.cargo = p_cargo)
      and (p_tipo = 'metro' or nullif(trim(coalesce(p_estacao, '')), '') is null or b.estacao_mais_proxima = p_estacao)
      and (
        nullif(trim(coalesce(p_termo, '')), '') is null
        or b.nome_mascarado ilike '%' || trim(p_termo) || '%'
        or b.cargo ilike '%' || trim(p_termo) || '%'
        or b.bairro ilike '%' || trim(p_termo) || '%'
        or b.cidade ilike '%' || trim(p_termo) || '%'
        or b.tags_publicas ilike '%' || trim(p_termo) || '%'
      )
  ),
  dados as (
    select
      case
        when p_tipo = 'cidade' then (cidade || '||' || estado_uf)
        when p_tipo = 'regiao_macro' then macro_calc
        when p_tipo = 'micro_regiao' then micro_calc
        when p_tipo = 'bairro' then bairro
        when p_tipo = 'faixa_idade' then faixa_idade
        when p_tipo = 'cargo' then cargo
        when p_tipo = 'metro' then estacao_mais_proxima
        else null
      end as valor,
      case
        when p_tipo = 'cidade' then (cidade || '/' || estado_uf)
        when p_tipo = 'metro' then (estacao_mais_proxima || coalesce(' • ' || nullif(linha_metro_mais_proxima, ''), ''))
        when p_tipo = 'regiao_macro' then macro_calc
        when p_tipo = 'micro_regiao' then micro_calc
        when p_tipo = 'bairro' then bairro
        when p_tipo = 'faixa_idade' then faixa_idade
        when p_tipo = 'cargo' then cargo
        else null
      end as label
    from base
  )
  select
    dados.valor::text,
    dados.label::text,
    count(*)::bigint as total
  from dados
  where nullif(trim(coalesce(dados.valor, '')), '') is not null
  group by dados.valor, dados.label
  order by total desc, label asc
  limit case
    when p_tipo in ('cargo','bairro','micro_regiao') then 800
    else 600
  end;
$$;

create or replace function public.nt_listar_talentos_publico_v10(
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
    from public.nt_base_publica_v10() b
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
  order by b.talento_key desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- 4) Ver detalhes / consumo destravado
create or replace function public.nt_consumir_talento(p_talento_key text)
returns table (
  talento_key text,
  nome_completo text,
  primeiro_nome text,
  email text,
  whatsapp text,
  telefone_principal text,
  cargo text,
  pretensao_salarial text,
  sexo text,
  idade_anos integer,
  faixa_idade text,
  cidade text,
  estado_uf text,
  bairro text,
  cep text,
  regiao_macro text,
  micro_regiao text,
  bairro_macro text,
  estacao_mais_proxima text,
  linha_metro_mais_proxima text,
  cor_linha_metro text,
  distancia_metro_km numeric,
  curriculo_url text,
  consumido_agora boolean,
  saldo_restante integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.nt_usuarios_conta%rowtype;
  v_conta public.nt_contas%rowtype;
  v_consumidos integer := 0;
  v_ja_existia boolean := false;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Faça login para liberar o contato.' using errcode = '42501';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select u.* into v_user
  from public.nt_usuarios_conta u
  join public.nt_contas c
    on c.conta_id = u.conta_id
   and c.produto_codigo = u.produto_codigo
  where (
      u.auth_user_id = auth.uid()
      or lower(coalesce(u.email_login, '')) = v_email
    )
    and u.status = 'ATIVO'
    and c.status = 'ATIVA'
    and u.produto_codigo = 'NOVOS_TALENTOS'
  order by case when u.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;

  if v_user.usuario_id is null then
    raise exception 'Usuário sem vínculo ativo no plano Novos Talentos.' using errcode = '42501';
  end if;

  if v_user.auth_user_id is distinct from auth.uid() then
    update public.nt_usuarios_conta
    set auth_user_id = auth.uid(),
        updated_at = now()
    where usuario_id = v_user.usuario_id;

    v_user.auth_user_id := auth.uid();
  end if;

  select * into v_conta
  from public.nt_contas c
  where c.conta_id = v_user.conta_id
    and c.produto_codigo = 'NOVOS_TALENTOS'
    and c.status = 'ATIVA'
  limit 1;

  if v_conta.conta_id is null then
    raise exception 'Conta sem plano ativo.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.nt_talentos t
    where t.talento_key = p_talento_key
      and t.produto_codigo = 'NOVOS_TALENTOS'
      and coalesce(t.status_registro, 'ATIVO') = 'ATIVO'
  ) then
    raise exception 'Talento não encontrado ou indisponível.' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.nt_talento_consumos lc
    where lc.conta_id = v_user.conta_id
      and lc.produto_codigo = 'NOVOS_TALENTOS'
      and lc.talento_key = p_talento_key
  ) into v_ja_existia;

  if not v_ja_existia then
    select count(*)::integer into v_consumidos
    from public.nt_talento_consumos lc
    where lc.conta_id = v_user.conta_id
      and lc.produto_codigo = 'NOVOS_TALENTOS';

    if coalesce(v_conta.limite_total, 0) > 0 and v_consumidos >= v_conta.limite_total then
      raise exception 'Limite do plano atingido.' using errcode = 'P0001';
    end if;

    insert into public.nt_talento_consumos (
      conta_id,
      produto_codigo,
      talento_key,
      usuario_id,
      auth_user_id,
      operador_nome,
      origem,
      created_at
    )
    values (
      v_user.conta_id,
      'NOVOS_TALENTOS',
      p_talento_key,
      v_user.usuario_id,
      auth.uid(),
      v_user.nome,
      'PLATAFORMA_NOVOS_TALENTOS',
      now()
    );
  end if;

  select count(*)::integer into v_consumidos
  from public.nt_talento_consumos lc
  where lc.conta_id = v_user.conta_id
    and lc.produto_codigo = 'NOVOS_TALENTOS';

  return query
  select
    t.talento_key::text,
    t.nome_completo::text,
    t.primeiro_nome::text,
    t.email::text,
    t.whatsapp::text,
    t.telefone_principal::text,
    t.cargo::text,
    t.pretensao_salarial::text,
    t.sexo::text,
    t.idade_anos::integer,
    t.faixa_idade::text,
    t.cidade::text,
    t.estado_uf::text,
    t.bairro::text,
    t.cep::text,
    t.regiao_macro::text,
    t.micro_regiao::text,
    t.bairro_macro::text,
    t.estacao_mais_proxima::text,
    t.linha_metro_mais_proxima::text,
    t.cor_linha_metro::text,
    t.distancia_metro_km::numeric,
    t.curriculo_url::text,
    (not v_ja_existia) as consumido_agora,
    greatest(coalesce(v_conta.limite_total, 0) - v_consumidos, 0) as saldo_restante
  from public.nt_talentos t
  where t.talento_key = p_talento_key
  limit 1;
end;
$$;

-- 5) Relatórios padrão Corretores
create or replace view public.nt_relatorio_contas_v10 as
select
  c.conta_id,
  c.nome_conta,
  c.plano_tipo,
  c.status,
  c.limite_total,
  c.usuarios_contratados,
  coalesce(count(cons.consumo_id), 0)::integer as consumidos,
  greatest(coalesce(c.limite_total, 0) - coalesce(count(cons.consumo_id), 0)::integer, 0) as saldo
from public.nt_contas c
left join public.nt_talento_consumos cons
  on cons.conta_id = c.conta_id
 and cons.produto_codigo = c.produto_codigo
where c.produto_codigo = 'NOVOS_TALENTOS'
group by
  c.conta_id,
  c.nome_conta,
  c.plano_tipo,
  c.status,
  c.limite_total,
  c.usuarios_contratados;

create or replace view public.nt_relatorio_operadores_v10 as
select
  cons.conta_id,
  cons.produto_codigo,
  date(cons.created_at at time zone 'America/Sao_Paulo') as data_consumo,
  cons.auth_user_id,
  coalesce(u.nome, cons.operador_nome, 'Operador') as operador_nome,
  coalesce(u.email_login, '') as email_login,
  count(*)::integer as total_consumos
from public.nt_talento_consumos cons
left join public.nt_usuarios_conta u
  on u.usuario_id = cons.usuario_id
where cons.produto_codigo = 'NOVOS_TALENTOS'
group by
  cons.conta_id,
  cons.produto_codigo,
  date(cons.created_at at time zone 'America/Sao_Paulo'),
  cons.auth_user_id,
  coalesce(u.nome, cons.operador_nome, 'Operador'),
  coalesce(u.email_login, '');

create or replace view public.nt_relatorio_contas_v9 as
select * from public.nt_relatorio_contas_v10;

create or replace view public.nt_relatorio_operadores_v9 as
select * from public.nt_relatorio_operadores_v10;

grant execute on function public.nt_macro_publica_v10(text, text) to anon, authenticated;
grant execute on function public.nt_micro_publica_v10(text, text, text) to anon, authenticated;
grant execute on function public.nt_base_publica_v10() to anon, authenticated;
grant execute on function public.nt_opcoes_filtro_publico_v10(text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.nt_listar_talentos_publico_v10(text, text, text, text, text, text, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.nt_consumir_talento(text) to authenticated;

grant select on public.nt_relatorio_contas_v10 to authenticated;
grant select on public.nt_relatorio_operadores_v10 to authenticated;
grant select on public.nt_relatorio_contas_v9 to authenticated;
grant select on public.nt_relatorio_operadores_v9 to authenticated;

notify pgrst, 'reload schema';

-- Diagnóstico final
select 'contas_ativas' as item, count(*) as total
from public.nt_contas
where produto_codigo = 'NOVOS_TALENTOS' and status = 'ATIVA'
union all
select 'usuarios_ativos', count(*)
from public.nt_usuarios_conta
where produto_codigo = 'NOVOS_TALENTOS' and status = 'ATIVO'
union all
select 'talentos_publicos', count(*)
from public.nt_talentos_publicos
where produto_codigo = 'NOVOS_TALENTOS' and ativo = true;

select 'cidade' as filtro, count(*) as opcoes
from public.nt_opcoes_filtro_publico_v10('cidade', null, null, null, null, null, null, null, null, null)
union all
select 'regiao_macro', count(*)
from public.nt_opcoes_filtro_publico_v10('regiao_macro', 'SÃO Paulo', 'SP', null, null, null, null, null, null, null)
union all
select 'bairro', count(*)
from public.nt_opcoes_filtro_publico_v10('bairro', 'SÃO Paulo', 'SP', null, null, null, null, null, null, null);

select *
from public.nt_relatorio_contas_v10
order by conta_id;
