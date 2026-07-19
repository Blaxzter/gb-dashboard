# Use node 22 as the base image (pnpm 11 requires Node >= 22.13)
FROM node:22-slim AS build-stage

RUN npm install -g pnpm@11.15.0

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN pnpm install

# Copy the rest of the application files to the working directory
COPY . .

# Build the application
RUN pnpm run build

FROM nginx:stable-alpine AS production-stage

# Install envsubst
RUN apk add --no-cache gettext

WORKDIR /usr/share/nginx/html
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy nginx.conf template - use default.conf.template for proper processing
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
