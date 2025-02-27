#!/bin/sh

# Define the HOST_URL variable; default to 'http://directus:8055' if not set
# HOST_URL=${HOST_URL:-http://localhost:8055}
HOST_URL=${HOST_URL:-http://directus:8055}

echo "Waiting for Directus to be available... ($HOST_URL)"
until $(curl --output /dev/null --silent --head --fail "$HOST_URL/server/health"); do
    printf '.'
    sleep 5
done

echo "Directus is up, checking if initialization is needed..."

TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email": "'"$ADMIN_EMAIL"'", "password": "'"$ADMIN_PASSWORD"'"}' \
  "$HOST_URL/auth/login" | jq -r '.data.access_token')

# Check if a specific collection exists to determine if initialization is needed
COLLECTION_EXISTS=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$HOST_URL/collections/autor" | jq -r '.data')

if [ "$COLLECTION_EXISTS" = "null" ]; then
    echo "Initialization needed, running directus-sync push..."

    # Run directus-sync push to sync your schema and data
    npx directus-sync@3.1.5 push -u "$HOST_URL" -e "$ADMIN_EMAIL" -p "$ADMIN_PASSWORD"

    # Obtain an admin access token
    TOKEN=$(curl -s -X POST -d "email=$ADMIN_EMAIL&password=$ADMIN_PASSWORD" \
      "$HOST_URL/auth/login" | jq -r '.data.access_token')

    echo "Initialization complete."
else
    echo "Initialization already done, skipping."
fi
