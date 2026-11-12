-- ============================================================================
-- RHI_limpar_telefones_cidade — zera telefone por prefixo de lead_key
-- >>> RODAR NO PROJETO RHI (tnzmxpoxvdlckmjwdala) <<<
--
-- Usada pela limpeza de telefones de SP (GAS GAS_SP_limpar_telefones).
-- Faz o UPDATE no servidor, com statement_timeout folgado (300s) — evita o
-- erro 57014 (statement timeout) que estoura quando o PATCH do PostgREST tenta
-- varrer a tabela inteira em ~8s.
--
-- Mantém o registro, o Instagram e o status: só tira telefone e o canal.
-- ============================================================================
create or replace function rhi_limpar_telefones_cidade(p_prefixos text[])
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '300s'
as $$
declare n1 int; n2 int;
begin
  update leads m
     set telefone_base = null,
         tem_telefone = null,
         tem_canal_telefone = false,
         updated_at = now()
   where exists (select 1 from unnest(p_prefixos) px where m.lead_key like px || '%');
  get diagnostics n1 = row_count;

  update leads_publicos m
     set tem_canal_telefone = false,
         updated_at = now()
   where exists (select 1 from unnest(p_prefixos) px where m.lead_key like px || '%');
  get diagnostics n2 = row_count;

  return jsonb_build_object('ok', true, 'leads', n1, 'leads_publicos', n2);
end
$$;

grant execute on function rhi_limpar_telefones_cidade(text[]) to service_role;

-- Teste (não zera nada — só confere que existe; para zerar SP, o GAS chama com
-- p_prefixos = ['SÃO PAULO::','SAO PAULO::']):
-- select rhi_limpar_telefones_cidade(array['__nao_existe__::']);
