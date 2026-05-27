FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN npm run build -w @veda/contracts && npm run build -w @veda/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache ttf-dejavu
COPY --from=base /app/node_modules node_modules
COPY --from=base /app/apps/api/dist apps/api/dist
COPY --from=base /app/apps/api/package.json apps/api/package.json
COPY --from=base /app/packages/contracts/dist packages/contracts/dist
COPY --from=base /app/packages/contracts/package.json packages/contracts/package.json
CMD ["node", "apps/api/dist/server.js"]
