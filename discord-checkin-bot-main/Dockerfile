FROM node:20-slim

WORKDIR /app

# Fonts required by @napi-rs/canvas
RUN apt-get update && \
    apt-get install -y --no-install-recommends fontconfig fonts-freefont-ttf && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Ensure data directory exists and users.json is present
RUN mkdir -p data && \
    [ -f data/users.json ] || echo '{}' > data/users.json

CMD ["node", "src/index.js"]
