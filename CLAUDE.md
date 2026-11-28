# RH IMOB — site + API (rhimob.com.br)

Site público e API serverless da RH IMOB (recrutamento imobiliário). HTML estático
+ funções Vercel (`api/*.js`) + Supabase. Captação de leads, "Perto de mim",
"Mercado por região", admin, páginas de corretor/vaga. Repositório **privado**:
`Fkvetik/rh_imob_sucesso`. Deploy na Vercel (projeto **rh-imob-sucesso**,
`prj_agk8d2YJQnS8ocBQs1KwOthiKdFy`, domínio `www.rhimob.com.br`).

## Supabase (3 projetos — NUNCA confundir)
- **COLETOR** `lrejfhsomfxyaoshmpzz` — parceiros/leads do coletor, "Perto de mim".
- **RHI** `tnzmxpoxvdlckmjwdala` — Corretores CRECI (`leads`, `leads_publicos`) e
  Mercado Maps (`rhi_mercado_*`).
- **NT** `pufxvskozfdvfscqnays` — Novos Talentos.
- Configs em `api/_ext-comum.js`. Chaves de serviço só em **env do Vercel**:
  `SUPABASE_SERVICE_KEY` (NT), `RHI_SUPABASE_SERVICE_KEY` (RHI),
  `MERCADO_INGEST_SECRET` (segredo do ingest do Maps).
- **Rodar SQL só no projeto certo.** RHI → `tnzmxpoxvdlckmjwdala`. NUNCA no
  `mercado-guaruja`. SQL fica em `sql/` e `_sql/`.

## Endpoints-chave (`api/`)
- `perto.js` — "Perto de mim": **só contagem**, nenhum dado de pessoa sai.
- `mercado-ingest.js` — planilha do Maps → banco. Protegido por `MERCADO_INGEST_SECRET`.
  **Só ramo imobiliário entra** (filtro por nome/categoria). Telefone é interno.
- `ext-*.js` — operações server-side da extensão (service key fica aqui, não na extensão).
- `ext-classificar.js` — **classifica a resposta do candidato** (bolha do WhatsApp) na
  intenção/chip certo. Protegido por `validarSessao` (token do operador). Híbrido:
  regras grátis para o óbvio (quando os chips vêm com `tipo`:
  interesse/sem_interesse/duvida/adiar/parar), Haiku só no ambíguo. POST
  `{token, mensagem, contexto?, opcoes:[{id,label,exemplos?,tipo?}]}` →
  `{ok, opcao, confianca, fonte:'regra'|'ia', motivo}`. **Não envia nada** — só interpreta;
  o envio do chip é a extensão (recomendado: só sugerir / gate de confiança, não auto-total).
- `vaga.js`, `mercado-corretores.js`, `admin-*` etc.

## Pipeline Mercado por região (Maps → banco)
Planilha **MAPS IMOBILIÁRIAS** (Apps Script) → `POST /api/mercado-ingest` (segredo)
→ `rhi_mercado_maps` (RHI). CENTRAL grava parcial, COLETA completa (upsert por
`place_key`; coordenada vem do token `!3d<lat>!4d<lng>` da placeUrl). Backfill
diário no GAS (`mercadoBackfillDiario`, ~3h). **Coordenadas:** vêm do token
`!3d<lat>!4d<lng>` da placeUrl; o GAS não envia lat/lng, então `MERCADO_MAPS_3_coords.sql`
(trigger + backfill) extrai da placeUrl — **sem isso `rhi_mercado_perto` conta 0**.
`/api/perto` chama `rhi_mercado_perto` (RHI, anon) e devolve `mercado.imobiliarias`;
a página `/perto-de-mim` mostra essa contagem no card de imobiliárias (cai pra Rede se null).
Operador também acessa via a extensão (flag do CRECI).

