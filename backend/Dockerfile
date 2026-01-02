# backend/Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose API Port
EXPOSE 3001

# Start the main server by default
# Note: You will need to run the workers separately or via a supervisor, 
# but for simple Docker Compose, we can run them as separate services sharing this image.
CMD ["npm", "run", "dev"]