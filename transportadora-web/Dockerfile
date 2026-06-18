FROM node:24.17.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY transportadora-api/package.json transportadora-api/package.json
COPY transportadora-web/package.json transportadora-web/package.json
RUN npm ci
COPY transportadora-web transportadora-web
ARG VITE_API_URL=""
ARG VITE_BASE_PATH="/"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build --workspace transportadora-web

FROM nginx:stable-alpine AS runtime
COPY transportadora-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/transportadora-web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
