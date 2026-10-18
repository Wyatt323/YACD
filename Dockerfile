FROM --platform=$BUILDPLATFORM oven/bun:alpine AS builder
WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build \
  # remove source maps - people like small image
  && rm public/*.map || true

FROM --platform=$TARGETPLATFORM nginx:alpine
RUN apk add --no-cache nodejs
COPY docker/nginx-default.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/public /usr/share/nginx/html
COPY server/icon-store.cjs /opt/yacd/icon-store.cjs
ENV YACD_DEFAULT_BACKEND "http://127.0.0.1:9090"
ADD docker-entrypoint.sh /
CMD ["/docker-entrypoint.sh"]
