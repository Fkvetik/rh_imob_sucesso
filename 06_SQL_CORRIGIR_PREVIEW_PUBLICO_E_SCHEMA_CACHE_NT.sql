-- RH IMOB • Novos Talentos
-- 06_SQL_CORRIGIR_PREVIEW_PUBLICO_E_SCHEMA_CACHE_NT.sql
--
-- Execute no Supabase SQL Editor do MESMO projeto usado no arquivo supabase-config.js do site.
--
-- Este SQL:
-- 1) Confere se as tabelas Novos Talentos existem nesse projeto.
-- 2) Libera apenas prévia pública protegida para visitantes sem login.
-- 3) Mantém telefone/e-mail/dados completos protegidos.
-- 4) Recarrega o cache da API do Supabase.
--
-- Se algum "existe" voltar false, o site está apontando para um projeto onde a carga nt_* não foi publicada.

select
  'nt_talentos_publicos' as tabela,
  to_regclass('public.nt_talentos_publicos') is not null as existe
union all select 'nt_filtro_cidade', to_regclass('public.nt_filtro_cidade') is not null
union all select 'nt_filtro_cidade_idade', to_regclass('public.nt_filtro_cidade_idade') is not null
union all select 'nt_filtro_cidade_cargo', to_regclass('public.nt_filtro_cidade_cargo') is not null
union all select 'nt_filtro_cidade_metro', to_regclass('public.nt_filtro_cidade_metro') is not null;

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

drop policy if exists nt_publicos_preview_anon on public.nt_talentos_publicos;
drop policy if exists nt_filtro_cidade_preview_anon on public.nt_filtro_cidade;
drop policy if exists nt_filtro_idade_preview_anon on public.nt_filtro_cidade_idade;
drop policy if exists nt_filtro_cargo_preview_anon on public.nt_filtro_cidade_cargo;
drop policy if exists nt_filtro_metro_preview_anon on public.nt_filtro_cidade_metro;

create policy nt_publicos_preview_anon
on public.nt_talentos_publicos
for select
to anon
using (
  produto_codigo = 'NOVOS_TALENTOS'
  and ativo = true
);

create policy nt_filtro_cidade_preview_anon
on public.nt_filtro_cidade
for select
to anon
using (true);

create policy nt_filtro_idade_preview_anon
on public.nt_filtro_cidade_idade
for select
to anon
using (true);

create policy nt_filtro_cargo_preview_anon
on public.nt_filtro_cidade_cargo
for select
to anon
using (true);

create policy nt_filtro_metro_preview_anon
on public.nt_filtro_cidade_metro
for select
to anon
using (true);

-- Recarrega cache da API REST do Supabase.
notify pgrst, 'reload schema';

-- Conferência final.
select 'nt_talentos_publicos' as tabela, count(*) as total from public.nt_talentos_publicos
union all select 'nt_filtro_cidade', count(*) from public.nt_filtro_cidade
union all select 'nt_filtro_cidade_idade', count(*) from public.nt_filtro_cidade_idade
union all select 'nt_filtro_cidade_cargo', count(*) from public.nt_filtro_cidade_cargo
union all select 'nt_filtro_cidade_metro', count(*) from public.nt_filtro_cidade_metro;
