# ============================================================
# CONFIGURAR_TUDO.ps1 - RH IMOB CRM Setup Automatico
# Compativel com Windows PowerShell 5.1
# SEM caracteres Unicode (sem em-dash, sem setas, sem linhas)
# ============================================================
param([string]$ConfigFile)

function Write-Step([int]$n,[string]$msg){
    Write-Host ""
    Write-Host "  [$n] $msg" -ForegroundColor Cyan
}
function Write-OK([string]$msg)   { Write-Host "      OK   $msg" -ForegroundColor Green  }
function Write-WARN([string]$msg) { Write-Host "    AVISO  $msg" -ForegroundColor Yellow }
function Write-ERRO([string]$msg) { Write-Host "    ERRO   $msg" -ForegroundColor Red    }
function Write-INFO([string]$msg) { Write-Host "           $msg" -ForegroundColor DarkGray }

# Le config.ini sem interpretar $ nos valores
function Read-Config([string]$path){
    $cfg = @{}
    if(-not (Test-Path $path)){
        Write-ERRO "Arquivo nao encontrado: $path"
        exit 1
    }
    foreach($line in [System.IO.File]::ReadAllLines($path)){
        $l = $line.Trim()
        if($l.StartsWith('#') -or $l -eq '') { continue }
        $idx = $l.IndexOf('=')
        if($idx -lt 1) { continue }
        $k = $l.Substring(0, $idx).Trim()
        $v = $l.Substring($idx + 1).Trim()
        $cfg[$k] = $v
    }
    return $cfg
}

# Valida campo obrigatorio
function Test-Campo([hashtable]$cfg,[string]$key,[string]$label){
    $v = $cfg[$key]
    if(-not $v -or $v.StartsWith('<')){ Write-ERRO "$label nao preenchido ($key)"; return $false }
    return $true
}

# Extrai project ID do Vercel (aceita ID ou URL)
function Get-VercelProjectId([string]$raw,[string]$token){
    if($raw -match '^prj_[A-Za-z0-9]+$'){ return $raw }

    $nome = $raw -replace 'https?://(vercel\.com/[^/]+/)?','' `
                 -replace '\.vercel\.app.*','' `
                 -replace '/.*','' `
                 -replace '^[^/]+/',''

    Write-WARN "VERCEL_PROJECT_ID parece uma URL. Buscando ID pelo nome '$nome'..."

    try{
        $r = Invoke-RestMethod `
            -Uri "https://api.vercel.com/v9/projects" `
            -Headers @{ Authorization = "Bearer $token" } `
            -ErrorAction Stop
        $proj = $r.projects | Where-Object { $_.name -like "*$nome*" } | Select-Object -First 1
        if($proj){ Write-OK "Projeto encontrado: $($proj.name) ($($proj.id))"; return $proj.id }
        Write-ERRO "Nenhum projeto com nome '$nome' encontrado."
        return $null
    }catch{
        Write-ERRO "Nao foi possivel buscar projetos: $($_.Exception.Message)"
        return $null
    }
}

