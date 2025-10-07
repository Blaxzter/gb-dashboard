# Service Worker Cache - Debug Guide

This guide explains the console logs you'll see and how to debug the service worker caching system.

## Console Log Prefixes

All logs use prefixes to identify their source:
- **`[Main]`** - Logs from `main.js` (app initialization)
- **`[App]`** - Logs from service worker registration module
- **`[SW]`** - Logs from the service worker itself
- **`[Cache Store]`** - Logs from the Pinia cache store

## Expected Log Flow

### 1. Initial App Load (First Time)

When you load the app for the first time, you should see:

```
[Main] 🚀 Initializing Service Worker...
[Main] Environment: PRODUCTION
[Main] VITE_ENABLE_SW: undefined
[App] 🚀 Starting Service Worker registration...
[App] ✅ Service Worker API is supported
[App] 📝 Registering Service Worker at /service-worker.js with scope /
[App] ✅ Service Worker registered successfully!
[App] 📍 Scope: http://localhost:4173/
[App] 📊 State: installing/waiting
[Main] ✅ Service Worker registration complete
[Main] 📖 Loading cache settings...
[Cache Store] 📖 Loading cache setting from IndexedDB...
[Cache Store] ℹ️ No saved cache setting found, using default: true
[Main] 📡 Setting up message listener...
[App] 📡 Setting up Service Worker message listener...
[App] ✅ Service Worker message listener registered
[Main] ✅ Service Worker setup complete!

[SW] ✅ Installing Service Worker...
[SW] Song cache name: song-data-v1
[SW] Document cache name: documents-v1
[SW] Song cache duration: 60 minutes
[SW] Document cache duration: 7 days
[SW] Skipping waiting phase
[SW] ✅ Activating Service Worker...
[SW] Found caches: []
[SW] Claiming all clients...
[SW] ✅ Service Worker activated and ready!
```

### 2. First Request to a Song

When you navigate to a song, you'll see:

```
[SW] 📡 Intercepted request: http://localhost:8055/items/gesangbuchlied?...
[SW] URL matches song data pattern: /items/gesangbuchlied
[SW] Checking if cache is enabled...
[SW] Active clients: 1
[SW] Cache enabled status from DB: true
[SW] Checking cache: song-data-v1
[SW] ❌ Not found in cache
[SW] 🌐 Fetching from network: http://localhost:8055/items/gesangbuchlied?...
[SW] Network response status: 200
[SW] ✅ Caching network response
[SW] ✅ Successfully cached response
```

### 3. Second Request to Same Song (Cache Hit!)

When you reload or revisit the same song:

```
[SW] 📡 Intercepted request: http://localhost:8055/items/gesangbuchlied?...
[SW] URL matches song data pattern: /items/gesangbuchlied
[SW] Checking if cache is enabled...
[SW] Active clients: 1
[SW] Cache enabled status from DB: true
[SW] Checking cache: song-data-v1
[SW] 📦 Found in cache, checking freshness...
[SW] Cache age: 2min / 60min, Fresh: true
[SW] ✅ Serving FRESH cache: http://localhost:8055/items/gesangbuchlied?...
[SW] Notifying clients of cache hit (type: song)
[App] 📨 Message received from Service Worker: {type: "CACHE_HIT", url: "...", cacheType: "song"}
[App] 💾 Cache hit detected!
[App] Cache type: song
[App] URL: http://localhost:8055/items/gesangbuchlied?...
[App] 🔔 Showing toast: Liederdaten aus Cache geladen
[Cache Store] 📊 Song cache hit recorded. Total: 1
[Cache Store] 🔔 Showing toast: [info] Liederdaten aus Cache geladen
```

### 4. Document/Asset Request (First Time)

When a PDF or image loads:

```
[SW] 📡 Intercepted request: http://localhost:8055/assets/abc123
[SW] URL matches document pattern: /assets/abc123
[SW] Checking cache: documents-v1
[SW] ❌ Not found in cache
[SW] 🌐 Fetching from network: http://localhost:8055/assets/abc123
[SW] Network response status: 200
[SW] ✅ Caching network response
[SW] ✅ Successfully cached response
```

### 5. Toggling Cache On/Off

When you toggle the cache switch:

```
[Cache Store] 🔄 Toggling cache from true to false
[Cache Store] 💾 Saving cache setting to IndexedDB...
[Cache Store] ✅ Cache setting saved successfully: false
[Cache Store] 🔔 Showing toast: [success] Cache deaktiviert
```

### 6. Clearing Cache

When you click "Cache leeren":

```
[Cache Store] 🗑️ Attempting to clear cache...
[Cache Store] Waiting for Service Worker to be ready...
[Cache Store] ✅ Service Worker is ready
[Cache Store] 📨 Sending CLEAR_CACHE message to Service Worker...
[SW] 📨 Received message: {type: "CLEAR_CACHE"}
[SW] Clearing all caches...
[SW] ✅ All caches cleared successfully
[Cache Store] 📨 Response from Service Worker: {success: true}
[Cache Store] ✅ Cache cleared successfully
[Cache Store] 🔄 Resetting cache hit counters
[Cache Store] 🔔 Showing toast: [success] Cache erfolgreich geleert
[Cache Store] ✅ Cache cleared and counters reset
```

## Common Issues and What to Look For

### Issue: Service Worker Not Registering

