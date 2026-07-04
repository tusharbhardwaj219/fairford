# Fair Ford Pharma — Cloud Run image
# The Node API lives in backend/ and also serves the sibling frontend/ and image/
# folders (server.js reads ../frontend and ../image), so all three are copied in
# with backend/ as the working directory.
FROM node:24-slim

# 1) Install backend PRODUCTION deps first (own layer = faster rebuilds).
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# 2) App code + the static folders the server serves via ../frontend and ../image.
#    (.dockerignore keeps node_modules and .env OUT of these copies.)
COPY backend/ ./
COPY frontend/ /app/frontend/
COPY image/ /app/image/

# Safe default; real config/secrets are injected by Cloud Run at runtime.
ENV NODE_ENV=production

# Cloud Run sends traffic to $PORT (default 8080); server.js honors process.env.PORT.
EXPOSE 8080
CMD ["node", "server.js"]
