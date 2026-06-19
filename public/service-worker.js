// Service Worker for caching songs and documents

// v2 (Issue #52): song/item data is now served network-first instead of
// cache-first. The old cache-first strategy could serve a song/text response up
// to an hour old, so a corrector who saved a strophe and later reloaded got the
// stale cached version back — their correction appeared to "revert". The cache
// is now only a fallback for when the network is unavailable (offline). Bumping
// the version also purges the old v1 caches (see the activate handler) so
// existing clients drop any stale entries on update.
const CACHE_VERSION = 'v2';
const SONG_CACHE_NAME = `song-data-${CACHE_VERSION}`;
const DOCUMENT_CACHE_NAME = `documents-${CACHE_VERSION}`;

// Only relevant as an offline fallback now that song data is network-first.
const SONG_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const DOCUMENT_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

// Helper to check if caching is enabled
async function isCacheEnabled() {
    console.log('[SW] Checking if cache is enabled...');
    try {
        const clients = await self.clients.matchAll();
        console.log('[SW] Active clients:', clients.length);
        if (clients.length > 0) {
            // Get cache status from IndexedDB
            const db = await openCacheDB();
            const tx = db.transaction(['settings'], 'readonly');
            const store = tx.objectStore('settings');
            const result = await new Promise((resolve, reject) => {
                const request = store.get('cacheEnabled');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const isEnabled = result ? result.value : true;
            console.log('[SW] Cache enabled status from DB:', isEnabled);
            return isEnabled; // Default to enabled
        }
    } catch (error) {
        console.log('[SW] Cache status check failed, defaulting to enabled:', error);
    }
    return true; // Default to enabled if we can't check
}

// Open IndexedDB for storing cache settings
function openCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('GesangbuchCache', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    });
}

// Helper to determine if a URL should be cached and with which strategy.
//   'network-first' → mutable data: always fetch fresh when online, fall back to
//                     the cache only on network failure (offline).
//   'cache-first'   → effectively-immutable file content: serve from cache while
//                     fresh, otherwise revalidate from the network.
function shouldCacheUrl(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Song/item data (and file metadata) is mutable — correctors edit it. Serve
    // it network-first so a save is never masked by a stale cached copy (#52).
    if (pathname.includes('/items/') || pathname.includes('/files')) {
        console.log('[SW] URL matches song data pattern:', pathname);
        return {
            cache: true,
            name: SONG_CACHE_NAME,
            duration: SONG_CACHE_DURATION,
            strategy: 'network-first',
        };
    }

    // Document/asset requests are the actual (content-addressed) file bytes and
    // can safely be served cache-first.
    if (pathname.includes('/assets/')) {
        console.log('[SW] URL matches document pattern:', pathname);
        return {
            cache: true,
            name: DOCUMENT_CACHE_NAME,
            duration: DOCUMENT_CACHE_DURATION,
            strategy: 'cache-first',
        };
    }

    console.log('[SW] URL does not match cache patterns:', pathname);
    return { cache: false };
}

// Helper to add timestamp to cached responses
function createCachedResponse(response, cacheInfo) {
    return response
        .clone()
        .blob()
        .then((blob) => {
            const headers = new Headers(response.headers);
            headers.set('X-Cache-Time', Date.now().toString());
            headers.set('X-Cache-Duration', cacheInfo.duration.toString());
            headers.set('X-Cache-Source', 'service-worker');

            return new Response(blob, {
                status: response.status,
                statusText: response.statusText,
                headers: headers,
            });
        });
}

// Helper to check if cached response is still fresh
function isCacheFresh(response, maxAge) {
    const cacheTime = response.headers.get('X-Cache-Time');
    if (!cacheTime) {
        console.log('[SW] No cache time header found');
        return false;
    }

    const age = Date.now() - parseInt(cacheTime);
    const isFresh = age < maxAge;
    const ageMinutes = Math.floor(age / 1000 / 60);
    const maxAgeMinutes = Math.floor(maxAge / 1000 / 60);
    console.log(`[SW] Cache age: ${ageMinutes}min / ${maxAgeMinutes}min, Fresh: ${isFresh}`);
    return isFresh;
}

// Install event - pre-cache critical resources if needed
self.addEventListener('install', (event) => {
    console.log('[SW] ✅ Installing Service Worker...');
    console.log('[SW] Song cache name:', SONG_CACHE_NAME);
    console.log('[SW] Document cache name:', DOCUMENT_CACHE_NAME);
    console.log('[SW] Song cache duration:', SONG_CACHE_DURATION / 1000 / 60, 'minutes');
    console.log(
        '[SW] Document cache duration:',
        DOCUMENT_CACHE_DURATION / 1000 / 60 / 60 / 24,
        'days',
    );
    self.skipWaiting(); // Activate worker immediately
    console.log('[SW] Skipping waiting phase');
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] ✅ Activating Service Worker...');
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                console.log('[SW] Found caches:', cacheNames);
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old versions of our caches
                        if (cacheName.includes('song-data-') || cacheName.includes('documents-')) {
                            if (
                                cacheName !== SONG_CACHE_NAME &&
                                cacheName !== DOCUMENT_CACHE_NAME
                            ) {
                                console.log('[SW] 🗑️ Deleting old cache:', cacheName);
                                return caches.delete(cacheName);
                            } else {
                                console.log('[SW] ✅ Keeping current cache:', cacheName);
                            }
                        }
                    }),
                );
            })
            .then(() => {
                console.log('[SW] Claiming all clients...');
                return self.clients.claim(); // Take control immediately
            })
            .then(() => {
                console.log('[SW] ✅ Service Worker activated and ready!');
            }),
    );
});

