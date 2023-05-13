<template>

  <div class="text-h4 mb-6">
    Aktueller Stand
  </div>

  <v-row>
    <v-col cols="12" sm="6" md="3">
      <v-card title="Lieder" height="120px">
        <v-card-text class="text-center pt-4">
            <span class="text-h5">
              # {{ songs.length }}
            </span>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-card title="Texte" height="120px">
        <v-card-text class="text-center pt-4">
            <span class="text-h5">
              # {{ texts.length }}
            </span>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-card title="Melodien" height="120px">
        <v-card-text class="text-center pt-4">
            <span class="text-h5">
              # {{ melodies.length }}
            </span>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-card title="Arbeitsaufträge" height="120px">
        <v-card-text class="text-center pt-4">
            <span class="text-h5">
              # {{ auftraege.length }}
            </span>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <v-row>
    <v-col cols="12" lg="7">
      <v-card class="pa-3">
        <SongCategories :chart_options="chart_options" />
      </v-card>
    </v-col>
    <v-col cols="12" lg="5">
      <v-card class="pa-3">
        <WorkOrder :chart_options="chart_options" />
      </v-card>
    </v-col>
  </v-row>

  <v-row v-if="is_kleiner_kreis_ansicht && is_kleiner_kreis">
    <v-col cols="12" lg="6">
      <v-card class="pa-3">
        <SongRatingStatus :chart_options="chart_options" />
      </v-card>
    </v-col>
    <v-col cols="12" lg="6">
      <v-card class="pa-3">
        <SongRatingOverview :chart_options="chart_options" />
      </v-card>
    </v-col>
  </v-row>

  <div class="text-h4 mt-10 mb-5 d-flex align-center">
    <v-icon class="me-5">mdi-video</v-icon>
    Tutorial Video
  </div>

  <div style="padding:56.25% 0 0 0;position:relative;" class="mb-5">
    <iframe
      src="https://player.vimeo.com/video/825475103?h=97f1880690&title=0&byline=0&portrait=0&speed=0&badge=0&autopause=0&player_id=0&app_id=58479/embed"
      allow="autoplay; fullscreen; picture-in-picture" allowfullscreen frameborder="0"
      style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
  </div>

  <div style="padding:56.25% 0 0 0;position:relative;" >
    <iframe
      src="https://player.vimeo.com/video/825783809?h=d917ebb9bc&badge=0&autopause=0&player_id=0&app_id=58479/embed"
      allow="autoplay; fullscreen; picture-in-picture" allowfullscreen frameborder="0"
      style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
  </div>
</template>

<script>

import {useAppStore} from "@/store/app";
import {useUserStore} from "@/store/user";

import WorkOrder from "@/components/dashboard/WorkOrder.vue";
import SongCategories from "@/components/dashboard/SongCategories.vue";
import SongRatingStatus from "@/components/dashboard/SongRatingStatus.vue";
import SongRatingOverview from "@/components/dashboard/SongRatingOverview.vue";


export default {
  name: "CurrentState",
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
              size: 12
            },
            generateLabels(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                const {labels: {pointStyle, color}} = chart.legend.options;

                return data.labels.map((label, i) => {
                  const meta = chart.getDatasetMeta(0);
                  const style = meta.controller.getStyle(i);

                  return {
                    text: label.length > 15 ? label.substring(0, 15) + '...' : label,
                    fillStyle: style.backgroundColor,
                    strokeStyle: style.borderColor,
                    fontColor: color,
                    lineWidth: style.borderWidth,
                    pointStyle: pointStyle,
                    hidden: !chart.getDataVisibility(i),

                    // Extra data used for toggling the correct item
                    index: i
                  };
                });
              }
              return [];
            }
          },
        },
      },
      tooltips: {
        mode: 'dataset'
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  }),
  computed: {
    is_kleiner_kreis() {
      return this.user.is_kleiner_kreis
    },
    is_kleiner_kreis_ansicht() {
      return this.user.is_kleiner_kreis_ansicht
    },
    chart_options() {
      const ret_options = this.options;
      ret_options.plugins.legend.position = this.$vuetify.display.mdAndUp ? 'right' : 'bottom';
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
      return this.store.auftraege;
    },
  },
}
</script>

<style scoped>

</style>
