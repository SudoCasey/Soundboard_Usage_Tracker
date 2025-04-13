FROM node:20.11.1

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Install dependencies with legacy peer deps flag to avoid conflicts
RUN npm install --legacy-peer-deps

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

# Bundle app source
COPY . .

# Start with required Node.js flags
CMD ["node", "--experimental-fetch", "--experimental-global-webcrypto", "index.js"] 