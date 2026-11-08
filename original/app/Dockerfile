# Production Dockerfile for Omertà
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy app
COPY server.js db.js ./
COPY dist/ ./dist/
COPY uploads/ ./uploads/

# Expose port
EXPOSE 7777

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7777/health || exit 1

# Start server
CMD ["node", "server.js"]
