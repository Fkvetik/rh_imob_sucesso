-- RH IMOB • Novos Talentos
-- 16_SQL_NT_V15_ADMIN_MASTER_RELATORIOS_FRASES.sql
--
-- Objetivo:
-- - Adicionar painel master no mesmo padrão operacional da Plataforma Corretores.
-- - Permitir ativar/inativar usuários do plano.
-- - Permitir editar frases de abordagem do plano.
-- - Entregar relatório por operador: hoje, 7 dias, 15 dias, 30 dias e total.
-- - Listar últimas liberações.
--
-- Não apaga dados.
-- Não mexe na Plataforma Corretores.

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

-- Garante estrutura mínima para consumos/relatórios.
alter table public.nt_talento_consumos
add column if not exists consumo_id uuid default gen_random_uuid();

alter table public.nt_talento_consumos
alter column consumo_id set default gen_random_uuid();

alter table public.nt_talento_consumos
add column if not exists created_at timestamptz not null default now();

alter table public.nt_talento_consumos
add column if not exists origem text;

alter table public.nt_talento_consumos
add column if not exists operador_nome text;

create unique index if not exists uq_nt_talento_consumos_conta_talento
on public.nt_talento_consumos (conta_id, talento_key);

create index if not exists idx_nt_talento_consumos_conta_created
on public.nt_talento_consumos (conta_id, produto_codigo, created_at desc);

-- Evolui frases para suportar escopo por conta/plano sem quebrar frases existentes.
alter table public.nt_frases_abordagem
add column if not exists conta_id text;

alter table public.nt_frases_abordagem
add column if not exists escopo text default 'GLOBAL';

alter table public.nt_frases_abordagem
add column if not exists is_default boolean default false;

alter table public.nt_frases_abordagem
add column if not exists is_favorite boolean default false;

alter table public.nt_frases_abordagem
add column if not exists updated_at timestamptz default now();

update public.nt_frases_abordagem
set escopo = coalesce(nullif(escopo, ''), case when conta_id is null then 'GLOBAL' else 'CONTA' end),
    updated_at = coalesce(updated_at, now())
where produto_codigo = 'NOVOS_TALENTOS';

create index if not exists idx_nt_frases_prod_conta_status
on public.nt_frases_abordagem (produto_codigo, conta_id, status, prioridade);