// Fetch event - implement caching strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only cache GET requests - POST/PUT/PATCH/DELETE cannot be cached
    if (request.method !== 'GET') {
        console.log('[SW] ⚠️ Skipping non-GET request:', request.method, request.url);
        return;
    }

    const cacheInfo = shouldCacheUrl(request.url);

    if (!cacheInfo.cache) {
        // Don't cache this request
        return;
    }

    event.respondWith(
        (async () => {
            console.log('[SW] 📡 Intercepted request:', request.url);

            // Check if caching is enabled
            const cacheEnabled = await isCacheEnabled();

            if (!cacheEnabled) {
                console.log('[SW] ⚠️ Caching disabled, fetching from network');
                return fetch(request);
            }

            const cache = await caches.open(cacheInfo.name);

            if (cacheInfo.strategy === 'network-first') {
                return networkFirst(request, cache, cacheInfo);
            }
            return cacheFirst(request, cache, cacheInfo);
        })(),
    );
});

// Network-first: always try the network so mutable data is never stale (#52).
// The cache is updated on every successful response and only read back when the
// network is unavailable (offline resilience).
async function networkFirst(request, cache, cacheInfo) {
    try {
        console.log('[SW] 🌐 Network-first, fetching:', request.url);
        const networkResponse = await fetch(request);
        console.log('[SW] Network response status:', networkResponse.status);

        if (networkResponse && networkResponse.status === 200) {
            const responseToCache = await createCachedResponse(networkResponse, cacheInfo);
            await cache.put(request, responseToCache);
            console.log('[SW] ✅ Updated cache from network');
        }

        return networkResponse;
    } catch (error) {
        console.error('[SW] ❌ Network fetch failed:', error);

        // Offline fallback: serve whatever we have, even if stale.
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            console.log('[SW] ⚠️ Offline — using cached fallback:', request.url);
            const clients = await self.clients.matchAll();
            const cacheType = cacheInfo.name.includes('song') ? 'song' : 'document';
            clients.forEach((client) => {
                client.postMessage({
                    type: 'CACHE_HIT',
                    url: request.url,
                    cacheType: cacheType,
                });
            });
            return cachedResponse;
        }

        console.error('[SW] ❌ No fallback available, throwing error');
        throw error;
    }
}

// Cache-first: serve fresh cache immediately, otherwise revalidate from network.
// Used for effectively-immutable file bytes under /assets/.
async function cacheFirst(request, cache, cacheInfo) {
    console.log('[SW] Checking cache:', cacheInfo.name);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        console.log('[SW] 📦 Found in cache, checking freshness...');
        if (isCacheFresh(cachedResponse, cacheInfo.duration)) {
            console.log('[SW] ✅ Serving FRESH cache:', request.url);

            // Notify the client that data was loaded from cache
            const clients = await self.clients.matchAll();
            const cacheType = cacheInfo.name.includes('song') ? 'song' : 'document';
            console.log('[SW] Notifying clients of cache hit (type:', cacheType + ')');
            clients.forEach((client) => {
                client.postMessage({
                    type: 'CACHE_HIT',
                    url: request.url,
                    cacheType: cacheType,
                });
            });

            return cachedResponse;
        } else {
            console.log('[SW] ⏰ Cache is stale, will fetch from network');
        }
    } else {
        console.log('[SW] ❌ Not found in cache');
    }

    // Fetch from network
    try {
        console.log('[SW] 🌐 Fetching from network:', request.url);
        const networkResponse = await fetch(request);
        console.log('[SW] Network response status:', networkResponse.status);

        // Only cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            console.log('[SW] ✅ Caching network response');
            const responseToCache = await createCachedResponse(networkResponse, cacheInfo);
            await cache.put(request, responseToCache);
            console.log('[SW] ✅ Successfully cached response');
        } else {
            console.log('[SW] ⚠️ Not caching response (status:', networkResponse.status + ')');
        }

        return networkResponse;
    } catch (error) {
        console.error('[SW] ❌ Network fetch failed:', error);

        // If network fails and we have a cached response (even if stale), use it
        if (cachedResponse) {
            console.log('[SW] ⚠️ Using STALE cache as fallback:', request.url);
            return cachedResponse;
        }

        console.error('[SW] ❌ No fallback available, throwing error');
        throw error;
    }
}

// Message event - handle commands from the client
self.addEventListener('message', (event) => {
    console.log('[SW] 📨 Received message:', event.data);

    if (event.data.type === 'CLEAR_CACHE') {
        console.log('[SW] Clearing all caches...');
        event.waitUntil(
            Promise.all([caches.delete(SONG_CACHE_NAME), caches.delete(DOCUMENT_CACHE_NAME)])
                .then(() => {
                    console.log('[SW] ✅ All caches cleared successfully');
                    event.ports[0].postMessage({ success: true });
                })
                .catch((error) => {
                    console.error('[SW] ❌ Error clearing cache:', error);
                    event.ports[0].postMessage({ success: false, error: error.message });
                }),
        );
    }

    if (event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Skipping waiting...');
        self.skipWaiting();
    }
});
