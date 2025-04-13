# Use the official Node.js 18 Alpine image which has a smaller attack surface
FROM node:18-alpine

# Install required system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Create app directory and set as working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies with exact versions and production only
RUN npm ci --only=production \
    && npm cache clean --force

# Copy app source
COPY . .

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /usr/src/app

# Switch to non-root user
USER appuser

# Start the application
CMD [ "npm", "start" ] 