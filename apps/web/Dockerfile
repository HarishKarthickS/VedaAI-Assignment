FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY apps/api/src/uploadthing apps/api/src/uploadthing
COPY packages packages
RUN npm run build -w @veda/contracts && npm run build -w @veda/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/apps/web/.next apps/web/.next
COPY --from=base /app/apps/web/package.json apps/web/package.json
COPY --from=base /app/node_modules node_modules
CMD ["npm", "run", "start", "-w", "@veda/web"]
