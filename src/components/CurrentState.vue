<template>
    <div class="text-h4 mb-6">Aktueller Stand</div>

    <v-row>
        <v-col cols="12" sm="6" md="3">
            <v-card title="Lieder" height="120px">
                <v-card-text class="text-center pt-4">
                    <span class="text-h5">
                        {{ songs.length }}
                    </span>
                </v-card-text>
            </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
            <v-card title="Texte" height="120px">
                <v-card-text class="text-center pt-4">
                    <span class="text-h5">
                        {{ texts.length }}
                    </span>
                </v-card-text>
            </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
            <v-card title="Melodien" height="120px">
                <v-card-text class="text-center pt-4">
                    <span class="text-h5">
                        {{ melodies.length }}
                    </span>
                </v-card-text>
            </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
            <v-card title="Arbeitsaufträge" height="120px">
                <v-card-text class="text-center pt-4">
                    <span class="text-h5">
                        {{ auftraege.length }}
                    </span>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>

    <v-row>
        <v-col cols="12" lg="7">
            <v-card class="pa-3">
                <SongCategories :chart-options="chart_options" />
            </v-card>
        </v-col>
        <v-col cols="12" lg="5">
            <v-card class="pa-3">
                <WorkOrder :chart-options="chart_options" />
            </v-card>
        </v-col>
    </v-row>

    <v-row v-if="is_kleiner_kreis_ansicht && is_kleiner_kreis">
        <v-col cols="12" lg="6">
            <v-card class="pa-3">
                <SongRatingStatus :chart-options="chart_options" />
            </v-card>
        </v-col>
        <v-col cols="12" lg="6">
            <v-card class="pa-3">
                <SongRatingOverview :chart-options="chart_options" />
            </v-card>
        </v-col>
        <v-col cols="12" lg="12">
            <v-card class="pa-3">
                <SongCategories :chart-options="chart_options" :filtered="true" />
            </v-card>
        </v-col>
    </v-row>
</template>

<script>
import { useAppStore } from '@/store/app';
import { useUserStore } from '@/store/user';

import WorkOrder from '@/components/dashboard/WorkOrder.vue';
import SongCategories from '@/components/dashboard/SongCategories.vue';
import SongRatingStatus from '@/components/dashboard/SongRatingStatus.vue';
import SongRatingOverview from '@/components/dashboard/SongRatingOverview.vue';
import _ from 'lodash';

export default {
    name: 'CurrentState',
    components: {
        SongRatingOverview,
        SongRatingStatus,
        WorkOrder,
        SongCategories,
    },
    data: () => ({
        tab: null,
        store: useAppStore(),
        user: useUserStore(),
        options: {
            // chartjs label positon
            plugins: {
                tooltip: {
                    enabled: true,
                    position: 'nearest',
                },
                legend: {
                    // set custom legend text formatter that adds ... if text is too long
                    labels: {
                        usePointStyle: true,
                        boxWidth: 10,
                        padding: 10,
                        font: {
                            size: 12,
                        },
                        generateLabels(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                const {
                                    labels: { pointStyle, color },
                                } = chart.legend.options;

                                return data.labels.map((label, i) => {
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta.controller.getStyle(i);

                                    return {
                                        text:
                                            label.length > 15
                                                ? label.substring(0, 15) + '...'
                                                : label,
                                        fillStyle: style.backgroundColor,
                                        strokeStyle: style.borderColor,
                                        fontColor: color,
                                        lineWidth: style.borderWidth,
                                        pointStyle: pointStyle,
                                        hidden: !chart.getDataVisibility(i),

                                        // Extra data used for toggling the correct item
                                        index: i,
                                    };
                                });
                            }
                            return [];
                        },
                    },
                },
            },
            tooltips: {
                mode: 'dataset',
            },
            responsive: true,
            maintainAspectRatio: false,
        },
    }),
    computed: {
        is_kleiner_kreis() {
            return this.user.is_kleiner_kreis;
        },
        is_kleiner_kreis_ansicht() {
            return this.user.is_kleiner_kreis_ansicht;
        },
        chart_options() {
            const ret_options = this.options;
            ret_options.plugins.legend.position = this.$vuetify.display.mdAndUp
                ? 'right'
                : 'bottom';
            return ret_options;
        },
        songs() {
            return this.store.gesangbuchlied;
        },
        texts() {
            return this.store.texts;
        },
        melodies() {
            return this.store.melodies;
        },
        auftraege() {
            return _.filter(this.store.auftraege, (a) => a.status !== 'done');
        },
    },
};
</script>

<style scoped></style>
