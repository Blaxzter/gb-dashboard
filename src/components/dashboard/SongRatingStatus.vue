<template>
    <div class="text-h5">Lieder nach Bewertung</div>
    <div class="mt-3">
        <div style="height: 400px">
            <Doughnut
                ref="song_rating_chart"
                :data="song_rating_data"
                :options="enhancedChartOptions"
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
    name: 'SongRatingStatus',
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
    }),
    computed: {
        songs() {
            return this.store.gesangbuchlied;
        },
        rated_song_bezeichner() {
            return _.map(this.songs, (elem) => {
                if (elem.bewertung_kleiner_kreis.bezeichner === '') {
                    return 'Unbewertet';
                } else {
                    if (elem?.liedHatAenderung) {
                        return 'Bewertet mit Änderungsvorschlag';
                    } else {
                        return 'Bewertet';
                    }
                }
            });
        },
        rated_song_data_list() {
            return _.countBy(this.rated_song_bezeichner);
        },
        song_rating_data() {
            const counts = this.rated_song_data_list;
            const vibrantPastelPalette = ['#1eb995', '#ffcd56', '#ff3341'];

            const data = [
                counts['Bewertet'] ?? 0,
                counts['Bewertet mit Änderungsvorschlag'] ?? 0,
                counts['Unbewertet'] ?? 0,
            ];

            return {
                labels: [
                    `Bewertet (${data[0]})`,
                    [`Bewertet mit`, `Änderungsvorschlag (${data[1]})`],
                    `Unbewertet (${data[2]})`,
                ],
                datasets: [
                    {
                        backgroundColor: vibrantPastelPalette,
                        data,
                    },
                ],
            };
        },
        enhancedChartOptions() {
            return {
                ...this.chartOptions,
                onClick: this.handle_click_events,
                onHover: (event, chartElement) => {
                    event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                },
                plugins: {
                    ...this.chartOptions.plugins,
                    legend: {
                        ...this.chartOptions.plugins.legend,
                        position: 'right',
                        labels: {
                            ...this.chartOptions.legend?.labels,
                            padding: 20, // Adjust this value to add more space
                        },
                    },
                    layout: {
                        ...this.chartOptions.plugins.layout,
                        padding: {
                            top: 20,
                            bottom: 20,
                            left: 10,
                            right: 20,
                        },
                    },
                },
            };
        },
    },
    methods: {
        handle_click_events(_event, chartElements) {
            if (!chartElements || !chartElements.length) return;
            const index = chartElements[0].index;
            const query = {};
            if (index === 1) {
                query.selected_aenderung = 'true';
            } else if (index === 2) {
                query.selected_bewertung = '';
            }
            this.$router.push({ name: 'Gesangbuchlieder', query });
        },
    },
};
</script>

<style scoped></style>