## Oferta / produtos (fontes = `plataformas.html` e `extensao-recrutadora.html`)
**Modelo:** o cliente pode operar a captação por conta (banco manual, a entrada barata) OU
com a extensão (automatizada, o passo de escala), OU deixar a RH IMOB fazer tudo (operação).
Não inventar nem contradizer os preços dessas páginas.
- **Banco manual = a entrada (o cliente filtra e aborda na mão):**
  - **Corretor com CRECI** (banco CRECI ativo, ~80 mil em 19 cidades) → `/corretores`.
    Por volume: **R$ 499** (500) · **R$ 999** (1.000) · **R$ 1.499** (ilimitado).
  - **Novos Talentos** (início de carreira, ~90 mil em 180+ cidades) → `/novos-talentos`.
    **R$ 249/mês** se já assina a Catho · **R$ 649/mês** acesso completo.
- **Extensão RH IMOB Aceleradora** (Chrome) = **a operação automatizada, integrada ao banco**
  (NÃO à Catho). Capta e aborda sozinha (Instagram, site do CRECI, outras), WhatsApp + CRM,
  **não para**: 2 operadores ≈ 5–6 pessoas abordando na mão. **2 acessos** e **bases inclusas**.
  Preço: **R$ 999/mês** · semestral R$ 899/mês · anual R$ 799/mês. Página `/extensao-recrutadora`.
  Store: `chromewebstore.google.com/detail/fkcpnophipbcicdbadekbhogihfkplmb`.
  (Catho: quem tem Catho mexe no link/filtro/atualiza; quem não tem, a RH IMOB põe um link e
  deixa rodando o mês — nuance operacional interna, não precisa ir pro chat.)
- **Operação completa (RH IMOB gerencia, SP):** geração + abordagem + triagem + entrega em
  entrevista, ~5 contratações/mês, setup 7 dias. **R$ 1.999/mês** se a empresa já tem
  assistente pro retorno · **R$ 3.499/mês** com assistente dedicada + headhunter.
- Contato comercial (Mariana): WhatsApp **5511978725515** (`EMPRESA_WHATSAPP`).
- Páginas: `/plataformas`, `/extensao-recrutadora`, `/apresentacao-rh-imob`, `/vagas`, `/incorporadoras`.
- Prints da extensão existem (`assets/extensao-*.jpg/png`) mas **não** entram no chat.

## Parceria de Vagas — R$ 99/mês (EM CONSTRUÇÃO, ainda não publicado)
**Problema que resolve:** muitos leads que entram pelos sites de geração (vagas,
construtoras, incorporadoras espalhadas) não querem pagar R$ 999 (extensão) nem
R$ 3.500 (operação) e **saem do funil sem gerar receita**. A Parceria de Vagas é o
degrau **mais barato** pra reter esse lead — sem competir com o funil de contratação.

**Como funciona (modelo de negócio):**
- Empresa com vaga paga **R$ 99/mês** e tem a vaga dela **anunciada junto** nos sites
  de vaga da RH IMOB (ex.: `/vagas`, `/vaga/:slug`), como já é feito hoje.
- A RH IMOB **aborda os corretores** que consegue no mês levando esse site (é o que já
  faz com a extensão/operação).
- **100% dos R$ 99 vira tráfego pago** levando pro site, **num dia fixo escolhido do
  mês** (ex.: dia 29/30). **Nada fica com a RH IMOB** — sem participação; tudo volta
  pra gerar resultado pro parceiro. Isso é o argumento central da apresentação.
- O parceiro tem **acesso aos painéis de abordagem** (os mesmos da extensão) e aos
  **Agendamentos / Visão geral** pra acompanhar o que está acontecendo.

**Regra de ouro:** **não pode canibalizar o lead de contratação** da RH IMOB. A
construção/empresa que entra aqui é pra CONTRATAR corretor (é cliente da vaga), não é
o corretor-lead. Separar bem na UI e no funil.

**O que já existe pra reaproveitar (não reinventar):**
- Página `/vagas` (estática, SEO) + vaga individual SSR em `api/vaga.js` (lê
  `site_vagas_publicas`, projeto NT, `status=ATIVA`, por `vaga_id`/slug) + `admin-vagas.html`.
- Páginas de parceiro: `recrutamento-para-construtoras.html`,
  `recrutamento-para-incorporadoras.html`, `rede-de-parceiros.html`, `parceiro.html`.

