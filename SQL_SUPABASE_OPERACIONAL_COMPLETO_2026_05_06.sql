-- =========================================================
-- RH IMOB | Plataforma Corretores - SQL operacional completo
-- Aplicar no Supabase SQL Editor antes de testar o novo ZIP.
-- Corrige abrir_lead, busca logada, trava de consumo, painel do plano,
-- operadores e mensagens de abordagem por plano.
-- =========================================================

-- 1) Índices/travas essenciais
create unique index if not exists lead_consumos_conta_lead_key_uidx
on public.lead_consumos (conta_id, lead_key);

create index if not exists lead_consumos_conta_user_idx
on public.lead_consumos (conta_id, user_id, data_consumo desc);

create index if not exists frases_abordagem_conta_status_idx
on public.frases_abordagem (conta_id, status, prioridade);

-- 2) Contexto do usuário logado
create or replace function public.current_usuario_conta()
returns public.usuarios_conta
language sql
stable
security definer
set search_path = public, auth
as $$
  select uc.*
  from public.usuarios_conta uc
  where uc.auth_user_id = auth.uid()
    and uc.status = 'ATIVO'
  limit 1
$$;

create or replace function public.current_conta_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select uc.conta_id
  from public.usuarios_conta uc
  where uc.auth_user_id = auth.uid()
    and uc.status = 'ATIVO'
  limit 1
$$;

create or replace function public.current_perfil_usuario()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select uc.perfil
  from public.usuarios_conta uc
  where uc.auth_user_id = auth.uid()
    and uc.status = 'ATIVO'
  limit 1
$$;

create or replace function public.rhi_is_admin_plano()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.usuarios_conta uc
    where uc.auth_user_id = auth.uid()
      and uc.status = 'ATIVO'
      and upper(coalesce(uc.perfil, 'OPERADOR')) in ('ADMIN', 'MASTER')
  )
$$;

-- 3) Busca logada: usa coluna cargo normalizada e oculta consumidos do plano
create or replace function public.search_leads_plano(
  p_cidade text default null,
  p_ano_inscricao text default null,
  p_cargo text default null,
  p_termo text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  lead_key text,
  cidade text,
  nome_mascarado text,
  creci_mascarado text,
  ano_inscricao text,
  cargo text,
  cargo_raw text,
  tem_canal_telefone boolean,
  tem_canal_instagram boolean,
  tags_publicas text,
  ativo boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_conta_id uuid;
begin
  v_conta_id := public.current_conta_id();

  if v_conta_id is null then
    raise exception 'USUARIO_SEM_CONTA_ATIVA';
  end if;

  return query
  select
    lp.lead_key,
    lp.cidade,
    lp.nome_mascarado,
    lp.creci_mascarado,
    lp.ano_inscricao,
    lp.cargo,
    lp.cargo_raw,
    lp.tem_canal_telefone,
    lp.tem_canal_instagram,
    lp.tags_publicas,
    lp.ativo,
    lp.updated_at
  from public.leads_publicos lp
  where lp.ativo = true
    and (p_cidade is null or p_cidade = '' or lp.cidade = p_cidade)
    and (p_ano_inscricao is null or p_ano_inscricao = '' or lp.ano_inscricao = p_ano_inscricao)
    and (p_cargo is null or p_cargo = '' or lp.cargo = p_cargo)
    and (
      p_termo is null
      or p_termo = ''
      or lp.tags_publicas ilike '%' || p_termo || '%'
      or lp.cidade ilike '%' || p_termo || '%'
      or lp.cargo ilike '%' || p_termo || '%'
    )
    and not exists (
      select 1
      from public.lead_consumos lc
      where lc.conta_id = v_conta_id
        and lc.lead_key = lp.lead_key
        and lc.status = 'LIBERADO'
    )
  order by lp.updated_at desc nulls last, lp.lead_key
  limit greatest(1, least(coalesce(p_limit, 12), 50))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- 4) Abrir lead com trava real de limite contratado
