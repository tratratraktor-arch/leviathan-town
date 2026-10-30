# Leviathan Town

Игра клана SGL (SunGuard Leviathan) на открытом коде Pony Town 2019 года
(форк [drewdru/ponyTown](https://github.com/drewdru/ponyTown), версия 0.53.1-alpha).

## Что изменено относительно Pony Town

- Регистрации нет. На главной кнопка **Play as guest**: сервер создаёт гостевой аккаунт
  и запоминает его в браузере (cookie `guest`, год). Маршрут `/auth/guest` в
  `src/ts/server/routes/auth.ts`. Регистрацию через бота добавим позже.
- Если сервер один, он выбирается сам, и игроку остаётся нажать «Play».
- Зависимости зафиксированы на версиях сентября 2019 года (`package-lock.json`),
  TypeScript 3.5.3. Более новые пакеты с этим кодом не собираются.
- Добавлены `Dockerfile`, `docker-compose.yml` и шаблон конфига `config-leviathan.json`.

## Запуск на VPS (Docker)

Игру собирает GitHub Actions (`.github/workflows/docker.yml`) при каждом пуше в `main`
и публикует образ `ghcr.io/tratratraktor-arch/leviathan-town:latest`. VPS только скачивает
готовый образ, поэтому подходит даже маленький сервер (1 ядро, 10 ГБ диска).

Установка и обновление одной командой (от root, Ubuntu/Debian):

```bash
curl -fsSL https://raw.githubusercontent.com/tratratraktor-arch/leviathan-town/main/deploy.sh | DOMAIN=town.sunguard-leviathan.duckdns.org bash
```

С `DOMAIN` игра слушает только `127.0.0.1:8090`, а наружу её отдаёт Caddy:

```
town.sunguard-leviathan.duckdns.org {
	reverse_proxy 127.0.0.1:8090
}
```

Без `DOMAIN` игра будет на `http://IP_СЕРВЕРА:8090/`.

## Запуск для разработки (без Docker)

Нужны Node.js 10 и MongoDB 4.x.

```bash
npm ci --unsafe-perm
cp config-leviathan.json config.json   # "db": "mongodb://localhost:27017/leviathan"
mkdir -p logs
npx gulp build
node pony-town.js --login --admin --game
```

## Админка

Админ-панель: `/admin/`. Выдать роль своему аккаунту (id видно в админке или в базе):

```bash
docker compose exec game node cli.js --addrole <account_id> superadmin
```

## Лицензии

Код Pony Town в public domain (`LICENSE_CODE.txt`). Графика и музыка под
CC BY-NC 4.0 (`LICENSE_ART.txt`, `LICENSE_MUSIC.txt`): только некоммерческое
использование, без доната, с указанием авторов.
