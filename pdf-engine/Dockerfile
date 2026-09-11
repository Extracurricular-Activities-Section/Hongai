# Hongai PDF engine — Cloudflare Containers / any linux/amd64 Node host.
# Build context: this directory (pdf-engine/).
FROM node:22-bookworm-slim

WORKDIR /app

# 預設：開源楷體近似 + Liberation Serif（Times 計量相容）。
# 正式若要「標楷體／Times New Roman」，把 kaiu.ttf、times.ttf、timesbd.ttf
# 放到 pdf-engine/fonts/（勿 commit 未授權字型）或設 PDF_FONT_*_PATH。
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fontconfig \
    fonts-arphic-bkai00mp \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/* \
  && fc-cache -f

COPY package.json ./
RUN npm install --omit=dev

COPY config.js generate.js types.js service.mjs docker-entrypoint.sh ./
COPY fonts ./fonts
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PDF_SERVICE_HOST=0.0.0.0
ENV PDF_SERVICE_PORT=8080
ENV PDF_FONT_CJK_PATH=/usr/share/fonts/truetype/arphic/bkai00mp.ttf
ENV PDF_FONT_LATIN_PATH=/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf
ENV PDF_FONT_LATIN_BOLD_PATH=/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf

EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
