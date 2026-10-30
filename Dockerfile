# Leviathan Town: build the 2019 Pony Town code on Node 10, ship a slim runtime image

FROM node:10-buster AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --unsafe-perm --no-audit
COPY . .
RUN mkdir -p logs && cp -n config-leviathan.json config.json && npx gulp build \
	&& rm -rf assets-source .git config.json

FROM node:10-buster-slim
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p logs
EXPOSE 8090
CMD ["node", "pony-town.js", "--login", "--admin", "--game"]
