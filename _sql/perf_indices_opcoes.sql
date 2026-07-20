-- ============================================================
-- PERF: acelera nt_opcoes_filtro_publico_v10 (dropdowns com contagem)
-- ------------------------------------------------------------
-- Sintoma: dropdown "filtra cidade + agrupa por X" estoura o statement
-- timeout (~3s) sobre os 112k de São Paulo. O RPC cai no fallback e a
-- dropdown fica sem os números.
-- Causa: só há índices simples em cidade_key e nas colunas de grupo,
-- separados. O agrupamento filtrado por cidade varre 112k linhas.
-- Fix: índices COMPOSTOS (cidade_key, <coluna_de_grupo>) → o filtro por
-- cidade + agregação vira index-only scan. Índices persistem no REFRESH
-- da materialized view.
-- Seguro: só cria índices (não altera dados). Roda tudo de uma vez.
-- ============================================================

create index if not exists nt_mv_ck_macro   on public.nt_base_pub_mv (cidade_key, macro_calc);
create index if not exists nt_mv_ck_micro   on public.nt_base_pub_mv (cidade_key, micro_calc);
create index if not exists nt_mv_ck_bairro  on public.nt_base_pub_mv (cidade_key, bairro);
create index if not exists nt_mv_ck_cargo   on public.nt_base_pub_mv (cidade_key, cargo);
create index if not exists nt_mv_ck_idade   on public.nt_base_pub_mv (cidade_key, faixa_idade);
create index if not exists nt_mv_ck_estacao on public.nt_base_pub_mv (cidade_key, estacao_mais_proxima, distancia_metro_km);

analyze public.nt_base_pub_mv;
