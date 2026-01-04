# Build Stage
FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Serve Stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Optional: Custom Nginx config if needed for React Router (Single Page App)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]