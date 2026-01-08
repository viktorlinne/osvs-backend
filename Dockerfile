# Multi-stage Dockerfile for osvs-backend

# Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build

# Runtime
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production --silent
# Copy built files from builder
COPY --from=builder /app/dist ./dist
# Ensure DB schema is available to the compiled migration script
# (migration looks for /app/dist/db/schema.sql)
COPY --from=builder /app/src/db/schema.sql ./dist/db/schema.sql
# Create uploads directory (Railway manages volumes via the UI)
RUN mkdir -p /app/public/uploads
# NOTE: Railway blocks the Dockerfile `VOLUME` instruction. If you need
# a persistent volume for uploads, create and attach a Railway volume
# in the project settings and map it to `/app/public/uploads` there.
# See: https://docs.railway.app/reference/volumes
EXPOSE 4000
CMD ["node", "dist/index.js"]
