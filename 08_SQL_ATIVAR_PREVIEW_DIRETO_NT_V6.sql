-- RH IMOB • Novos Talentos
-- 08_SQL_ATIVAR_PREVIEW_DIRETO_NT_V6.sql
--
-- Execute no Supabase correto da Plataforma Novos Talentos.
--
-- O objetivo é permitir a prévia pública mascarada no site:
-- - libera somente nt_talentos_publicos e filtros;
-- - mantém nt_talentos completo protegido;
-- - mantém telefone/e-mail completo atrás do login e consumo;
-- - recarrega o cache da API.

-- 1) Conferir se está no projeto certo.
select
  'nt_talentos_publicos' as tabela,
  to_regclass('public.nt_talentos_publicos') is not null as existe
union all select 'nt_filtro_cidade', to_regclass('public.nt_filtro_cidade') is not null
union all select 'nt_filtro_cidade_idade', to_regclass('public.nt_filtro_cidade_idade') is not null
union all select 'nt_filtro_cidade_cargo', to_regclass('public.nt_filtro_cidade_cargo') is not null
union all select 'nt_filtro_cidade_metro', to_regclass('public.nt_filtro_cidade_metro') is not null;

-- 2) Grants públicos apenas para prévia mascarada.
grant usage on schema public to anon, authenticated;

grant select on public.nt_talentos_publicos to anon, authenticated;
grant select on public.nt_filtro_cidade to anon, authenticated;
grant select on public.nt_filtro_cidade_idade to anon, authenticated;
grant select on public.nt_filtro_cidade_cargo to anon, authenticated;
grant select on public.nt_filtro_cidade_metro to anon, authenticated;

-- 3) RLS ativo.
alter table public.nt_talentos_publicos enable row level security;
alter table public.nt_filtro_cidade enable row level security;
alter table public.nt_filtro_cidade_idade enable row level security;
alter table public.nt_filtro_cidade_cargo enable row level security;
alter table public.nt_filtro_cidade_metro enable row level security;

-- 4) Policies para visitante sem login.
drop policy if exists nt_publicos_preview_anon_v6 on public.nt_talentos_publicos;
drop policy if exists nt_filtro_cidade_preview_anon_v6 on public.nt_filtro_cidade;
drop policy if exists nt_filtro_idade_preview_anon_v6 on public.nt_filtro_cidade_idade;
drop policy if exists nt_filtro_cargo_preview_anon_v6 on public.nt_filtro_cidade_cargo;
drop policy if exists nt_filtro_metro_preview_anon_v6 on public.nt_filtro_cidade_metro;

create policy nt_publicos_preview_anon_v6
on public.nt_talentos_publicos
for select
to anon
using (
  produto_codigo = 'NOVOS_TALENTOS'
  and ativo = true
);

create policy nt_filtro_cidade_preview_anon_v6
on public.nt_filtro_cidade
for select
to anon
using (true);

create policy nt_filtro_idade_preview_anon_v6
on public.nt_filtro_cidade_idade
for select
to anon
using (true);

create policy nt_filtro_cargo_preview_anon_v6
on public.nt_filtro_cidade_cargo
for select
to anon
using (true);

create policy nt_filtro_metro_preview_anon_v6
on public.nt_filtro_cidade_metro
for select
to anon
using (true);

-- 5) Policies para logado também conseguir visualizar a prévia.
drop policy if exists nt_publicos_preview_auth_v6 on public.nt_talentos_publicos;

create policy nt_publicos_preview_auth_v6
on public.nt_talentos_publicos
for select
to authenticated
using (
  produto_codigo = 'NOVOS_TALENTOS'
  and ativo = true
);

-- 6) Função de consumo protegida, se ainda não existir ou precisar atualizar.
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

grant execute on function public.nt_consumir_talento(text) to authenticated;

-- 7) Recarrega cache da API.
notify pgrst, 'reload schema';

-- 8) Conferência final.
select 'nt_talentos_publicos' as tabela, count(*) as total from public.nt_talentos_publicos
union all select 'nt_filtro_cidade', count(*) from public.nt_filtro_cidade
union all select 'nt_filtro_cidade_idade', count(*) from public.nt_filtro_cidade_idade
union all select 'nt_filtro_cidade_cargo', count(*) from public.nt_filtro_cidade_cargo
union all select 'nt_filtro_cidade_metro', count(*) from public.nt_filtro_cidade_metro;
