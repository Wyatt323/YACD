FROM node:22-alpine
WORKDIR /app
COPY icon-store.cjs ./icon-store.cjs
ENV YACD_ICON_HOST=0.0.0.0 \
    YACD_ICON_PORT=3001 \
    YACD_ICON_DATA_FILE=/data/group-icons.json
CMD ["node", "/app/icon-store.cjs"]