**What you'll see:**
```
[Main] ℹ️ Service Worker not enabled (not in production and VITE_ENABLE_SW not set)
```

**Solution:** You're in development mode. Either:
1. Build and run production: `pnpm build && pnpm preview`
2. Or set environment variable: `VITE_ENABLE_SW=true`

---

### Issue: Service Worker Not Supported

**What you'll see:**
```
[App] ⚠️ Service Worker not supported in this browser
[Main] ⚠️ Service Worker registration returned null
```

**Solution:** Use a modern browser (Chrome, Firefox, Safari, Edge) over HTTPS or localhost.

---

### Issue: Cache Not Working

**Look for:**
```
[SW] URL does not match cache patterns: /some/other/path
```

**Explanation:** The URL doesn't match `/items/*` or `/assets/*` patterns, so it's not cached.

---

### Issue: Stale Cache

**What you'll see:**
```
[SW] 📦 Found in cache, checking freshness...
[SW] Cache age: 75min / 60min, Fresh: false
[SW] ⏰ Cache is stale, will fetch from network
[SW] 🌐 Fetching from network: ...
```

**Explanation:** Cache expired (song data > 1 hour, documents > 1 week). Fresh data is being fetched.

---

### Issue: Network Failure with Fallback

**What you'll see:**
```
[SW] 🌐 Fetching from network: ...
[SW] ❌ Network fetch failed: TypeError: Failed to fetch
[SW] ⚠️ Using STALE cache as fallback: ...
```

**Explanation:** Network is offline or server unreachable. Service worker is serving stale cache as fallback.

---

### Issue: Cache Disabled

**What you'll see:**
```
[SW] Checking if cache is enabled...
[SW] Cache enabled status from DB: false
[SW] ⚠️ Caching disabled, fetching from network
```

**Explanation:** User disabled cache via footer toggle. All requests go to network.

---

## Debug Checklist

Use this checklist to verify everything is working:

### ✅ Service Worker Registration
- [ ] See `[Main] 🚀 Initializing Service Worker...`
- [ ] See `[App] ✅ Service Worker registered successfully!`
- [ ] See `[SW] ✅ Service Worker activated and ready!`

### ✅ Cache Configuration
- [ ] See cache names: `song-data-v1`, `documents-v1`
- [ ] See durations: 60 minutes (songs), 7 days (documents)

### ✅ First Request (Cache Miss)
- [ ] See `[SW] 📡 Intercepted request: ...`
- [ ] See `[SW] ❌ Not found in cache`
- [ ] See `[SW] 🌐 Fetching from network: ...`
- [ ] See `[SW] ✅ Successfully cached response`

### ✅ Second Request (Cache Hit)
- [ ] See `[SW] 📦 Found in cache, checking freshness...`
- [ ] See `[SW] ✅ Serving FRESH cache: ...`
- [ ] See `[App] 💾 Cache hit detected!`
- [ ] See toast notification in UI
- [ ] See cache counter increment in footer

### ✅ Cache Controls
- [ ] Toggle works - see `[Cache Store] 🔄 Toggling cache...`
- [ ] Clear works - see `[SW] ✅ All caches cleared successfully`
- [ ] Toast shows for both actions

## Advanced Debugging

### Inspect Cache in DevTools

1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Expand **Cache Storage** in left sidebar
4. You should see:
   - `song-data-v1`
   - `documents-v1`
5. Click each to see cached URLs

### Check Service Worker State

1. In **Application** tab → **Service Workers**
2. Verify:
   - Status: **activated**
   - Running: **✓**
   - Scope: `http://localhost:4173/`

### Monitor Network Requests

1. Go to **Network** tab
2. Reload page with cache enabled
3. Look for:
   - Size column shows `(ServiceWorker)` for cached requests
   - Time should be very fast (<10ms) for cache hits

### Inspect IndexedDB

1. In **Application** tab → **IndexedDB**
2. Expand `GesangbuchCache` → `settings`
3. Verify `cacheEnabled` setting exists

### Filter Console Logs

Use these filters in console to focus on specific logs:

```
[SW]           # Only service worker logs
[Cache Store]  # Only cache store logs
[App]          # Only app/registration logs
cache hit      # Only cache hit events
```

## Log Levels

**Emoji Legend:**
- 🚀 Initialization
- ✅ Success
- ❌ Error
- ⚠️ Warning
- ℹ️ Info
- 📡 Network/Communication
- 📨 Message
- 💾 Cache
- 📦 Cache Hit
- 🌐 Network Fetch
- 🔄 Update/Change
- 🗑️ Delete/Clear
- 🔔 Notification
- 📖 Read
- 💾 Write
- 📊 Statistics
- ⏰ Time/Timeout

## Pro Tips

1. **Filter by prefix**: Type `[SW]` in console filter to see only service worker logs
2. **Preserve log**: Enable "Preserve log" in DevTools to keep logs across page reloads
3. **Verbose mode**: All logs are already detailed - no need for additional flags
4. **Clear old logs**: Clear console between tests to avoid confusion
5. **Hard refresh**: Use Ctrl+Shift+R to bypass cache when needed (but SW may still intercept!)

## Need Help?

If you're still having issues:
1. Copy the relevant console logs
2. Check the Application tab in DevTools for cache/SW state
3. Verify you're running in production mode or have VITE_ENABLE_SW=true
4. Check that the service-worker.js file exists at `/service-worker.js`
