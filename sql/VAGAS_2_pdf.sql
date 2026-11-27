-- ============================================================================
-- VAGAS_2 — PDF da empresa na vaga (apresentação / pipeline / lançamentos)
-- Rode no projeto das VAGAS/NT (pufxvskozfdvfscqnays).
-- pdf_url:   link do PDF subido (bucket público). Aparece como botão "Saiba mais"
--            na página da vaga. Vazio = sem PDF (botão não aparece).
-- pdf_label: texto do botão (ex.: "Apresentação da empresa"). Default sensato.
-- ============================================================================
alter table public.site_vagas_publicas
  add column if not exists pdf_url text,
  add column if not exists pdf_label text;

select count(*) filter (where coalesce(pdf_url,'') <> '') as com_pdf, count(*) as total
from public.site_vagas_publicas;
