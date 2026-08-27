#!/usr/bin/env bash
#
# Prepara o ambiente de desenvolvimento do AncorIA.
#
# Uso:  ./setup.sh
#
# Verifica as versões necessárias, instala as dependências e roda os testes
# para confirmar que a instalação ficou íntegra.

set -euo pipefail
cd "$(dirname "$0")"

# Cor apenas quando a saída é um terminal: em pipe ou log, os códigos de
# escape virariam lixo no texto.
if [ -t 1 ]; then
  VERDE='\033[0;32m'; VERMELHO='\033[0;31m'; AMARELO='\033[0;33m'; NEUTRO='\033[0m'
else
  VERDE=''; VERMELHO=''; AMARELO=''; NEUTRO=''
fi
ok()    { echo -e "${VERDE}✓${NEUTRO} $1"; }
aviso() { echo -e "${AMARELO}!${NEUTRO} $1"; }
erro()  { echo -e "${VERMELHO}✗${NEUTRO} $1" >&2; }

echo
echo "Preparando o ambiente do AncorIA"
echo "================================"
echo

# --- Node -------------------------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
  erro "Node.js não encontrado."
  echo "  Instale a versão 22.12 ou superior: https://nodejs.org"
  exit 1
fi

# A faixa exigida vem do Vite e do electron-vite. A checagem usa o próprio Node
# para evitar comparar versões com texto no shell.
if ! node -e '
  const [ma, mi] = process.versions.node.split(".").map(Number);
  const ok = (ma === 20 && mi >= 19) || (ma === 22 && mi >= 12) || ma > 22;
  process.exit(ok ? 0 : 1);
'; then
  erro "Node $(node -v) não é compatível."
  echo "  É necessário ^20.19.0 ou >=22.12.0."
  echo "  Com o nvm:  nvm install 22 && nvm use 22"
  exit 1
fi
ok "Node $(node -v)"

# --- npm --------------------------------------------------------------------

if ! command -v npm >/dev/null 2>&1; then
  erro "npm não encontrado."
  exit 1
fi
ok "npm $(npm -v)"

# --- Dependências -----------------------------------------------------------

echo
echo "Instalando as dependências…"
aviso "O Electron tem cerca de 114 MB. A primeira instalação demora."
echo

if ! npm install; then
  erro "A instalação falhou."
  echo
  echo "  Se o download do Electron travou, tente um espelho:"
  echo "    ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install"
  exit 1
fi
ok "Dependências instaladas"

# --- Verificação ------------------------------------------------------------

echo
echo "Rodando os testes…"
echo

if npm test --silent; then
  ok "Testes passaram"
else
  erro "Os testes falharam. O ambiente pode estar incompleto."
  exit 1
fi

# --- Pronto -----------------------------------------------------------------

cat <<'FIM'

Ambiente pronto.

  npm run dev     executa em modo de desenvolvimento
  npm test        roda os testes
  npm run build   verifica os tipos e gera o build
  npm run dist    gera o instalável

Na primeira execução, configure o acesso pelo botão de conexão no cabeçalho:

  GitHub  um Personal Access Token com permissão de leitura
  Drive   um Client ID OAuth do tipo "Desktop app" criado no Google Cloud

O passo a passo completo está no README.md.

FIM
