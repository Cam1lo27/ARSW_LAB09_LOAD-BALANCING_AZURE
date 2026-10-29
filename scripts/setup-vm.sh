#!/usr/bin/env bash
# Instala Node.js (con nvm), clona el repositorio y deja la FibonacciApp corriendo con forever.
# Uso (dentro de la VM):
#   bash setup-vm.sh [url_del_repositorio]
set -e

REPO_URL="${1:-https://github.com/Cam1lo27/ARSW_LAB09_LOAD-BALANCING_AZURE.git}"
REPO_DIR="$HOME/$(basename "$REPO_URL" .git)"

echo ">> Instalando git y curl"
sudo apt-get update -y
sudo apt-get install -y git curl

echo ">> Instalando nvm y Node.js LTS"
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install --lts
nvm alias default 'lts/*'
node -v
npm -v

echo ">> Clonando / actualizando $REPO_URL"
if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" pull
else
  git clone "$REPO_URL" "$REPO_DIR"
fi

echo ">> Instalando dependencias de la FibonacciApp"
cd "$REPO_DIR/FibonacciApp"
npm install

echo ">> Iniciando la app con forever"
npm install -g forever
forever stopall || true
forever start FibonacciApp.js
forever list

echo ">> Prueba local:"
sleep 2
curl -s http://localhost:3000/fibonacci/6; echo
