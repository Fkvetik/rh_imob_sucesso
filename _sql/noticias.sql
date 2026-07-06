-- ============================================================
-- RHIMOB — Tabela de notícias
-- Executar no Supabase Dashboard → SQL Editor
-- Projeto: tnzmxpoxvdlckmjwdala
-- ============================================================

CREATE TABLE IF NOT EXISTS noticias (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo         TEXT         NOT NULL,
  resumo         TEXT         NOT NULL DEFAULT '',
  corpo          TEXT         NOT NULL DEFAULT '',   -- HTML
  imagem_url     TEXT         DEFAULT '',
  slug           TEXT         UNIQUE NOT NULL,
  categoria      TEXT         NOT NULL DEFAULT 'Mercado',
  publicado_em   TIMESTAMPTZ  DEFAULT NOW(),
  ativo          BOOLEAN      NOT NULL DEFAULT false,
  criado_em      TIMESTAMPTZ  DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ  DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_noticias_slug         ON noticias (slug);
CREATE INDEX IF NOT EXISTS idx_noticias_ativo_data   ON noticias (ativo, publicado_em DESC);
CREATE INDEX IF NOT EXISTS idx_noticias_categoria    ON noticias (categoria);

-- Atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION set_noticias_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_noticias_atualizado_em ON noticias;
CREATE TRIGGER trg_noticias_atualizado_em
  BEFORE UPDATE ON noticias
  FOR EACH ROW EXECUTE FUNCTION set_noticias_atualizado_em();

-- RLS
ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;

-- Leitura pública: só artigos ativos
DROP POLICY IF EXISTS "public_read_ativas" ON noticias;
CREATE POLICY "public_read_ativas" ON noticias
  FOR SELECT USING (ativo = true);

-- Admin (anon key com senha client-side): leitura total + escrita
DROP POLICY IF EXISTS "anon_full_access" ON noticias;
CREATE POLICY "anon_full_access" ON noticias
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Storage: bucket público para imagens de notícias
-- ============================================================

-- Criar bucket público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'noticias',
  'noticias',
  true,
  5242880,   -- 5 MB por arquivo
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Política: leitura pública
DROP POLICY IF EXISTS "noticias_storage_read" ON storage.objects;
CREATE POLICY "noticias_storage_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'noticias');

-- Política: upload via anon (protegido por senha no admin client-side)
DROP POLICY IF EXISTS "noticias_storage_insert" ON storage.objects;
CREATE POLICY "noticias_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'noticias');

-- Política: deletar via anon
DROP POLICY IF EXISTS "noticias_storage_delete" ON storage.objects;
CREATE POLICY "noticias_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'noticias');

-- ============================================================
-- Artigo de exemplo para validar o setup
-- ============================================================
INSERT INTO noticias (titulo, resumo, corpo, imagem_url, slug, categoria, ativo)
VALUES (
  'Mercado imobiliário de SP bate recorde de contratações no 1º semestre de 2026',
  'Imobiliárias paulistanas contrataram 34% mais corretores em relação ao mesmo período de 2025, impulsionadas pela retomada de lançamentos no ABC e Grande SP.',
  '<p>O mercado imobiliário paulistano encerrou o primeiro semestre de 2026 com um recorde histórico: foram contratados 34% mais corretores do que no mesmo período do ano anterior, segundo dados consolidados pela RH IMOB a partir de 52 mil profissionais mapeados em sua base.</p>
<p>A retomada foi puxada principalmente pelo segmento de lançamentos no ABC Paulista, Grande São Paulo e interior — cidades como Campinas, Ribeirão Preto e São José dos Campos registraram alta acima de 40% na demanda por profissionais com CRECI ativo.</p>
<h2>O que explica o crescimento</h2>
<p>Três fatores combinados impulsionaram a contratação:</p>
<ul>
  <li><strong>Queda da Selic</strong> — a redução das taxas de juros voltou a tornar o financiamento imobiliário acessível para a classe média.</li>
  <li><strong>Retomada de lançamentos</strong> — incorporadoras que pausaram projetos em 2024 retomaram cronogramas com urgência.</li>
  <li><strong>Escassez de corretores qualificados</strong> — a demanda cresceu mais rápido do que a formação de novos profissionais com CRECI.</li>
</ul>
<h2>O que esperar no 2º semestre</h2>
<p>A projeção é de continuidade. Imobiliárias que ainda não estruturaram seu processo de recrutamento enfrentarão cada vez mais dificuldade para contratar no prazo — especialmente para lançamentos com data de estande definida.</p>
<p>A RH IMOB estima que, no 2º semestre, a demanda por corretores com perfil de lançamento crescerá mais 20% nas regiões metropolitanas de São Paulo, Rio de Janeiro e Belo Horizonte.</p>',
  '',
  'mercado-imobiliario-sp-recorde-contratacoes-2026',
  'Mercado',
  true
) ON CONFLICT (slug) DO NOTHING;
