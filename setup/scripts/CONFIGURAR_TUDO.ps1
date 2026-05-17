# ============================================================
# CONFIGURAR_TUDO.ps1 — RH IMOB CRM Setup Automatico
# ============================================================
param([string]$ConfigFile)

# ── Helpers de UI ────────────────────────────────────────────
function Write-Step([string]$n,[string]$msg){
    Write-Host "`n  [$n] " -NoNewline -ForegroundColor Cyan
    Write-Host $msg -ForegroundColor White
}
function Write-OK([string]$msg){
    Write-Host "      OK  $msg" -ForegroundColor Green
}
function Write-WARN([string]$msg){
    Write-Host "    AVISO  $msg" -ForegroundColor Yellow
}
function Write-ERRO([string]$msg){
    Write-Host "    ERRO   $msg" -ForegroundColor Red
}
function Write-INFO([string]$msg){
    Write-Host "           $msg" -ForegroundColor DarkGray
}
function Write-Banner([string]$msg){
    $line = "=" * ($msg.Length + 4)
    Write-Host "`n  $line" -ForegroundColor DarkCyan
    Write-Host "  | $msg |" -ForegroundColor Cyan
    Write-Host "  $line`n" -ForegroundColor DarkCyan
}

# ── Lê config.ini ────────────────────────────────────────────
function Read-Config([string]$path){
    $cfg = @{}
    if(-not (Test-Path $path)){
        Write-ERRO "Arquivo de configuracao nao encontrado: $path"
        exit 1
    }
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if($line -match '^[^#].*='){
            $parts = $line -split '=',2
            $cfg[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
    return $cfg
}

function Assert-Config([hashtable]$cfg,[string]$key,[string]$label){
    $val = $cfg[$key]
    if(-not $val -or $val -like '<*>'){
        Write-ERRO "$label nao preenchido no MINHAS_CONFIGURACOES.ini"
        Write-INFO "Abra o arquivo e preencha: $key"
        return $false
    }
    return $true
}

# ── Carrega configuracoes ─────────────────────────────────────
Write-Banner "RH IMOB CRM — Configuracao de Producao"
$cfg = Read-Config $ConfigFile

$erros = 0
foreach($par in @(
    @('VERCEL_TOKEN','Token do Vercel'),
    @('VERCEL_PROJECT_ID','Project ID do Vercel'),
    @('CRM_SUPABASE_SERVICE_ROLE_KEY','Service Role Key do Supabase'),
    @('CRM_PANEL_TOKEN','Senha do painel CRM')
)){
    if(-not (Assert-Config $cfg $par[0] $par[1])){ $erros++ }
}
if($erros -gt 0){
    Write-Host "`n  Corrija os campos acima no MINHAS_CONFIGURACOES.ini e rode novamente.`n" -ForegroundColor Red
    Read-Host "  Pressione Enter para fechar"
    exit 1
}

$VERCEL_TOKEN  = $cfg['VERCEL_TOKEN']
$PROJECT_ID    = $cfg['VERCEL_PROJECT_ID']
$PANEL_TOKEN   = $cfg['CRM_PANEL_TOKEN']
$SB_URL        = $cfg['CRM_SUPABASE_URL']
$SB_KEY        = $cfg['CRM_SUPABASE_SERVICE_ROLE_KEY']
$SB_MGMT_TOKEN = $cfg['SUPABASE_ACCESS_TOKEN']
$WEBAPP_URL    = $cfg['APPS_SCRIPT_WEBAPP_URL']
$ZAPI_CT       = $cfg['ZAPI_CLIENT_TOKEN']
$ZAPI_INST_NT  = $cfg['ZAPI_INSTANCE_NT']
$ZAPI_TOK_NT   = $cfg['ZAPI_TOKEN_NT']
$ZAPI_INST_CR  = $cfg['ZAPI_INSTANCE_CRECI']
$ZAPI_TOK_CR   = $cfg['ZAPI_TOKEN_CRECI']

# Extrai project ref do Supabase da URL
$SB_REF = ($SB_URL -replace 'https://','') -replace '\.supabase\.co.*',''


# ══════════════════════════════════════════════════════════════
# PASSO 1 — Variaveis de ambiente no Vercel
# ══════════════════════════════════════════════════════════════
Write-Step "1/5" "Configurando variaveis de ambiente no Vercel..."

$vercelHeaders = @{
    'Authorization' = "Bearer $VERCEL_TOKEN"
    'Content-Type'  = 'application/json'
}

$envVars = @(
    @{ key='CRM_SUPABASE_URL';              value=$SB_URL;       type='encrypted' },
    @{ key='CRM_SUPABASE_SERVICE_ROLE_KEY'; value=$SB_KEY;       type='sensitive' },
    @{ key='CRM_PANEL_TOKEN';               value=$PANEL_TOKEN;  type='sensitive' },
    @{ key='CRM_LOCAL_BYPASS';              value='NAO';         type='plain' }
)

$targets = @('production','preview','development')
$okCount = 0

foreach($env in $envVars){
    $body = @{
        key    = $env.key
        value  = $env.value
        type   = $env.type
        target = $targets
    } | ConvertTo-Json

    try{
        # Tenta criar; se 409 (already exists), faz PATCH para atualizar
        $resp = Invoke-RestMethod `
            -Uri "https://api.vercel.com/v10/projects/$PROJECT_ID/env" `
            -Method POST `
            -Headers $vercelHeaders `
            -Body $body `
            -ErrorAction Stop
        Write-OK "$($env.key) criada"
        $okCount++
    }catch{
        $code = $_.Exception.Response.StatusCode.value__
        if($code -eq 409){
            # Variavel ja existe — busca o ID e atualiza
            try{
                $existing = Invoke-RestMethod `
                    -Uri "https://api.vercel.com/v10/projects/$PROJECT_ID/env" `
                    -Method GET `
                    -Headers $vercelHeaders `
                    -ErrorAction Stop
                $envObj = $existing.envs | Where-Object { $_.key -eq $env.key } | Select-Object -First 1
                if($envObj){
                    Invoke-RestMethod `
                        -Uri "https://api.vercel.com/v10/projects/$PROJECT_ID/env/$($envObj.id)" `
                        -Method PATCH `
                        -Headers $vercelHeaders `
                        -Body $body `
                        -ErrorAction Stop | Out-Null
                    Write-OK "$($env.key) atualizada"
                    $okCount++
                }
            }catch{ Write-WARN "$($env.key) — nao foi possivel atualizar: $($_.Exception.Message)" }
        }else{
            Write-WARN "$($env.key) — $($_.Exception.Message)"
        }
    }
}

