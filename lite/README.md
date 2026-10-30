# Leviathan Town Lite

Лёгкая версия игры клана SGL. Не тянет весь Pony Town: свой маленький сервер на Node.js
(одна зависимость, `ws`), без базы данных, картинки природы взяты из Pony Town.

- Вход: ник, потом импорт пони из полосок кадров, выгруженных из Pony Town
  (стояние обязательно; ходьба, сидение, лежание, полёт, буп по желанию).
  Ник и номер скина хранятся в браузере игрока, аккаунтов пока нет.
- Скины лежат файлами в `data/skins/` (каждый 20–100 КБ).
- Игроки видят друг друга: сервер пересылает координаты по WebSocket.
- Образ около 60 МБ в сжатом виде, в памяти около 10–30 МБ.

## Файлы

- `server.js` отдаёт файлы игры, принимает скины (`POST /api/skin`) и пересылает движения игроков (`/ws`).
- `public/main.js` меню: ник и импорт.
- `public/skin-import.js` разбор картинки из Pony Town: масштаб, кадры, точка опоры.
- `public/skins.js` загрузка скинов и выбор кадра.
- `public/game.js` локация, управление, рисование, связь с сервером.
- `public/assets/` трава и объекты из Pony Town (CC BY-NC 4.0).

## Запуск на VPS

Нужен Docker. Команда ставит игру в `/opt/leviathan-lite` и больше ничего на сервере не трогает:

```bash
curl -fsSL https://raw.githubusercontent.com/tratratraktor-arch/leviathan-town/main/lite/deploy.sh | DOMAIN=town.sunguard-leviathan.duckdns.org bash
```

Обновление: та же команда. Удаление: `cd /opt/leviathan-lite && docker compose down && cd / && rm -rf /opt/leviathan-lite`.

## Запуск у себя

```bash
cd lite
npm install
node server.js   # http://localhost:8090/
```
