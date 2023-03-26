/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'

// Plugins
import { registerPlugins } from '@/plugins'

const app = createApp(App)

registerPlugins(app)

// Load all data into the store
import { useAppStore } from "./store/app";
const store = useAppStore();
store.loadData();

app.mount('#app')