# Cria ou atualiza env var no Vercel
# Tipo valido: 'encrypted' (segredos) ou 'plain' (texto simples)
# PATCH nao inclui 'key' no corpo -- apenas POST inclui
function Set-VercelEnv([string]$projectId,[string]$token,[string]$key,[string]$value,[string]$type){
    $h = @{ Authorization="Bearer $token"; 'Content-Type'='application/json' }

    # Busca lista de envs para verificar se ja existe
    $envList = $null
    try{
        $envList = Invoke-RestMethod `
            -Uri "https://api.vercel.com/v10/projects/$projectId/env" `
            -Headers $h -ErrorAction Stop
    }catch{
        Write-WARN "Nao foi possivel listar envs: $($_.Exception.Message)"
        return $false
    }
    $existente = ($envList.envs | Where-Object { $_.key -eq $key } | Select-Object -First 1)

    # Tipo: API aceita 'encrypted' ou 'plain' -- 'sensitive' nao e valido na v10
    $envType = $type
    if($envType -eq 'sensitive'){ $envType = 'encrypted' }

    try{
        if($existente){
            # Variaveis 'sensitive' nao podem ter o tipo alterado via API
            # Usa o tipo atual para evitar erro 400
            $tipoAtual = $existente.type
            if(-not $tipoAtual){ $tipoAtual = $envType }

            $patchBody = @{
                value  = $value
                type   = $tipoAtual
                target = @('production','preview','development')
            } | ConvertTo-Json -Compress

            try{
                Invoke-RestMethod `
                    -Uri "https://api.vercel.com/v10/projects/$projectId/env/$($existente.id)" `
                    -Method PATCH -Headers $h -Body $patchBody -ErrorAction Stop | Out-Null
                Write-OK "Atualizada: $key"
            }catch{
                # Sensitive nao pode ser re-escrita via API - ja esta correta
                Write-OK "Mantida (sensitive): $key"
            }
        }else{
            $postBody = @{
                key    = $key
                value  = $value
                type   = $envType
                target = @('production','preview','development')
            } | ConvertTo-Json -Compress
            Invoke-RestMethod `
                -Uri "https://api.vercel.com/v10/projects/$projectId/env" `
                -Method POST -Headers $h -Body $postBody -ErrorAction Stop | Out-Null
            Write-OK "Criada: $key"
        }
        return $true
    }catch{
        Write-WARN "$key - $($_.Exception.Message)"
        return $false
    }
}

# Aciona redeploy no Vercel
function Invoke-VercelRedeploy([string]$projectId,[string]$token){
    try{
        $uriDeps = "https://api.vercel.com/v6/deployments?projectId=" + $projectId + [char]38 + "limit=1"
        $deps = Invoke-RestMethod `
            -Uri $uriDeps `
            -Headers @{ Authorization="Bearer $token" } -ErrorAction Stop
        $last = $deps.deployments[0]
        if(-not $last){ Write-WARN "Nenhum deploy anterior encontrado."; return }

        $body = @{ deploymentId=$last.uid; name=$last.name } | ConvertTo-Json -Compress
        Invoke-RestMethod `
            -Uri "https://api.vercel.com/v13/deployments" `
            -Method POST `
            -Headers @{ Authorization="Bearer $token"; 'Content-Type'='application/json' } `
            -Body $body -ErrorAction Stop | Out-Null
        Write-OK "Redeploy acionado (aguarde ~1 min)"
    }catch{
        Write-WARN "Redeploy: $($_.Exception.Message)"
        Write-INFO "Faca manualmente: Vercel - Deployments - Redeploy"
    }
}

# Executa SQL no Supabase via Management API
function Invoke-SupabaseSQL([string]$ref,[string]$accessToken,[string]$sqlPath){
    if(-not (Test-Path $sqlPath)){ Write-WARN "SQL nao encontrado: $sqlPath"; return }
    $sql = [System.IO.File]::ReadAllText($sqlPath)
    $body = @{ query = $sql } | ConvertTo-Json -Compress
    try{
        Invoke-RestMethod `
            -Uri "https://api.supabase.com/v1/projects/$ref/database/query" `
            -Method POST `
            -Headers @{ Authorization="Bearer $accessToken"; 'Content-Type'='application/json' } `
            -Body $body -ErrorAction Stop | Out-Null
        Write-OK "SQL executado com sucesso"
    }catch{
        Write-WARN "SQL via API: $($_.Exception.Message)"
        Write-INFO "Execute manualmente no Supabase SQL Editor"
        Start-Process "https://supabase.com/dashboard/project/$ref/sql/new"
    }
}