create or replace function public.abrir_lead(
  p_lead_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_usuario public.usuarios_conta%rowtype;
  v_conta public.contas%rowtype;
  v_lead public.leads%rowtype;
  v_consumo_id uuid;
  v_ja_consumido boolean;
  v_consumidos integer;
  v_limite integer;
  v_restantes integer;
  v_aviso text;
begin
  select *
  into v_usuario
  from public.usuarios_conta uc
  where uc.auth_user_id = auth.uid()
    and uc.status = 'ATIVO'
  limit 1;

  if v_usuario.id is null then
    raise exception 'USUARIO_SEM_CONTA_ATIVA';
  end if;

  select *
  into v_conta
  from public.contas c
  where c.id = v_usuario.conta_id
    and c.status = 'ATIVA'
  limit 1;

  if v_conta.id is null then
    raise exception 'CONTA_INATIVA_OU_NAO_ENCONTRADA';
  end if;

  select *
  into v_lead
  from public.leads l
  where l.lead_key = p_lead_key
    and l.ativo = true
  limit 1;

  if v_lead.lead_key is null then
    raise exception 'LEAD_NAO_ENCONTRADO';
  end if;

  select exists (
    select 1
    from public.lead_consumos lc
    where lc.conta_id = v_usuario.conta_id
      and lc.lead_key = p_lead_key
      and lc.status = 'LIBERADO'
  )
  into v_ja_consumido;

  select count(*)::integer
  into v_consumidos
  from public.lead_consumos lc
  where lc.conta_id = v_usuario.conta_id
    and lc.status = 'LIBERADO';

  v_limite := coalesce(v_conta.limite_leads, 0);

  if v_limite <= 0 then
    raise exception 'PLANO_SEM_LIMITE_CONFIGURADO';
  end if;

  if v_ja_consumido = false and v_consumidos >= v_limite then
    raise exception 'LIMITE_DE_ACESSOS_DO_PLANO_ESGOTADO';
  end if;

  insert into public.lead_consumos (
    conta_id,
    lead_key,
    user_id,
    auth_user_id,
    usuario_email,
    data_consumo,
    status,
    origem
  )
  values (
    v_usuario.conta_id,
    v_lead.lead_key,
    v_usuario.id,
    auth.uid(),
    v_usuario.email,
    now(),
    'LIBERADO',
    'web'
  )
  on conflict (conta_id, lead_key)
  do update set
    updated_at = now()
  returning id into v_consumo_id;

  select count(*)::integer
  into v_consumidos
  from public.lead_consumos lc
  where lc.conta_id = v_usuario.conta_id
    and lc.status = 'LIBERADO';

  v_restantes := greatest(v_limite - v_consumidos, 0);

  v_aviso := null;
  if v_restantes = 0 then
    v_aviso := 'Seu plano atingiu o limite de acessos. Renove ou faça upgrade para continuar liberando contatos.';
  elsif v_restantes <= 10 then
    v_aviso := 'Seu plano está quase no fim. Restam apenas ' || v_restantes || ' acessos.';
  elsif v_restantes <= 30 then
    v_aviso := 'Atenção: restam ' || v_restantes || ' acessos no seu plano.';
  elsif v_restantes <= 50 then
    v_aviso := 'Seu consumo está avançado. Restam ' || v_restantes || ' acessos disponíveis.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'consumo_id', v_consumo_id,
    'ja_consumido_antes', v_ja_consumido,
    'plano', jsonb_build_object(
      'conta_id', v_conta.id,
      'nome_empresa', v_conta.nome_empresa,
      'limite_leads', v_limite,
      'leads_consumidos', v_consumidos,
      'leads_restantes', v_restantes,
      'aviso', v_aviso
    ),
    'usuario', jsonb_build_object(
      'id', v_usuario.id,
      'nome', v_usuario.nome,
      'email', v_usuario.email,
      'perfil', v_usuario.perfil,
      'conta_id', v_usuario.conta_id
    ),
    'lead', jsonb_build_object(
      'lead_key', v_lead.lead_key,
      'cidade', v_lead.cidade,
      'nome_completo', v_lead.nome_completo,
      'nome_mascarado', v_lead.nome_mascarado,
      'creci', v_lead.creci,
      'creci_mascarado', v_lead.creci_mascarado,
      'data_inscricao', v_lead.data_inscricao,
      'ano_inscricao', v_lead.ano_inscricao,
      'situacao', v_lead.situacao,
      'telefone_base', v_lead.telefone_base,
      'telefone_wa', v_lead.telefone_wa,
      'telefone_txt', v_lead.telefone_txt,
      'instagram_url', v_lead.instagram_url,
      'instagram_username', v_lead.instagram_username,
      'nome_perfil', v_lead.nome_perfil,
      'bio', v_lead.bio,
      'cargo', v_lead.cargo,
      'cargo_raw', v_lead.cargo_raw,
      'tem_canal_telefone', v_lead.tem_canal_telefone,
      'tem_canal_instagram', v_lead.tem_canal_instagram
    )
  );
