FROM node:22-alpine

WORKDIR /app

# Install only the server workspace's production dependencies
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci --omit=dev --workspace=@broadcast-server/server

COPY server/ server/

EXPOSE 8080
CMD ["node", "server/src/index.js"]
