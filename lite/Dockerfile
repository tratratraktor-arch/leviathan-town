FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js ./
COPY public ./public
ENV DATA_DIR=/app/data
EXPOSE 8090
USER node
CMD ["node", "server.js"]
