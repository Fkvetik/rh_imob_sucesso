# ============================================================
# VERIFICAR_STATUS.ps1 — RH IMOB CRM
# Compativel com Windows PowerShell 5.1 (sem ?? nem ?.)
# ============================================================
param([string]$ConfigFile)

function Write-OK([string]$msg)  { Write-Host "  [OK] $msg" -ForegroundColor Green  }
function Write-FAIL([string]$msg){ Write-Host "  [XX] $msg" -ForegroundColor Red    }
function Write-WARN([string]$msg){ Write-Host "  [--] $msg" -ForegroundColor Yellow }
function Write-HEAD([string]$msg){ Write-Host "`n  === $msg ===" -ForegroundColor Cyan }

function Read-Config([string]$path){
    $cfg = @{}
    foreach($line in [System.IO.File]::ReadAllLines($path)){
        $l = $line.Trim()
        if($l.StartsWith('#') -or $l -eq '') { continue }
        $idx = $l.IndexOf('=')
        if($idx -lt 1) { continue }
        $k = $l.Substring(0,$idx).Trim()
        $v = $l.Substring($idx+1).Trim()
        $cfg[$k] = $v
    }
    return $cfg
}

function Safe([object]$val,[string]$fallback=''){
    if($val -eq $null -or $val -eq ''){ return $fallback }
    return [string]$val
}

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   RH IMOB CRM - Verificacao de Status           " -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan

if(-not (Test-Path $ConfigFile)){
    Write-Host "  ERRO: $ConfigFile nao encontrado." -ForegroundColor Red
    Read-Host "  Enter para fechar"
    exit 1
}

$cfg     = Read-Config $ConfigFile
$SB_URL  = Safe $cfg['CRM_SUPABASE_URL']
$SB_KEY  = Safe $cfg['CRM_SUPABASE_SERVICE_ROLE_KEY']
$VCL_TOK = Safe $cfg['VERCEL_TOKEN']
$VCL_PRJ = Safe $cfg['VERCEL_PROJECT_ID']
$PANEL   = Safe $cfg['CRM_PANEL_TOKEN']
$WEBAPP  = Safe $cfg['APPS_SCRIPT_WEBAPP_URL']
$ZAPI_CT = Safe $cfg['ZAPI_CLIENT_TOKEN']
$SB_REF  = ($SB_URL -replace 'https://','') -replace '\.supabase\.co.*',''

# ── 1. Supabase ───────────────────────────────────────────────
Write-HEAD "Supabase"
if($SB_URL -and $SB_KEY){
    try{
        $h = @{ apikey=$SB_KEY; Authorization="Bearer $SB_KEY" }
        $uriSb = $SB_URL + "/rest/v1/crm_operacoes?select=operation_key,ativo" + [char]38 + "limit=10"
        $r = Invoke-RestMethod `
            -Uri $uriSb `
            -Headers $h -ErrorAction Stop
        Write-OK "Conexao com Supabase OK"
        if($r.Count -gt 0){
            Write-OK "crm_operacoes: $($r.Count) operacao(oes)"
            foreach($row in $r){
                Write-Host "       - $($row.operation_key) (ativo=$($row.ativo))" -ForegroundColor DarkGray
            }
        }else{
            Write-WARN "crm_operacoes vazia - rode sql/10_crm_operacoes_v21.sql"
        }
    }catch{
        Write-FAIL "Supabase inacessivel: $($_.Exception.Message)"
    }
}else{
    Write-WARN "CRM_SUPABASE_URL ou SERVICE_ROLE_KEY nao preenchidos"
}

# ── 2. Vercel env vars ────────────────────────────────────────
Write-HEAD "Vercel"
if($VCL_TOK -and $VCL_PRJ -and $VCL_PRJ -match '^prj_'){
    try{
        $hv = @{ Authorization="Bearer $VCL_TOK" }
        $envs = Invoke-RestMethod `
            -Uri "https://api.vercel.com/v10/projects/$VCL_PRJ/env" `
            -Headers $hv -ErrorAction Stop
        $keys = $envs.envs | ForEach-Object { $_.key }
        $needed = @('CRM_SUPABASE_URL','CRM_SUPABASE_SERVICE_ROLE_KEY','CRM_PANEL_TOKEN')
        foreach($k in $needed){
            if($keys -contains $k){ Write-OK "$k definida" }
            else                  { Write-FAIL "$k ausente no Vercel" }
        }
    }catch{
        Write-WARN "Nao foi possivel verificar Vercel: $($_.Exception.Message)"
    }
}elseif($VCL_PRJ -and -not ($VCL_PRJ -match '^prj_')){
    Write-WARN "VERCEL_PROJECT_ID parece uma URL - rode CONFIGURAR_TUDO.cmd para corrigir automaticamente"
}else{
    Write-WARN "VERCEL_TOKEN ou VERCEL_PROJECT_ID nao preenchidos"
}

