FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /app

COPY package*.json ./
# --ignore-scripts skips postinstall (which downloads Playwright browsers)
# The base image already has Chromium — no need to re-download
RUN npm install --ignore-scripts

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
