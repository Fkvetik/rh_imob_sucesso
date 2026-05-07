-- RH IMOB • Plataforma Novos Talentos
-- ETAPA 4 — SQL complementar para a página /novos-talentos.html
-- Versão: RHIMOB_NT_SITE_RPC_V1_2026_05_07
--
-- Execute no Supabase SQL Editor.
-- Não altera a Plataforma Corretores.
-- Apenas cria/atualiza funções RPC prefixadas com nt_.

create or replace function public.nt_app_context()
returns table (
  usuario_id uuid,
  conta_id text,
  produto_codigo text,
  nome text,
  email_login text,
  perfil text,
  nome_conta text,
  plano_tipo text,
  limite_total integer,
  limite_por_usuario integer,
  usuarios_contratados integer,
  consumidos integer,
  saldo integer
)
language sql
security definer
set search_path = public
as $$
  select
    u.usuario_id,
    u.conta_id,
    u.produto_codigo,
    u.nome,
    u.email_login,
    u.perfil,
    c.nome_conta,
    c.plano_tipo,
    coalesce(c.limite_total, 0) as limite_total,
    coalesce(c.limite_por_usuario, 0) as limite_por_usuario,
    coalesce(c.usuarios_contratados, 0) as usuarios_contratados,
    coalesce((
      select count(*)::integer
      from public.nt_talento_consumos lc
      where lc.conta_id = c.conta_id
        and lc.produto_codigo = c.produto_codigo
    ), 0) as consumidos,
    greatest(
      coalesce(c.limite_total, 0) - coalesce((
        select count(*)::integer
        from public.nt_talento_consumos lc
        where lc.conta_id = c.conta_id
          and lc.produto_codigo = c.produto_codigo
      ), 0),
      0
    ) as saldo
  from public.nt_usuarios_conta u
  join public.nt_contas c
    on c.conta_id = u.conta_id
   and c.produto_codigo = u.produto_codigo
  where u.auth_user_id = auth.uid()
    and u.status = 'ATIVO'
    and c.status = 'ATIVA'
    and u.produto_codigo = 'NOVOS_TALENTOS'
  limit 1;
$$;

create or replace function public.nt_listar_talentos(
  p_cidade text default null,
  p_estado_uf text default null,
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
    where u.auth_user_id = auth.uid()
      and u.status = 'ATIVO'
      and c.status = 'ATIVA'
      and u.produto_codigo = 'NOVOS_TALENTOS'
    limit 1
  ), base as (
    select p.*
    from public.nt_talentos_publicos p
    cross join me
    where p.produto_codigo = me.produto_codigo
      and p.ativo = true
      and not exists (
        select 1
        from public.nt_talento_consumos lc
        where lc.conta_id = me.conta_id
          and lc.produto_codigo = me.produto_codigo
          and lc.talento_key = p.talento_key
      )
      and (nullif(trim(p_cidade), '') is null or p.cidade = p_cidade)
      and (nullif(trim(p_estado_uf), '') is null or p.estado_uf = upper(p_estado_uf))
      and (nullif(trim(p_faixa_idade), '') is null or p.faixa_idade = p_faixa_idade)
      and (nullif(trim(p_cargo), '') is null or p.cargo = p_cargo)
      and (nullif(trim(p_estacao), '') is null or p.estacao_mais_proxima = p_estacao)
      and (
        nullif(trim(p_termo), '') is null
        or p.cargo ilike '%' || trim(p_termo) || '%'
        or p.cidade ilike '%' || trim(p_termo) || '%'
        or p.bairro ilike '%' || trim(p_termo) || '%'
        or p.regiao_macro ilike '%' || trim(p_termo) || '%'
        or p.micro_regiao ilike '%' || trim(p_termo) || '%'
        or p.tags_publicas ilike '%' || trim(p_termo) || '%'
      )
  )
  select
    base.talento_key,
    base.nome_mascarado,
    base.primeiro_nome,
    base.cargo,
    base.idade_anos,
    base.faixa_idade,
    base.cidade,
    base.estado_uf,
    base.bairro,
    base.regiao_macro,
    base.micro_regiao,
    base.tem_whatsapp,
    base.tem_email,
    base.tem_geo,
    base.estacao_mais_proxima,
    base.linha_metro_mais_proxima,
    base.cor_linha_metro,
    base.distancia_metro_km,
    base.tags_publicas,
    count(*) over() as total_count
  from base
  order by base.cidade nulls last, base.bairro nulls last, base.cargo nulls last, base.primeiro_nome nulls last
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

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
  v_consumidos integer;
  v_inserted uuid;
