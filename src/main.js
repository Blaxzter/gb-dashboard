/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Components
import App from './App.vue';

// Composables
import { createApp } from 'vue';

// Plugins
import { registerPlugins } from '@/plugins';

// Service Worker
import {
    registerServiceWorker,
    setupServiceWorkerMessageListener,
} from '@/utils/serviceWorkerRegistration';
import { useCacheStore } from '@/store/cache';

const app = createApp(App);

registerPlugins(app);

app.mount('#app');

// Register service worker after app is mounted
if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW) {
    console.log('[Main] 🚀 Initializing Service Worker...');
    console.log('[Main] Environment:', import.meta.env.PROD ? 'PRODUCTION' : 'DEVELOPMENT');
    console.log('[Main] VITE_ENABLE_SW:', import.meta.env.VITE_ENABLE_SW);

    registerServiceWorker()
        .then((registration) => {
            if (registration) {
                console.log('[Main] ✅ Service Worker registration complete');
                // Setup message listener with cache store
                const cacheStore = useCacheStore();
                console.log('[Main] 📖 Loading cache settings...');
                cacheStore.loadCacheSetting();
                console.log('[Main] 📡 Setting up message listener...');
                setupServiceWorkerMessageListener(cacheStore);
                console.log('[Main] ✅ Service Worker setup complete!');
            } else {
                console.warn('[Main] ⚠️ Service Worker registration returned null');
            }
        })
        .catch((error) => {
            console.error('[Main] ❌ Service Worker initialization failed:', error);
        });
} else {
    console.log(
        '[Main] ℹ️ Service Worker not enabled (not in production and VITE_ENABLE_SW not set)',
    );
}
