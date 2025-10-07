<template>
    <v-container class="mb-1">
        <v-responsive class="d-flex">
            <v-footer class="d-flex flex-column">
                <div class="d-flex w-100 justify-space-between flex-column flex-md-row align-center">
                    <div>
                        &copy; {{ new Date().getFullYear() }} —
                        <strong>Gesangbuch Dashboard</strong>
                    </div>
                    <div class="d-flex align-center gap-4">
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
                    </div>
                    <div class="d-flex">
                        <div>Brauchst du Hilfe? Schreib uns eine E-Mail:</div>
                        <v-btn
                            icon
                            class="ml-3 mail-icon"
                            :href="'mailto:' + mailtoEmail"
                            target="_blank"
                            variant="text"
                            size="tiny"
                        >
                            <v-icon>mdi-email</v-icon>
                        </v-btn>
                    </div>
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

const mailtoEmail = import.meta.env.VITE_MAILTO_EMAIL;
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
.mail-icon {
    cursor: pointer;
    &:hover {
        transition: all 0.2s ease-in-out;
        transform: scale(1.8);
        color: #1867c0;
    }
}

.gap-4 {
    gap: 1rem;
}
</style>