end;
$$;

-- 5) Painel do plano
create or replace function public.rhi_painel_plano()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_usuario public.usuarios_conta%rowtype;
  v_conta public.contas%rowtype;
  v_perfil text;
  v_usuarios_ativos integer;
  v_usuarios_disponiveis integer;
  v_consumidos_total integer;
  v_saldo integer;
  v_aviso_consumo text;
  v_aviso_usuarios text;
  v_consumo_operadores jsonb;
  v_operadores jsonb;
  v_ultimos jsonb;
begin
  select *
  into v_usuario
  from public.usuarios_conta uc
  where uc.auth_user_id = auth.uid()
    and uc.status = 'ATIVO'
  limit 1;

  if v_usuario.id is null then
    raise exception 'USUARIO_SEM_CONTA_ATIVA';
  end if;

  v_perfil := upper(coalesce(v_usuario.perfil, 'OPERADOR'));

  if v_perfil not in ('ADMIN', 'MASTER') then
    raise exception 'ACESSO_NEGADO_ADMIN';
  end if;

  select *
  into v_conta
  from public.contas c
  where c.id = v_usuario.conta_id
  limit 1;

  if v_conta.id is null then
    raise exception 'CONTA_NAO_ENCONTRADA';
  end if;

  select count(*)::integer
  into v_usuarios_ativos
  from public.usuarios_conta uc
  where uc.conta_id = v_conta.id
    and uc.status = 'ATIVO';

  v_usuarios_disponiveis := greatest(coalesce(v_conta.usuarios_contratados, 0) - v_usuarios_ativos, 0);

  if v_usuarios_disponiveis = 0 then
    v_aviso_usuarios := 'Todos os usuários contratados já estão em uso. Para acelerar a operação, solicite upgrade do plano.';
  elsif v_usuarios_disponiveis = 1 then
    v_aviso_usuarios := 'Ainda existe 1 usuário disponível neste plano.';
  else
    v_aviso_usuarios := 'Existem ' || v_usuarios_disponiveis || ' usuários disponíveis neste plano.';
  end if;

  select count(*)::integer
  into v_consumidos_total
  from public.lead_consumos lc
  where lc.conta_id = v_conta.id
    and lc.status = 'LIBERADO';

  v_saldo := greatest(coalesce(v_conta.limite_leads, 0) - coalesce(v_consumidos_total, 0), 0);

  v_aviso_consumo := null;
  if v_saldo = 0 then
    v_aviso_consumo := 'Seu plano atingiu o limite de acessos. Renove ou faça upgrade para continuar liberando contatos.';
  elsif v_saldo <= 10 then
    v_aviso_consumo := 'Seu plano está quase no fim. Restam apenas ' || v_saldo || ' acessos.';
  elsif v_saldo <= 30 then
    v_aviso_consumo := 'Atenção: restam ' || v_saldo || ' acessos no seu plano.';
  elsif v_saldo <= 50 then
    v_aviso_consumo := 'Seu consumo está avançado. Restam ' || v_saldo || ' acessos disponíveis.';
  end if;

  select coalesce(jsonb_agg(x order by x->>'nome'), '[]'::jsonb)
  into v_operadores
  from (
    select jsonb_build_object(
      'usuario_id', uc.id,
      'auth_user_id', uc.auth_user_id,
      'nome', uc.nome,
      'email', uc.email,
      'telefone', uc.telefone,
      'perfil', uc.perfil,
      'status', uc.status,
      'consumidos_total', count(lc.id),
      'created_at', uc.created_at,
      'updated_at', uc.updated_at
    ) as x
    from public.usuarios_conta uc
    left join public.lead_consumos lc
      on lc.user_id = uc.id
      and lc.conta_id = uc.conta_id
      and lc.status = 'LIBERADO'
    where uc.conta_id = v_conta.id
    group by uc.id, uc.auth_user_id, uc.nome, uc.email, uc.telefone, uc.perfil, uc.status, uc.created_at, uc.updated_at
  ) op;

  select coalesce(jsonb_agg(x order by x->>'nome'), '[]'::jsonb)
  into v_consumo_operadores
  from (
    select jsonb_build_object(
      'usuario_id', uc.id,
      'nome', uc.nome,
      'email', uc.email,
      'perfil', uc.perfil,
      'status', uc.status,
      'consumidos_hoje', count(lc.id) filter (where lc.data_consumo::date = current_date),
      'consumidos_7_dias', count(lc.id) filter (where lc.data_consumo >= now() - interval '7 days'),
      'consumidos_total', count(lc.id)
    ) as x
    from public.usuarios_conta uc
    left join public.lead_consumos lc
      on lc.user_id = uc.id
      and lc.conta_id = uc.conta_id
      and lc.status = 'LIBERADO'
    where uc.conta_id = v_conta.id
    group by uc.id, uc.nome, uc.email, uc.perfil, uc.status
  ) s;

  select coalesce(jsonb_agg(x order by x->>'data_consumo' desc), '[]'::jsonb)
  into v_ultimos
  from (
    select jsonb_build_object(
      'data_consumo', lc.data_consumo,
      'operador', coalesce(uc.nome, lc.usuario_email),
      'usuario_email', lc.usuario_email,
      'lead_key', lc.lead_key,
      'nome_mascarado', lp.nome_mascarado,
      'cidade', lp.cidade,
      'ano_inscricao', lp.ano_inscricao,
      'cargo', lp.cargo
    ) as x
    from public.lead_consumos lc
    left join public.usuarios_conta uc on uc.id = lc.user_id
    left join public.leads_publicos lp on lp.lead_key = lc.lead_key
    where lc.conta_id = v_conta.id
      and lc.status = 'LIBERADO'
    order by lc.data_consumo desc
    limit 50
  ) u;

  return jsonb_build_object(
    'ok', true,
    'conta', jsonb_build_object(
      'id', v_conta.id,
      'nome_empresa', v_conta.nome_empresa,
      'telefone', v_conta.telefone,
      'status', v_conta.status,
      'usuarios_contratados', v_conta.usuarios_contratados,
      'usuarios_ativos', v_usuarios_ativos,
      'usuarios_disponiveis', v_usuarios_disponiveis,
      'limite_leads', v_conta.limite_leads,
      'leads_consumidos', v_consumidos_total,
      'leads_disponiveis', v_saldo,
      'data_inicio', v_conta.data_inicio,
      'data_fim', v_conta.data_fim,
      'aviso_consumo', v_aviso_consumo,
      'aviso_usuarios', v_aviso_usuarios
    ),
    'usuario_logado', jsonb_build_object(
      'id', v_usuario.id,
      'nome', v_usuario.nome,
      'email', v_usuario.email,
      'perfil', v_usuario.perfil
    ),
    'operadores', v_operadores,
    'consumo_operadores', v_consumo_operadores,
    'ultimos_contatos', v_ultimos
  );
