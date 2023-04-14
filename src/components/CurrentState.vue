<template>

  <div class="text-h4 mb-6">
    Aktueller Stand
  </div>

  <v-row>
    <v-col cols="12" sm="6" md="3">
      <v-card title="Songs" height="120px">
        <v-card-text class="text-center pt-4">
            <span class="text-h5">
              # {{songs.length}}
            </span>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-card title="Texte" height="120px">
        <v-card-text class="text-center pt-4">
            <span class="text-h5">
              # {{texts.length}}
            </span>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-card title="Melodien" height="120px">
        <v-card-text class="text-center pt-4">
            <span class="text-h5">
              # {{melodies.length}}
            </span>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-card title="Arbeitsaufträge" height="120px">
        <v-card-text class="text-center pt-4">
            <span class="text-h5">
              # {{auftraege.length}}
            </span>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <v-row>
    <v-col cols="12" md="6">
      <v-card class="pa-3">
        <div class="text-h5">
          Lieder
        </div>
        <div class="mt-3">
          <Doughnut :data="song_chart_data" :options="options"/>
        </div>
      </v-card>
    </v-col>
    <v-col cols="12" md="6">
      <v-card class="pa-3">
        <div class="text-h5">
          Arbeitsaufträge der Arbeitskreise
        </div>
        <div class="mt-3">
          <Doughnut :data="work_chart_data" :options="options"/>
        </div>
      </v-card>
    </v-col>
  </v-row>
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
      responsive: true,
      maintainAspectRatio: false
    },
  }),
  computed: {
    ...mapStores(useAppStore),
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
      console.log(this.existing_categories)
      const song_data = _.countBy(this.existing_categories)
      return _.map(this.song_category_label, elem => song_data[elem])
    },

    work_order_label() {
      return _.uniq(_.map(this.auftraege, 'arbeitskreis_name'))
    },
    work_orders_data_list() {
      let work_order_data = _.countBy(this.work_orders,  'arbeitskreis_name');
      return _.filter(_.map(this.work_order_label, elem => work_order_data[elem]), elem => elem !== 0)
    }
  }
}
</script>

<style scoped>

</style>
