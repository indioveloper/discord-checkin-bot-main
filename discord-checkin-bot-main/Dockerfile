FROM node:20-alpine

WORKDIR /app

# Fonts required by @napi-rs/canvas on Alpine
RUN apk add --no-cache fontconfig ttf-freefont

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Ensure data directory exists and users.json is present
RUN mkdir -p data && \
    [ -f data/users.json ] || echo '{}' > data/users.json

CMD ["node", "src/index.js"]
