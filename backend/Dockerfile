# lapa-casa-hostel/backend/Dockerfile

# ===========================================
# BASE STAGE
# ===========================================
FROM node:20-alpine AS base

LABEL maintainer="Lapa Casa Hostel Tech Team"
LABEL description="Channel Manager Backend - Lapa Casa Hostel"
LABEL version="1.0.0"

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# ===========================================
# DEVELOPMENT STAGE
# ===========================================
FROM base AS development

ENV NODE_ENV=development

# Install all dependencies including dev
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start development server
CMD ["npm", "run", "dev"]

# ===========================================
# DEPENDENCIES STAGE (Production)
# ===========================================
FROM base AS dependencies

ENV NODE_ENV=production

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Generate Prisma Client
RUN npx prisma generate

# ===========================================
# BUILD STAGE
# ===========================================
FROM base AS build

ENV NODE_ENV=production

# Install all dependencies for build
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# ===========================================
# PRODUCTION STAGE
# ===========================================
FROM node:20-alpine AS production

ENV NODE_ENV=production
ENV PORT=5000

WORKDIR /app

# Install only runtime dependencies
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application from build stage
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma

# Create logs directory
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start production server
CMD ["node", "dist/server.js"]

# ===========================================
# TEST STAGE
# ===========================================
FROM base AS test

ENV NODE_ENV=test

# Install all dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Run tests
CMD ["npm", "test"]