**Entregáveis a construir (a combinar com o Fernando antes de codar):**
1. **Página de apresentação da parceria** (pra ele apresentar a quem convida): deixa
   claro R$ 99/mês, 100% em tráfego pago, zero participação da RH IMOB, o que o parceiro
   recebe (vaga nos sites + abordagem mensal + acesso a painéis/agendamentos/visão geral).
2. **Organizar o `/vagas`** pra comportar as vagas de parceiros com imagens, bonito, sem
   afetar o funil de contratação da RH IMOB.
3. **Fluxo de entrada do parceiro** (como paga os R$ 99, como a vaga é publicada —
   self-service via `admin-vagas`/`parceiro.html` ou RH IMOB publica), **a definir**.
4. **Acesso do parceiro** aos painéis de abordagem + Agendamentos/Visão geral — reaproveitar
   o que a extensão/admin já têm, com um login/escopo próprio de "parceiro de vaga".

**Decisões em aberto (perguntar antes de construir):** dia fixo do tráfego pago;
cobrança dos R$ 99 (manual/Pix/assinatura); parceiro publica a própria vaga ou a RH IMOB
publica; qual exatamente o escopo de acesso do parceiro aos painéis.

## Disparo de e-mail — Banco de Novos Talentos (EM CONSTRUÇÃO)
Ferramenta pra a empresa mandar e-mail de abordagem aos talentos do banco NT (que
**disponibilizaram o próprio e-mail** pra contato — base de consentimento). Volume
**100–200/dia** por empresa, **saindo do Gmail da própria empresa** via **Gmail API
(OAuth)** — conecta a conta uma vez, não precisa ficar com o Gmail aberto; cabe no
limite do Gmail. Envio **server-side** (função Vercel, token no servidor), com
**fila/ritmo** e **descadastro (opt-out) obrigatório** em todo e-mail.

**Fase 1 (FEITA, só UI):** `email-talentos.html` (`/email-talentos`, noindex) — painel
de composição: assunto + editor de texto rico (negrito/itálico/lista/link), **anexo
PDF/foto** (≤10 MB, só UI ainda), **placeholders** `{nome} {cidade} {cargo} {saudacao}
{empresa} {remetente}`, e **prévia** com template de e-mail profissional + dados de
exemplo + rodapé de descadastro. Ainda **não envia nem lê o banco**.

**Acesso (FEITO no admin):** logou na extensão → pode usar a ferramenta, MAS só quando
o admin **libera a conta** no painel Operadores (botão `📧 E-mail: liberado/não`) e define
o **limite/dia** (botão `✏️ N/dia`, padrão **100**). Mesmo padrão do acesso Catho. Backend:
SQL `EMAIL_1_acesso_por_login.sql` (repo da extensão, roda no COLETOR) — colunas
`usuarios.email_acesso` (default false) + `email_limite_dia` (default 100) e a RPC
`rpc_admin_email_acesso(senha, login, ligar, limite)`. O botão no admin só aparece depois
que o SQL roda (`EMAIL_ACESSO` null = esconde).

**Próximas fases (a fazer):**
- Fase 2: **seleção dos talentos** do banco NT (filtro cidade/cargo) via endpoint
  protegido (valida o token de sessão da extensão + `email_acesso`; e-mails são PII —
  nunca expor lista no cliente). O envio confere o `email_limite_dia` vs enviados no dia.
- Fase 3: **conectar Gmail (OAuth)** + envio server-side com personalização dos
  placeholders, anexos (MIME), ritmo e registro de opt-out.
- LGPD: link de descadastro real + tabela de quem saiu (nunca reenviar).

