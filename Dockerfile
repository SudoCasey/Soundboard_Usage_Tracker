FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Install dependencies with exact versions
RUN npm ci --only=production

# Install required system dependencies for canvas
RUN apt-get update && \
    apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy app source
COPY . .

# Use non-root user for security
RUN chown -R node:node /usr/src/app
USER node

# Start the application
CMD [ "npm", "start" ] 