end;
$$;

-- 6) Gestão simples de operadores: listar / inativar / reativar
create or replace function public.rhi_admin_listar_operadores()
returns table (
  usuario_id uuid,
  auth_user_id uuid,
  nome text,
  email text,
  telefone text,
  perfil text,
  status text,
  consumidos_hoje bigint,
  consumidos_total bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin public.usuarios_conta%rowtype;
begin
  select *
  into v_admin
  from public.usuarios_conta uc
  where uc.auth_user_id = auth.uid()
    and uc.status = 'ATIVO'
  limit 1;

  if v_admin.id is null then
    raise exception 'USUARIO_SEM_CONTA_ATIVA';
  end if;

  if upper(coalesce(v_admin.perfil, 'OPERADOR')) not in ('ADMIN', 'MASTER') then
    raise exception 'ACESSO_NEGADO_ADMIN';
  end if;

  return query
  select
    uc.id as usuario_id,
    uc.auth_user_id,
    uc.nome,
    uc.email,
    uc.telefone,
    uc.perfil,
    uc.status,
    count(lc.id) filter (where lc.data_consumo::date = current_date) as consumidos_hoje,
    count(lc.id) as consumidos_total,
    uc.created_at,
    uc.updated_at
  from public.usuarios_conta uc
  left join public.lead_consumos lc
    on lc.user_id = uc.id
    and lc.conta_id = uc.conta_id
    and lc.status = 'LIBERADO'
  where uc.conta_id = v_admin.conta_id
  group by uc.id, uc.auth_user_id, uc.nome, uc.email, uc.telefone, uc.perfil, uc.status, uc.created_at, uc.updated_at
  order by uc.status, uc.nome;
end;
$$;

create or replace function public.rhi_admin_alterar_status_operador(
  p_usuario_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin public.usuarios_conta%rowtype;
  v_status text;
  v_id uuid;
begin
  select *
  into v_admin
  from public.usuarios_conta uc
  where uc.auth_user_id = auth.uid()
    and uc.status = 'ATIVO'
  limit 1;

  if v_admin.id is null then
    raise exception 'USUARIO_SEM_CONTA_ATIVA';
  end if;

  if upper(coalesce(v_admin.perfil, 'OPERADOR')) not in ('ADMIN', 'MASTER') then
    raise exception 'ACESSO_NEGADO_ADMIN';
  end if;

  v_status := upper(trim(coalesce(p_status, '')));

  if v_status not in ('ATIVO', 'INATIVO') then
    raise exception 'STATUS_INVALIDO_USE_ATIVO_OU_INATIVO';
  end if;

  if p_usuario_id = v_admin.id and v_status = 'INATIVO' then
    raise exception 'ADMIN_NAO_PODE_INATIVAR_A_SI_MESMO';
  end if;

  update public.usuarios_conta uc
  set status = v_status, updated_at = now()
  where uc.id = p_usuario_id
    and uc.conta_id = v_admin.conta_id
  returning uc.id into v_id;

  if v_id is null then
    raise exception 'OPERADOR_NAO_ENCONTRADO_NESTE_PLANO';
  end if;

  return jsonb_build_object('ok', true, 'usuario_id', v_id, 'status', v_status);
end;
$$;

-- 7) Mensagens de abordagem por plano
create or replace function public.rhi_clonar_frases_padrao_para_plano()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_conta_id uuid;
  v_total integer;
  v_global_conta_id uuid := '00000000-0000-4000-8000-000000000001';
begin
  if not public.rhi_is_admin_plano() then
    raise exception 'ACESSO_NEGADO_ADMIN';
  end if;

  v_conta_id := public.current_conta_id();
  if v_conta_id is null then
    raise exception 'USUARIO_SEM_CONTA_ATIVA';
  end if;

  insert into public.frases_abordagem (conta_id, texto, status, prioridade, is_default, is_favorite)
  select v_conta_id, f.texto, f.status, f.prioridade, false, f.is_favorite
  from public.frases_abordagem f
  where f.conta_id = v_global_conta_id
    and not exists (
      select 1
      from public.frases_abordagem fx
      where fx.conta_id = v_conta_id
        and lower(trim(fx.texto)) = lower(trim(f.texto))
    );

  get diagnostics v_total = row_count;
  return jsonb_build_object('ok', true, 'clonadas', v_total);
end;
$$;

create or replace function public.rhi_listar_frases_abordagem()
returns table (
  id uuid,
  conta_id uuid,
  texto text,
  status text,
  prioridade integer,
  is_default boolean,
  is_favorite boolean,
  escopo text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_conta_id uuid;
  v_tem_proprias boolean;
  v_global_conta_id uuid := '00000000-0000-4000-8000-000000000001';
begin
  v_conta_id := public.current_conta_id();
  if v_conta_id is null then
    raise exception 'USUARIO_SEM_CONTA_ATIVA';
  end if;

  select exists (select 1 from public.frases_abordagem f where f.conta_id = v_conta_id)
  into v_tem_proprias;

  if v_tem_proprias then
    return query
    select f.id, f.conta_id, f.texto, f.status, f.prioridade, f.is_default, f.is_favorite, 'PLANO'::text, f.created_at, f.updated_at
    from public.frases_abordagem f
    where f.conta_id = v_conta_id
    order by f.prioridade, f.created_at;
  else
    return query
    select f.id, f.conta_id, f.texto, f.status, f.prioridade, f.is_default, f.is_favorite, 'GLOBAL'::text, f.created_at, f.updated_at
    from public.frases_abordagem f
    where f.conta_id = v_global_conta_id
    order by f.prioridade, f.created_at;
  end if;
end;
$$;

create or replace function public.rhi_salvar_frase_abordagem(
  p_id uuid default null,
  p_texto text default null,
  p_status text default 'ATIVA',
  p_prioridade integer default 1,
  p_is_favorite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_conta_id uuid;
  v_id uuid;
begin
  if not public.rhi_is_admin_plano() then
    raise exception 'ACESSO_NEGADO_ADMIN';
  end if;

  v_conta_id := public.current_conta_id();
  if v_conta_id is null then
    raise exception 'USUARIO_SEM_CONTA_ATIVA';
  end if;

  if p_texto is null or length(trim(p_texto)) < 10 then
    raise exception 'TEXTO_DA_FRASE_INVALIDO';
  end if;

  if p_id is null then
    insert into public.frases_abordagem (conta_id, texto, status, prioridade, is_default, is_favorite)
    values (v_conta_id, trim(p_texto), coalesce(nullif(trim(p_status), ''), 'ATIVA'), coalesce(p_prioridade, 1), false, coalesce(p_is_favorite, false))
    returning id into v_id;
  else
    update public.frases_abordagem f
    set texto = trim(p_texto),
        status = coalesce(nullif(trim(p_status), ''), 'ATIVA'),
        prioridade = coalesce(p_prioridade, f.prioridade),
        is_favorite = coalesce(p_is_favorite, f.is_favorite),
        updated_at = now()
    where f.id = p_id
      and f.conta_id = v_conta_id
    returning f.id into v_id;

    if v_id is null then
      raise exception 'FRASE_NAO_ENCONTRADA_NO_PLANO';
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.rhi_alterar_status_frase_abordagem(
  p_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_conta_id uuid;
  v_status text;
  v_id uuid;
begin
  if not public.rhi_is_admin_plano() then
    raise exception 'ACESSO_NEGADO_ADMIN';
  end if;

  v_conta_id := public.current_conta_id();
  v_status := upper(trim(coalesce(p_status, '')));

  if v_status not in ('ATIVA', 'INATIVA') then
    v_status := 'INATIVA';
  end if;

  update public.frases_abordagem f
  set status = v_status, updated_at = now()
  where f.id = p_id
    and f.conta_id = v_conta_id
  returning f.id into v_id;

  if v_id is null then
    raise exception 'FRASE_NAO_ENCONTRADA_NO_PLANO';
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end;
$$;

-- 8) Grants
-- Funções públicas autenticadas
grant execute on function public.current_usuario_conta() to authenticated;
grant execute on function public.current_conta_id() to authenticated;
grant execute on function public.current_perfil_usuario() to authenticated;
grant execute on function public.rhi_is_admin_plano() to authenticated;
grant execute on function public.search_leads_plano(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.abrir_lead(text) to authenticated;
grant execute on function public.rhi_painel_plano() to authenticated;
grant execute on function public.rhi_admin_listar_operadores() to authenticated;
grant execute on function public.rhi_admin_alterar_status_operador(uuid, text) to authenticated;
grant execute on function public.rhi_clonar_frases_padrao_para_plano() to authenticated;
grant execute on function public.rhi_listar_frases_abordagem() to authenticated;
grant execute on function public.rhi_salvar_frase_abordagem(uuid, text, text, integer, boolean) to authenticated;
grant execute on function public.rhi_alterar_status_frase_abordagem(uuid, text) to authenticated;
