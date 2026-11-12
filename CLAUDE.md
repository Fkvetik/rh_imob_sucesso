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
