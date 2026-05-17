# ============================================================
# VERIFICAR_STATUS.ps1 — RH IMOB CRM
# Verifica se tudo esta configurado e funcionando
# ============================================================
param([string]$ConfigFile)

function Write-OK([string]$msg)  { Write-Host "  [OK] $msg"    -ForegroundColor Green  }
function Write-FAIL([string]$msg){ Write-Host "  [XX] $msg"    -ForegroundColor Red    }
function Write-WARN([string]$msg){ Write-Host "  [--] $msg"    -ForegroundColor Yellow }
function Write-HEAD([string]$msg){ Write-Host "`n  === $msg ===" -ForegroundColor Cyan  }

function Read-Config([string]$path){
    $cfg = @{}
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if($line -match '^[^#].*='){
            $parts = $line -split '=',2
            $cfg[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
    return $cfg
}

$cfg      = Read-Config $ConfigFile
$SB_URL   = $cfg['CRM_SUPABASE_URL']
$SB_KEY   = $cfg['CRM_SUPABASE_SERVICE_ROLE_KEY']
$VCL_TOK  = $cfg['VERCEL_TOKEN']
$VCL_PROJ = $cfg['VERCEL_PROJECT_ID']
$PANEL    = $cfg['CRM_PANEL_TOKEN']
$WEBAPP   = $cfg['APPS_SCRIPT_WEBAPP_URL']
$SB_REF   = ($SB_URL -replace 'https://','') -replace '\.supabase\.co.*',''

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   RH IMOB CRM — Verificacao de Status       ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Cyan

# ── 1. Supabase — conectividade ──────────────────────────────
Write-HEAD "Supabase"
try{
    $r = Invoke-RestMethod `
        -Uri "$SB_URL/rest/v1/crm_operacoes?select=operation_key,ativo&limit=10" `
        -Headers @{ apikey=$SB_KEY; Authorization="Bearer $SB_KEY" } `
        -ErrorAction Stop
    Write-OK "Conexao com Supabase OK"
    if($r.Count -gt 0){
        Write-OK "crm_operacoes encontrada ($($r.Count) operacoes):"
        $r | ForEach-Object { Write-Host "       • $($_.operation_key) (ativo=$($_.ativo))" -ForegroundColor DarkGray }
    }else{
        Write-WARN "crm_operacoes vazia — rode sql/10_crm_operacoes_v21.sql"
    }
}catch{
    Write-FAIL "Supabase inacessivel: $($_.Exception.Message)"
}

# ── 2. Vercel — variaveis de ambiente ────────────────────────
Write-HEAD "Vercel"
if($VCL_TOK -and $VCL_TOK -notlike '<*>' -and $VCL_PROJ -and $VCL_PROJ -notlike '<*>'){
    try{
        $envs = Invoke-RestMethod `
            -Uri "https://api.vercel.com/v10/projects/$VCL_PROJ/env" `
            -Headers @{ Authorization="Bearer $VCL_TOK" } `
            -ErrorAction Stop
        $keys = $envs.envs | ForEach-Object { $_.key }
        $needed = @('CRM_SUPABASE_URL','CRM_SUPABASE_SERVICE_ROLE_KEY','CRM_PANEL_TOKEN')
        foreach($k in $needed){
            if($k -in $keys){ Write-OK "$k definida no Vercel" }
            else             { Write-FAIL "$k ausente no Vercel" }
        }
    }catch{ Write-WARN "Nao foi possivel verificar Vercel: $($_.Exception.Message)" }
}else{
    Write-WARN "VERCEL_TOKEN ou VERCEL_PROJECT_ID nao preenchidos no .ini"
}

# ── 3. API do CRM (site publicado) ───────────────────────────
Write-HEAD "API CRM (site publicado)"
try{
    $vercelProj = Invoke-RestMethod `
        -Uri "https://api.vercel.com/v9/projects/$VCL_PROJ" `
        -Headers @{ Authorization="Bearer $VCL_TOK" } `
        -ErrorAction Stop
    $domain = $vercelProj.alias | Select-Object -First 1
    if(-not $domain){ $domain = "$VCL_PROJ.vercel.app" }
    $siteUrl = "https://$domain"

    $apiTest = Invoke-WebRequest `
        -Uri "$siteUrl/api/crm/operacoes" `
        -Headers @{ 'x-crm-token'=$PANEL } `
        -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    $apiData = $apiTest.Content | ConvertFrom-Json
    if($apiData.ok){
        Write-OK "API /api/crm/operacoes respondendo em $siteUrl"
        Write-OK "Operacoes retornadas: $($apiData.operacoes.Count)"
    }else{
        Write-FAIL "API retornou ok=false"
    }
}catch{
    Write-WARN "Nao foi possivel testar a API do site: $($_.Exception.Message)"
    Write-Host "      Verifique se o deploy no Vercel concluiu." -ForegroundColor DarkGray
}

# ── 4. Z-API — conectividade das instancias ──────────────────
Write-HEAD "Z-API"
$instancias = @(
    @{ inst=$cfg['ZAPI_INSTANCE_NT'];    tok=$cfg['ZAPI_TOKEN_NT'];    nome='NT (Novos Talentos)' },
    @{ inst=$cfg['ZAPI_INSTANCE_CRECI']; tok=$cfg['ZAPI_TOKEN_CRECI']; nome='CRECI' }
)
foreach($z in $instancias){
    if(-not $z.inst -or $z.inst -like '<*>'){ Write-WARN "$($z.nome): nao configurada no .ini"; continue }
    try{
        $zapiR = Invoke-RestMethod `
            -Uri "https://api.z-api.io/instances/$($z.inst)/token/$($z.tok)/status" `
            -Headers @{ 'Client-Token'=$cfg['ZAPI_CLIENT_TOKEN'] } `
            -ErrorAction Stop
        $connected = $zapiR.connected -eq $true -or $zapiR.status -eq 'CONNECTED' -or $zapiR.value -eq 'CONNECTED'
        if($connected){ Write-OK "Z-API $($z.nome): CONECTADA" }
        else           { Write-WARN "Z-API $($z.nome): status=$($zapiR.value ?? $zapiR.status ?? 'desconhecido')" }
    }catch{ Write-WARN "Z-API $($z.nome): $($_.Exception.Message)" }
}

# ── 5. Webhook Apps Script ───────────────────────────────────
Write-HEAD "Apps Script Web App"
if($WEBAPP -and $WEBAPP -notlike '<*>'){
    Write-OK "URL configurada: $WEBAPP"
    try{
        $wtest = Invoke-WebRequest -Uri "$WEBAPP`?health=1" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        Write-OK "Web App acessivel (HTTP $($wtest.StatusCode))"
    }catch{ Write-WARN "Web App nao respondeu: $($_.Exception.Message)" }
}else{
    Write-WARN "APPS_SCRIPT_WEBAPP_URL nao preenchido — implante o Web App primeiro"
}

# ── Resumo ───────────────────────────────────────────────────
Write-Host ""
Write-Host "  Verificacao concluida." -ForegroundColor Cyan
Write-Host "  Para configurar o que estiver pendente: CONFIGURAR_TUDO.cmd`n" -ForegroundColor DarkGray

Read-Host "  Pressione Enter para fechar"
