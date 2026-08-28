#!/usr/bin/env bash
#
# Abre o AncorAI a partir do terminal, dispensando rodar os comandos npm um a
# um. Execute na pasta do projeto:
#
#     ./iniciar.sh              modo de desenvolvimento (padrão)
#     ./iniciar.sh build        compila e abre a versão compilada
#
# O script não instala nada no sistema, não cria atalhos e não altera nada
# fora da pasta do projeto.

set -euo pipefail

# Funciona mesmo quando chamado de outro diretório.
cd "$(dirname "${BASH_SOURCE[0]}")"

vermelho=$'\e[31m'; verde=$'\e[32m'; amarelo=$'\e[33m'; normal=$'\e[0m'
erro()   { echo "${vermelho}✗ $*${normal}" >&2; }
aviso()  { echo "${amarelo}! $*${normal}"; }
passo()  { echo "${verde}▸ $*${normal}"; }

# O modo é conferido antes de qualquer trabalho: rejeitar um argumento errado
# depois de instalar dependências por minutos seria tempo jogado fora.
modo="${1:-dev}"
if [[ "$modo" != "dev" && "$modo" != "build" ]]; then
  erro "Modo desconhecido: ${modo}"
  echo "  Use './iniciar.sh' ou './iniciar.sh build'."
  exit 1
fi

# --- O Electron precisa rodar como Electron -------------------------------
#
# Com ELECTRON_RUN_AS_NODE definido, o binário do Electron se comporta como
# Node puro: o processo executa, termina sem erro e nenhuma janela aparece.
# A variável costuma vir de terminais embutidos em editores, então limpá-la
# aqui evita um sintoma que parece defeito da aplicação.
if [[ -n "${ELECTRON_RUN_AS_NODE:-}" ]]; then
  aviso "ELECTRON_RUN_AS_NODE estava definido; ignorando para esta execução."
  unset ELECTRON_RUN_AS_NODE
fi

# --- Node --------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  erro "Node.js não encontrado."
  echo "  Instale a versão 20.19+ ou 22.12+ e execute novamente."
  exit 1
fi

versao_node=$(node -v)
maior=$(echo "${versao_node#v}" | cut -d. -f1)
menor=$(echo "${versao_node#v}" | cut -d. -f2)

# Espelha o campo "engines" do package.json.
if (( maior < 20 )) || (( maior == 21 )) \
   || (( maior == 20 && menor < 19 )) || (( maior == 22 && menor < 12 )); then
  erro "Node ${versao_node} não atende ao exigido pelo projeto (20.19+ ou 22.12+)."
  exit 1
fi

passo "Node ${versao_node}"

# --- Dependências ------------------------------------------------------------
#
# Reinstala quando não há node_modules ou quando o package-lock.json mudou
# depois da última instalação — o caso de quem acabou de dar git pull.
marca=node_modules/.ancorai-instalado
hash_lock=$(sha256sum package-lock.json | cut -d' ' -f1)

precisa_instalar=false
if [[ ! -d node_modules ]]; then
  precisa_instalar=true
elif [[ ! -f "$marca" ]] || [[ "$(cat "$marca")" != "$hash_lock" ]]; then
  aviso "package-lock.json mudou desde a última instalação."
  precisa_instalar=true
fi

if [[ "$precisa_instalar" == true ]]; then
  passo "Instalando dependências (demora alguns minutos na primeira vez)…"
  if ! npm install; then
    erro "A instalação falhou."
    echo "  Verifique a conexão e tente 'npm install' manualmente para ver o erro completo."
    exit 1
  fi
  # Guarda o hash do lock instalado. Comparar datas não serve: o npm toca
  # package-lock.json e node_modules no mesmo instante, e a comparação
  # dispararia uma reinstalação a cada execução.
  echo "$hash_lock" > "$marca"
else
  passo "Dependências já instaladas"
fi

# --- Abrir -------------------------------------------------------------------
case "$modo" in
  dev)
    passo "Abrindo o AncorAI… (Ctrl+C encerra)"
    exec npm run dev
    ;;
  build)
    passo "Compilando…"
    npm run build
    passo "Abrindo a versão compilada… (Ctrl+C encerra)"
    exec npm start
    ;;
esac
