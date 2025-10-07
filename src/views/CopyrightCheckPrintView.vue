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
            />
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
        };
    },
    async mounted() {
        try {
            // Ensure data is loaded
            await this.store.loadData();

            // Filter songs that need copyright checking
            this.songs = this.store.gesangbuchlieder.filter(
                (song) => song.autor_oder_copyright_checken === true,
            );

            console.log(`Found ${this.songs.length} songs requiring copyright check`);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            this.loading = false;
        }
    },
    methods: {
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
    }
}
</style>
