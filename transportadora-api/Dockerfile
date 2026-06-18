FROM node:24.17.0-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS dependencies
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY transportadora-api/package.json transportadora-api/package.json
COPY transportadora-web/package.json transportadora-web/package.json
RUN npm ci
COPY transportadora-api/prisma transportadora-api/prisma
RUN npm run prisma:generate --workspace transportadora-api

FROM dependencies AS build
COPY transportadora-api transportadora-api
RUN npm run build --workspace transportadora-api

FROM build AS migrate
ENV NODE_ENV=production
CMD ["npm", "run", "prisma:deploy", "--workspace", "transportadora-api"]

FROM build AS production-dependencies
RUN npm prune --omit=dev --omit=optional --workspace transportadora-api --include-workspace-root

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY transportadora-api/package.json transportadora-api/package.json
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/transportadora-api/.build transportadora-api/.build
COPY --from=build /app/transportadora-api/prisma transportadora-api/prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "transportadora-api/.build/src/main.js"]
