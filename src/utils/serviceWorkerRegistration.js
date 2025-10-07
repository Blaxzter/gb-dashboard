// Service Worker Registration

export async function registerServiceWorker() {
    console.log('[App] 🚀 Starting Service Worker registration...');

    if (!('serviceWorker' in navigator)) {
        console.warn('[App] ⚠️ Service Worker not supported in this browser');
        return null;
    }

    console.log('[App] ✅ Service Worker API is supported');

    try {
        console.log('[App] 📝 Registering Service Worker at /service-worker.js with scope /');
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/',
        });

        console.log('[App] ✅ Service Worker registered successfully!');
        console.log('[App] 📍 Scope:', registration.scope);
        console.log('[App] 📊 State:', registration.active?.state || 'installing/waiting');

        // Handle updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[App] 🔄 Service Worker update found');
            console.log('[App] New worker state:', newWorker.state);

            newWorker.addEventListener('statechange', () => {
                console.log('[App] 📊 Service Worker state changed to:', newWorker.state);
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available
                    console.log('[App] ✅ New Service Worker available and installed');
                    console.log('[App] 💡 Consider notifying user to reload for updates');
                }
            });
        });

        return registration;
    } catch (error) {
        console.error('[App] ❌ Service Worker registration failed:', error);
        console.error('[App] Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
        });
        return null;
    }
}

export function setupServiceWorkerMessageListener(cacheStore) {
    console.log('[App] 📡 Setting up Service Worker message listener...');

    if (!('serviceWorker' in navigator)) {
        console.warn('[App] ⚠️ Service Worker not supported, skipping message listener setup');
        return;
    }

    console.log('[App] ✅ Service Worker message listener registered');

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[App] 📨 Message received from Service Worker:', event.data);

        if (event.data.type === 'CACHE_HIT') {
            const cacheType = event.data.cacheType;
            const url = event.data.url;

            console.log('[App] 💾 Cache hit detected!');
            console.log('[App] Cache type:', cacheType);
            console.log('[App] URL:', url);

            cacheStore.recordCacheHit(cacheType);

            // Show toast notification
            const message =
                cacheType === 'song'
                    ? 'Liederdaten aus Cache geladen'
                    : 'Dokument aus Cache geladen';

            console.log('[App] 🔔 Showing toast:', message);
            cacheStore.showCacheToast(message, 'info');
        }
    });
}
