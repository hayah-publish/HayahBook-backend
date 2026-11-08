FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
USER node

# Port 7860 is default for Hugging Face Spaces, or any PORT from environment
ENV PORT=7860
EXPOSE 7860

CMD ["npm", "run", "start:prod"]
