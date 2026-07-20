-- PERF: dropdowns com contagem sobre São Paulo (112k) levam ~4-10s no free
-- tier; o statement_timeout do anon estava ~3s e estourava (RPC caía no
-- fallback sem números). Sobe o limite para caber a agregação.
-- Sem risco de dados; só afrouxa o teto de tempo de query.
alter role anon set statement_timeout = '15s';
alter role authenticated set statement_timeout = '15s';
notify pgrst, 'reload config';
