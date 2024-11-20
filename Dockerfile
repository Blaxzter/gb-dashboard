# Use node 19 as the base image
FROM node:20-slim as build-stage

RUN npm install -g pnpm

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

FROM nginx:stable-alpine as production-stage

# Install envsubst
RUN apk add --no-cache gettext

# Install dos2unix to convert line endings
RUN apk add --no-cache dos2unix

WORKDIR /usr/share/nginx/html
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy nginx.conf template
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template

# Copy entrypoint script and convert line endings
COPY entrypoint.sh /entrypoint.sh
RUN dos2unix /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

#ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
