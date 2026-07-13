-- ============================================================
-- RHIMOB — Evolução das notícias
-- Executar no Supabase Dashboard → SQL Editor
-- Projeto: tnzmxpoxvdlckmjwdala
-- ============================================================

-- 1. Adicionar coluna destaque na tabela noticias
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS destaque BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_noticias_destaque ON noticias (destaque);

-- 2. Tabela de comentários
CREATE TABLE IF NOT EXISTS comentarios (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  noticia_slug TEXT         NOT NULL,
  nome         TEXT         NOT NULL,
  email        TEXT         NOT NULL DEFAULT '',
  texto        TEXT         NOT NULL,
  aprovado     BOOLEAN      NOT NULL DEFAULT false,
  criado_em    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_slug     ON comentarios (noticia_slug);
CREATE INDEX IF NOT EXISTS idx_comentarios_aprovado ON comentarios (aprovado);

-- RLS
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode inserir (submit de comentário)
DROP POLICY IF EXISTS "anon_insert_comentarios" ON comentarios;
CREATE POLICY "anon_insert_comentarios" ON comentarios
  FOR INSERT WITH CHECK (true);

-- Admin (anon key) tem acesso total para moderar
DROP POLICY IF EXISTS "anon_full_comentarios" ON comentarios;
CREATE POLICY "anon_full_comentarios" ON comentarios
  FOR ALL USING (true) WITH CHECK (true);
