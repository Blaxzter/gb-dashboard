<template>
  <LoaderComponent v-if="!currentState" />
  <router-view v-else />
</template>

<script setup>
// On mounted preform autologin
import { computed, onMounted } from "vue";

// get pinia store from useeAppStore
import { useAppStore } from "@/store/app";
import LoaderComponent from "@/components/util/LoaderComponent.vue";

const app = useAppStore();

// computed that returns the current state
const currentState = computed(() => {
  return app.data_loaded;
});

onMounted(() => {
  console.log(app.data_loaded);
});
</script>