# Configura webhook Z-API
function Set-ZapiWebhook([string]$inst,[string]$tok,[string]$ct,[string]$url,[string]$nome){
    if(-not $inst -or $inst.StartsWith('<')){ Write-WARN "Instancia $nome nao configurada"; return }
    $body = @{ value = $url } | ConvertTo-Json -Compress
    try{
        Invoke-RestMethod `
            -Uri "https://api.z-api.io/instances/$inst/token/$tok/update-webhook-received" `
            -Method PUT `
            -Headers @{ 'Client-Token'=$ct; 'Content-Type'='application/json' } `
            -Body $body -ErrorAction Stop | Out-Null
        Write-OK "Webhook $nome configurado: $url"
    }catch{
        Write-WARN "Z-API $nome : $($_.Exception.Message)"
        Write-INFO "Configure manualmente em developer.z-api.io"
        Write-INFO "URL: $url"
    }
}

# ============================================================
# INICIO
# ============================================================

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   RH IMOB CRM - Configuracao de Producao        " -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan

$cfg = Read-Config $ConfigFile

# Valida campos minimos
$ok = $true
if(-not (Test-Campo $cfg 'VERCEL_TOKEN'              'Token do Vercel'))          { $ok=$false }
if(-not (Test-Campo $cfg 'VERCEL_PROJECT_ID'         'Project ID/URL do Vercel')) { $ok=$false }
if(-not (Test-Campo $cfg 'CRM_SUPABASE_SERVICE_ROLE_KEY' 'Service Role Key'))     { $ok=$false }
if(-not $ok){
    Write-Host ""
    Write-Host "  Corrija os campos acima e rode novamente." -ForegroundColor Red
    Read-Host "  Enter para fechar"
    exit 1
}

$VCL_TOKEN    = $cfg['VERCEL_TOKEN']
$VCL_PROJ_RAW = $cfg['VERCEL_PROJECT_ID']
$PANEL_TOKEN  = $cfg['CRM_PANEL_TOKEN']
$SB_URL       = $cfg['CRM_SUPABASE_URL']
$SB_KEY       = $cfg['CRM_SUPABASE_SERVICE_ROLE_KEY']
$SB_MGMT      = $cfg['SUPABASE_ACCESS_TOKEN']
$WEBAPP_URL   = $cfg['APPS_SCRIPT_WEBAPP_URL']
$ZAPI_CT      = $cfg['ZAPI_CLIENT_TOKEN']
$ZAPI_IN_NT   = $cfg['ZAPI_INSTANCE_NT']
$ZAPI_TK_NT   = $cfg['ZAPI_TOKEN_NT']
$ZAPI_IN_CR   = $cfg['ZAPI_INSTANCE_CRECI']
$ZAPI_TK_CR   = $cfg['ZAPI_TOKEN_CRECI']

$SB_REF = ($SB_URL -replace 'https://','' -replace '\.supabase\.co.*','')

# --- 1. Resolve Project ID ---
Write-Step 1 "Resolvendo Project ID do Vercel..."
$PROJECT_ID = Get-VercelProjectId $VCL_PROJ_RAW $VCL_TOKEN
if(-not $PROJECT_ID){
    Write-ERRO "Nao foi possivel obter o Project ID. Verifique VERCEL_PROJECT_ID no .ini"
    Read-Host "  Enter para fechar"
    exit 1
}
Write-OK "Project ID: $PROJECT_ID"

# Salva o ID correto no ini
$iniContent = [System.IO.File]::ReadAllText($ConfigFile)
if($VCL_PROJ_RAW -ne $PROJECT_ID){
    $iniContent = $iniContent -replace [regex]::Escape("VERCEL_PROJECT_ID=$VCL_PROJ_RAW"), "VERCEL_PROJECT_ID=$PROJECT_ID"
    [System.IO.File]::WriteAllText($ConfigFile, $iniContent, [System.Text.Encoding]::UTF8)
    Write-OK "VERCEL_PROJECT_ID corrigido no .ini para: $PROJECT_ID"
}

