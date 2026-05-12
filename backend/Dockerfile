# Backend Dockerfile for SMS
FROM node:20-alpine AS base

# Puppeteer on Alpine should use system Chromium (bundled Chrome won't work on musl).
# Install Chromium runtime deps in the final image; and skip Puppeteer download during npm install.

# Install dependencies only when needed
FROM base AS deps

# Install build dependencies for bcrypt
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Install Chromium for PDF rendering (Puppeteer)
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

# Copy necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

USER nestjs

EXPOSE 3001

# Start the application
CMD ["node", "dist/src/main.js"]
