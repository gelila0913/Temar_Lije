# ==============================================================================
# Multi-Stage Dockerfile for Temar Lije Frontend (React / Vite + Nginx)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend Assets
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Serve Static Assets with High-Performance Nginx
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts from builder stage
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy custom nginx configuration with SPA routing and API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