# ── 3. API do site publicado ──────────────────────────────────
Write-HEAD "API CRM (site publicado)"
$siteUrl = "https://rhimob-crm-atendimento.vercel.app"
if($PANEL){
    try{
        $wr = Invoke-WebRequest `
            -Uri "$siteUrl/api/crm/operacoes" `
            -Headers @{ 'x-crm-token'=$PANEL } `
            -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        $apiData = $wr.Content | ConvertFrom-Json
        if($apiData.ok){
            $total = 0
            if($apiData.operacoes){ $total = @($apiData.operacoes).Count }
            Write-OK "API respondendo em $siteUrl"
            Write-OK "Operacoes retornadas: $total"
        }else{
            Write-FAIL "API retornou ok=false"
        }
    }catch{
        Write-WARN "Nao foi possivel testar a API: $($_.Exception.Message)"
        Write-Host "       Verifique se o deploy no Vercel concluiu (~1 min apos push)" -ForegroundColor DarkGray
    }
}else{
    Write-WARN "CRM_PANEL_TOKEN nao preenchido - impossivel testar a API"
}

# ── 4. Z-API instancias ───────────────────────────────────────
Write-HEAD "Z-API"
$instancias = @(
    @{ inst=Safe $cfg['ZAPI_INSTANCE_NT'];    tok=Safe $cfg['ZAPI_TOKEN_NT'];    nome='NT (Novos Talentos)' },
    @{ inst=Safe $cfg['ZAPI_INSTANCE_CRECI']; tok=Safe $cfg['ZAPI_TOKEN_CRECI']; nome='CRECI' }
)
foreach($z in $instancias){
    if(-not $z.inst -or $z.inst.StartsWith('<')){
        Write-WARN "$($z.nome): nao configurada"
        continue
    }
    try{
        $zapiR = Invoke-RestMethod `
            -Uri "https://api.z-api.io/instances/$($z.inst)/token/$($z.tok)/status" `
            -Headers @{ 'Client-Token'=$ZAPI_CT } `
            -ErrorAction Stop
        # Verifica conexao (vários formatos possíveis de resposta)
        $statusVal = ''
        if($zapiR.value)     { $statusVal = [string]$zapiR.value }
        elseif($zapiR.status){ $statusVal = [string]$zapiR.status }
        elseif($zapiR.connected -ne $null){ $statusVal = if($zapiR.connected){'CONNECTED'}else{'DISCONNECTED'} }
        $connected = ($statusVal -eq 'CONNECTED' -or $zapiR.connected -eq $true)
        if($connected){
            Write-OK "Z-API $($z.nome): CONECTADA"
        }else{
            Write-WARN "Z-API $($z.nome): $statusVal"
        }
    }catch{
        Write-WARN "Z-API $($z.nome): $($_.Exception.Message)"
    }
}

# ── 5. Webhook configurado ────────────────────────────────────
Write-HEAD "Apps Script Web App"
if($WEBAPP -and -not $WEBAPP.StartsWith('<')){
    Write-OK "URL configurada"
    Write-Host "       $WEBAPP" -ForegroundColor DarkGray
    try{
        $wt = Invoke-WebRequest `
            -Uri $WEBAPP `
            -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        Write-OK "Web App acessivel (HTTP $($wt.StatusCode))"
    }catch{
        Write-WARN "Web App nao respondeu: $($_.Exception.Message)"
    }
}else{
    Write-WARN "APPS_SCRIPT_WEBAPP_URL nao preenchido"
    Write-Host "       Implante o Apps Script como Web App e cole a URL no .ini" -ForegroundColor DarkGray
}

# ── Fim ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   Verificacao concluida.                        " -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "  Pressione Enter para fechar"
