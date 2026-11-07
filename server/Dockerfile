FROM node:22-alpine AS client
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /client/dist ./public
ENV CLIENT_DIST=/app/public
ENV UPLOADS_DIR=/app/uploads
EXPOSE 3000
CMD ["node", "src/server.js"]
