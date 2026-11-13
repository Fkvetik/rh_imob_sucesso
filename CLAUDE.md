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
- `vaga.js`, `mercado-corretores.js`, `admin-*` etc.

## Pipeline Mercado por região (Maps → banco)
Planilha **MAPS IMOBILIÁRIAS** (Apps Script) → `POST /api/mercado-ingest` (segredo)
→ `rhi_mercado_maps` (RHI). CENTRAL grava parcial, COLETA completa (upsert por
`place_key`; coordenada vem do token `!3d<lat>!4d<lng>` da placeUrl). Backfill
diário no GAS (`mercadoBackfillDiario`, ~3h). "Perto de mim" lê só contagem
(`rhi_mercado_perto`). Operador acessa via a extensão (flag do CRECI).

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
- **6+/mês:** sob medida. **Gerente/SDR:** a partir de R$ 1.500. **Outros:** ~salário (até 70%).
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

## Convenções
- Mensagens de commit terminam com:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- CSS com tokens em `:root`; páginas compartilháveis têm widget de compartilhar + "Baixar arte".
