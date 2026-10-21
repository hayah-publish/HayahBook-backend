FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Port 7860 is default for Hugging Face Spaces, or any PORT from environment
ENV PORT=7860
EXPOSE 7860

CMD ["npm", "run", "start:prod"]
