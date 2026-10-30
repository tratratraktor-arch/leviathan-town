# Leviathan Town: build and run the 2019 Pony Town code on Node 10
FROM node:10-buster

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --unsafe-perm --no-audit

COPY . .
RUN mkdir -p logs && cp -n config-leviathan.json config.json && npx gulp build

EXPOSE 8090
CMD ["node", "pony-town.js", "--login", "--admin", "--game"]
