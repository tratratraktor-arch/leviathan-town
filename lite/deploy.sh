#!/usr/bin/env bash
# Leviathan Town Lite: install or update the game on a VPS that already has Docker.
# Usage (as root): curl -fsSL https://raw.githubusercontent.com/tratratraktor-arch/leviathan-town/main/lite/deploy.sh | DOMAIN=town.example.org bash
# Only touches its own folder (/opt/leviathan-lite) and its own container.
set -euo pipefail

RAW="https://raw.githubusercontent.com/tratratraktor-arch/leviathan-town/main/lite"
DIR="${DIR:-/opt/leviathan-lite}"
PORT=8090
DOMAIN="${DOMAIN:-}"

if [ "$(id -u)" -ne 0 ]; then
	echo "Запусти скрипт от root (sudo -i, потом снова команду)." >&2
	exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
	echo "Нужен Docker с docker compose." >&2
	exit 1
fi

mkdir -p "$DIR/data"
cd "$DIR"
# the image runs as the "node" user (uid 1000), it has to be able to write skins
chown -R 1000:1000 data

echo "==> Скачиваю docker-compose.yml"
curl -fsSL "$RAW/docker-compose.yml" -o docker-compose.yml

if [ -n "$DOMAIN" ]; then
	echo "GAME_BIND=127.0.0.1:$PORT" > .env
fi

echo "==> Скачиваю образ игры и запускаю"
docker compose pull
docker compose up -d --no-build
docker image prune -f >/dev/null

echo
echo "Готово."
if [ -n "$DOMAIN" ]; then
	echo "Игра: https://$DOMAIN/ (если в Caddyfile есть блок для этого адреса)"
	echo
	echo "$DOMAIN {"
	echo "	reverse_proxy 127.0.0.1:$PORT"
	echo "}"
else
	echo "Игра: http://IP_СЕРВЕРА:$PORT/"
fi
