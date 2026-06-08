# GB-Dashboard for the Johannische Kirche

This project is a dashboard for the Johannische Kirche to help in the task of creating a new singbook.
It's written in Vue 3 with vuetify as the UI framework and a directus backend.

![dashboard.png](example-views%2Fdashboard.png)

## Features

Based on the dashboard images shown, here's a comprehensive feature list that could be added to the readme:

# Features

![gb-dashboard-feature](https://github.com/user-attachments/assets/06eea6bb-c84b-470c-bf55-67a9b6d2e9a7)

### Dashboard Overview
- Show various information on a glance
- Total counts for: songs, texts, melodies and tasks
- Distribution of categories, task groups and song ratings

### Work Task Management
- Task categorization system
- Task status tracking
- Assignment and tracking of:
    - Texts needing melodies
    - Melodies needing texts
    - Author inquiries
    - Melody revisions
    - Other tasks

### Content Administration
- Upload system for songs, texts, and melodies
- Missing assignments tracking
- Duplicate entry detection
- Content search functionality
- Sorting and filtering capabilities
- Pagination controls

### Data Visualization
- Interactive pie charts for category distribution
- Bar charts for text-melody distribution
- Task distribution visualization
- Rating overview charts

### Performance & Offline Support
- Service Worker caching for improved performance
- Song data cached for 1 hour
- Documents (PDFs, images, audio) cached for 1 week
- Offline access to previously viewed content
- Cache controls in footer (enable/disable, clear cache)
- Toast notifications when data is loaded from cache
- Cache hit statistics

See [CACHE_README.md](CACHE_README.md) for detailed documentation on caching functionality.

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

## Usage

There are two user accounts used for logging into the GB-Dashboard:

1. **AK-Gesangbuch**: The default user account for general access.
2. **Kleiner-AK**: A special user account with additional permissions.

There is no registration process; all users share these accounts for simplicity. However, logging into Directus with the same user credentials can cause sessions to overwrite each other, leading to users being logged out unexpectedly. This session overwrite issue is the reason we use a shared authentication token instead of the more secure method of individual logins.

Each alias is backed by its own Directus account on the remote, so each alias uses its own static token:

- **AK-Gesangbuch** → `VITE_AUTH_TOKEN`
- **Kleiner-AK** → `VITE_SPECIAL_AUTH_TOKEN` (falls back to `VITE_AUTH_TOKEN` if left empty)

### Setting up the Shared Tokens

1. **Generate a static authentication token in Directus** (once per account):
    - Log in to your Directus instance as an admin.
    - Navigate to **Settings** > **Roles & Permissions**.
    - Select the role associated with the user account.
    - Go to the **Tokens** tab and create a new static token.

2. **Obfuscate each token** so it is not a plain, grep-able string in the built bundle:
    ```
    npm run obfuscate-token -- YOUR_AK_GESANGBUCH_TOKEN
    npm run obfuscate-token -- YOUR_KLEINER_AK_TOKEN
    ```
    Each command prints an `obf:...` value.

    > **Note:** this is deterrence only, **not** real security. Because the frontend
    > talks to Directus directly, the decoded token still travels in the
    > `Authorization` header and can be read from the browser's network tab. The
    > obfuscation only keeps the token from appearing verbatim in the JS source. To
    > make the token genuinely secret it must move behind a server-side proxy. A
    > plain (un-obfuscated) token in the `.env` still works if you accept that.

3. **Set the tokens in the frontend environment variables**:
    - Open your `.env` file.
    - Set `VITE_AUTH_TOKEN` to the obfuscated **AK-Gesangbuch** token
      and `VITE_SPECIAL_AUTH_TOKEN` to the obfuscated **Kleiner-AK** token:
      ```
      VITE_AUTH_TOKEN=obf:...
      VITE_SPECIAL_AUTH_TOKEN=obf:...
      ```

By using these shared tokens, all users can authenticate with the application simultaneously without causing session conflicts in Directus. While this approach is less secure than individual logins, it prevents users from being logged out due to session overwrites.

It shouldn't be difficult to implement individual logins in the future, but for now, this shared token system is the most practical solution.

## License

This project is licensed under the [MIT License](LICENSE).

