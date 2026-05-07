-- RH IMOB • Novos Talentos
-- 14_SQL_NT_V11_DETALHES_JSON_SEM_REGRESSAO.sql
--
-- Objetivo:
-- Corrigir "Ver detalhes" sem mexer nos filtros que já estão funcionando.
-- Esta versão cria funções NOVAS em JSON, sem tentar alterar o retorno das funções antigas.
--
-- Não apaga talentos.
-- Não apaga usuários.
-- Não apaga contas.
-- Não apaga consumos.
-- Não altera a Plataforma Corretores.

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

-- Estrutura segura para consumo/relatório.
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

create index if not exists idx_nt_talento_consumos_created_at
on public.nt_talento_consumos (created_at desc);

create index if not exists idx_nt_talento_consumos_conta_data
on public.nt_talento_consumos (conta_id, produto_codigo, created_at desc);

-- Contexto do login em JSON.
-- Evita problema de RLS/SELECT direto no front e evita conflito de retorno antigo.
create or replace function public.nt_app_context_json_v11()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_user public.nt_usuarios_conta%rowtype;
  v_conta public.nt_contas%rowtype;
  v_consumidos integer := 0;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if auth.uid() is null then
    return null;
  end if;

  select u.* into v_user
  from public.nt_usuarios_conta u
  where (
      u.auth_user_id = auth.uid()
      or lower(coalesce(u.email_login, '')) = v_email
    )
    and u.status = 'ATIVO'
    and u.produto_codigo = 'NOVOS_TALENTOS'
  order by case when u.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;

  if v_user.usuario_id is null then
    return null;
  end if;

  -- Autoajuste do UID real do Auth quando a planilha vinculou pelo e-mail.
  if v_user.auth_user_id is distinct from auth.uid() then
    update public.nt_usuarios_conta
    set auth_user_id = auth.uid(), updated_at = now()
    where usuario_id = v_user.usuario_id;

    v_user.auth_user_id := auth.uid();
  end if;

  select * into v_conta
  from public.nt_contas c
  where c.conta_id = v_user.conta_id
    and c.produto_codigo = v_user.produto_codigo
    and c.status = 'ATIVA'
  limit 1;

  if v_conta.conta_id is null then
    return null;
  end if;

  select count(*)::integer into v_consumidos
  from public.nt_talento_consumos lc
  where lc.conta_id = v_user.conta_id
    and lc.produto_codigo = v_user.produto_codigo;

  return jsonb_build_object(
    'usuario_id', v_user.usuario_id,
    'usuario_seed_id', v_user.usuario_seed_id,
    'conta_id', v_user.conta_id,
    'produto_codigo', v_user.produto_codigo,
    'nome', v_user.nome,
    'email_login', v_user.email_login,
    'perfil', v_user.perfil,
    'nome_conta', v_conta.nome_conta,
    'plano_tipo', v_conta.plano_tipo,
    'status', v_conta.status,
    'limite_total', coalesce(v_conta.limite_total, 0),
    'limite_por_usuario', coalesce(v_conta.limite_por_usuario, 0),
    'usuarios_contratados', coalesce(v_conta.usuarios_contratados, 0),
    'consumidos', coalesce(v_consumidos, 0),
    'saldo', greatest(coalesce(v_conta.limite_total, 0) - coalesce(v_consumidos, 0), 0)
  );
end;
$$;

-- Liberação de detalhe em JSON.
-- Usa tipos flexíveis e não depende de alterar assinatura de função antiga.
create or replace function public.nt_consumir_talento_json_v11(p_talento_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_user public.nt_usuarios_conta%rowtype;
  v_conta public.nt_contas%rowtype;
  v_consumidos integer := 0;
  v_inserted uuid;
  v_t public.nt_talentos%rowtype;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if auth.uid() is null then
    raise exception 'Login obrigatório para liberar contato.' using errcode = '42501';
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
    and u.status = 'ATIVO'
    and c.status = 'ATIVA'
    and u.produto_codigo = 'NOVOS_TALENTOS'
  order by case when u.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;

  if v_user.usuario_id is null then
    raise exception 'Acesso não autorizado para a Plataforma Novos Talentos.' using errcode = '42501';
  end if;

  -- Autoajuste do vínculo pelo e-mail logado.
  if v_user.auth_user_id is distinct from auth.uid() then
    update public.nt_usuarios_conta
    set auth_user_id = auth.uid(), updated_at = now()
    where usuario_id = v_user.usuario_id;

    v_user.auth_user_id := auth.uid();
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

  select * into v_t
  from public.nt_talentos t
  where t.talento_key = p_talento_key
    and t.produto_codigo = v_user.produto_codigo
    and coalesce(t.status_registro, 'ATIVO') = 'ATIVO'
  limit 1;

  if v_t.talento_key is null then
    raise exception 'Talento não encontrado ou indisponível.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.nt_talento_consumos lc
    where lc.conta_id = v_user.conta_id
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
      origem,
      created_at
    ) values (
      v_user.conta_id,
      v_user.produto_codigo,
      p_talento_key,
      v_user.usuario_id,
      auth.uid(),
      v_user.nome,
      'PLATAFORMA_NOVOS_TALENTOS',
      now()
    )
    on conflict (conta_id, talento_key) do nothing
    returning consumo_id into v_inserted;
  end if;

  select count(*)::integer into v_consumidos
  from public.nt_talento_consumos lc
  where lc.conta_id = v_user.conta_id
    and lc.produto_codigo = v_user.produto_codigo;

  return jsonb_build_object(
    'talento_key', v_t.talento_key,
    'nome_completo', v_t.nome_completo,
    'primeiro_nome', v_t.primeiro_nome,
    'email', v_t.email,
    'whatsapp', v_t.whatsapp,
    'telefone_principal', v_t.telefone_principal,
    'cargo', v_t.cargo,
    'pretensao_salarial', v_t.pretensao_salarial,
    'sexo', v_t.sexo,
    'idade_anos', v_t.idade_anos,
    'faixa_idade', v_t.faixa_idade,
    'cidade', v_t.cidade,
    'estado_uf', v_t.estado_uf,
    'bairro', v_t.bairro,
    'cep', v_t.cep,
    'regiao_macro', v_t.regiao_macro,
    'micro_regiao', v_t.micro_regiao,
    'bairro_macro', v_t.bairro_macro,
    'estacao_mais_proxima', v_t.estacao_mais_proxima,
    'linha_metro_mais_proxima', v_t.linha_metro_mais_proxima,
    'cor_linha_metro', v_t.cor_linha_metro,
    'distancia_metro_km', v_t.distancia_metro_km,
    'curriculo_url', v_t.curriculo_url,
    'consumido_agora', (v_inserted is not null),
    'saldo_restante', greatest(coalesce(v_conta.limite_total, 0) - coalesce(v_consumidos, 0), 0)
  );
end;
$$;

grant execute on function public.nt_app_context_json_v11() to authenticated;
grant execute on function public.nt_consumir_talento_json_v11(text) to authenticated;

notify pgrst, 'reload schema';

-- Diagnóstico rápido: funções criadas.
select
  proname,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as retorno
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('nt_app_context_json_v11','nt_consumir_talento_json_v11')
order by proname;
