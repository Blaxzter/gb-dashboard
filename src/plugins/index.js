/**
 * plugins/index.js
 *
 * Automatically included in `./src/main.js`
 */

// Plugins
import {loadFonts} from './webfontloader'
import vuetify from './vuetify'
import pinia from '../store'
import router from '../router'

import VCalendar from 'v-calendar';
import 'v-calendar/style.css';

export function registerPlugins(app) {
  loadFonts()
  app
    .use(vuetify)
    .use(router)
    .use(pinia)
    .use(VCalendar, {})
}