## Consultora IA (`/ia-recrutamento`)
Chatbot **guiado** (vanilla JS, sem LLM) em `ia-recrutamento.html` que qualifica o lead B2B,
registra **automaticamente** no painel ao concluir (POST client-side em **NT** `site_leads`,
config `RHIMOB_NOVOS_TALENTOS_SUPABASE_CONFIG`) e oferece só **"Enviar no WhatsApp"**.
`CONV_ID` único por conversa (painel agrupa pelo prefixo antes do `#`). Perguntas digitadas
em campo livre são respondidas e re-perguntadas (`pergunta_`/`responderDuvida_`), não gravadas
como dado. Estagiário é recusado. `fmt()` suporta **`[texto](url)`** e `**negrito**` (sem
imagens). **Campo de texto sempre aberto** (inclusive nas etapas de botão): `setChips`
aceita digitação — casa o texto com um botão (atalho) ou manda pro `responderLivre_`.
`responderLivre_(t,cb)` é o **cérebro de intenções** (regex sobre texto normalizado sem
acento, `norm_`): preço banco/extensão/operação, "é caro", garantia, prazo/setup, fontes,
banco×extensão, como a extensão funciona, CLT/PJ, rotatividade, cidades, CRECI, estagiário,
fidelidade, pagamento, corretor×NT, falar com humano, LGPD, quem é a RH IMOB, volume,
saudação, e — quando foge do roteiro — o **LLM** (ver abaixo). **Híbrido LLM:** o fallback
do `responderLivre_` chama `perguntarIA_` → `POST /api/ia-chat` (função serverless) que fala
com o **Claude Haiku 5.5** usando `process.env.ANTHROPIC_API_KEY` (só no servidor, env na
Vercel; nunca no cliente). O `SYSTEM` em `api/ia-chat.js` carrega os preços/regras do negócio
e proíbe inventar valores. Respostas conhecidas continuam locais (grátis/instantâneas); só as
perguntas fora do roteiro gastam API (centavos). Falha de rede/key → `FALLBACK_IA` estático.
**Dois princípios (não quebrar):** (1) **continuidade** — ao responder algo digitado numa
etapa de botão, a IA **retoma a pergunta pendente** (`setChips` guarda `perguntaAtual` e a
reemite, salvo se a resposta já terminar com "?"), pra conversa nunca "morrer"; (2) **preço
só com contexto** — `respostaPreco` sem `lead.cargo` dá a **visão geral** (249 banco / 999
extensão / 1.999–3.499 operação) e conduz pra coletar, **nunca** chuta "Pra , ~70%".

**Fluxo:** região → cargo → quantidade → **(corretor/novos talentos) fork de caminho**
→ [**Operação completa**: remuneração→benefícios→jornada→estrutura(tem assistente/RH pro
retorno?)→urgência→objeção] ou [**Ferramentas** (`ferramentas`): enquadra **banco manual
(entrada) × extensão (escala)** → `menuFerramentas` → `planoExtensao` / `bancosManuais`
(`planoCorretores`/`planoNT`) / `comoFunciona`; toda tela tem saída `paraOperacao` pra
voltar ao atendimento → escolhe → urgência] → contato → registra.
Gerente/SDR/outro pulam o fork (banco/extensão não localizam esses perfis) e seguem na operação.
`objecao()` tem atalho "Conhecer as plataformas" (`verPlataformas`).

**Preços na IA (sintetizados das páginas acima; nunca "depende"):**
- Corretor/novos talentos **em SP, operação completa:** tem assistente/RH pro retorno →
  **R$ 1.999**; sem estrutura → **R$ 3.499** (assistente dedicada + headhunter).
- **Ferramentas (qualquer região):** banco manual (NT R$ 249/649, Corretor CRECI a partir de
  R$ 499) **×** extensão automatizada **R$ 999/mês** (899 semestral / 799 anual, 2 acessos,
  bases inclusas). Pitch sutil: banco = entrada enxuta; extensão = sustentabilidade/escala.
- **Fora de SP:** operação com equipe não atende → caminho é banco + extensão.
- **6+/mês:** dimensionado por **operadora dedicada** (R$ 3.500/mês cada, com ferramentas/acessos):
  6–10 → 2 op → **R$ 7.000**; 11–20 → 3+ op → **a partir de ~R$ 10.500**; 20+ → setor dedicado
  (operação grande). **25% de desconto** pra quem vem pela plataforma / operação grande. A IA
  pergunta a faixa (`faixa6`: 6–10 / 11–20 / 20+) pra dar número concreto.
