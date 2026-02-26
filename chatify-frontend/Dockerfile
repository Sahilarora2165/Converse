# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Declare build args — without ARG, docker-compose build args are silently ignored
ARG VITE_API_URL=""
ARG VITE_WS_URL="/ws"

# Expose to Vite at build time
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Run Stage ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80