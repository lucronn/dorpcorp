FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json package-lock.json ./
RUN npm install --omit=dev --ignore-scripts
COPY dist ./dist
COPY src ./src
COPY server.ts index.html metadata.json tsconfig.json vite.config.ts ./
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
