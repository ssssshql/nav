# Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY client/package.json client/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install
COPY client/ .
RUN pnpm build

# Build backend and serve
FROM node:20-alpine
WORKDIR /app

# Copy server dependencies
COPY server/package.json server/pnpm-lock.yaml* ./server/
RUN cd server && npm install -g pnpm && pnpm install --prod

# Copy source code
COPY server/ ./server/
# Copy frontend build artifacts to ../client/dist relative to server/app.js
COPY --from=builder /app/dist ./client/dist/

# Set working directory to server so relative paths work
WORKDIR /app/server

EXPOSE 3000
CMD ["node", "app.js"]
