#!/usr/bin/env bash
# Leviathan Town: install or update the game on a fresh Ubuntu/Debian VPS.
# Usage (as root): curl -fsSL https://raw.githubusercontent.com/tratratraktor-arch/leviathan-town/main/deploy.sh | DOMAIN=town.example.org bash
# With DOMAIN set the game listens on 127.0.0.1:8090 only and is served by your reverse proxy (Caddy).
set -euo pipefail

REPO="https://github.com/tratratraktor-arch/leviathan-town.git"
BRANCH="${BRANCH:-main}"
DIR="${DIR:-/opt/leviathan-town}"
PORT=8090
DOMAIN="${DOMAIN:-}"

if [ "$(id -u)" -ne 0 ]; then
	echo "Запусти скрипт от root (sudo -i, потом снова команду)." >&2
	exit 1
fi

echo "==> Проверяю git и Docker"
if ! command -v git >/dev/null; then
	apt-get update -y && apt-get install -y git curl
fi
if ! command -v docker >/dev/null; then
	curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
	apt-get update -y && apt-get install -y docker-compose-plugin
fi

echo "==> Скачиваю код ($BRANCH)"
if [ -d "$DIR/.git" ]; then
	git -C "$DIR" fetch origin "$BRANCH"
	git -C "$DIR" checkout -q "$BRANCH"
	git -C "$DIR" reset -q --hard "origin/$BRANCH"
else
	git clone -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

if [ ! -f config.json ]; then
	echo "==> Создаю config.json"
	if [ -n "$DOMAIN" ]; then
		HOST_URL="https://$DOMAIN/"
	else
		IP="$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')"
		HOST_URL="http://$IP:$PORT/"
	fi
	SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
	TOKEN="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
	sed -e "s#http://YOUR_SERVER_IP:8090/#$HOST_URL#" \
		-e "s#CHANGE_ME_RANDOM_STRING#$SECRET#" \
		-e "s#CHANGE_ME_ANOTHER_RANDOM_STRING#$TOKEN#" \
		config-leviathan.json > config.json
fi
mkdir -p logs

if [ -n "$DOMAIN" ]; then
	echo "GAME_BIND=127.0.0.1:$PORT" > .env
elif command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
	ufw allow "$PORT"/tcp
fi

echo "==> Собираю и запускаю (первый раз 5-10 минут)"
docker compose up -d --build

HOST="$(grep -o '"host": *"[^"]*"' config.json | sed 's/.*"\(http[^"]*\)"/\1/')"
echo
echo "Готово. Игра: $HOST"
echo "Логи: cd $DIR && docker compose logs -f game"
if [ -n "$DOMAIN" ]; then
	echo
	echo "Добавь в Caddyfile (обычно /etc/caddy/Caddyfile) и выполни: systemctl reload caddy"
	echo
	echo "$DOMAIN {"
	echo "	reverse_proxy 127.0.0.1:$PORT"
	echo "}"
fi
