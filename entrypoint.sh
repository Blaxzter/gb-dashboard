
#!/bin/sh

# Substitute environment variables in nginx.conf
envsubst '$NGINX_SERVER_NAME' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf

# Start Nginx
exec "$@"