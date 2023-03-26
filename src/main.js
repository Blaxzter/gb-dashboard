import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);

// Store

import { createPinia } from "pinia";

const pinia = createPinia();
app.use(pinia);

import { useStore } from "./stores/store";
const store = useStore();
store.fetchData();

import "vuetify/styles";
import { createVuetify } from "vuetify";

const vuetify = createVuetify();

app.use(vuetify).mount("#app");
