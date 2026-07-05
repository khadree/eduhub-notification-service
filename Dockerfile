# # Build stage
# FROM node:18-alpine AS builder

# # Set working directory
# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# # Install dependencies
# RUN npm ci --only=production

# # Production stage
# FROM node:18-alpine

# # Install dumb-init for proper signal handling
# RUN apk add --no-cache dumb-init

# # Create app user
# RUN addgroup -g 1001 -S nodejs && \
#     adduser -S nodejs -u 1001

# # Set working directory
# WORKDIR /app

# # Copy dependencies from builder
# COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# # Copy application files
# COPY --chown=nodejs:nodejs . .

# # Create logs directory
# RUN mkdir -p logs && chown nodejs:nodejs logs

# # Switch to non-root user
# USER nodejs

# # Expose port
# EXPOSE 3000

# # Health check
# HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
#   CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# # Use dumb-init to handle signals properly
# ENTRYPOINT ["dumb-init", "--"]

# # Start application
# CMD ["node", "src/index.js"]


# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

# Production stage
FROM node:22-alpine

# Patch OS packages to latest available for this Alpine release
RUN apk update && apk upgrade --no-cache

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Strip npm's own CLI + yarn + corepack — not needed at runtime,
# and their bundled deps are what's driving the Node.js CVEs
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /opt/yarn-v* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx \
             /usr/local/bin/yarn /usr/local/bin/yarnpkg \
             /usr/local/bin/corepack

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application files
COPY --chown=nodejs:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "src/index.js"]