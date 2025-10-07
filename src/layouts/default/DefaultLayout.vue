<template>
    <v-app id="inspire" class="app-root-style">
        <LoaderComponent v-if="!currentState" />
        <template v-else>
            <default-bar />

            <default-view />

            <footer-bar />
        </template>
    </v-app>
</template>

<script setup>
import DefaultBar from './AppBar.vue';
import DefaultView from './MainView.vue';
import FooterBar from './FooterBar.vue';

// get pinia store from useeAppStore
import { useAppStore } from '@/store/app';
import LoaderComponent from '@/components/util/LoaderComponent.vue';
import { computed, onMounted } from 'vue';

const app = useAppStore();

// computed that returns the current state
const currentState = computed(() => {
    return app.data_loaded;
});

onMounted(() => {
    console.log(currentState.value);
});
</script>

<style>
.app-root-style {
    max-width: 1500px;
    margin: auto;
}
</style>
