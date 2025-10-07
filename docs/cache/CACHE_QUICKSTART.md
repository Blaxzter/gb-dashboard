# Service Worker Cache - Quick Start

## What Was Added

A complete service worker caching system has been implemented for your GB-Dashboard application. Here's what you get:

### ✅ Automatic Caching
- **Song data**: Cached for 1 hour (all `/items/*` API requests)
- **Documents**: Cached for 1 week (all `/assets/*` - PDFs, images, audio files)

### ✅ User Controls (in Footer)
- **Cache Toggle**: Enable/disable caching with a switch
- **Clear Cache Button**: Manually clear all cached data
- **Cache Hit Counter**: Shows how many items were loaded from cache

### ✅ User Feedback
- Toast notifications appear when data is loaded from cache
- Visual indicators show cache status

## Testing the Feature

### 1. Build and Test in Production Mode

```bash
# Build the application
pnpm build

# Preview the production build
pnpm preview
```

Then open your browser to `http://localhost:4173` (or the preview port shown).

### 2. Verify Service Worker is Active

1. Open Chrome DevTools (F12)
2. Go to **Application** tab → **Service Workers**
3. You should see `/service-worker.js` registered and active

### 3. Test the Cache

1. **Navigate to a song** that has documents/images
2. **Check the footer** - you should see:
   - Cache toggle (should be "aktiviert" by default)
   - "Cache leeren" button
3. **Reload the page** (F5)
4. You should see toast notifications like:
   - "Liederdaten aus Cache geladen"
   - "Dokument aus Cache geladen"
5. **Check the cache hit counter** - it should increment

### 4. Test Offline Mode

1. **Load a few songs** (with their images/PDFs)
2. Open DevTools → **Network** tab
3. Check **"Offline"** box at the top
4. **Navigate back to previously viewed songs** - they should still load!

### 5. Test Cache Toggle

1. **Disable cache** using the footer switch
2. Reload the page
3. No cache notifications should appear
4. Check Network tab - requests should go to the network

## Development Mode

By default, the service worker only runs in production. To enable it during development:

1. Add to your `.env` file:
   ```
   VITE_ENABLE_SW=true
   ```

2. Or modify `src/main.js` line 27:
   ```javascript
   // Change from:
   if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW) {
   
   // To:
   if (true) {  // Always enable
   ```

## Files Added/Modified

### New Files
- `public/service-worker.js` - Service worker implementation
- `src/store/cache.js` - Cache state management (Pinia store)
- `src/utils/serviceWorkerRegistration.js` - Service worker registration
- `CACHE_README.md` - Detailed documentation
- `CACHE_QUICKSTART.md` - This file

### Modified Files
- `src/main.js` - Added service worker registration
- `src/layouts/default/FooterBar.vue` - Added cache controls
- `src/layouts/new/FooterBar.vue` - Added cache controls
- `README.md` - Added cache feature documentation

## Debugging

### Console Logs

The service worker now has **extensive console logging** to help you debug! Open the browser console (F12) and you'll see detailed logs with prefixes:

- **`[Main]`** - App initialization
- **`[App]`** - Service worker registration
- **`[SW]`** - Service worker operations (caching, fetching)
- **`[Cache Store]`** - Cache state management

**What to look for:**
```
[SW] ✅ Service Worker activated and ready!
[SW] 📡 Intercepted request: ...
[SW] ✅ Serving FRESH cache: ...
[App] 💾 Cache hit detected!
```

See [CACHE_DEBUG_GUIDE.md](CACHE_DEBUG_GUIDE.md) for complete debugging instructions and log examples.

## Troubleshooting

### Service Worker Not Showing
- Make sure you built with `pnpm build` and using `pnpm preview`
- Service workers require HTTPS or localhost
- Check browser console for `[Main]` and `[App]` logs
- Look for errors in the console

### Cache Not Working
- Open console and look for `[SW]` logs
- Verify the service worker is active in DevTools → Application
- Check that cache toggle is enabled (green) in the footer
- Look for `[SW] 📡 Intercepted request:` logs
- Try clearing the cache and reloading

### Stale Data
- Use "Cache leeren" button in footer
- Or hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
- Check console for `[SW] Cache age: ...` to see cache freshness

### Not Seeing Cache Hits
- First load will always be a cache miss (see `[SW] ❌ Not found in cache`)
- Second load should show `[SW] ✅ Serving FRESH cache`
- Check if URL matches patterns: `/items/*` or `/assets/*`
- Verify cache is enabled in footer

## How It Works (Simple Version)

1. User visits a song page
2. Service worker intercepts requests
3. **First time**: Data fetched from network and cached
4. **Next time**: 
   - If cache is fresh → served from cache (instant!)
   - If cache is stale → fetched from network and re-cached
5. User sees toast notification when cache is used

## Cache Expiration

- **Song data** expires after 1 hour
- **Documents** expire after 1 week
- Expired cache is automatically refreshed from network
- You can manually clear cache anytime using the footer button

## Benefits

✅ **Faster load times** - No waiting for server response  
✅ **Offline support** - View previously loaded songs without internet  
✅ **Reduced server load** - Less requests to your backend  
✅ **Better UX** - Instant navigation between songs  
✅ **User control** - Can disable or clear cache anytime  

## Next Steps

1. **Test it**: Build and test the caching functionality
2. **Customize**: Adjust cache durations in `public/service-worker.js` if needed
3. **Monitor**: Watch the cache hit counter to see how effective it is
4. **Deploy**: Deploy to production and enjoy faster page loads!

For more detailed information, see [CACHE_README.md](CACHE_README.md).
