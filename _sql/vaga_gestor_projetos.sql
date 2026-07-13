-- ============================================================
-- Vaga: Gestor(a) de Projetos Pleno — São Paulo/SP
-- Cliente do mercado imobiliário · Responsável: Mariana
-- Rodar no Supabase (projeto pufxvskozfdvfscqnays) → SQL Editor
-- ============================================================

insert into public.site_vagas_publicas (
  vaga_id, titulo, categoria, localidade, cidade, estado_uf,
  modalidade, remuneracao, horario, resumo,
  destaques, detalhes, requisitos, atividades,
  selo, prioridade, status, whatsapp_destino,
  imagem_url, video_url, instagram_url, midia_tipo, midia_alt,
  responsavel_nome, responsavel_whatsapp, responsavel_empresa,
  responsavel_cargo, responsavel_email,
  created_at, updated_at
) values (
  'gestor-projetos-pleno-sp',
  'Gestor(a) de Projetos Pleno',
  'Gestão e Projetos',
  'Vila Madalena/SP',
  'São Paulo',
  'SP',
  'CLT ou PJ · Presencial',
  'R$ 4.000,00 + VT, VR e Convênio Médico',
  'Presencial · Vila Madalena, São Paulo/SP',
  'Gestão de projetos estratégicos em empresa do mercado imobiliário, com foco em tecnologia, inteligência de dados e melhoria de processos. Buscamos um profissional organizado, analítico e com capacidade de conectar áreas e transformar ideias em planos de ação.',
  E'Ambiente inovador com foco em tecnologia e dados\nProjetos estratégicos e melhoria de processos\nInterface entre áreas comerciais, operacionais e tecnologia',
  E'Planejamento e acompanhamento de projetos\nControle de prazos, entregas e indicadores (KPIs)\nOrganização de processos e fluxos de trabalho\nInterface entre áreas comerciais, operacionais e tecnologia\nApoio na implantação de ferramentas digitais e novas soluções',
  E'Experiência com gestão de projetos\nFacilidade com tecnologia, sistemas e ferramentas digitais\nConhecimento em Excel, indicadores e organização de dados\nDiferencial: experiência com CRM, automações, IA e metodologias ágeis',
  E'Planejamento e acompanhamento de projetos\nControle de prazos e KPIs\nOrganização de processos e fluxos de trabalho\nApoio na implantação de ferramentas digitais',
  '',
  10,
  'ATIVA',
  'MARIANA',
  '',
  '',
  '',
  '',
  'Vaga Gestor de Projetos Pleno - RH IMOB',
  'Mariana',
  '5511953973268',
  'RH Imob',
  'Hunter',
  'flucasvagas@gmail.com',
  now(),
  now()
)
on conflict (vaga_id) do update set
  titulo = excluded.titulo,
  categoria = excluded.categoria,
  localidade = excluded.localidade,
  modalidade = excluded.modalidade,
  remuneracao = excluded.remuneracao,
  horario = excluded.horario,
  resumo = excluded.resumo,
  destaques = excluded.destaques,
  detalhes = excluded.detalhes,
  requisitos = excluded.requisitos,
  atividades = excluded.atividades,
  status = 'ATIVA',
  updated_at = now();
