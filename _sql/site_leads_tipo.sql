-- Segmenta leads do site em empresa (quer contratar) x candidato (quer vaga).
-- Sem essa coluna o motor grava mesmo assim (marca [tipo] na origem via retry),
-- mas com ela o painel filtra direto. Seguro; default preserva os leads atuais.
alter table public.site_leads add column if not exists tipo text default 'empresa';
notify pgrst, 'reload schema';
