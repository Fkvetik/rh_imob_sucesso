
# RH IMOB - Higienizacao segura do repositorio rh_imob_sucesso
# Uso: clique no CMD ou rode: powershell -ExecutionPolicy Bypass -File .\higienizar_github_rhimob.ps1

$ErrorActionPreference = "Stop"

function Write-Title($txt) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host " $txt" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor Cyan
}

function Write-Ok($txt) { Write-Host "[OK] $txt" -ForegroundColor Green }
function Write-Warn($txt) { Write-Host "[ATENCAO] $txt" -ForegroundColor Yellow }
function Write-Err($txt) { Write-Host "[ERRO] $txt" -ForegroundColor Red }

function Test-GitRepo {
  if (-not (Test-Path ".git")) {
    Write-Err "Esta pasta nao parece ser um repositorio Git."
    Write-Host "Abra o CMD na pasta clonada do repositorio rh_imob_sucesso e execute novamente."
    exit 1
  }

  $remote = ""
  try { $remote = git remote get-url origin 2>$null } catch {}

  Write-Host "Repositorio remoto atual: $remote"
  if ($remote -notmatch "rh_imob_sucesso") {
    Write-Warn "O remoto nao parece ser Fkvetik/rh_imob_sucesso."
    Write-Warn "Confira antes de continuar."
    $continuar = Read-Host "Digite CONTINUAR para seguir mesmo assim, ou Enter para sair"
    if ($continuar -ne "CONTINUAR") { exit 0 }
  }
}

function Get-TimeStamp {
  return (Get-Date).ToString("yyyyMMdd_HHmmss")
}

function Ensure-ArchiveFolder {
  if (-not (Test-Path "_archive")) {
    New-Item -ItemType Directory -Path "_archive" | Out-Null
    Write-Ok "Pasta _archive criada."
  }

  if (-not (Test-Path "_archive\LEIA-ME.txt")) {
    @"
Arquivos antigos, patches, anotacoes e materiais de apoio movidos para nao poluir a raiz do projeto.

Regra:
- Nada foi apagado automaticamente.
- Arquivos movidos para ca podem ser revisados depois.
- A producao principal deve ficar em app/, lib/, assets/, apps_script/, sql/ e arquivos de configuracao.
"@ | Set-Content -Path "_archive\LEIA-ME.txt" -Encoding UTF8
  }
}

function Get-CleanupCandidates {
  $items = @()

  # Arquivos soltos na raiz que normalmente sao patch/anotacao/versao antiga
  $filePatterns = @(
    "ALTERACOES*",
    "ANOTACOES*",
    "APLICAR*",
    "ATUALIZAR*",
    "PATCH*",
    "VERSAO*",
    "BACKUP*",
    "COPIA*",
    "CORRECAO*",
    "AJUSTE*",
    "README_ANTIGO*",
    "*.bak",
    "*.old",
    "*.tmp",
    "*.zip"
  )

  foreach ($pat in $filePatterns) {
    Get-ChildItem -LiteralPath "." -File -Filter $pat -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Name -notin @("package.json","package-lock.json","README.md","next.config.js","next.config.mjs","vercel.json")) {
        $items += $_
      }
    }
  }

  # Pastas de apoio/patch na raiz que podem ser arquivadas com seguranca.
  # Nao inclui app, lib, assets, apps_script, sql, docs, setup.
  $folderNames = @(
    "ARQUIVOS_ATUALIZAR",
    "ARQUIVOS_ATUALIZADOS",
    "PATCHES",
    "BACKUPS",
    "VERSOES_ANTIGAS",
    "TEMP",
    "TMP"
  )

  foreach ($folder in $folderNames) {
    if (Test-Path $folder) {
      $items += Get-Item $folder
    }
  }

  # Remove duplicados
  $items = $items | Sort-Object FullName -Unique
  return $items
}