- **Gerente/SDR:** a partir de R$ 1.500. **Outros:** ~salário (até 70%).
- Objeção "e se não der certo": a entrega é levar o profissional com aderência à reunião;
  conversão depende da proposta da empresa. Sem "contratação garantida" (CLT = reposição).

**Agendamento de reunião (Google Meet):** ao concluir, a IA oferece agendar (`ofertarReuniao`
→ `escolherHorario` → `confirmarReuniao`). Slots = **dia seguinte, 10h ou 14h, seg–sex**,
com **regra das 24h** (slot só aparece se faltar ≥24h; `proximosSlots_`). Link fixo
`MEET_LINK` = https://meet.google.com/pba-myme-aus (mesma sala). O horário escolhido vai pro
painel (campo `mensagem`, "Reunião: …") e pro texto do WhatsApp. A criação do evento real no
calendário é manual pela equipe (o chat não tem backend de calendário).

**Medição (GA G-NSJD4F675L):** `track(ev,params)` dispara eventos no funil — `ia_inicio`,
`ia_regiao`, `ia_cargo`, `ia_caminho`, `ia_contato_inicio`, `ia_lead_registrado`,
`ia_reuniao`, `ia_whatsapp`, e no campo livre `ia_pergunta_livre` (param `q` = pergunta
truncada), `ia_llm_ok` / `ia_llm_fallback`. Ver em GA → Relatórios → Eventos (ou DebugView).
Use `ia_pergunta_livre` pra achar perguntas recorrentes e migrá-las pro roteiro local (grátis).

Home (`index.html`) linka a Consultora IA no nav e no hero. O card da extensão na home
confirma o preço escalonado (999/899/799) — **não** é divergência.

## Regras invioláveis
- **Nunca** expor telefone coletado publicamente. "Perto de mim" = contagem.
- Dados do Maps = **prospecção · CRECI não verificado** (rotular na UI).
- **Commit + push a cada mudança.** Push em `main` → **deploy automático** na Vercel.
  Mudança de **env var** precisa de **redeploy manual** (a variável só vale em build novo).
- Chave de serviço **só** no servidor (env do Vercel), nunca no HTML/JS do cliente.

## Sync de Corretores CRECI (GAS, projeto à parte)
`dev/scripts` (no repo da extensão): lê abas "ativos" + "telefone" por cidade e faz
**upsert por CRECI** em `leads`/`leads_publicos` (RHI). O upsert **sobrescreve** o
telefone. Limpeza pontual de telefones de SP sem substituto:
`GAS_SP_limpar_telefones.gs` (`ressincronizarSPZerado`). Gatilho diário continua
sendo só o sync normal (não a limpeza).

## Triagem de interesse por IA (Agente A — em construção, NÃO publicado)
Classifica a resposta do candidato no WhatsApp como `positivo` / `negativo` /
`neutro` / `parar`. Modelo **Claude Haiku 5.5** (`claude-haiku-5-5`), barato
(~fração de centavo por resposta). Spec completa (Agente A + SDR Agente B,
guardrails, rollout em 3 fases) em
`../rh-imob-aceleradora/dev/AGENTES_IA_spec.md`.

Arquivos já criados (sintaxe validada, ainda SEM commit/deploy):
- `api/ia-triagem.js` — Vercel Function. `POST /api/ia-triagem` com header
  `x-ia-token: <IA_TRIAGEM_SECRET>` (ou `?token=`), body `{texto, contexto?}`.
  Retorna `{ok, interesse, confianca, motivo, uso:{input,output}}`. Só lê e
  rotula — **não envia nada ao lead**.
- `scripts/ia_triagem_teste.mjs` — teste local (Passo 2 / calibração). Compara
  o rótulo da IA com o que o operador marcou e mostra acerto% + custo real.
- `scripts/ia_triagem_exemplos.csv` — exemplos `texto,esperado` pra calibrar.

