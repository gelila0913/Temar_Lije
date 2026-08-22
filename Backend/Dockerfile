# ==============================================================================
# Multi-Stage Dockerfile for Temar Lije Backend (NestJS / Node.js)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Stage (Compile TypeScript & Generate Prisma Client)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies required for native modules (e.g. bcrypt) and database queries (Prisma)
RUN apk add --no-cache python3 make g++ libc6-compat openssl

# Copy package manifests first for optimal Docker layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for compiling)
RUN npm ci

# Generate Prisma Client code
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy source code and build configurations
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Compile TypeScript to JavaScript in /usr/src/app/dist
RUN npm run build

# Prune devDependencies to keep only production dependencies
RUN npm prune --omit=dev && npm cache clean --force

# ------------------------------------------------------------------------------
# Stage 2: Production Runner (Lean, Secure, Minimal Image)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Set working directory
WORKDIR /usr/src/app

# Install dumb-init, healthcheck dependencies, and libraries for database queries (Prisma)
RUN apk add --no-cache dumb-init libc6-compat openssl

# Copy production dependencies and compiled artifacts from builder stage
COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

# Create uploads directory structure and ensure write permissions
RUN mkdir -p uploads/materials uploads/assignments uploads/submissions && chmod -R 777 uploads && chown -R node:node /usr/src/app

# Switch to non-root node user for security
USER node

# Expose backend application port
EXPOSE 3000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start application with dumb-init for graceful shutdown & signal forwarding
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma db push && node dist/main.js"]
