(() => {
  const EMPRESA_WHATSAPP = '5511997213584';
  const VAGAS_WHATSAPP = '5511953973268';
  const DEFAULT_EMPRESA_MESSAGE = 'Olá, vim pelo site da RH IMOB e gostaria de entender melhor como vocês podem apoiar minha empresa no recrutamento imobiliário.';
  const DEFAULT_VAGA_MESSAGE = 'Olá, Mariana. Vim pelo site da RH IMOB e quero saber mais sobre as vagas.';

  const FALLBACK_JOBS = [
    {
      "id": "corretor-terceiros-grupo-kaza-alto-padrao-sp",
      "title": "Corretor(a) de Imóveis – Terceiros Alto Padrão",
      "category": "Vendas terceiros",
      "location": "São Paulo/SP",
      "contract": "Autônomo",
      "pay": "Comissionamento compatível com imóveis de alto padrão",
      "schedule": "Atuação comercial com rotina alinhada à operação",
      "summary": "O Grupo Kaza busca profissionais comerciais para atuar no setor de terceiros, com foco em imóveis de alto padrão, atendimento consultivo e relacionamento com clientes qualificados.",
      "highlights": [
            "Atuação com imóveis de alto padrão",
            "Carteira voltada a venda de terceiros",
            "Marca consolidada no mercado imobiliário",
            "Perfil consultivo e foco em relacionamento"
      ],
      "details": [
            "Atendimento e relacionamento com clientes compradores e proprietários",
            "Captação, apresentação e negociação de imóveis de terceiros",
            "Atuação consultiva no segmento de médio e alto padrão",
            "Acompanhamento do cliente durante o processo comercial",
            "Desejável CRECI ativo ou disponibilidade para regularização",
            "Experiência com vendas, atendimento consultivo ou mercado imobiliário será considerada diferencial",
            "Perfil comunicativo, organizado, comercial e orientado a resultado",
            "Atuação em regiões estratégicas de São Paulo, com foco em imóveis de maior valor agregado"
      ],
      "sections": [
            {
                  "title": "Atuação",
                  "items": [
                        "Venda de imóveis de terceiros em operação de alto padrão",
                        "Relacionamento com proprietários e clientes compradores",
                        "Captação, apresentação, negociação e acompanhamento comercial"
                  ]
            },
            {
                  "title": "Perfil desejado",
                  "items": [
                        "Perfil comercial, consultivo e com boa comunicação",
                        "Organização para acompanhar carteira, visitas e propostas",
                        "Experiência com vendas ou mercado imobiliário será diferencial",
                        "Desejável CRECI ativo ou disponibilidade para regularização"
                  ]
            },
            {
                  "title": "Diferenciais da oportunidade",
                  "items": [
                        "Atuação em imobiliária de alto padrão",
                        "Contato com imóveis e clientes de maior valor agregado",
                        "Ambiente estruturado para profissionais que buscam crescimento no mercado imobiliário"
                  ]
            }
      ],
      "badge": "Grupo Kaza",
      "featured": true
},
    {
      "id": "corretor-locacao-grupo-kaza-alto-padrao-sp",
      "title": "Corretor(a) de Locação – Alto Padrão",
      "category": "Locação",
      "location": "São Paulo/SP",
      "contract": "Autônomo",
      "pay": "Comissionamento compatível com locações de alto padrão",
      "schedule": "Atuação comercial com rotina alinhada à operação",
      "summary": "Oportunidade para atuar no setor de locação do Grupo Kaza, em uma operação imobiliária estruturada, com foco em imóveis de alto padrão e atendimento qualificado.",
      "highlights": [
            "Foco em locação residencial e comercial",
            "Atuação com imóveis de maior valor agregado",
            "Relacionamento com clientes e proprietários",
            "Imobiliária de alto padrão"
      ],
      "details": [
            "Atendimento a clientes interessados em locação de imóveis",
            "Apresentação de imóveis e condução de visitas",
            "Relacionamento com proprietários e potenciais locatários",
            "Apoio na negociação e avanço das propostas de locação",
            "Organização do funil de atendimento e acompanhamento dos interessados",
            "Desejável vivência com locação, atendimento ao cliente ou mercado imobiliário",
            "Perfil comunicativo, consultivo, ágil e com boa postura profissional",
            "Boa oportunidade para profissionais que desejam atuar em uma imobiliária consolidada e com foco em alto padrão"
      ],
      "sections": [
            {
                  "title": "Atuação",
                  "items": [
                        "Atendimento a clientes interessados em locação",
                        "Agendamento e realização de visitas",
                        "Relacionamento com proprietários e interessados",
                        "Acompanhamento de propostas e negociações"
                  ]
            },
            {
                  "title": "Perfil desejado",
                  "items": [
                        "Boa comunicação e postura profissional",
                        "Agilidade no atendimento e organização de rotina",
                        "Perfil consultivo e orientado a resultado",
                        "Experiência com locação ou atendimento ao cliente será diferencial"
                  ]
            },
            {
                  "title": "Diferenciais da oportunidade",
                  "items": [
                        "Atuação no segmento de alto padrão",
                        "Operação imobiliária estruturada",
                        "Contato com clientes qualificados e imóveis de maior valor agregado"
                  ]
            }
      ],
      "badge": "Grupo Kaza",
      "featured": true
},
    {
      "id": "corretor-locacao-vila-madalena-clt",
      "title": "Corretor(a) de Locação",
      "category": "Locação",
      "location": "Vila Madalena – São Paulo/SP",
      "contract": "CLT",
      "pay": "Fixo R$ 2.100 + comissão de 10%",
      "schedule": "Seg. a sex. 9h às 18h • sáb. 9h às 13h",
      "summary": "Vaga CLT para profissional comercial atuar com locação, atendimento, negociação e relacionamento com clientes em imobiliária estruturada na Vila Madalena.",
      "highlights": [
        "Salário fixo de R$ 2.100,00",
        "Média de ganhos entre R$ 3.000,00 e R$ 6.000,00",
        "Vale combustível de R$ 800,00",
        "Veículo próprio imprescindível"
      ],
      "details": [
        "Comissão de 10% sobre a produção",
        "Premiações e campanhas variáveis",
        "Vale alimentação de R$ 375,00",
        "Assistência odontológica subsidiada em 50%",
        "Auxílio de 50% no seguro do veículo",
        "Seguro de vida, Gympass e day off",
        "Cursos e treinamentos para desenvolvimento profissional",
        "Experiência com vendas, representação comercial ou mercado imobiliário",
        "Perfil comercial, comunicativo e com facilidade em negociação",
        "Desejável vivência com atendimento ao cliente e captação de imóveis"
      ],
      "sections": [
        {
          "title": "Ganhos e comissões",
          "items": [
            "Comissão de 10% sobre a produção",
            "Média de ganhos entre R$ 3.000,00 e R$ 6.000,00",
            "Premiações e campanhas variáveis"
          ]
        },
        {
          "title": "Benefícios",
          "items": [
            "Vale combustível de R$ 800,00",
            "Vale alimentação de R$ 375,00",
            "Assistência odontológica subsidiada em 50%",
            "Auxílio de 50% no seguro do veículo",
            "Seguro de vida",
            "Gympass",
            "Day off",
            "Cursos e treinamentos"
          ]
        },
        {
          "title": "Requisitos",
          "items": [
            "Veículo próprio imprescindível",
            "Experiência com vendas, representação comercial ou mercado imobiliário",
            "Perfil comercial, comunicativo e com facilidade em negociação",
            "Desejável vivência com atendimento ao cliente e captação de imóveis"
          ]
        }
      ],
      "badge": "CLT + benefícios",
      "featured": true
    },
    {
      "id": "corretor-imoveis-terceiros-vila-madalena",
      "title": "Corretor(a) de Imóveis – Terceiros",
      "category": "Vendas terceiros",
      "location": "Vila Madalena – São Paulo/SP",
      "contract": "Autônomo",
      "pay": "Comissão até 33% + ajuda de custo",
      "schedule": "Seg. a sex. 9h às 18h • sáb. até 13h",
      "summary": "A Imobiliária Pacheco, com mais de 45 anos de atuação, busca profissionais comerciais para venda e captação de imóveis de terceiros.",
      "highlights": [
        "Comissão de até 33%",
        "Ajuda de custo de R$ 3.000,00 por 3 meses",
        "Imobiliária tradicional na Vila Madalena",
        "Atuação com captação, venda e negociação"
      ],
      "details": [
        "Atendimento e relacionamento com clientes",
        "Captação e venda de imóveis de terceiros",
        "Apresentação e negociação de imóveis",
        "Identificação do perfil e necessidade do cliente",
        "Acompanhamento de todo o processo de venda",
        "Ser corretor(a) de imóveis ou estar cursando TTI",
        "Também serão avaliados profissionais com experiência em vendas",
        "Possuir veículo próprio",
        "Perfil comunicativo, comercial e com foco em resultados"
      ],
      "sections": [
        {
          "title": "Principais atividades",
          "items": [
            "Atendimento e relacionamento com clientes",
            "Captação e venda de imóveis de terceiros",
            "Apresentação e negociação de imóveis",
            "Identificação do perfil e necessidade do cliente",
            "Acompanhamento de todo o processo de venda"
          ]
        },
        {
          "title": "Requisitos",
          "items": [
            "Ser corretor(a) de imóveis ou estar cursando TTI",
            "Profissionais com experiência em vendas também serão avaliados",
            "Possuir veículo próprio",
            "Perfil comunicativo, comercial e com foco em resultados"
          ]
        }
      ],
      "badge": "Terceiros",
      "featured": true
    },
    {
      "id": "vistoriador-saida-entrega-chaves-vila-madalena",
      "title": "Vistoriador de Saída",
      "category": "Vistoria",
      "location": "Vila Madalena – São Paulo/SP",
      "contract": "Presencial",
      "pay": "Salário R$ 3.000 + benefícios",
      "schedule": "Seg. a sex. 9h às 18h • sábados alternados 9h às 13h",
      "summary": "Atuação no departamento de entrega de chaves, realizando vistorias, registros, comunicação e negociação de manutenções com inquilinos.",
      "highlights": [
        "Salário de R$ 3.000,00",
        "Vale combustível de R$ 850,00",
        "VA R$ 375,00 + VT",
        "Preferência por vivência em imobiliária"
      ],
      "details": [
        "Realizar visitas aos imóveis para verificar o estado de manutenção",
        "Preencher fichas de descrição ao final de cada visita",
        "Registrar, comunicar e negociar serviços de manutenção com inquilinos",
        "Tirar fotos e filmar os imóveis vistoriados",
        "Comunicação verbal e escrita",
        "Organização, relacionamento interpessoal e flexibilidade",
        "Vivência comprovada em atendimento ao público",
        "Preferência para profissionais que tenham atuado em imobiliária",
        "Habilitação",
        "Assistência odontológica 50%, seguro parcial do carro, Gympass e Conexa Saúde"
      ],
      "sections": [
        {
          "title": "Atividades",
          "items": [
            "Visitar imóveis para verificar estado de manutenção",
            "Preencher fichas de descrição ao final de cada visita",
            "Registrar, comunicar e negociar serviços de manutenção com inquilinos",
            "Tirar fotos e filmar"
          ]
        },
        {
          "title": "Habilidades",
          "items": [
            "Comunicação verbal e escrita",
            "Organização",
            "Relacionamento interpessoal",
            "Flexibilidade"
          ]
        },
        {
          "title": "Conhecimentos e experiência",
          "items": [
            "Vivência comprovada em atendimento ao público",
            "Preferência para profissionais que tenham atuado em imobiliária",
            "Habilitação"
          ]
        },
        {
          "title": "Benefícios",
          "items": [
            "VA R$ 375,00",
            "VT",
            "50% de assistência odontológica",
            "Seguro parcial do carro",
            "Vale combustível de R$ 850,00",
            "Gympass",
            "Conexa Saúde"
          ]
        }
      ],
      "badge": "Entrega de chaves",
      "featured": true
    },
    {
      "id": "gestor-negocios-imobiliarios-cuiaba-mt",
      "title": "Gestor de Negócios Imobiliários",
      "category": "Gestão imobiliária",
      "location": "Cuiabá/MT e região",
      "contract": "Expansão comercial",
      "pay": "Fixo na faixa de R$ 10.000 + comissão + moradia",
      "schedule": "Disponibilidade para mudança de estado",
      "summary": "Construtora consolidada busca gestor para expansão comercial, abertura de mercado e parcerias imobiliárias em Cuiabá e cidades próximas.",
      "highlights": [
        "Fixo na faixa de R$ 10.000,00",
        "Comissão e moradia",
        "Foco em expansão e novos lançamentos",
        "CRECI ativo e networking regional"
      ],
      "details": [
        "Desenvolver parcerias estratégicas com imobiliárias da região",
        "Abrir frente comercial para novos lançamentos imobiliários",
        "Fortalecer networking e relacionamento com o mercado local",
        "Estruturar e acompanhar operações voltadas ao segmento econômico/popular",
        "Atuar diretamente na expansão da construtora em novas cidades",
        "CRECI ativo",
        "Experiência no segmento imobiliário econômico/popular",
        "Vivência sólida com parcerias imobiliárias",
        "Experiência como gestor comercial ou gestor imobiliário",
        "Perfil estratégico, comercial e com forte networking",
        "Disponibilidade para mudança de estado"
      ],
      "sections": [
        {
          "title": "Responsabilidades",
          "items": [
            "Desenvolver parcerias estratégicas com imobiliárias da região",
            "Abrir frente comercial para novos lançamentos imobiliários",
            "Fortalecer networking e relacionamento com o mercado local",
            "Estruturar e acompanhar operações do segmento econômico/popular",
            "Atuar na expansão da construtora em novas cidades"
          ]
        },
        {
          "title": "Requisitos",
          "items": [
            "CRECI ativo",
            "Experiência no segmento imobiliário econômico/popular",
            "Vivência sólida com parcerias imobiliárias",
            "Experiência como gestor comercial ou gestor imobiliário",
            "Perfil estratégico, comercial e com forte networking",
            "Disponibilidade para mudança de estado"
          ]
        },
        {
          "title": "Oferta",
          "items": [
            "Fixo na faixa de R$ 10.000,00",
            "Comissão",
            "Moradia",
            "Grande potencial de crescimento em empresa em expansão"
          ]
        }
      ],
      "badge": "Cuiabá/MT",
      "featured": true
    },
    {
      "id": "analista-credito-osasco",
      "title": "Analista de Crédito Imobiliário",
      "category": "Crédito imobiliário",
      "location": "Osasco/SP",
      "contract": "PJ",
      "pay": "R$ 4.000 fixo + premiação por contrato assinado",
      "summary": "Atuação com análise e acompanhamento de contratos de financiamento habitacional.",
      "highlights": [
        "Experiência em crédito imobiliário",
        "Prática com sistemas da Caixa Econômica Federal",
        "Atuação presencial em Osasco"
      ],
      "details": [
        "Perfil organizado, analítico e focado em resultados",
        "Necessário fácil acesso à região de Osasco",
        "Foco em análise e acompanhamento de contratos de financiamento habitacional"
      ],
      "badge": "Vaga especializada"
    },
    {
      "id": "gerente-treinamentos-osasco",
      "title": "Gerente de Treinamentos",
      "category": "Treinamento e liderança",
      "location": "Osasco/SP",
      "contract": "Presencial",
      "pay": "Salário fixo + comissão",
      "summary": "Capacitação técnica de equipes comerciais no setor imobiliário.",
      "highlights": [
        "Mínimo de 5 anos no mercado imobiliário",
        "Expertise em crédito associativo",
        "Treinamentos para lançamentos e performance comercial"
      ],
      "details": [
        "Vivência com treinamentos técnicos voltados para lançamentos",
        "Disponibilidade e acesso facilitado à região de Osasco",
        "Perfil de liderança, didática e desenvolvimento de corretores/equipes"
      ],
      "badge": "Liderança"
    },
    {
      "id": "novos-talentos-direcoes",
      "title": "Novos Talentos – Mercado Imobiliário",
      "category": "Novos talentos",
      "location": "Oeste/SP + Guarulhos",
      "contract": "Formação comercial",
      "pay": "Curso de TTI + ajuda de custo + comissão",
      "summary": "Oportunidade para entrar no mercado imobiliário com processo formativo e acompanhamento.",
      "highlights": [
        "A empresa investe no curso técnico (TTI)",
        "Ajuda de custo mensal",
        "Comissões a partir de R$ 6.000 por venda"
      ],
      "details": [
        "Indicado para quem quer começar sem experiência prévia no mercado imobiliário",
        "Treinamentos e acompanhamento diário",
        "Estrutura comercial e metodologia de trabalho",
        "Regiões de referência: Barueri, Carapicuíba, Osasco, Guarulhos e entorno"
      ],
      "badge": "Entrada no mercado"
    },
    {
      "id": "gerente-vendas-osasco",
      "title": "Gerente de Vendas",
      "category": "Gerência comercial",
      "location": "Osasco/SP",
      "contract": "Início imediato",
      "pay": "Ajuda de custo + comissão",
      "summary": "Operação com estrutura comercial ativa para liderar equipe e acelerar vendas.",
      "highlights": [
        "Estrutura pronta e operação ativa",
        "Rotina de performance com foco em resultado",
        "Autonomia para gestão, metas e indicadores"
      ],
      "details": [
        "Desejável experiência como gerente comercial no mercado imobiliário",
        "Possibilidade de trazer colaboradores/equipe própria",
        "Treinamento e acompanhamento do time comercial"
      ],
      "badge": "Início imediato"
    },
    {
      "id": "gerente-vendas-centro-sp",
      "title": "Gerente de Vendas – Centro",
      "category": "Gerência comercial",
      "location": "Centro de São Paulo/SP",
      "contract": "Com experiência",
      "pay": "Ajuda de custo: R$ 5.000 + comissão",
      "summary": "Busca de líder para estruturar e acelerar time comercial na região central de São Paulo.",
      "highlights": [
        "Atuação na região central de São Paulo",
        "Ajuda de custo de R$ 5.000",
        "Foco em gestão de funil, metas, treinamento e performance"
      ],
      "details": [
        "Ter no mínimo 5 corretores",
        "Experiência comercial no mercado imobiliário",
        "Perfil para formar, acompanhar e acelerar operação"
      ],
      "badge": "Centro SP"
    },
    {
      "id": "sdr-consolacao",
      "title": "Telemarketing Ativo / SDR",
      "category": "SDR e atendimento",
      "location": "Consolação/SP",
      "contract": "PJ",
      "pay": "R$ 2.500 fixo + comissão",
      "summary": "Atuação com prospecção, qualificação de leads e geração de oportunidades comerciais.",
      "highlights": [
        "Contato ativo com leads e potenciais clientes",
        "Prospecção e qualificação de oportunidades",
        "Horário flexível com opções de turno"
      ],
      "details": [
        "Boa comunicação e clareza ao falar",
        "Perfil proativo e organizado",
        "Resiliência para metas e objeções",
        "Interesse em crescimento na área comercial"
      ],
      "badge": "PJ"
    },
    {
      "id": "gerente-vendas-sao-paulo-10k",
      "title": "Gerente de Vendas – Imobiliário",
      "category": "Gerência comercial",
      "location": "São Paulo/SP",
      "contract": "Autônomo",
      "pay": "Ajuda de custo mensal de R$ 10.000 + comissão",
      "summary": "Oportunidade estratégica para líder com equipe própria e histórico de resultado.",
      "highlights": [
        "Ajuda de custo mensal de R$ 10.000",
        "Autonomia para gestão e desenvolvimento de equipe",
        "Atuação direta em operações e lançamentos imobiliários"
      ],
      "details": [
        "Vivência comprovada em liderança comercial",
        "Equipe própria com no mínimo 10 profissionais ativos",
        "Capacidade de cobrar, acompanhar e desenvolver performance",
        "Organização, leitura de indicadores e tomada de decisão"
      ],
      "badge": "Estratégica"
    },
    {
      "id": "jovem-aprendiz-imobiliario",
      "title": "Jovem Aprendiz – Formação no Mercado Imobiliário",
      "category": "Novos talentos",
      "location": "São Paulo/SP",
      "contract": "Formação",
      "pay": "Bolsa integral do curso técnico + possível ajuda de custo",
      "summary": "Para jovens até 23 anos que desejam se formar e iniciar carreira no mercado imobiliário.",
      "highlights": [
        "Bolsa integral do curso técnico",
        "Treinamento prático e teórico desde o início",
        "Acompanhamento, capacitação e suporte diário"
      ],
      "details": [
        "Não exige experiência prévia no mercado imobiliário",
        "Indicado para quem tem vontade de aprender, crescer e se desenvolver",
        "Plantões em diversas regiões de São Paulo, com imóveis populares, médio padrão, alto padrão e boutique",
        "Em alguns casos, ajuda de custo avaliada individualmente"
      ],
      "badge": "Formação"
    },
    {
      "id": "telemarketing-pirituba",
      "title": "Telemarketing Ativo",
      "category": "SDR e atendimento",
      "location": "Pirituba/SP",
      "contract": "Com experiência",
      "pay": "Salário R$ 2.500 + VT + VR",
      "summary": "Contato ativo com clientes e leads, apresentação de ofertas, follow-up e agendamentos.",
      "highlights": [
        "Salário R$ 2.500",
        "Vale transporte e vale refeição",
        "Função orientada a metas e resultados"
      ],
      "details": [
        "Boa comunicação e poder de persuasão",
        "Inteligência emocional e resiliência",
        "Organização e foco em resultado",
        "Empatia e cordialidade no atendimento",
        "Ensino médio completo"
      ],
      "badge": "Pirituba"
    }
  ];

  let JOBS = FALLBACK_JOBS.slice();
  const SITE_VAGAS_TABLE = 'site_vagas_publicas';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const escapeHTML = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  function openWhatsApp(number, message) {
    const text = encodeURIComponent(message || '');
    window.open(`https://wa.me/${number}?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function formatPhoneField(input) {
    if (!input) return;
    input.addEventListener('input', () => {
      let value = input.value.replace(/\D/g, '').slice(0, 11);
      if (value.length > 10) {
        value = value.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
      } else if (value.length > 6) {
        value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
      } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
      }
      input.value = value;
    });
  }



  function getNtSupabaseConfig() {
    const cfg = window.RHIMOB_NOVOS_TALENTOS_SUPABASE_CONFIG || {};
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey) return null;
    return cfg;
  }

  function getCorretoresSupabaseConfig() {
    const cfg = window.RHIMOB_SUPABASE_CONFIG || {};
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey) return null;
    return cfg;
  }

  function supabaseHeaders(cfg, extra = {}) {
    return {
      apikey: cfg.publishableKey,
      Authorization: `Bearer ${cfg.publishableKey}`,
      ...extra
    };
  }

  function parseContentRangeTotal(response) {
    const range = response.headers.get('content-range') || response.headers.get('Content-Range') || '';
    const match = range.match(/\/(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  async function countSupabaseRows(cfg, table, query = '') {
    const url = `${cfg.url.replace(/\/$/, '')}/rest/v1/${table}?select=*&limit=1${query ? `&${query}` : ''}`;
    const response = await fetch(url, {
      headers: supabaseHeaders(cfg, { Prefer: 'count=exact' })
    });
    if (!response.ok) throw new Error(`Falha ao contar ${table}: HTTP ${response.status}`);
    const total = parseContentRangeTotal(response);
    if (Number.isFinite(total)) return total;
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) ? rows.length : 0;
  }

  function formatInteger(value) {
    const number = Number(value || 0);
    return number.toLocaleString('pt-BR');
  }

  function formatRoundedMil(value) {
    const number = Number(value || 0);
    if (!number) return '57 mil+';
    if (number >= 1000) return `${Math.ceil(number / 1000)} mil+`;
    return `${formatInteger(number)}+`;
  }

  function setMetric(name, value) {
    $$(`[data-rhimob-metric="${name}"]`).forEach((el) => {
      const format = el.dataset.format || 'integer';
      el.textContent = format === 'rounded-mil' ? formatRoundedMil(value) : formatInteger(value);
      el.dataset.loaded = 'true';
    });
  }

  async function hydratePublicMetrics() {
    const corretoresCfg = getCorretoresSupabaseConfig();
    const ntCfg = getNtSupabaseConfig();

    if (corretoresCfg) {
      Promise.allSettled([
        countSupabaseRows(corretoresCfg, corretoresCfg.publicTable || 'leads_publicos'),
        countSupabaseRows(corretoresCfg, 'lead_filtros_cidade'),
        countSupabaseRows(corretoresCfg, 'lead_filtros_cidade_ano_cargo')
      ]).then(([total, cidades, combinacoes]) => {
        if (total.status === 'fulfilled') setMetric('corretores_total', total.value);
        if (cidades.status === 'fulfilled') setMetric('corretores_cidades', cidades.value);
        if (combinacoes.status === 'fulfilled') setMetric('corretores_combinacoes', combinacoes.value);
      });
    }

    if (ntCfg) {
      Promise.allSettled([
        countSupabaseRows(ntCfg, 'nt_talentos_publicos'),
        countSupabaseRows(ntCfg, 'nt_filtro_cidade'),
        countSupabaseRows(ntCfg, 'nt_filtro_cidade_metro')
      ]).then(([total, cidades, metro]) => {
        if (total.status === 'fulfilled') setMetric('nt_total_rounded', total.value);
        if (cidades.status === 'fulfilled') setMetric('nt_cidades', cidades.value);
        if (metro.status === 'fulfilled') setMetric('nt_metro', metro.value);
      });
    }
  }

  function splitJobText(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return String(value || '')
      .split(/\n|\r|\|/) 
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeJobFromSupabase(row) {
    const title = normalize(row.titulo || row.title || row.nome_vaga || 'Vaga RH IMOB');
    const cidadeUf = [row.cidade, row.estado_uf].filter(Boolean).join('/');
    const location = normalize(row.localidade || row.location || cidadeUf || 'Consultar região');
    const id = normalize(row.vaga_id || row.slug || row.id || title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));

    return {
      id,
      title,
      category: normalize(row.categoria || row.category || 'Vagas'),
      location,
      contract: normalize(row.modalidade || row.contract || row.tipo_contrato || 'Consultar condição'),
      pay: normalize(row.remuneracao || row.pay || 'Condição informada pela Mariana'),
      schedule: normalize(row.horario || row.schedule || ''),
      summary: normalize(row.resumo || row.summary || 'Oportunidade cadastrada pela RH IMOB.'),
      highlights: splitJobText(row.destaques || row.highlights).slice(0, 5),
      details: splitJobText(row.detalhes || row.details || row.requisitos || row.atividades).slice(0, 8),
      badge: normalize(row.selo || row.badge || row.categoria || 'Vaga ativa')
    };
  }

  function setJobsLoading(isLoading) {
    const grid = $('#jobsGrid');
    if (!grid) return;
    if (isLoading) {
      grid.innerHTML = '<div class="jobs-note reveal in-view"><strong>Atualizando vagas...</strong><span>Buscando oportunidades ativas cadastradas pela RH IMOB.</span></div>';
    }
  }

  async function loadDynamicJobs() {
    const cfg = getNtSupabaseConfig();
    if (!cfg || !$('#jobsGrid')) return false;

    const select = [
      'vaga_id','titulo','categoria','localidade','cidade','estado_uf','modalidade','remuneracao','horario',
      'resumo','destaques','detalhes','requisitos','atividades','selo','prioridade','status','updated_at'
    ].join(',');
    const url = `${cfg.url.replace(/\/$/, '')}/rest/v1/${SITE_VAGAS_TABLE}?select=${encodeURIComponent(select)}&status=eq.ATIVA&order=prioridade.asc&order=updated_at.desc`;
    const response = await fetch(url, { headers: supabaseHeaders(cfg) });
    if (!response.ok) throw new Error(`Falha ao carregar vagas: HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return false;
    JOBS = rows.map(normalizeJobFromSupabase).filter((job) => job.id && job.title);
    return JOBS.length > 0;
  }

  async function initJobs() {
    if (!$('#jobsGrid')) return;
    setJobsLoading(true);
    try {
      const loaded = await loadDynamicJobs();
      renderJobs('todas');
      if (!loaded) console.warn('RH IMOB: usando vagas fixas de fallback.');
    } catch (error) {
      console.warn('RH IMOB: falha ao carregar vagas dinâmicas; usando fallback.', error);
      JOBS = FALLBACK_JOBS.slice();
      renderJobs('todas');
    }
  }


  function setupMenu() {
    const toggle = $('.nav-toggle');
    const nav = $('#menu-principal');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    $$('a', nav).forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function setupReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => obs.observe(el));
  }

  function setupWhatsAppLinks() {
    $$('.js-whatsapp').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const type = link.dataset.type || 'empresa';
        const number = type === 'vaga' ? VAGAS_WHATSAPP : EMPRESA_WHATSAPP;
        const message = link.dataset.message || (type === 'vaga' ? DEFAULT_VAGA_MESSAGE : DEFAULT_EMPRESA_MESSAGE);
        openWhatsApp(number, message);
      });
    });
  }

  function buildCompanyLeadMessage(data) {
    return [
      'Olá, vim pelo site da RH IMOB e gostaria de receber uma apresentação.',
      '',
      'Meus dados:',
      `Nome: ${data.nome}`,
      `Empresa: ${data.empresa}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade/Estado: ${data.cidade}`,
      `Tipo de demanda: ${data.demanda}`,
      `Mensagem: ${data.mensagem || 'Não informado'}`,
      '',
      'Gostaria de entender como a RH IMOB pode apoiar nossa empresa no recrutamento imobiliário.'
    ].join('\n');
  }

  function setupCompanyForm() {
    const form = $('#leadForm');
    if (!form) return;

    formatPhoneField(form.elements.whatsapp);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = {
        nome: normalize(form.elements.nome?.value),
        empresa: normalize(form.elements.empresa?.value),
        whatsapp: normalize(form.elements.whatsapp?.value),
        cidade: normalize(form.elements.cidade?.value),
        demanda: normalize(form.elements.demanda?.value),
        mensagem: normalize(form.elements.mensagem?.value)
      };

      const required = ['nome', 'empresa', 'whatsapp', 'cidade', 'demanda'];
      const missing = required.filter((field) => !data[field]);

      if (missing.length) {
        form.elements[missing[0]]?.focus();
        alert('Por favor, preencha os campos obrigatórios antes de abrir o WhatsApp.');
        return;
      }

      openWhatsApp(EMPRESA_WHATSAPP, buildCompanyLeadMessage(data));
    });
  }

  function renderJobDetails(job) {
    const sections = Array.isArray(job.sections) && job.sections.length
      ? job.sections
      : [{ title: 'Detalhes da vaga', items: job.details || [] }];

    return sections.map((section) => {
      const items = (section.items || []).map((item) => `<li>${escapeHTML(item)}</li>`).join('');
      if (!items) return '';
      return `<div class="job-more-section"><strong>${escapeHTML(section.title)}</strong><ul>${items}</ul></div>`;
    }).join('');
  }

  function createJobCard(job) {
    const highlights = (job.highlights || []).slice(0, 4).map((item) => `<li>${escapeHTML(item)}</li>`).join('');
    const details = renderJobDetails(job);
    const schedule = job.schedule ? `<span>🕒 ${escapeHTML(job.schedule)}</span>` : '';
    const featured = job.featured ? ' job-featured' : '';
    const aria = `Detalhes da vaga ${job.title}`;

    return `
      <article class="job-card${featured} reveal in-view" data-category="${escapeHTML(job.category)}">
        <div class="job-card-head">
          <span class="job-badge">${escapeHTML(job.badge)}</span>
          <h3>${escapeHTML(job.title)}</h3>
          <div class="job-location">📍 ${escapeHTML(job.location)}</div>
        </div>
        <div class="job-card-body">
          <p>${escapeHTML(job.summary)}</p>
          <div class="job-meta">
            <span>💼 ${escapeHTML(job.contract)}</span>
            <span>💰 ${escapeHTML(job.pay)}</span>
            ${schedule}
          </div>
          <ul class="job-list">${highlights}</ul>
          ${details ? `<details class="job-more"><summary aria-label="${escapeHTML(aria)}">Ver mais detalhes</summary>${details}</details>` : ''}
          <button class="btn btn-primary btn-full js-open-job" type="button" data-job-id="${escapeHTML(job.id)}">Tenho interesse</button>
        </div>
      </article>
    `;
  }

  function renderJobs(filter = 'todas') {
    const grid = $('#jobsGrid');
    if (!grid) return;

    const list = filter === 'todas' ? JOBS : JOBS.filter((job) => job.category === filter);
    grid.innerHTML = list.map(createJobCard).join('');

    $$('.js-open-job', grid).forEach((button) => {
      button.addEventListener('click', () => openJobModal(button.dataset.jobId));
    });
  }

  function setupJobFilters() {
    $$('.job-filter').forEach((button) => {
      button.addEventListener('click', () => {
        $$('.job-filter').forEach((btn) => btn.classList.remove('is-active'));
        button.classList.add('is-active');
        renderJobs(button.dataset.filter || 'todas');
      });
    });
  }

  function getJobById(id) {
    return JOBS.find((job) => job.id === id);
  }

  function openJobModal(jobId) {
    const modal = $('#jobModal');
    const form = $('#jobForm');
    const title = $('#modalTitle');
    const subtitle = $('#modalSubtitle');
    const job = getJobById(jobId);
    if (!modal || !form || !job) return;

    form.reset();
    form.elements.jobId.value = job.id;
    title.textContent = `Tenho interesse: ${job.title}`;
    subtitle.textContent = `${job.location} • ${job.pay}`;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => form.elements.nome?.focus(), 50);
  }

  function closeJobModal() {
    const modal = $('#jobModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function buildJobMessage(job, data) {
    return [
      `Olá, Mariana. Vim pelo site da RH IMOB e tenho interesse na vaga: ${job.title}.`,
      '',
      `Vaga: ${job.title}`,
      `Local: ${job.location}`,
      `Modalidade/Condição: ${job.contract}`,
      `Remuneração: ${job.pay}`,
      '',
      'Meus dados:',
      `Nome: ${data.nome}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade/Bairro: ${data.cidade}`,
      `Experiência: ${data.experiencia}`,
      `Disponibilidade: ${data.disponibilidade}`,
      `Mensagem: ${data.mensagem || 'Não informado'}`,
      '',
      'Pode me orientar sobre os próximos passos?'
    ].join('\n');
  }

  function setupJobModal() {
    const modal = $('#jobModal');
    const form = $('#jobForm');
    if (!modal || !form) return;

    formatPhoneField(form.elements.whatsapp);

    $$('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closeJobModal);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        closeJobModal();
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const job = getJobById(form.elements.jobId.value);
      if (!job) return;

      const data = {
        nome: normalize(form.elements.nome?.value),
        whatsapp: normalize(form.elements.whatsapp?.value),
        cidade: normalize(form.elements.cidade?.value),
        experiencia: normalize(form.elements.experiencia?.value),
        disponibilidade: normalize(form.elements.disponibilidade?.value),
        mensagem: normalize(form.elements.mensagem?.value)
      };

      const required = ['nome', 'whatsapp', 'cidade', 'experiencia', 'disponibilidade'];
      const missing = required.filter((field) => !data[field]);
      if (missing.length) {
        form.elements[missing[0]]?.focus();
        alert('Preencha os campos obrigatórios para enviar seu interesse.');
        return;
      }

      openWhatsApp(VAGAS_WHATSAPP, buildJobMessage(job, data));
    });
  }

  function openTalentModal() {
    const modal = $('#talentModal');
    const form = $('#talentForm');
    if (!modal || !form) return;
    form.reset();
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => form.elements.nome?.focus(), 50);
  }

  function closeTalentModal() {
    const modal = $('#talentModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function buildTalentMessage(data) {
    return [
      'Olá, Mariana. Vim pelo site da RH IMOB e quero entrar no Banco Confidencial de Talentos Imobiliários.',
      '',
      'Meu perfil:',
      `Nome: ${data.nome}`,
      `WhatsApp: ${data.whatsapp}`,
      `Cidade/região onde atuo: ${data.regiao}`,
      `CRECI: ${data.creci || 'Não informado'}`,
      `Função atual: ${data.funcao}`,
      `Tempo de experiência: ${data.experiencia}`,
      `Empresa atual/último vínculo: ${data.empresaAtual || 'Prefiro informar em conversa'}`,
      `O que me faria avaliar proposta: ${data.interesse}`,
      `Observações: ${data.observacoes || 'Não informado'}`,
      '',
      'Tenho interesse em receber propostas de imobiliárias/incorporadoras parceiras, com contato discreto e confidencial.'
    ].join('\n');
  }

  function setupTalentModal() {
    const openButton = $('#openTalentModal');
    const form = $('#talentForm');
    const modal = $('#talentModal');
    if (!modal || !form) return;

    formatPhoneField(form.elements.whatsapp);

    if (openButton) {
      openButton.addEventListener('click', openTalentModal);
    }

    $$('[data-close-talent-modal]').forEach((el) => {
      el.addEventListener('click', closeTalentModal);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        closeTalentModal();
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = {
        nome: normalize(form.elements.nome?.value),
        whatsapp: normalize(form.elements.whatsapp?.value),
        regiao: normalize(form.elements.regiao?.value),
        creci: normalize(form.elements.creci?.value),
        funcao: normalize(form.elements.funcao?.value),
        experiencia: normalize(form.elements.experiencia?.value),
        empresaAtual: normalize(form.elements.empresaAtual?.value),
        interesse: normalize(form.elements.interesse?.value),
        observacoes: normalize(form.elements.observacoes?.value)
      };

      const required = ['nome', 'whatsapp', 'regiao', 'funcao', 'experiencia', 'interesse'];
      const missing = required.filter((field) => !data[field]);
      if (missing.length) {
        form.elements[missing[0]]?.focus();
        alert('Preencha os campos obrigatórios para enviar seu perfil.');
        return;
      }

      openWhatsApp(VAGAS_WHATSAPP, buildTalentMessage(data));
    });
  }

  function setupFooterYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupMenu();
    setupReveal();
    setupWhatsAppLinks();
    setupCompanyForm();
    setupJobFilters();
    setupJobModal();
    setupTalentModal();
    setupFooterYear();
    hydratePublicMetrics();
    initJobs();
  });
})();
