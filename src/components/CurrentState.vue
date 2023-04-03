<template>

  <v-container>
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
  </v-container>

</template>

<script>

import _ from 'lodash';

import {mapStores} from 'pinia'
import {useAppStore} from "@/store/app";

import {ArcElement, Chart as ChartJS, Legend, Tooltip} from 'chart.js'
import {Doughnut} from 'vue-chartjs'

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
      return {
        labels: ['Veröffentlicht', 'Entwurf', 'Archiviert'],
        datasets: [
          {
            backgroundColor: ['#41B883', '#00D8FF', '#DD1B16'],
            data: this.song_data_list
          }
        ]
      }
    },
    work_chart_data() {
      return {
        labels: ['Text', 'Melodie', 'Jugend', 'Kinder', 'IT', 'Kleiner Kreis'],
        datasets: [
          {
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
            data: this.work_orders_data_list
          }
        ]
      }
    },
    song_data_list() {
      const song_data = _.countBy(this.songs, (ele) => ele.status)
      return [
        _.get(song_data, 'published', 0),
        _.get(song_data, 'draft', 0),
        _.get(song_data, 'archived', 0),
      ]
    },
    work_orders_data_list() {
      const work_orders_data = _.countBy(this.work_orders, (ele) => ele.arbeitskreisId)
      return [
        _.get(work_orders_data, '1', 0),
        _.get(work_orders_data, '2', 0),
        _.get(work_orders_data, '3', 0),
        _.get(work_orders_data, '4', 0),
        _.get(work_orders_data, '5', 0),
        _.get(work_orders_data, '6', 0),
      ]
    }
  }
}
</script>

<style scoped>

</style>
