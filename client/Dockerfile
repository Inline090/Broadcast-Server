# Build the client, then serve the static bundle with nginx
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
RUN npm ci --workspace=@broadcast-server/client

COPY client/ client/
RUN npm run build --workspace=@broadcast-server/client

FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
