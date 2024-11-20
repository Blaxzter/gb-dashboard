#!/bin/sh

# Set default value if NGINX_SERVER_NAME is not set
: "${NGINX_SERVER_NAME:=localhost}"

# Substitute environment variables in nginx.conf
envsubst '$NGINX_SERVER_NAME' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf

# Start Nginx
exec "$@"
