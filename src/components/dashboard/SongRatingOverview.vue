<template>
    <div class="text-h5">Übersicht Bewertungen</div>
    <div class="mt-3">
        <div style="height: 400px">
            <Doughnut ref="song_rating_chart" :data="song_rating_data" :options="chartOptions" />
        </div>
    </div>
</template>

<script>
import _ from 'lodash';

import { useAppStore } from '@/store/app';

import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'vue-chartjs';
import chroma from 'chroma-js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default {
    name: 'SongRatingOverview',
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
            return _.map(this.songs, (elem) =>
                elem.bewertung_kleiner_kreis.bezeichner === ''
                    ? 'unbewertet'
                    : elem.bewertung_kleiner_kreis.bezeichner,
            );
        },
        rated_song_data_list() {
            return _.countBy(this.rated_song_bezeichner);
        },
        song_rating_data() {
            let labels = _.keys(this.rated_song_data_list);

            const vibrantPastelPalette = [
                '#1ba3c6',
                '#2cb5c0',
                '#30bcad',
                '#21B087',
                '#33a65c',
                '#57a337',
                '#a2b627',
                '#d5bb21',
                '#f8b620',
                '#f89217',
                '#f06719',
                '#e03426',
                '#f64971',
                '#fc719e',
                '#eb73b3',
                '#ce69be',
                '#a26dc2',
                '#7873c0',
                '#4f7cba',
            ];

            const bezierColors = chroma.bezier(vibrantPastelPalette);
            const colorScale = chroma.scale(bezierColors).mode('lch');
            const pastelColors = colorScale.colors(labels.length);

            const rated_songs = _.map(labels, (elem) => this.rated_song_data_list[elem]);

            return {
                labels: labels,
                datasets: [
                    {
                        backgroundColor: pastelColors,
                        data: rated_songs,
                    },
                ],
            };
        },
    },
};
</script>

<style scoped></style>
