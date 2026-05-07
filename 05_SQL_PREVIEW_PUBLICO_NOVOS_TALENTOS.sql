-- RH IMOB • Plataforma Novos Talentos
-- ETAPA 4.2 — Prévia pública protegida, no padrão da Plataforma Corretores
-- Execute no Supabase SQL Editor.
--
-- Objetivo:
-- - Permitir que a página /novos-talentos carregue filtros e cartões públicos sem login.
-- - Manter telefone, e-mail e detalhes completos protegidos.
-- - Login continua obrigatório para nt_consumir_talento.

grant usage on schema public to anon, authenticated;

grant select on public.nt_talentos_publicos to anon, authenticated;
grant select on public.nt_filtro_cidade to anon, authenticated;
grant select on public.nt_filtro_cidade_idade to anon, authenticated;
grant select on public.nt_filtro_cidade_cargo to anon, authenticated;
grant select on public.nt_filtro_cidade_metro to anon, authenticated;

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

-- Conferência rápida:
select 'nt_talentos_publicos' as tabela, count(*) as total from public.nt_talentos_publicos
union all select 'nt_filtro_cidade', count(*) from public.nt_filtro_cidade
union all select 'nt_filtro_cidade_idade', count(*) from public.nt_filtro_cidade_idade
union all select 'nt_filtro_cidade_cargo', count(*) from public.nt_filtro_cidade_cargo
union all select 'nt_filtro_cidade_metro', count(*) from public.nt_filtro_cidade_metro;
