FROM node:22-alpine AS base
ARG UID=1000
ARG GID=1000
RUN if getent passwd $UID > /dev/null 2>&1; then \
      deluser "$(getent passwd $UID | cut -d: -f1)"; \
    fi && \
    if getent group $GID > /dev/null 2>&1; then \
      delgroup "$(getent group $GID | cut -d: -f1)"; \
    fi && \
    addgroup -g $GID yatme && adduser -u $UID -G yatme -D yatme
WORKDIR /app

# Install dependencies
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci && chown -R yatme:yatme /app
USER yatme

# Build frontend
FROM deps AS build
COPY --chown=yatme:yatme tsconfig.json tsconfig.app.json tsconfig.node.json tsconfig.test.json tsconfig.server.json ./
COPY --chown=yatme:yatme src/ src/
COPY --chown=yatme:yatme server/ server/
COPY --chown=yatme:yatme index.html vite.config.ts ./
ENV VITE_STORAGE=server
RUN npm run build

# Production image
FROM base AS production
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    rm -rf node_modules/@img/sharp-libvips-linux-x64 node_modules/@img/sharp-linux-x64 && \
    apk del python3 make g++
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
