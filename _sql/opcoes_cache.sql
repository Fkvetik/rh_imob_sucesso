-- ============================================================
-- CACHE de opções de filtro (dropdowns) — fim do timeout no free tier
-- ------------------------------------------------------------
-- Problema: nt_opcoes_filtro_publico_v10 agrega 128k linhas ao vivo por
-- clique. 7 dropdowns em paralelo no page load saturam o free tier (todas
-- dão 57014). Serializar amenizou, mas ainda leva ~20s.
-- Solução: pré-agregar as contagens numa tabela pequena, atualizada pelo
-- cron. O site lê por índice (instantâneo). Formato idêntico ao RPC
-- (valor/label/total), então é drop-in.
-- Cobre os 2 casos que causavam o storm: sem filtro (__ALL__) e só cidade.
-- Combinações mais profundas continuam no RPC (uma por vez, sem storm).
-- ============================================================

create table if not exists public.nt_opcoes_cache (
  tipo       text not null,
  cidade_key text not null,          -- '__ALL__' = sem filtro de cidade
  valor      text not null,
  label      text not null,
  total      int  not null,
  rank       int  not null
);
create index if not exists nt_opcoes_cache_lookup
  on public.nt_opcoes_cache (tipo, cidade_key, total desc);

create or replace function public.nt_opcoes_cache_rebuild()
returns void language plpgsql security definer as $$
begin
  truncate public.nt_opcoes_cache;

  with base as (
    select cidade, estado_uf, cidade_key, macro_calc, micro_calc, bairro,
           faixa_idade, cargo, estacao_mais_proxima, linha_metro_mais_proxima,
           distancia_metro_km
    from public.nt_base_pub_mv
    where ativo
  ),
  u as (
    -- cidade (só global)
    select 'cidade' tipo, '__ALL__' ck,
           cidade||'||'||estado_uf valor, cidade||'/'||estado_uf label, count(*) total
      from base where coalesce(cidade,'')<>'' and coalesce(estado_uf,'')<>''
      group by cidade, estado_uf
    -- regiao_macro
    union all select 'regiao_macro','__ALL__', macro_calc, macro_calc, count(*)
      from base where coalesce(macro_calc,'')<>'' group by macro_calc
    union all select 'regiao_macro', cidade_key, macro_calc, macro_calc, count(*)
      from base where coalesce(macro_calc,'')<>'' and coalesce(cidade_key,'')<>'' group by cidade_key, macro_calc
    -- micro_regiao
    union all select 'micro_regiao','__ALL__', micro_calc, micro_calc, count(*)
      from base where coalesce(micro_calc,'')<>'' group by micro_calc
    union all select 'micro_regiao', cidade_key, micro_calc, micro_calc, count(*)
      from base where coalesce(micro_calc,'')<>'' and coalesce(cidade_key,'')<>'' group by cidade_key, micro_calc
    -- bairro
    union all select 'bairro','__ALL__', bairro, bairro, count(*)
      from base where coalesce(bairro,'')<>'' group by bairro
    union all select 'bairro', cidade_key, bairro, bairro, count(*)
      from base where coalesce(bairro,'')<>'' and coalesce(cidade_key,'')<>'' group by cidade_key, bairro
    -- faixa_idade
    union all select 'faixa_idade','__ALL__', faixa_idade, faixa_idade, count(*)
      from base where coalesce(faixa_idade,'')<>'' group by faixa_idade
    union all select 'faixa_idade', cidade_key, faixa_idade, faixa_idade, count(*)
      from base where coalesce(faixa_idade,'')<>'' and coalesce(cidade_key,'')<>'' group by cidade_key, faixa_idade
    -- cargo
    union all select 'cargo','__ALL__', cargo, cargo, count(*)
      from base where coalesce(cargo,'')<>'' group by cargo
    union all select 'cargo', cidade_key, cargo, cargo, count(*)
      from base where coalesce(cargo,'')<>'' and coalesce(cidade_key,'')<>'' group by cidade_key, cargo
    -- metro (só <=5km; label com a linha)
    union all select 'metro','__ALL__', estacao_mais_proxima,
           estacao_mais_proxima || case when coalesce(linha_metro_mais_proxima,'')<>'' then ' • '||linha_metro_mais_proxima else '' end,
           count(*)
      from base where coalesce(estacao_mais_proxima,'')<>'' and distancia_metro_km is not null and distancia_metro_km<=5
      group by estacao_mais_proxima, linha_metro_mais_proxima
    union all select 'metro', cidade_key, estacao_mais_proxima,
           estacao_mais_proxima || case when coalesce(linha_metro_mais_proxima,'')<>'' then ' • '||linha_metro_mais_proxima else '' end,
           count(*)
      from base where coalesce(estacao_mais_proxima,'')<>'' and distancia_metro_km is not null and distancia_metro_km<=5 and coalesce(cidade_key,'')<>''
      group by cidade_key, estacao_mais_proxima, linha_metro_mais_proxima
  ),
  ranked as (
    select tipo, ck, valor, label, total,
           row_number() over (partition by tipo, ck order by total desc, label) rn
    from u
  )
  insert into public.nt_opcoes_cache (tipo, cidade_key, valor, label, total, rank)
  select tipo, ck, valor, label, total, rn from ranked where rn <= 700;
end $$;

-- popula agora
select public.nt_opcoes_cache_rebuild();

-- leitura pública (política trivial = sem custo por linha)
alter table public.nt_opcoes_cache enable row level security;
drop policy if exists nt_opcoes_cache_read on public.nt_opcoes_cache;
create policy nt_opcoes_cache_read on public.nt_opcoes_cache for select to anon, authenticated using (true);
grant select on public.nt_opcoes_cache to anon, authenticated;

-- atualiza a cada 30 min (nos minutos 10/40, após o refresh da MV nos 00/30)
do $$ begin
  perform cron.unschedule('nt_opcoes_cache');
exception when others then null; end $$;
select cron.schedule('nt_opcoes_cache', '10,40 * * * *', $$select public.nt_opcoes_cache_rebuild();$$);

-- recarrega o schema da API
notify pgrst, 'reload schema';

-- conferência
select tipo, cidade_key, count(*) opcoes from public.nt_opcoes_cache
where cidade_key in ('__ALL__','sao paulo') group by tipo, cidade_key order by tipo, cidade_key;
