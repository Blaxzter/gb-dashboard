# GB-Dashboard for the Johannische Kirche

This project is a dashboard for the Johannische Kirche to help in the task of creating a new singbook.
It's written in Vue 3 with vuetify as the UI framework and a directus backend.

![dashboard.png](example-views%2Fdashboard.png)

## Project setup

### Frontend

```bash
# Install dependencies
pnpm install

# Hot Reload for development
pnpm dev

# Build for production
pnpm build
```

### Backend

The backend is a directus instance.
The schemas are defined in the `directus-config` folder and synced using the [directus-extension-sync](https://github.com/tractr/directus-sync) .
You can build the directus instance either by using the provided `Dockerfile.directus` or by installing the extension yourself in your directus instance.

If you are using the `docker-compose.full.yml` file the first time the schemas will be created automatically.
Otherwise, you can use `npx directus-sync push -u directus-address -e "username" -p "password"` in the top directory to push the schemas to the directus instance.

