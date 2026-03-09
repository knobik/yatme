FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build frontend
FROM deps AS build
COPY tsconfig.json tsconfig.app.json tsconfig.node.json tsconfig.test.json tsconfig.server.json ./
COPY src/ src/
COPY server/ server/
COPY index.html vite.config.ts ./
ENV VITE_STORAGE=server
RUN npm run build

# Production image
FROM base AS production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    rm -rf node_modules/@img/sharp-libvips-linux-x64 node_modules/@img/sharp-linux-x64
COPY server/ server/
COPY tsconfig.server.json ./
COPY scripts/ scripts/
COPY data/ data/
COPY docker-entrypoint.sh ./
COPY --from=build /app/dist/ dist/

ENV PORT=8080
ENV MAP_DIR=/app/maps
ENV ASSETS_DIR=/app/sprites
EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npx", "tsx", "server/index.ts"]
