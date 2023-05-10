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
        <div class="text-h5">
          Lieder nach Kategorien
        </div>
        <div class="mt-3">
          <Doughnut :data="song_chart_data" :options="categorie_options" ref="categorie_chart"/>
        </div>
      </v-card>
    </v-col>
    <v-col cols="12" lg="5">
      <v-card class="pa-3">
        <div class="text-h5">
          Arbeitsaufträge der Arbeitskreise
        </div>
        <div class="mt-3">
          <Doughnut :data="work_chart_data" :options="chart_options"/>
        </div>
      </v-card>
    </v-col>
  </v-row>

  <div class="text-h4 mt-10 d-flex align-center">
    <v-icon class="me-5">mdi-video</v-icon>
    Tutorial Video
  </div>

  <div style="padding:56.25% 0 0 0;position:relative;" class="ma-sd-0 ma-md-10">
    <iframe
      src="https://player.vimeo.com/video/825475103?h=97f1880690&title=0&byline=0&portrait=0&speed=0&badge=0&autopause=0&player_id=0&app_id=58479/embed"
      allow="autoplay; fullscreen; picture-in-picture" allowfullscreen frameborder="0"
      style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
  </div>
</template>

<script>

import _ from 'lodash';

import {mapStores} from 'pinia'
import {useAppStore} from "@/store/app";

import {ArcElement, Chart as ChartJS, Legend, Tooltip} from 'chart.js'
import {Doughnut} from 'vue-chartjs'

import chroma from 'chroma-js'

ChartJS.register(ArcElement, Tooltip, Legend)

export default {
  name: "CurrentState",
  components: {
    Doughnut
  },
  data: () => ({
    tab: null,
    store: useAppStore(),
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
    ...mapStores(useAppStore),
    chart_options() {
      const ret_options = this.options;
      ret_options.plugins.legend.position = this.$vuetify.display.mdAndUp ? 'right' : 'bottom';
      return ret_options;
    },
    categorie_options() {
      const ret_options = _.cloneDeep(this.chart_options);
      ret_options.onClick = this.handle_click_events;
      ret_options.onHover = function (event, chartElement) {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      };
      return ret_options;
    },
    songs() {
      return this.store.gesangbuchlied;
    },
    work_orders() {
      return this.store.auftraege;
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
    song_chart_data() {
      let labels = this.song_category_label;
      const vibrantPastelPalette = [
        '#1ba3c6', '#2cb5c0', '#30bcad', '#21B087', '#33a65c', '#57a337', '#a2b627', '#d5bb21', '#f8b620', '#f89217', '#f06719', '#e03426', '#f64971', '#fc719e', '#eb73b3', '#ce69be', '#a26dc2', '#7873c0', '#4f7cba'
      ];

      const bezierColors = chroma.bezier(vibrantPastelPalette);
      const colorScale = chroma.scale(bezierColors).mode('lch');
      const pastelColors = colorScale.colors(labels.length);

      return {
        labels: labels,
        datasets: [
          {
            backgroundColor: pastelColors,
            data: this.song_data_list
          }
        ]
      }
    },
    work_chart_data() {
      let labels = this.work_order_label;
      const vibrantPastelPalette = [
        '#1ba3c6', '#2cb5c0', '#30bcad', '#21B087', '#33a65c', '#57a337', '#a2b627', '#d5bb21', '#f8b620', '#f89217', '#f06719', '#e03426', '#f64971', '#fc719e', '#eb73b3', '#ce69be', '#a26dc2', '#7873c0', '#4f7cba'
      ];

      const bezierColors = chroma.bezier(vibrantPastelPalette);
      const colorScale = chroma.scale(bezierColors).mode('lch');
      const pastelColors = colorScale.colors(labels.length);
      return {
        labels: labels,
        datasets: [
          {
            backgroundColor: pastelColors,
            data: this.work_orders_data_list
          }
        ]
      }
    },
    existing_categories() {
      return _.map(_.filter(_.flatten(_.map(this.songs, (elem) => elem?.kategories)), elem => elem), elem => elem.kategorie_name.name);
    },
    song_category_label() {
      let existing_categories = this.existing_categories
      return _.uniq(existing_categories)
    },
    song_data_list() {
      const song_data = _.countBy(this.existing_categories)
      return _.map(this.song_category_label, elem => song_data[elem])
    },

    work_order_label() {
      return _.uniq(_.map(this.auftraege, 'arbeitskreis_name'))
    },
    work_orders_data_list() {
      let work_order_data = _.countBy(this.work_orders, 'arbeitskreis_name');
      return _.filter(_.map(this.work_order_label, elem => work_order_data[elem]), elem => elem !== 0)
    }
  },
  methods: {
    handle_click_events(event, legendItem) {
      if (legendItem && legendItem.length) {
        let element_index = legendItem[0].index;
        this.$router.push({
          name: 'Gesangbuchlieder',
          query: {filter_kategorie: this.song_category_label[element_index]}
        })
      }
    }
  }
}
</script>

<style scoped>

</style>
