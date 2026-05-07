-- RH IMOB • Diagnóstico Plataforma Novos Talentos
-- Rode no Supabase SQL Editor para confirmar o motivo quando login entra mas painel não carrega.

-- 1) Confere funções usadas pelo HTML
select
  p.proname as funcao,
  oidvectortypes(p.proargtypes) as argumentos,
  pg_get_function_result(p.oid) as retorno
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('nt_app_context','nt_listar_talentos','nt_consumir_talento','nt_listar_frases_plano')
order by p.proname;

-- 2) Confere vínculo do login usado no teste
select
  usuario_seed_id,
  conta_id,
  produto_codigo,
  nome,
  email_login,
  perfil,
  status,
  auth_user_id
from public.nt_usuarios_conta
where email_login = 'rhimobvip@gmail.com';

-- 3) Confere conta vinculada
select
  c.conta_id,
  c.produto_codigo,
  c.nome_conta,
  c.plano_tipo,
  c.status,
  c.limite_total,
  c.limite_por_usuario,
  c.usuarios_contratados
from public.nt_contas c
where c.conta_id = 'CONTA_DEMO_NOVOS_TALENTOS';

-- 4) Confere se há filtros e talentos públicos
select 'nt_talentos_publicos' as tabela, count(*) as total from public.nt_talentos_publicos
union all select 'nt_filtro_cidade', count(*) from public.nt_filtro_cidade
union all select 'nt_filtro_cidade_idade', count(*) from public.nt_filtro_cidade_idade
union all select 'nt_filtro_cidade_cargo', count(*) from public.nt_filtro_cidade_cargo
union all select 'nt_filtro_cidade_metro', count(*) from public.nt_filtro_cidade_metro;
