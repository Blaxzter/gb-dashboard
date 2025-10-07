# Service Worker Cache Documentation

This application implements a service worker to cache song data and documents for improved performance and offline capabilities.

## Features

### 1. **Automatic Caching**
- **Song Data**: Cached for 1 hour
  - All API requests to `/items/*` endpoints (songs, texts, melodies, etc.)
- **Documents**: Cached for 1 week
  - All asset requests to `/assets/*` endpoints (PDFs, images, audio files)

### 2. **Cache Control UI**
Located in the footer of every page:
- **Cache Toggle**: Enable/disable caching on-the-fly
- **Clear Cache Button**: Manually clear all cached data
- **Cache Hit Counter**: Shows how many items were loaded from cache (songs and documents separately)

### 3. **Toast Notifications**
Users are notified when data is loaded from cache:
- "Liederdaten aus Cache geladen" - when song data is served from cache
- "Dokument aus Cache geladen" - when a document is served from cache
- Success/error messages when toggling or clearing cache

## How It Works

### Service Worker Strategy
The service worker uses a **Cache-First with Network Fallback** strategy:

1. **Cache Check**: When a request is made, the service worker first checks if there's a fresh cached response
2. **Fresh Cache**: If the cached data is still within the expiration time, it's served immediately
3. **Network Fetch**: If no cache exists or it's expired, fetch from the network
4. **Cache Update**: Successful network responses are cached for future use
5. **Stale Fallback**: If the network fails and there's a stale cache, serve the stale cache

### Cache Duration
- **Song Data**: 60 minutes (1 hour)
- **Documents**: 10,080 minutes (1 week)

Cache freshness is tracked using custom headers:
- `X-Cache-Time`: Timestamp when the response was cached
- `X-Cache-Duration`: Duration (in milliseconds) that the cache is considered fresh
- `X-Cache-Source`: Always set to "service-worker" for identification

### Cache Storage
- **Song Cache Name**: `song-data-v1`
- **Document Cache Name**: `documents-v1`
- **Settings Storage**: Uses IndexedDB (`GesangbuchCache` database) to persist cache enable/disable state

## Development

### Enable Service Worker in Development
By default, the service worker only runs in production builds. To enable it in development, set the environment variable:

```bash
VITE_ENABLE_SW=true
```

Or modify `main.js`:
```javascript
// Change this condition
if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW) {
  // Service worker registration
}
```

### Testing the Service Worker

1. **Build the application**:
   ```bash
   npm run build
   npm run preview
   ```

2. **Open DevTools**:
   - Go to Application → Service Workers
   - Check if the service worker is registered and active

3. **Test Cache**:
   - Open Network tab with "Disable cache" unchecked
   - Navigate to a song
   - Refresh the page
   - Check if requests show "(from ServiceWorker)" in the Size column

4. **Test Offline**:
   - Load some songs and documents
   - Go offline (DevTools → Network → Offline)
   - Previously viewed songs and documents should still load from cache

### Clearing Cache During Development

To clear all caches:
```javascript
// In browser console
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
});
```

Or use the "Clear Cache" button in the footer.

## File Structure

```
/public/service-worker.js              # Service worker implementation
/src/store/cache.js                     # Cache state management (Pinia store)
/src/utils/serviceWorkerRegistration.js # Service worker registration utilities
/src/layouts/default/FooterBar.vue      # Footer with cache controls (default layout)
/src/layouts/new/FooterBar.vue          # Footer with cache controls (new layout)
/src/main.js                            # App entry point with SW registration
```

## API Integration

The service worker intercepts all fetch requests and determines if they should be cached based on URL patterns:

```javascript
// Cached URLs
/items/gesangbuchlied    → Song data (1 hour)
/items/text              → Text data (1 hour)
/items/melodie           → Melody data (1 hour)
/assets/[file_id]        → Documents (1 week)

// Not cached
/auth/*                  → Authentication endpoints
/users/*                 → User management
(all other endpoints)
```

## Browser Compatibility

Service Workers are supported in:
- Chrome 40+
- Firefox 44+
- Safari 11.1+
- Edge 17+

The application gracefully degrades if service workers are not supported.

## Troubleshooting

### Service Worker Not Registering
1. Check that you're running over HTTPS or localhost
2. Check browser console for errors
3. Verify service-worker.js is accessible at `/service-worker.js`

### Cache Not Working
1. Check if cache is enabled in the footer toggle
2. Open DevTools → Application → Cache Storage
3. Verify cache entries exist (`song-data-v1`, `documents-v1`)
4. Check Network tab to see if requests are served from service worker

### Stale Data Issues
1. Use the "Clear Cache" button in the footer
2. Toggle cache off and on
3. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Toast Not Showing
1. Check browser console for errors
2. Verify Pinia store is properly initialized
3. Check that `useCacheStore` is imported in FooterBar components

## Future Enhancements

Possible improvements:
- Background sync for offline submissions
- Push notifications for song updates
- Smarter cache invalidation (e.g., based on ETag headers)
- Cache size management (auto-cleanup when cache exceeds size limit)
- Precaching critical resources on install
- Cache analytics dashboard
