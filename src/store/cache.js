// Utilities
import { defineStore } from 'pinia';

export const useCacheStore = defineStore('cache', {
    state: () => ({
        cacheEnabled: true,
        showToast: false,
        toastMessage: '',
        toastType: 'info',
        cacheHits: {
            songs: 0,
            documents: 0,
        },
    }),

    getters: {
        isCacheEnabled: (state) => state.cacheEnabled,
        shouldShowToast: (state) => state.showToast,
        getToastMessage: (state) => state.toastMessage,
        getToastType: (state) => state.toastType,
        getCacheHits: (state) => state.cacheHits,
    },

    actions: {
        async toggleCache() {
            const oldValue = this.cacheEnabled;
            this.cacheEnabled = !this.cacheEnabled;

            console.log('[Cache Store] 🔄 Toggling cache from', oldValue, 'to', this.cacheEnabled);

            // Store the cache setting in IndexedDB
            try {
                console.log('[Cache Store] 💾 Saving cache setting to IndexedDB...');
                const db = await this.openCacheDB();
                const tx = db.transaction(['settings'], 'readwrite');
                const store = tx.objectStore('settings');
                await new Promise((resolve, reject) => {
                    const request = store.put({ key: 'cacheEnabled', value: this.cacheEnabled });
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });

                console.log(
                    '[Cache Store] ✅ Cache setting saved successfully:',
                    this.cacheEnabled,
                );

                // Show toast notification
                this.showCacheToast(
                    this.cacheEnabled ? 'Cache aktiviert' : 'Cache deaktiviert',
                    'success',
                );
            } catch (error) {
                console.error('[Cache Store] ❌ Failed to save cache setting:', error);
                this.showCacheToast('Fehler beim Speichern der Cache-Einstellung', 'error');
            }
        },

        async loadCacheSetting() {
            console.log('[Cache Store] 📖 Loading cache setting from IndexedDB...');
            try {
                const db = await this.openCacheDB();
                const tx = db.transaction(['settings'], 'readonly');
                const store = tx.objectStore('settings');
                const result = await new Promise((resolve, reject) => {
                    const request = store.get('cacheEnabled');
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });

                if (result) {
                    this.cacheEnabled = result.value;
                    console.log('[Cache Store] ✅ Cache setting loaded:', this.cacheEnabled);
                } else {
                    console.log(
                        '[Cache Store] ℹ️ No saved cache setting found, using default: true',
                    );
                }
            } catch (error) {
                console.log('[Cache Store] ⚠️ Could not load cache setting, using default:', error);
            }
        },

        async clearCache() {
            console.log('[Cache Store] 🗑️ Attempting to clear cache...');

            if (!('serviceWorker' in navigator)) {
                console.warn('[Cache Store] ⚠️ Service Worker not available');
                this.showCacheToast('Service Worker nicht verfügbar', 'error');
                return;
            }

            try {
                console.log('[Cache Store] Waiting for Service Worker to be ready...');
                const registration = await navigator.serviceWorker.ready;
                console.log('[Cache Store] ✅ Service Worker is ready');

                if (registration.active) {
                    console.log(
                        '[Cache Store] 📨 Sending CLEAR_CACHE message to Service Worker...',
                    );
                    // Create a message channel to get a response
                    const messageChannel = new MessageChannel();

                    await new Promise((resolve, reject) => {
                        messageChannel.port1.onmessage = (event) => {
                            console.log(
                                '[Cache Store] 📨 Response from Service Worker:',
                                event.data,
                            );
                            if (event.data.success) {
                                console.log('[Cache Store] ✅ Cache cleared successfully');
                                resolve();
                            } else {
                                console.error(
                                    '[Cache Store] ❌ Cache clear failed:',
                                    event.data.error,
                                );
                                reject(new Error(event.data.error));
                            }
                        };

                        registration.active.postMessage({ type: 'CLEAR_CACHE' }, [
                            messageChannel.port2,
                        ]);

                        // Timeout after 5 seconds
                        setTimeout(() => {
                            console.error(
                                '[Cache Store] ⏰ Timeout waiting for cache clear response',
                            );
                            reject(new Error('Timeout'));
                        }, 5000);
                    });

                    // Reset cache hits
                    console.log('[Cache Store] 🔄 Resetting cache hit counters');
                    this.cacheHits.songs = 0;
                    this.cacheHits.documents = 0;

                    this.showCacheToast('Cache erfolgreich geleert', 'success');
                    console.log('[Cache Store] ✅ Cache cleared and counters reset');
                } else {
                    console.warn('[Cache Store] ⚠️ No active Service Worker found');
                }
            } catch (error) {
                console.error('[Cache Store] ❌ Failed to clear cache:', error);
                this.showCacheToast('Fehler beim Leeren des Cache', 'error');
            }
        },

        showCacheToast(message, type = 'info') {
            console.log(`[Cache Store] 🔔 Showing toast: [${type}] ${message}`);
            this.toastMessage = message;
            this.toastType = type;
            this.showToast = true;

            // Auto-hide after 3 seconds
            setTimeout(() => {
                console.log('[Cache Store] 🔕 Auto-hiding toast');
                this.showToast = false;
            }, 3000);
        },

        hideToast() {
            console.log('[Cache Store] 🔕 Hiding toast manually');
            this.showToast = false;
        },

        recordCacheHit(cacheType) {
            if (cacheType === 'song') {
                this.cacheHits.songs++;
                console.log(
                    '[Cache Store] 📊 Song cache hit recorded. Total:',
                    this.cacheHits.songs,
                );
            } else if (cacheType === 'document') {
                this.cacheHits.documents++;
                console.log(
                    '[Cache Store] 📊 Document cache hit recorded. Total:',
                    this.cacheHits.documents,
                );
            }
        },

        openCacheDB() {
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
        },
    },
});
