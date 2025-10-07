<template>
    <div class="print-view">
        <!-- Control Panel (hidden when printing) -->
        <div v-if="!loading" class="control-panel no-print">
            <v-container>
                <v-row align="center">
                    <v-col cols="auto">
                        <h2>Druckansicht</h2>
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
                            Drucken
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
            <PrintGesangbuchLiedComponent
                v-for="(song, index) in songs"
                :key="index"
                :selected-song="song"
                :wrap-layout="wrapLayout"
            />
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state no-print">
            <v-container>
                <v-alert type="info" title="Keine Lieder zum Drucken">
                    Es wurden keine Lieder für die Druckansicht ausgewählt.
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
    name: 'PrintView',
    components: {
        PrintGesangbuchLiedComponent,
        LoaderComponent,
    },
    data() {
        return {
            store: useAppStore(),
            songs: [],
            loading: true,
            wrapLayout: false,
        };
    },
    async mounted() {
        try {
            // Ensure data is loaded
            await this.store.loadData();

            // Load songs from route params or store
            // This allows flexibility for how songs are passed to the print view
            if (this.$route.params.songIds) {
                this.loadSongsById(this.$route.params.songIds);
            } else if (this.$route.query.songId) {
                // Single song from query parameter
                this.loadSongsById([this.$route.query.songId]);
            } else {
                // No songs specified
                this.songs = [];
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            this.loading = false;
        }
    },
    methods: {
        loadSongsById(songIds) {
            // Ensure songIds is an array
            const ids = Array.isArray(songIds) ? songIds : [songIds];

            // Load songs from store
            this.songs = ids
                .map((id) => {
                    // Find song by ID in the store
                    const song = this.store.gesangbuchlieder.find((s) => s.id === parseInt(id));
                    if (!song) {
                        console.warn(`Song with ID ${id} not found`);
                    }
                    return song;
                })
                .filter((song) => song !== undefined);
        },
        printPage() {
            window.print();
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
}

.empty-state {
    padding: 40px 0;
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
    }
}
</style>
