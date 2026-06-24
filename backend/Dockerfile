# Qoders backend — Node + TypeScript, compiled to dist/. Includes Chromium for Puppeteer
# (AI style-guide generation renders sites headlessly to read exact computed styles).

# ---- build stage (compile TS) ----
FROM node:22-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# Chromium runtime libraries (Puppeteer downloads its own Chromium; these are the OS deps it needs)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
      libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
      libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
      libxkbcommon0 libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# install prod deps; puppeteer's postinstall downloads a matching Chromium into the image
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