if($okCount -eq $envVars.Count){
    Write-OK "Todas as $okCount variaveis configuradas no Vercel"
}

# ── Redeploy automatico ──────────────────────────────────────
Write-INFO "Acionando redeploy no Vercel..."
try{
    $deploys = Invoke-RestMethod `
        -Uri "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&limit=1" `
        -Method GET -Headers $vercelHeaders -ErrorAction Stop
    $lastDeploy = $deploys.deployments[0]
    if($lastDeploy){
        $redeployBody = @{ deploymentId=$lastDeploy.uid; name=$lastDeploy.name } | ConvertTo-Json
        Invoke-RestMethod `
            -Uri "https://api.vercel.com/v13/deployments" `
            -Method POST -Headers $vercelHeaders -Body $redeployBody -ErrorAction Stop | Out-Null
        Write-OK "Redeploy acionado (aguarde ~1 min para o site atualizar)"
    }
}catch{ Write-WARN "Redeploy manual: Vercel → Deployments → botao ... → Redeploy" }


# ══════════════════════════════════════════════════════════════
# PASSO 2 — SQL no Supabase
# ══════════════════════════════════════════════════════════════
Write-Step "2/5" "Executando SQL no Supabase (tabela crm_operacoes)..."

$sqlPath = Join-Path (Split-Path (Split-Path $PSScriptRoot)) "sql\10_crm_operacoes_v21.sql"
if(-not (Test-Path $sqlPath)){
    Write-WARN "SQL nao encontrado em $sqlPath"
    Write-INFO "Execute manualmente: Supabase → SQL Editor → abra sql/10_crm_operacoes_v21.sql"
}else{
    $sqlContent = Get-Content $sqlPath -Raw

    # Tenta via Management API (precisa de SUPABASE_ACCESS_TOKEN)
    if($SB_MGMT_TOKEN -and $SB_MGMT_TOKEN -notlike '<*>'){
        try{
            $mgmtBody = @{ query = $sqlContent } | ConvertTo-Json
            Invoke-RestMethod `
                -Uri "https://api.supabase.com/v1/projects/$SB_REF/database/query" `
                -Method POST `
                -Headers @{ Authorization="Bearer $SB_MGMT_TOKEN"; 'Content-Type'='application/json' } `
                -Body $mgmtBody `
                -ErrorAction Stop | Out-Null
            Write-OK "tabela crm_operacoes criada/atualizada no Supabase"
        }catch{
            Write-WARN "Management API: $($_.Exception.Message)"
            Write-INFO "Execute manualmente: Supabase → SQL Editor → cole o conteudo de sql/10_crm_operacoes_v21.sql"
            # Abre o Supabase no navegador
            Start-Process "https://supabase.com/dashboard/project/$SB_REF/sql/new"
            Write-INFO "Navegador aberto no SQL Editor do Supabase. Cole e execute o SQL."
        }
    }else{
        Write-WARN "SUPABASE_ACCESS_TOKEN nao preenchido — abrindo SQL Editor no navegador..."
        Start-Process "https://supabase.com/dashboard/project/$SB_REF/sql/new"
        Write-INFO "Cole o conteudo de sql/10_crm_operacoes_v21.sql e clique em Run"
    }
}


# ══════════════════════════════════════════════════════════════
# PASSO 3 — Webhooks Z-API
# ══════════════════════════════════════════════════════════════
Write-Step "3/5" "Configurando webhooks na Z-API..."

if($WEBAPP_URL -and $WEBAPP_URL -notlike '<*>'){
    $zapiHeaders = @{ 'Client-Token' = $ZAPI_CT; 'Content-Type' = 'application/json' }

    $instancias = @(
        @{ inst=$ZAPI_INST_NT; tok=$ZAPI_TOK_NT; op='NOVOS_TALENTOS';   nome='NT' },
        @{ inst=$ZAPI_INST_CR; tok=$ZAPI_TOK_CR; op='CORRETORES_CRECI'; nome='CRECI' }
    )

    foreach($z in $instancias){
        $webhookUrl  = "$WEBAPP_URL`?operation=$($z.op)"
        $webhookBody = @{ value = $webhookUrl } | ConvertTo-Json

        try{
            Invoke-RestMethod `
                -Uri "https://api.z-api.io/instances/$($z.inst)/token/$($z.tok)/update-webhook-received" `
                -Method PUT -Headers $zapiHeaders -Body $webhookBody -ErrorAction Stop | Out-Null
            Write-OK "Webhook $($z.nome): $webhookUrl"
        }catch{
            Write-WARN "Z-API $($z.nome): $($_.Exception.Message)"
            Write-INFO "Configure manualmente: $webhookUrl"
        }
    }
}else{
    Write-WARN "APPS_SCRIPT_WEBAPP_URL nao preenchido — pule este passo por agora"
    Write-INFO "Apos implantar o Apps Script como Web App, edite o .ini e rode novamente"
}


# ══════════════════════════════════════════════════════════════
# PASSO 4 — Abre passos manuais no navegador
# ══════════════════════════════════════════════════════════════
Write-Step "4/5" "Abrindo passos manuais no navegador..."
Start-Sleep 1

# Apps Script
Write-INFO "Abrindo Google Apps Script..."
Start-Process "https://script.google.com"
Start-Sleep 1

# Vercel (para conferir o deploy)
Write-INFO "Abrindo Vercel..."
Start-Process "https://vercel.com/dashboard"
Start-Sleep 1


# ══════════════════════════════════════════════════════════════
# PASSO 5 — Resumo final
# ══════════════════════════════════════════════════════════════
Write-Step "5/5" "Resumo"
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║           CHECKLIST FINAL                           ║" -ForegroundColor Cyan
Write-Host "  ╠══════════════════════════════════════════════════════╣" -ForegroundColor Cyan

$checkItems = @(
    "Vercel: variaveis de ambiente definidas",
    "Vercel: aguardar ~1min para deploy concluir",
    "Supabase: tabela crm_operacoes criada",
    "Apps Script: substituir os 5 arquivos .gs",
    "Apps Script: Implantar como Web App → copiar URL",
    "config.ini: colar URL em APPS_SCRIPT_WEBAPP_URL",
    "Rodar este script novamente (configura Z-API webhook)",
    "Abrir site → digitar token: $PANEL_TOKEN → Salvar",
    "Apps Script: painel_63_credenciais_debug()",
    "Apps Script: painel_52_agenda_instalar_gatilho_15min()",
    "Apps Script: painel_60_instalar_trigger_outbox()"
)

for($i=0; $i -lt $checkItems.Count; $i++){
    $num = ($i+1).ToString().PadLeft(2)
    Write-Host "  ║  [ ] $num. $($checkItems[$i])" -ForegroundColor White
}
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Token do painel CRM (guarde este valor):" -ForegroundColor Yellow
Write-Host "  >>> $PANEL_TOKEN <<<" -ForegroundColor Green
Write-Host ""

Read-Host "  Pressione Enter para fechar"