-- Helper: usuário atual.
create or replace function public.nt_current_user_v15()
returns table (
  usuario_id uuid,
  usuario_seed_id text,
  conta_id text,
  produto_codigo text,
  auth_user_id uuid,
  nome text,
  email_login text,
  perfil text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.usuario_id,
    u.usuario_seed_id,
    u.conta_id,
    u.produto_codigo,
    u.auth_user_id,
    u.nome,
    u.email_login,
    u.perfil,
    u.status
  from public.nt_usuarios_conta u
  where (
      u.auth_user_id = auth.uid()
      or lower(coalesce(u.email_login, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and u.produto_codigo = 'NOVOS_TALENTOS'
    and u.status = 'ATIVO'
  order by case when u.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

-- Helper: master atual com autoajuste do UID.
create or replace function public.nt_require_master_v15()
returns table (
  usuario_id uuid,
  usuario_seed_id text,
  conta_id text,
  produto_codigo text,
  auth_user_id uuid,
  nome text,
  email_login text,
  perfil text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.nt_usuarios_conta%rowtype;
  v_email text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if auth.uid() is null then
    raise exception 'Login obrigatório.' using errcode = '42501';
  end if;

  select u.* into v_user
  from public.nt_usuarios_conta u
  join public.nt_contas c
    on c.conta_id = u.conta_id
   and c.produto_codigo = u.produto_codigo
  where (
      u.auth_user_id = auth.uid()
      or lower(coalesce(u.email_login, '')) = v_email
    )
    and u.produto_codigo = 'NOVOS_TALENTOS'
    and u.status = 'ATIVO'
    and c.status = 'ATIVA'
  order by case when u.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;

  if v_user.usuario_id is null then
    raise exception 'Usuário sem acesso ao plano.' using errcode = '42501';
  end if;

  if upper(coalesce(v_user.perfil, '')) not in ('MASTER','ADMIN','SUPER','SUPER_ADMIN') then
    raise exception 'Acesso restrito ao master do plano.' using errcode = '42501';
  end if;

  if v_user.auth_user_id is distinct from auth.uid() then
    update public.nt_usuarios_conta
    set auth_user_id = auth.uid(), updated_at = now()
    where usuario_id = v_user.usuario_id;
  end if;

  return query
  select
    v_user.usuario_id,
    v_user.usuario_seed_id,
    v_user.conta_id,
    v_user.produto_codigo,
    auth.uid(),
    v_user.nome,
    v_user.email_login,
    v_user.perfil,
    v_user.status;
end;
$$;

-- Frases ativas para o seletor do detalhe:
-- prioriza frases da conta; se não existir, usa GLOBAL/EMPRESARIAL.
create or replace function public.nt_frases_ativas_json_v15()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_conta_id text;
  v_total_conta int := 0;
  v_result jsonb;
begin
  select * into v_user
  from public.nt_current_user_v15()
  limit 1;

  v_conta_id := v_user.conta_id;

  if v_conta_id is not null then
    select count(*)::int into v_total_conta
    from public.nt_frases_abordagem f
    where f.produto_codigo = 'NOVOS_TALENTOS'
      and f.status = 'ATIVA'
      and f.conta_id = v_conta_id;
  end if;

  if v_total_conta > 0 then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.prioridade, x.titulo), '[]'::jsonb)
    into v_result
    from (
      select
        f.frase_id,
        f.titulo,
        f.texto,
        f.prioridade,
        f.status,
        coalesce(f.escopo, 'CONTA') as escopo,
        f.conta_id,
        f.is_favorite
      from public.nt_frases_abordagem f
      where f.produto_codigo = 'NOVOS_TALENTOS'
        and f.status = 'ATIVA'
        and f.conta_id = v_conta_id
      order by f.prioridade, f.titulo
    ) x;

    return v_result;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.prioridade, x.titulo), '[]'::jsonb)
  into v_result
  from (
    select
      f.frase_id,
      f.titulo,
      f.texto,
      f.prioridade,
      f.status,
      coalesce(f.escopo, 'GLOBAL') as escopo,
      f.conta_id,
      f.is_favorite
    from public.nt_frases_abordagem f
    where f.produto_codigo = 'NOVOS_TALENTOS'
      and f.status = 'ATIVA'
      and (f.conta_id is null or f.escopo = 'GLOBAL' or f.plano_tipo = 'EMPRESARIAL')
    order by f.prioridade, f.titulo
    limit 20
  ) x;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

create or replace function public.nt_admin_painel_json_v15()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_master record;
  v_conta public.nt_contas%rowtype;
  v_consumidos int := 0;
  v_consumidos_15 int := 0;
  v_consumidos_30 int := 0;
  v_ativos int := 0;
  v_operadores jsonb := '[]'::jsonb;
  v_ultimos jsonb := '[]'::jsonb;
begin
  select * into v_master
  from public.nt_require_master_v15()
  limit 1;

  select * into v_conta
  from public.nt_contas c
  where c.conta_id = v_master.conta_id
    and c.produto_codigo = 'NOVOS_TALENTOS'
  limit 1;

  select count(*)::int into v_consumidos
  from public.nt_talento_consumos c
  where c.conta_id = v_master.conta_id
    and c.produto_codigo = 'NOVOS_TALENTOS';

  select count(*)::int into v_consumidos_15
  from public.nt_talento_consumos c
  where c.conta_id = v_master.conta_id
    and c.produto_codigo = 'NOVOS_TALENTOS'
    and c.created_at >= now() - interval '15 days';

  select count(*)::int into v_consumidos_30
  from public.nt_talento_consumos c
  where c.conta_id = v_master.conta_id
    and c.produto_codigo = 'NOVOS_TALENTOS'
    and c.created_at >= now() - interval '30 days';

  select count(*)::int into v_ativos
  from public.nt_usuarios_conta u
  where u.conta_id = v_master.conta_id
    and u.produto_codigo = 'NOVOS_TALENTOS'
    and u.status = 'ATIVO';

  select coalesce(jsonb_agg(to_jsonb(x) order by x.nome), '[]'::jsonb)
  into v_operadores
  from (
    select
      u.usuario_id,
      u.usuario_seed_id,
      u.nome,
      u.email_login,
      u.perfil,
      u.status,
      coalesce(count(c.consumo_id) filter (where date(c.created_at at time zone 'America/Sao_Paulo') = date(now() at time zone 'America/Sao_Paulo')), 0)::int as consumidos_hoje,
      coalesce(count(c.consumo_id) filter (where c.created_at >= now() - interval '7 days'), 0)::int as consumidos_7_dias,
      coalesce(count(c.consumo_id) filter (where c.created_at >= now() - interval '15 days'), 0)::int as consumidos_15_dias,
      coalesce(count(c.consumo_id) filter (where c.created_at >= now() - interval '30 days'), 0)::int as consumidos_30_dias,
      coalesce(count(c.consumo_id), 0)::int as consumidos_total
    from public.nt_usuarios_conta u
    left join public.nt_talento_consumos c
      on c.usuario_id = u.usuario_id
     and c.conta_id = u.conta_id
     and c.produto_codigo = u.produto_codigo
    where u.conta_id = v_master.conta_id
      and u.produto_codigo = 'NOVOS_TALENTOS'
    group by u.usuario_id, u.usuario_seed_id, u.nome, u.email_login, u.perfil, u.status
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into v_ultimos
  from (
    select
      c.consumo_id,
      c.created_at,
      c.operador_nome,
      u.email_login as usuario_email,
      c.talento_key,
      p.nome_mascarado,
      p.primeiro_nome,
      p.cidade,
      p.estado_uf,
      p.cargo
    from public.nt_talento_consumos c
    left join public.nt_usuarios_conta u on u.usuario_id = c.usuario_id
    left join public.nt_talentos_publicos p on p.talento_key = c.talento_key
    where c.conta_id = v_master.conta_id
      and c.produto_codigo = 'NOVOS_TALENTOS'
    order by c.created_at desc
    limit 30
  ) x;

  return jsonb_build_object(
    'conta', jsonb_build_object(
      'conta_id', v_conta.conta_id,
      'nome_conta', v_conta.nome_conta,
      'plano_tipo', v_conta.plano_tipo,
      'status', v_conta.status,
      'limite_total', coalesce(v_conta.limite_total, 0),
      'usuarios_contratados', coalesce(v_conta.usuarios_contratados, 0),
      'usuarios_ativos', coalesce(v_ativos, 0),
      'usuarios_disponiveis', greatest(coalesce(v_conta.usuarios_contratados, 0) - coalesce(v_ativos, 0), 0),
      'consumidos', coalesce(v_consumidos, 0),
      'saldo', greatest(coalesce(v_conta.limite_total, 0) - coalesce(v_consumidos, 0), 0),
      'consumidos_15_dias', coalesce(v_consumidos_15, 0),
      'consumidos_30_dias', coalesce(v_consumidos_30, 0)
    ),
    'operadores', v_operadores,
    'ultimos', v_ultimos
  );
end;
$$;

create or replace function public.nt_admin_alterar_status_usuario_v15(
  p_usuario_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_master record;
  v_status text;
  v_target public.nt_usuarios_conta%rowtype;
begin
  select * into v_master
  from public.nt_require_master_v15()
  limit 1;

  v_status := upper(coalesce(p_status, ''));
  if v_status not in ('ATIVO','INATIVO') then
    raise exception 'Status inválido.';
  end if;

  select * into v_target
  from public.nt_usuarios_conta u
  where u.usuario_id = p_usuario_id
    and u.conta_id = v_master.conta_id
    and u.produto_codigo = 'NOVOS_TALENTOS'
  limit 1;

  if v_target.usuario_id is null then
    raise exception 'Usuário não encontrado neste plano.';
  end if;

  if v_target.auth_user_id = auth.uid() and v_status <> 'ATIVO' then
    raise exception 'Você não pode inativar o próprio acesso master.';
  end if;

  update public.nt_usuarios_conta
  set status = v_status,
      updated_at = now()
  where usuario_id = p_usuario_id
    and conta_id = v_master.conta_id
    and produto_codigo = 'NOVOS_TALENTOS';

  return jsonb_build_object('ok', true, 'usuario_id', p_usuario_id, 'status', v_status);
end;
$$;

create or replace function public.nt_admin_listar_frases_json_v15()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_master record;
  v_result jsonb;
begin
  select * into v_master
  from public.nt_require_master_v15()
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.prioridade, x.titulo), '[]'::jsonb)
  into v_result
  from (
    select
      f.frase_id,
      f.titulo,
      f.texto,
      f.prioridade,
      f.status,
      coalesce(f.escopo, case when f.conta_id is null then 'GLOBAL' else 'CONTA' end) as escopo,
      f.conta_id,
      coalesce(f.is_default, false) as is_default,
      coalesce(f.is_favorite, false) as is_favorite
    from public.nt_frases_abordagem f
    where f.produto_codigo = 'NOVOS_TALENTOS'
      and (
        f.conta_id = v_master.conta_id
        or f.conta_id is null
        or f.escopo = 'GLOBAL'
        or f.plano_tipo = 'EMPRESARIAL'
      )
    order by f.prioridade, f.titulo
    limit 100
  ) x;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

create or replace function public.nt_admin_salvar_frase_v15(
  p_frase_id text,
  p_texto text,
  p_status text default 'ATIVA',
  p_prioridade integer default 1,
  p_is_favorite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_master record;
  v_existing public.nt_frases_abordagem%rowtype;
  v_id text;
  v_status text;
begin
  select * into v_master
  from public.nt_require_master_v15()
  limit 1;

  if nullif(trim(coalesce(p_texto, '')), '') is null or length(trim(p_texto)) < 10 then
    raise exception 'Texto da frase muito curto.';
  end if;

  v_status := upper(coalesce(p_status, 'ATIVA'));
  if v_status not in ('ATIVA','INATIVA') then
    v_status := 'ATIVA';
  end if;

  if nullif(trim(coalesce(p_frase_id, '')), '') is not null then
    select * into v_existing
    from public.nt_frases_abordagem f
    where f.frase_id = p_frase_id
      and f.produto_codigo = 'NOVOS_TALENTOS'
    limit 1;
  end if;

  -- Se editar frase global, cria uma cópia da conta.
  if v_existing.frase_id is not null and v_existing.conta_id is distinct from v_master.conta_id then
    v_id := 'FRASE_NT_' || replace(gen_random_uuid()::text, '-', '');
  else
    v_id := coalesce(nullif(trim(coalesce(p_frase_id, '')), ''), 'FRASE_NT_' || replace(gen_random_uuid()::text, '-', ''));
  end if;

  insert into public.nt_frases_abordagem (
    frase_id,
    produto_codigo,
    plano_tipo,
    conta_id,
    escopo,
    titulo,
    texto,
    prioridade,
    status,
    is_default,
    is_favorite,
    updated_at
  )
  values (
    v_id,
    'NOVOS_TALENTOS',
    'EMPRESARIAL',
    v_master.conta_id,
    'CONTA',
    'Frase do plano',
    trim(p_texto),
    coalesce(p_prioridade, 1),
    v_status,
    false,
    coalesce(p_is_favorite, false),
    now()
  )
  on conflict (frase_id) do update
  set texto = excluded.texto,
      prioridade = excluded.prioridade,
      status = excluded.status,
      is_favorite = excluded.is_favorite,
      conta_id = excluded.conta_id,
      escopo = 'CONTA',
      updated_at = now();

  return jsonb_build_object('ok', true, 'frase_id', v_id);
end;
$$;

create or replace function public.nt_admin_alterar_status_frase_v15(
  p_frase_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_master record;
  v_status text;
  v_existing public.nt_frases_abordagem%rowtype;
  v_id text;
begin
  select * into v_master
  from public.nt_require_master_v15()
  limit 1;

  v_status := upper(coalesce(p_status, ''));
  if v_status not in ('ATIVA','INATIVA') then
    raise exception 'Status inválido.';
  end if;

  select * into v_existing
  from public.nt_frases_abordagem f
  where f.frase_id = p_frase_id
    and f.produto_codigo = 'NOVOS_TALENTOS'
  limit 1;

  if v_existing.frase_id is null then
    raise exception 'Frase não encontrada.';
  end if;

  if v_existing.conta_id is null or v_existing.conta_id is distinct from v_master.conta_id then
    v_id := 'FRASE_NT_' || replace(gen_random_uuid()::text, '-', '');

    insert into public.nt_frases_abordagem (
      frase_id,
      produto_codigo,
      plano_tipo,
      conta_id,
      escopo,
      titulo,
      texto,
      prioridade,
      status,
      is_default,
      is_favorite,
      updated_at
    )
    values (
      v_id,
      'NOVOS_TALENTOS',
      'EMPRESARIAL',
      v_master.conta_id,
      'CONTA',
      coalesce(v_existing.titulo, 'Frase do plano'),
      v_existing.texto,
      coalesce(v_existing.prioridade, 1),
      v_status,
      false,
      coalesce(v_existing.is_favorite, false),
      now()
    );
  else
    update public.nt_frases_abordagem
    set status = v_status,
        updated_at = now()
    where frase_id = p_frase_id
      and conta_id = v_master.conta_id
      and produto_codigo = 'NOVOS_TALENTOS';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.nt_current_user_v15() to authenticated;
grant execute on function public.nt_require_master_v15() to authenticated;
grant execute on function public.nt_frases_ativas_json_v15() to authenticated;
grant execute on function public.nt_admin_painel_json_v15() to authenticated;
grant execute on function public.nt_admin_alterar_status_usuario_v15(uuid, text) to authenticated;
grant execute on function public.nt_admin_listar_frases_json_v15() to authenticated;
grant execute on function public.nt_admin_salvar_frase_v15(text, text, text, integer, boolean) to authenticated;
grant execute on function public.nt_admin_alterar_status_frase_v15(text, text) to authenticated;

notify pgrst, 'reload schema';

-- Diagnóstico das funções criadas.
select
  proname,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as retorno
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname like 'nt_admin_%_v15'
order by proname;
