// Eigene Vitest-Config (getrennt von vite.config.js), damit die Logik-Tests
// nicht die Vuetify-/DevTools-Plugins der App-Build-Pipeline mitziehen. Nur der
// '@'-Alias wird gespiegelt, damit `@/assets/js/...`-Imports auflösen.
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    test: {
        // Reine Logik-Tests brauchen kein DOM.
        environment: 'node',
        include: ['src/**/*.{test,spec}.js'],
    },
});
