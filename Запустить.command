#!/bin/zsh
cd "${0:A:h}"
if ! command -v node >/dev/null; then
  echo 'Для запуска исходников нужен Node.js 22+. Готовое приложение FormLens.app работает без Node.js.'
  read -k 1
  exit 1
fi
if [[ ! -d node_modules/electron/dist ]]; then
  npm ci || exit 1
  node node_modules/electron/install.js || exit 1
fi
node scripts/setup.mjs || exit 1
npm start
