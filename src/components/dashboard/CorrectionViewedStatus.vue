<template>
    <div class="d-flex justify-space-between align-center mb-2">
        <div class="text-h5">Korrekturlesung Status</div>
        <v-tooltip text="Nur Lieder mit Bewertung 'Rein' anzeigen" location="bottom">
            <template #activator="{ props }">
                <v-btn
                    v-bind="props"
                    :icon="filterReinOnly ? 'mdi-filter' : 'mdi-filter-outline'"
                    size="small"
                    :color="filterReinOnly ? 'primary' : 'grey'"
                    variant="text"
                    @click="toggleFilter"
                />
            </template>
        </v-tooltip>
    </div>
    <div class="mt-3">
        <div style="height: 400px">
            <Doughnut
                ref="correction_viewed_chart"
                :data="correction_viewed_data"
                :options="chartOptions"
            />
        </div>
    </div>
</template>

<script>
import _ from 'lodash';

import { useAppStore } from '@/store/app';

import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'vue-chartjs';

ChartJS.register(ArcElement, Tooltip, Legend);

export default {
    name: 'CorrectionViewedStatus',
    components: {
        Doughnut,
    },
    props: {
        chartOptions: {
            type: Object,
            required: true,
        },
    },
    data: () => ({
        store: useAppStore(),
        filterReinOnly: true,
    }),
    computed: {
        songs() {
            return this.store.gesangbuchlied;
        },
        filteredSongs() {
            if (!this.filterReinOnly) {
                return this.songs;
            }
            // Filter for songs with "Rein" bewertung
            return _.filter(this.songs, (song) =>
                song.bewertung_kleiner_kreis?.bezeichner?.toLowerCase()?.includes('rein'),
            );
        },
        correction_viewed_data() {
            const correctionViewed = _.filter(
                this.filteredSongs,
                (song) => song.text?.korrekturlesung1 === true,
            ).length;

            const notCorrectionViewed = this.filteredSongs.length - correctionViewed;

            return {
                labels: ['Korrektur gelesen', 'Nicht gelesen'],
                datasets: [
                    {
                        backgroundColor: ['#4caf50', '#ff9800'],
                        data: [correctionViewed, notCorrectionViewed],
                    },
                ],
            };
        },
    },
    methods: {
        toggleFilter() {
            this.filterReinOnly = !this.filterReinOnly;
        },
    },
};
</script>

<style scoped></style>
