-- ============================================================================
-- VAGAS_5 — endereço do plantão/empreendimento na vaga
-- Rode no projeto das VAGAS/NT (pufxvskozfdvfscqnays).
-- endereco: rua/número do empreendimento. Aparece na página da vaga como
-- "📍 Como chegar" com link pro Google Maps, pro corretor se localizar.
-- Vazio = não mostra. Default '' (coluna NOT NULL como as outras de texto).
-- ============================================================================
alter table public.site_vagas_publicas
  add column if not exists endereco text not null default '';

select count(*) filter (where coalesce(endereco,'') <> '') as com_endereco, count(*) as total
from public.site_vagas_publicas;
