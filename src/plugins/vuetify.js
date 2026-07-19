/**
 * plugins/vuetify.js
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';

// Composables
import { createVuetify } from 'vuetify';
import { de } from 'vuetify/locale';
import { getInitialTheme } from '@/composables/useThemeToggle';

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
    locale: {
        locale: 'de',
        fallback: 'de',
        messages: { de },
    },
    theme: {
        // Vuetify 4 folgt standardmäßig dem Betriebssystem ('system'). Wir setzen
        // den Start-Wert bewusst (persistierte Nutzer-Auswahl, sonst 'light'),
        // damit sich das Design nicht ungefragt am OS-Farbschema orientiert.
        defaultTheme: getInitialTheme(),
        themes: {
            light: {
                dark: false,
                colors: {
                    // Leicht grauer Seitenhintergrund, damit sich die weißen
                    // Karten/Sheets abheben (ersetzt das früher fest im Layout
                    // gesetzte bg-grey-lighten-3).
                    background: '#EEEEEE',
                    surface: '#FFFFFF',
                    primary: '#1867C0',
                    secondary: '#5CBBF6',
                },
            },
            dark: {
                dark: true,
                colors: {
                    primary: '#2196F3',
                    secondary: '#5CBBF6',
                },
            },
        },
    },
});