function Diagnose {
  Write-Title "DIAGNOSTICO DO REPOSITORIO"

  Test-GitRepo

  Write-Host ""
  Write-Host "Branch atual:"
  git branch --show-current

  Write-Host ""
  Write-Host "Status Git:"
  git status --short

  Write-Host ""
  Write-Host "Arquivos/pastas candidatos para mover para _archive:"
  $candidates = Get-CleanupCandidates
  if ($candidates.Count -eq 0) {
    Write-Ok "Nenhum candidato encontrado com os padroes seguros."
  } else {
    $candidates | ForEach-Object { Write-Host " - $($_.Name)" }
  }

  Write-Host ""
  Write-Host "Verificacao rapida de termos sensiveis:"
  $secretPatterns = @(
    "service_role",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ZAPI_TOKEN",
    "CLIENT_TOKEN",
    "API_KEY",
    "SECRET",
    "TOKEN",
    "credentials",
    "credenciais",
    "PRIVATE_KEY"
  )

  $ignoreDirs = @("\.git\", "\node_modules\", "\.next\", "\_archive\")
  $files = Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $full = $_.FullName
    $ok = $true
    foreach ($d in $ignoreDirs) {
      if ($full -match [regex]::Escape($d).Replace("\\\\", "\\")) { $ok = $false }
    }
    $ok
  }

  $report = @()
  foreach ($pattern in $secretPatterns) {
    $matches = Select-String -Path $files.FullName -Pattern $pattern -SimpleMatch -ErrorAction SilentlyContinue
    foreach ($m in $matches) {
      $report += [pscustomobject]@{
        Arquivo = $m.Path
        Linha = $m.LineNumber
        Termo = $pattern
        Conteudo = ($m.Line.Trim() -replace "([A-Za-z0-9_\-]{12})[A-Za-z0-9_\-]{8,}","`$1***")
      }
    }
  }

  if ($report.Count -gt 0) {
    $reportPath = "RELATORIO_SEGURANCA_GIT.txt"
    $report | Format-Table -AutoSize | Out-String | Set-Content -Path $reportPath -Encoding UTF8
    Write-Warn "Foram encontrados termos sensiveis. Veja: $reportPath"
    Write-Warn "Nao envie chaves/tokens aqui. Se houver chave real, remova e troque no servico."
  } else {
    Write-Ok "Nenhum termo sensivel encontrado pelos padroes basicos."
  }
}

function BackupBranch {
  Write-Title "CRIANDO BRANCH DE BACKUP"
  Test-GitRepo

  $current = git branch --show-current
  if ([string]::IsNullOrWhiteSpace($current)) {
    Write-Err "Nao foi possivel identificar a branch atual."
    exit 1
  }

  $stamp = Get-TimeStamp
  $backupBranch = "backup-antes-higienizacao-$stamp"

  git checkout -b $backupBranch
  git push -u origin $backupBranch

  Write-Ok "Backup criado e enviado: $backupBranch"

  git checkout $current
  Write-Ok "Voltei para a branch original: $current"
}

function CleanSafe {
  Write-Title "HIGIENIZACAO SEGURA - MOVER PARA _archive"
  Test-GitRepo
  Ensure-ArchiveFolder

  $stamp = Get-TimeStamp
  $dest = "_archive\higienizacao_$stamp"
  New-Item -ItemType Directory -Path $dest | Out-Null

  $candidates = Get-CleanupCandidates

  if ($candidates.Count -eq 0) {
    Write-Ok "Nada para mover."
    return
  }

  Write-Host "Estes itens serao movidos para: $dest"
  $candidates | ForEach-Object { Write-Host " - $($_.Name)" }

  Write-Host ""
  $confirm = Read-Host "Digite SIM para mover estes itens para _archive"
  if ($confirm -ne "SIM") {
    Write-Warn "Operacao cancelada. Nada foi movido."
    return
  }

  $manifest = @()
  foreach ($item in $candidates) {
    $target = Join-Path $dest $item.Name

    if (Test-Path $target) {
      $target = Join-Path $dest ("{0}_{1}" -f $stamp, $item.Name)
    }

    Move-Item -LiteralPath $item.FullName -Destination $target
    $manifest += "$($item.FullName) -> $target"
    Write-Ok "Movido: $($item.Name)"
  }

  $manifest | Set-Content -Path (Join-Path $dest "MANIFESTO_ARQUIVADOS.txt") -Encoding UTF8
  Write-Ok "Manifesto criado em $dest\MANIFESTO_ARQUIVADOS.txt"

  git status --short
}

function CommitPush {
  Write-Title "COMMIT E PUSH"
  Test-GitRepo

  Write-Host "Status atual:"
  git status --short

  Write-Host ""
  $confirm = Read-Host "Digite SIM para fazer commit e push da higienizacao"
  if ($confirm -ne "SIM") {
    Write-Warn "Commit cancelado."
    return
  }

  git add .
  git commit -m "chore: higieniza raiz do repositorio e arquiva arquivos antigos"
  git push

  Write-Ok "Commit enviado para o GitHub."
  Write-Warn "A Vercel deve iniciar novo deploy automaticamente."
}

function Show-Menu {
  while ($true) {
    Write-Title "MENU"
    Write-Host "1 - Diagnosticar repositorio (nao altera nada)"
    Write-Host "2 - Criar branch de backup antes da limpeza"
    Write-Host "3 - Higienizar seguro: mover arquivos antigos para _archive"
    Write-Host "4 - Commit + push para GitHub"
    Write-Host "5 - Sair"
    Write-Host ""

    $op = Read-Host "Escolha uma opcao"

    switch ($op) {
      "1" { Diagnose }
      "2" { BackupBranch }
      "3" { CleanSafe }
      "4" { CommitPush }
      "5" { break }
      default { Write-Warn "Opcao invalida." }
    }
  }
}

Show-Menu
