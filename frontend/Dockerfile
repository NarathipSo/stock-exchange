# frontend/Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Allow external access for Vite (important for Docker)
CMD ["npm", "run", "dev", "--", "--host"] 