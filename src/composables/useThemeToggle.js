/**
 * composables/useThemeToggle.js
 *
 * Kapselt das Umschalten zwischen hellem und dunklem Vuetify-Theme und
 * persistiert die Auswahl im localStorage.
 */

import { computed } from 'vue';
import { useTheme } from 'vuetify';

// Schlüssel im localStorage für die persistierte Theme-Auswahl des Nutzers.
export const THEME_STORAGE_KEY = 'gb-theme';

/**
 * Liest die beim App-Start zu verwendende Theme-Auswahl.
 *
 * Fällt auf 'light' zurück, damit die App wie vor dem Vuetify-4-Update hell
 * startet (Vuetify 4 verwendet standardmäßig 'system', folgt also dem
 * Betriebssystem). Wer stattdessen dem OS-Farbschema folgen möchte, ändert den
 * Rückgabewert hier auf 'system'.
 */
export function getInitialTheme() {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
            return stored;
        }
    } catch {
        // localStorage nicht verfügbar (z. B. privater Modus) – Standard nutzen.
    }
    return 'light';
}

/**
 * Stellt einen reaktiven Dark-Mode-Status sowie eine toggle()-Funktion bereit,
 * die zwischen hellem und dunklem Theme wechselt und die Auswahl speichert.
 */
export function useThemeToggle() {
    const theme = useTheme();

    // theme.name.value ist der aufgelöste Name ('light'/'dark') – auch dann,
    // wenn als Standard 'system' konfiguriert ist.
    const isDark = computed(() => theme.name.value === 'dark');

    function toggle() {
        const next = isDark.value ? 'light' : 'dark';
        theme.change(next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // Persistenz nicht möglich – Auswahl gilt nur für diese Sitzung.
        }
    }

    return { isDark, toggle };
}