begin
  select u.* into v_user
  from public.nt_usuarios_conta u
  join public.nt_contas c on c.conta_id = u.conta_id and c.produto_codigo = u.produto_codigo
  where u.auth_user_id = auth.uid()
    and u.status = 'ATIVO'
    and c.status = 'ATIVA'
    and u.produto_codigo = 'NOVOS_TALENTOS'
  limit 1;

  if v_user.usuario_id is null then
    raise exception 'Acesso não autorizado para a Plataforma Novos Talentos.' using errcode = '42501';
  end if;

  select * into v_conta
  from public.nt_contas c
  where c.conta_id = v_user.conta_id
    and c.produto_codigo = v_user.produto_codigo
    and c.status = 'ATIVA'
  for update;

  if v_conta.conta_id is null then
    raise exception 'Conta não encontrada ou inativa.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.nt_talentos t
    where t.talento_key = p_talento_key
      and t.produto_codigo = v_user.produto_codigo
      and coalesce(t.status_registro, 'ATIVO') = 'ATIVO'
  ) then
    raise exception 'Talento não encontrado ou indisponível.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.nt_talento_consumos lc
    where lc.conta_id = v_user.conta_id
      and lc.produto_codigo = v_user.produto_codigo
      and lc.talento_key = p_talento_key
  ) then
    v_inserted := null;
  else
    select count(*)::integer into v_consumidos
    from public.nt_talento_consumos lc
    where lc.conta_id = v_user.conta_id
      and lc.produto_codigo = v_user.produto_codigo;

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
      origem
    ) values (
      v_user.conta_id,
      v_user.produto_codigo,
      p_talento_key,
      v_user.usuario_id,
      auth.uid(),
      v_user.nome,
      'PLATAFORMA_NOVOS_TALENTOS'
    )
    on conflict (conta_id, talento_key) do nothing
    returning consumo_id into v_inserted;
  end if;

  select count(*)::integer into v_consumidos
  from public.nt_talento_consumos lc
  where lc.conta_id = v_user.conta_id
    and lc.produto_codigo = v_user.produto_codigo;

  return query
  select
    t.talento_key,
    t.nome_completo,
    t.primeiro_nome,
    t.email,
    t.whatsapp,
    t.telefone_principal,
    t.cargo,
    t.pretensao_salarial,
    t.sexo,
    t.idade_anos,
    t.faixa_idade,
    t.cidade,
    t.estado_uf,
    t.bairro,
    t.cep,
    t.regiao_macro,
    t.micro_regiao,
    t.bairro_macro,
    t.estacao_mais_proxima,
    t.linha_metro_mais_proxima,
    t.cor_linha_metro,
    t.distancia_metro_km,
    t.curriculo_url,
    (v_inserted is not null) as consumido_agora,
    greatest(coalesce(v_conta.limite_total, 0) - v_consumidos, 0) as saldo_restante
  from public.nt_talentos t
  where t.talento_key = p_talento_key;
end;
$$;

create or replace function public.nt_listar_frases_plano()
returns table (
  frase_id text,
  prioridade integer,
  titulo text,
  texto text,
  status text
)
language sql
security definer
set search_path = public
as $$
  select f.frase_id, f.prioridade, f.titulo, f.texto, f.status
  from public.nt_frases_abordagem f
  join public.nt_usuarios_conta u on u.auth_user_id = auth.uid() and u.produto_codigo = f.produto_codigo
  join public.nt_contas c on c.conta_id = u.conta_id and c.produto_codigo = u.produto_codigo and c.plano_tipo = f.plano_tipo
  where u.status = 'ATIVO'
    and c.status = 'ATIVA'
    and f.status = 'ATIVA'
    and f.produto_codigo = 'NOVOS_TALENTOS'
  order by f.prioridade nulls last, f.frase_id;
$$;

grant execute on function public.nt_app_context() to authenticated;
grant execute on function public.nt_listar_talentos(text, text, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.nt_consumir_talento(text) to authenticated;
grant execute on function public.nt_listar_frases_plano() to authenticated;

-- Conferência estrutural:
select
  proname as funcao,
  pg_get_function_result(p.oid) as retorno
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('nt_app_context', 'nt_listar_talentos', 'nt_consumir_talento', 'nt_listar_frases_plano')
order by proname;