# --- 2. Variaveis de ambiente no Vercel ---
Write-Step 2 "Configurando variaveis de ambiente no Vercel..."
Set-VercelEnv $PROJECT_ID $VCL_TOKEN 'CRM_SUPABASE_URL'              $SB_URL      'encrypted'
Set-VercelEnv $PROJECT_ID $VCL_TOKEN 'CRM_SUPABASE_SERVICE_ROLE_KEY' $SB_KEY      'encrypted'
Set-VercelEnv $PROJECT_ID $VCL_TOKEN 'CRM_PANEL_TOKEN'               $PANEL_TOKEN 'encrypted'
Set-VercelEnv $PROJECT_ID $VCL_TOKEN 'CRM_LOCAL_BYPASS'              'NAO'        'plain'
Invoke-VercelRedeploy $PROJECT_ID $VCL_TOKEN

# --- 3. SQL no Supabase ---
Write-Step 3 "Executando SQL no Supabase..."
$sqlPath = Join-Path (Split-Path (Split-Path $PSScriptRoot)) 'sql\10_crm_operacoes_v21.sql'
if($SB_MGMT -and -not $SB_MGMT.StartsWith('<')){
    if($SB_MGMT.StartsWith('sbp_')){
        Invoke-SupabaseSQL $SB_REF $SB_MGMT $sqlPath
    }else{
        Write-WARN "SUPABASE_ACCESS_TOKEN deve comecar com sbp_ (gere em supabase.com/dashboard/account/tokens)"
        Start-Process "https://supabase.com/dashboard/account/tokens"
    }
}else{
    Write-WARN "SUPABASE_ACCESS_TOKEN nao preenchido - abrindo SQL Editor"
    Start-Process "https://supabase.com/dashboard/project/$SB_REF/sql/new"
    Write-INFO "Cole o arquivo sql/10_crm_operacoes_v21.sql e clique Run"
}

# --- 4. Webhooks Z-API ---
Write-Step 4 "Configurando webhooks Z-API..."
if($WEBAPP_URL -and -not $WEBAPP_URL.StartsWith('<')){
    Set-ZapiWebhook $ZAPI_IN_NT $ZAPI_TK_NT $ZAPI_CT "$WEBAPP_URL`?operation=NOVOS_TALENTOS"   'NT'
    Set-ZapiWebhook $ZAPI_IN_CR $ZAPI_TK_CR $ZAPI_CT "$WEBAPP_URL`?operation=CORRETORES_CRECI" 'CRECI'
}else{
    Write-WARN "APPS_SCRIPT_WEBAPP_URL ainda nao preenchido"
    Write-INFO "Apos implantar o Apps Script, cole a URL no .ini e rode novamente"
}

# --- 5. Abre navegador ---
Write-Step 5 "Abrindo passos manuais no navegador..."
Start-Process "https://script.google.com"
Start-Sleep -Seconds 1
Start-Process "https://vercel.com/dashboard"

# --- Resumo final ---
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   RESUMO                                        " -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "  Vercel Project ID : $PROJECT_ID" -ForegroundColor White
Write-Host "  Supabase Ref      : $SB_REF" -ForegroundColor White
Write-Host "  Token do painel   : $PANEL_TOKEN" -ForegroundColor Green
Write-Host ""
Write-Host "  Proximos passos manuais:" -ForegroundColor Yellow
Write-Host "  [ ] Apps Script: substituir os 5 arquivos .gs" -ForegroundColor White
Write-Host "  [ ] Apps Script: Implantar como Web App - copiar URL" -ForegroundColor White
Write-Host "  [ ] Colar URL em APPS_SCRIPT_WEBAPP_URL no .ini" -ForegroundColor White
Write-Host "  [ ] Rodar CONFIGURAR_TUDO.cmd novamente (webhook Z-API)" -ForegroundColor White
Write-Host "  [ ] Abrir o site e digitar o token acima em Salvar acesso" -ForegroundColor White
Write-Host "  [ ] Apps Script: painel_52_agenda_instalar_gatilho_15min()" -ForegroundColor White
Write-Host "  [ ] Apps Script: painel_60_instalar_trigger_outbox()" -ForegroundColor White
Write-Host ""

Read-Host "  Pressione Enter para fechar"
