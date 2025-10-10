<template>
    <div class="print-view">
        <!-- Control Panel (hidden when printing) -->
        <div v-if="!loading" class="control-panel no-print">
            <v-container>
                <v-row align="center">
                    <v-col cols="auto">
                        <h2>Druckansicht - Autor/Copyright zu prüfen</h2>
                    </v-col>
                    <v-col cols="auto">
                        <v-chip color="warning" prepend-icon="mdi-alert">
                            {{ songs.length }} Lieder
                        </v-chip>
                    </v-col>
                    <v-col cols="auto">
                        <v-chip color="info" prepend-icon="mdi-eye">
                            {{ visibleSongsCount }} sichtbar
                        </v-chip>
                    </v-col>
                    <v-col cols="auto">
                        <v-switch
                            v-model="wrapLayout"
                            color="primary"
                            label="Strophen umbrechend"
                            hide-details
                            density="compact"
                        />
                    </v-col>
                    <v-col cols="auto">
                        <v-btn color="primary" prepend-icon="mdi-printer" @click="printPage">
                            Alle Drucken
                        </v-btn>
                    </v-col>
                    <v-col cols="auto">
                        <v-btn
                            variant="outlined"
                            prepend-icon="mdi-eye"
                            @click="toggleAllVisibility"
                        >
                            {{ allVisible ? 'Alle ausblenden' : 'Alle anzeigen' }}
                        </v-btn>
                    </v-col>
                    <v-col cols="auto">
                        <v-btn variant="text" @click="goBack"> Zurück </v-btn>
                    </v-col>
                </v-row>
            </v-container>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-container">
            <LoaderComponent />
        </div>

        <!-- Print Content -->
        <div v-else-if="songs && songs.length > 0" class="print-content">
            <div v-for="(song, index) in songs" :key="index" class="song-wrapper">
                <div class="song-row">
                    <!-- Song Controls (hidden when printing) -->
                    <div class="song-controls no-print">
                        <v-card class="controls-card" elevation="2">
                            <v-card-text class="pa-3">
                                <div class="controls-content">
                                    <div class="control-item">
                                        <v-checkbox
                                            v-model="visibleSongs[index]"
                                            hide-details
                                            density="compact"
                                            color="primary"
                                        >
                                            <template #label>
                                                <div class="checkbox-label">
                                                    <strong>{{ index + 1 }}.</strong>
                                                    <span class="song-title-label">{{
                                                        song.gesangbuch_titel
                                                    }}</span>
                                                </div>
                                            </template>
                                        </v-checkbox>
                                    </div>
                                    <div class="control-item">
                                        <v-btn
                                            size="small"
                                            variant="outlined"
                                            prepend-icon="mdi-printer"
                                            :disabled="!visibleSongs[index]"
                                            block
                                            @click="printSingleSong(index)"
                                        >
                                            Drucken
                                        </v-btn>
                                    </div>
                                </div>
                            </v-card-text>
                        </v-card>
                    </div>

                    <!-- Song Component -->
                    <div
                        v-show="visibleSongs[index]"
                        class="song-content"
                        :class="{ 'print-only-this': printingIndex === index }"
                    >
                        <PrintGesangbuchLiedComponent
                            :selected-song="song"
                            :wrap-layout="wrapLayout"
                            :hide-copyright-alert="true"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state no-print">
            <v-container>
                <v-alert type="success" title="Keine Lieder zu prüfen">
                    Es gibt derzeit keine Lieder, die auf Autor oder Copyright geprüft werden
                    müssen.
                </v-alert>
            </v-container>
        </div>
    </div>
</template>

<script>
import PrintGesangbuchLiedComponent from '@/components/SongRelated/PrintGesangbuchLiedComponent.vue';
import LoaderComponent from '@/components/util/LoaderComponent.vue';
import { useAppStore } from '@/store/app';

export default {
    name: 'CopyrightCheckPrintView',
    components: {
        PrintGesangbuchLiedComponent,
        LoaderComponent,
    },
    data() {
        return {
            store: useAppStore(),
            songs: [],
            loading: true,
            wrapLayout: true,
            visibleSongs: [],
            printingIndex: null,
        };
    },
    computed: {
        visibleSongsCount() {
            return this.visibleSongs.filter(Boolean).length;
        },
        allVisible() {
            return this.visibleSongs.every(Boolean);
        },
    },
    async mounted() {
        try {
            // Ensure data is loaded
            await this.store.loadData();

            // Filter songs that need copyright checking and have "rein" in kleiner kreis bewertung
            this.songs = this.store.gesangbuchlieder.filter(
                (song) =>
                    song.autor_oder_copyright_checken === true &&
                    song.bewertung_kleiner_kreis?.bezeichner?.toLowerCase() === 'rein',
            );

            // Initialize all songs as visible
            this.visibleSongs = new Array(this.songs.length).fill(true);

            console.log(`Found ${this.songs.length} songs requiring copyright check`);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            this.loading = false;
        }
    },
    methods: {
        printPage() {
            this.printingIndex = null;
            window.print();
        },
        printSingleSong(index) {
            this.printingIndex = index;
            this.$nextTick(() => {
                window.print();
                // Reset after printing
                setTimeout(() => {
                    this.printingIndex = null;
                }, 100);
            });
        },
        toggleAllVisibility() {
            const newValue = !this.allVisible;
            this.visibleSongs = new Array(this.songs.length).fill(newValue);
        },
        goBack() {
            this.$router.go(-1);
        },
    },
};
</script>

<style scoped>
.print-view {
    background-color: #f5f5f5;
    min-height: 100vh;
}

.control-panel {
    background: white;
    border-bottom: 1px solid #e0e0e0;
    padding: 16px 0;
    position: sticky;
    top: 0;
    z-index: 10;
}

.print-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
}

.song-wrapper {
    width: 100%;
    max-width: 1400px;
    margin-bottom: 20px;
}

.song-row {
    display: flex;
    gap: 20px;
    align-items: flex-start;
}

.song-controls {
    flex: 0 0 250px;
    position: sticky;
    top: 100px;
}

.controls-card {
    background-color: #ffffff;
    border: 2px solid #e0e0e0;
}

.controls-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.control-item {
    width: 100%;
}

.checkbox-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.song-title-label {
    font-size: 0.9em;
    line-height: 1.3;
    word-break: break-word;
}

.song-content {
    flex: 1;
    min-width: 0;
}

.empty-state {
    padding: 40px 0;
}

.loading-container {
    min-height: 100vh;
}

/* Hide control panel when printing */
@media print {
    .no-print {
        display: none !important;
    }

    .print-view {
        background: white;
    }

    .print-content {
        display: block;
        padding: 0;
    }

    .song-row {
        display: block;
    }

    .song-content {
        width: 100%;
    }

    /* When printing a single song, hide all other songs */
    .song-wrapper:has(.print-only-this) ~ .song-wrapper {
        display: none !important;
    }

    .song-wrapper:not(:has(.print-only-this)) {
        display: none !important;
    }

    /* If no specific song is selected for printing (printingIndex is null), show all visible songs */
    .print-view:not(:has(.print-only-this)) .song-wrapper {
        display: block !important;
    }
}
</style>
