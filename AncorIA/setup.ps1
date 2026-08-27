# Prepara o ambiente de desenvolvimento do AncorIA no Windows.
#
# Uso:  .\setup.ps1
#
# Se o PowerShell recusar a execução, libere para esta sessão com:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Escreva-Ok    { param($m) Write-Host "OK  $m" -ForegroundColor Green }
function Escreva-Aviso { param($m) Write-Host "!   $m" -ForegroundColor Yellow }
function Escreva-Erro  { param($m) Write-Host "X   $m" -ForegroundColor Red }

Write-Host ""
Write-Host "Preparando o ambiente do AncorIA"
Write-Host "================================"
Write-Host ""

# --- Node -------------------------------------------------------------------

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Escreva-Erro "Node.js nao encontrado."
    Write-Host "  Instale a versao 22.12 ou superior: https://nodejs.org"
    exit 1
}

# A faixa exigida vem do Vite e do electron-vite.
node -e "const [ma,mi]=process.versions.node.split('.').map(Number);process.exit(((ma===20&&mi>=19)||(ma===22&&mi>=12)||ma>22)?0:1)"
if ($LASTEXITCODE -ne 0) {
    Escreva-Erro "Node $(node -v) nao e compativel."
    Write-Host "  E necessario ^20.19.0 ou >=22.12.0."
    exit 1
}
Escreva-Ok "Node $(node -v)"

# --- npm --------------------------------------------------------------------

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Escreva-Erro "npm nao encontrado."
    exit 1
}
Escreva-Ok "npm $(npm -v)"

# --- Dependencias -----------------------------------------------------------

Write-Host ""
Write-Host "Instalando as dependencias..."
Escreva-Aviso "O Electron tem cerca de 114 MB. A primeira instalacao demora."
Write-Host ""

npm install
if ($LASTEXITCODE -ne 0) {
    Escreva-Erro "A instalacao falhou."
    Write-Host ""
    Write-Host "  Se o download do Electron travou, tente um espelho:"
    Write-Host '    $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; npm install'
    exit 1
}
Escreva-Ok "Dependencias instaladas"

# --- Verificacao ------------------------------------------------------------

Write-Host ""
Write-Host "Rodando os testes..."
Write-Host ""

npm test --silent
if ($LASTEXITCODE -ne 0) {
    Escreva-Erro "Os testes falharam. O ambiente pode estar incompleto."
    exit 1
}
Escreva-Ok "Testes passaram"

# --- Pronto -----------------------------------------------------------------

Write-Host ""
Write-Host "Ambiente pronto."
Write-Host ""
Write-Host "  npm run dev     executa em modo de desenvolvimento"
Write-Host "  npm test        roda os testes"
Write-Host "  npm run build   verifica os tipos e gera o build"
Write-Host "  npm run dist    gera o instalavel"
Write-Host ""
Write-Host "Na primeira execucao, configure o acesso pelo botao de conexao no cabecalho:"
Write-Host ""
Write-Host "  GitHub  um Personal Access Token com permissao de leitura"
Write-Host '  Drive   um Client ID OAuth do tipo "Desktop app" criado no Google Cloud'
Write-Host ""
Write-Host "O passo a passo completo esta no README.md."
Write-Host ""