⚠️ O `SYSTEM_PROMPT` é **idêntico** em `api/ia-triagem.js` e no teste `.mjs` —
mudou num, muda no outro.

Env vars (só na Vercel, nunca no código/GitHub):
- `ANTHROPIC_API_KEY` — chave da conta Anthropic.
- `IA_TRIAGEM_SECRET` — senha simples que libera o endpoint.

Fluxo pra retomar quando for ativar:
1. **Passo 2 (calibrar, local, sem deploy):** criar chave Anthropic com limite
   de gasto baixo → `$env:ANTHROPIC_API_KEY = "sk-ant-..."` → preencher 20-40
   respostas reais no CSV → `node scripts/ia_triagem_teste.mjs scripts/ia_triagem_exemplos.csv`
   → ajustar o `SYSTEM_PROMPT` até o acerto ficar bom.
2. **Passo 3 (publicar):** pôr as 2 env vars na Vercel → commit + push (deploy).
3. **Passo 4 (mostrar no painel):** a extensão chama o endpoint e exibe a
   etiqueta de interesse pro operador (modo sugestão, 1 clique).

Acesso por operador: será uma flag por operação (nem todo operador vai querer
pagar). Quando a flag está ligada, o painel chama o endpoint; desligada, nada
é cobrado.

## Convenções
- Mensagens de commit terminam com:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- CSS com tokens em `:root`; páginas compartilháveis têm widget de compartilhar + "Baixar arte".

## Identidade visual & Instagram (@rh_imob)
Marca **RH IMOB** — recrutamento + tecnologia para o mercado imobiliário. Atuar
como **especialista de social/branding**, não só despejar vaga.

**Cores (sempre usar):** roxo escuro `#2b124d` (fundo), roxo vibrante/neon
`#5a1fd4`/`#a855f7` (glow), laranja `#ff7a1a` (destaque/CTA). Fundo escuro com
brilho neon roxo + acentos laranja. Branco para texto.

**Logo:** círculo neon "RH IMOB" (casinha laranja, anel roxo/azul brilhante).
No site: `/assets/rhimob-logo.jpg`. O usuário tem uma versão neon nova.

**Padrão de arte do feed (observado no perfil):** fundo roxo escuro com prédios/
torres à noite (janelas acesas) e, nas vagas, foto de corretor(a) profissional à
direita; headline condensada em branco com palavra-chave em laranja; logo RH IMOB
no topo; lista de benefícios com ícones; CTA forte (WhatsApp, `@rh_imob`,
"link na bio"). Formato retrato 1080x1350 (4:5). Parceiros aparecem com marca
própria (EMCCAMP, Engelux, Direcional, Cury, Pacheco).

**Pilares de conteúdo (mix ~70% valor / 30% vaga):**
1. **Educativo/valor** (alto alcance e salvamento): "quanto ganha", "como tirar o
   CRECI", "erros de quem quer ser corretor", dados do mercado de SP.
2. **Prova social**: depoimentos de corretores colocados pela RH IMOB.
3. **Vaga**: anúncios por empresa/região (levam ao WhatsApp do responsável).
4. **Bastidores/autoridade**: a operação, a tecnologia (extensão), resultados.

**Legendas:** abrir com gancho + emoji; bullets com ✅; CTA claro ("link na bio",
WhatsApp); 8–10 hashtags (#corretordeimoveis #mercadoimobiliario #vagascorretor
#saopaulo #creci #rhimob …). Tom profissional, aspiracional, direto.

**Pipeline de publicação (montado):** arte no **Canva** (connector `create-design`
→ `export-design` png → download → `postiz upload` → `postiz posts:create`) →
publica/agenda no **Postiz** (CLI, já autenticado) no @rh_imob. Integração IG id
`cmwzmsxdt04ywpl07t5hmbrry`. Regra: se arte feita por IA, perguntar sobre
`made_with_ai` (infográfico normalmente NÃO marca). Quando o pedido é "não
depender de mim", entregar artes PRONTAS (nada de placeholders tipo modelo de
depoimento com [NOME]/FOTO). Página "link na bio": `/ferramentas`.
