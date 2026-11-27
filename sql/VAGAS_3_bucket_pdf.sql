-- ============================================================================
-- VAGAS_3 — liberar PDF no bucket 'noticias'
-- Rode no projeto RHI (tnzmxpoxvdlckmjwdala), onde fica o bucket das imagens.
-- O bucket estava limitado a imagens e recusava application/pdf (erro 415).
-- Isto ACRESCENTA application/pdf à lista, sem tirar os tipos de imagem já
-- permitidos. Também sobe o teto de tamanho do bucket pra 50 MB.
-- ============================================================================

-- 1) ver como está hoje (confira antes/depois)
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'noticias';

-- 2) acrescenta application/pdf (só se a lista existir e ainda não tiver o pdf)
update storage.buckets
set allowed_mime_types = allowed_mime_types || '{application/pdf}'
where id = 'noticias'
  and allowed_mime_types is not null
  and not ('application/pdf' = any(allowed_mime_types));

-- 3) garante teto de 50 MB no bucket (52428800 bytes)
update storage.buckets
set file_size_limit = greatest(coalesce(file_size_limit, 0), 52428800)
where id = 'noticias';

-- 4) confere o resultado
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'noticias';
