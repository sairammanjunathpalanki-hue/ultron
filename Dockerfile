# ===================================================
# ULTRON CLOUD BACKEND DOCKERFILE
# Deployable to Render, Railway, Fly.io, AWS ECS, GCP Cloud Run
# ===================================================

FROM node:20-alpine AS runner

WORKDIR /app

# Install build essentials if needed
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json ./

# Install production and build dependencies
RUN npm install

# Copy application backend, shared types, and production APK
COPY server/ ./server/
COPY shared/ ./shared/
COPY tsconfig.json ./
COPY ULTRON.apk ./ULTRON.apk

# Create sandbox and logs directories
RUN mkdir -p /app/sandbox /app/logs /app/data

# Expose dynamic port for cloud environments (Render, Railway, Fly.io, etc.)
ENV PORT=3001
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV SANDBOX_PATH=/app/sandbox

EXPOSE 3001

# Launch backend via tsx runtime
CMD ["npm", "start"]
