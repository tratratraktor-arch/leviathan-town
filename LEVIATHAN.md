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

Нужны Docker и docker compose.

```bash
git clone https://github.com/tratratraktor-arch/leviathan-town.git
cd leviathan-town
cp config-leviathan.json config.json
# в config.json: впиши IP или домен сервера в "host",
# а в "secret" и "token" — две разные случайные строки:
#   openssl rand -hex 32
docker compose up -d --build
```

Первая сборка идёт 5–10 минут. Игра будет на `http://IP_СЕРВЕРА:8090/`.

Обновление после изменений в репозитории:

```bash
git pull
docker compose up -d --build
```

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
