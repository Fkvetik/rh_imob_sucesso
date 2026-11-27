-- ============================================================================
-- VAGAS_1 — "ativa fora da grade" + edição pelo dono da vaga
-- Rode no projeto das VAGAS/NT (pufxvskozfdvfscqnays).
--
-- na_grade:   separa "pública" de "aparece na grade /vagas". Três estados:
--               ATIVA + na_grade=true   → aparece na grade
--               ATIVA + na_grade=false  → página pública por link, fora da grade
--               INATIVA (qualquer)      → fora do ar (404)
--             default true: nada muda pras vagas que já existem.
-- edit_token: segredo por vaga. O link que a Mariana manda pro dono
--             (/editar-vaga?v=<vaga_id>&t=<edit_token>) deixa ELE editar só
--             aquela vaga, sem o token-mestre do admin. Gerado sob demanda.
-- ============================================================================
alter table public.site_vagas_publicas
  add column if not exists na_grade boolean not null default true,
  add column if not exists edit_token text;

-- Garante que toda vaga ATIVA que já existe continue na grade (default já cobre,
-- mas deixa explícito pra linhas antigas que por acaso tenham vindo nulas).
update public.site_vagas_publicas set na_grade = true where na_grade is null;

select count(*) filter (where na_grade) as na_grade,
       count(*) filter (where not na_grade) as fora_da_grade,
       count(*) as total
from public.site_vagas_publicas;
