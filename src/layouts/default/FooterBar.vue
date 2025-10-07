<template>
    <v-container class="my-0 py-0">
        <v-responsive class="d-flex">
            <v-footer class="text-center d-flex flex-column">
                <v-divider></v-divider>

                <!-- Cache Controls -->
                <div class="d-flex justify-center align-center gap-4 mb-2">
                    <v-tooltip location="top">
                        <template #activator="{ props }">
                            <div v-bind="props" class="d-flex align-center">
                                <v-switch
                                    v-model="cacheStore.cacheEnabled"
                                    color="primary"
                                    hide-details
                                    density="compact"
                                    :label="`Cache ${cacheStore.cacheEnabled ? 'aktiviert' : 'deaktiviert'}`"
                                    @change="cacheStore.toggleCache()"
                                />
                            </div>
                        </template>
                        <span>Cache für Lieder (1h) und Dokumente (1 Woche)</span>
                    </v-tooltip>

                    <v-btn
                        size="small"
                        variant="text"
                        prepend-icon="mdi-delete-sweep"
                        @click="cacheStore.clearCache()"
                    >
                        Cache leeren
                    </v-btn>

                    <v-tooltip v-if="totalCacheHits > 0" location="top">
                        <template #activator="{ props }">
                            <v-chip v-bind="props" size="small" color="success" variant="outlined">
                                <v-icon start size="small">mdi-cached</v-icon>
                                {{ totalCacheHits }}
                            </v-chip>
                        </template>
                        <span>
                            Cache Treffer: {{ cacheStore.cacheHits.songs }} Lieder,
                            {{ cacheStore.cacheHits.documents }} Dokumente
                        </span>
                    </v-tooltip>
                </div>

                <div>
                    &copy; {{ new Date().getFullYear() }} —
                    <strong>Gesangbuch Dashboard</strong>
                </div>
            </v-footer>

            <!-- Toast Notification -->
            <v-snackbar
                v-model="cacheStore.showToast"
                :color="toastColor"
                :timeout="3000"
                location="top"
            >
                <div class="d-flex align-center">
                    <v-icon v-if="cacheStore.toastType === 'info'" start>mdi-information</v-icon>
                    <v-icon v-else-if="cacheStore.toastType === 'success'" start
                        >mdi-check-circle</v-icon
                    >
                    <v-icon v-else-if="cacheStore.toastType === 'error'" start
                        >mdi-alert-circle</v-icon
                    >
                    {{ cacheStore.toastMessage }}
                </div>

                <template #actions>
                    <v-btn variant="text" size="small" @click="cacheStore.hideToast()">
                        Schließen
                    </v-btn>
                </template>
            </v-snackbar>
        </v-responsive>
    </v-container>
</template>

<script setup>
import { useCacheStore } from '@/store/cache';
import { computed } from 'vue';

const cacheStore = useCacheStore();

const totalCacheHits = computed(() => {
    return cacheStore.cacheHits.songs + cacheStore.cacheHits.documents;
});

const toastColor = computed(() => {
    switch (cacheStore.toastType) {
        case 'success':
            return 'success';
        case 'error':
            return 'error';
        case 'info':
        default:
            return 'info';
    }
});
</script>

<style scoped>
.gap-4 {
    gap: 1rem;
}
</style>
