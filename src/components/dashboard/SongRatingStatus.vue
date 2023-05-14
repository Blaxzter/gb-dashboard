<template>
  <div class="text-h5">
    Lieder nach Kategorien
  </div>
  <div class="mt-3">
    <div style="height: 400px">
      <Doughnut :data="song_rating_data" :options="chart_options" ref="song_rating_chart" />
    </div>
  </div>
</template>

<script >

import _ from 'lodash';

import {useAppStore} from "@/store/app";

import {ArcElement, Chart as ChartJS, Legend, Tooltip} from 'chart.js'
import {Doughnut} from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip, Legend)

export default {
  name: "SongRatingStatus",
  components: {
    Doughnut
  },
  data: () => ({
    store: useAppStore(),
  }),
  props: {
    chart_options: {
      type: Object,
      required: true
    }
  },
  computed: {
    songs() {
      return this.store.gesangbuchlied;
    },
    rated_song_bezeichner() {
      console.log(_.map(this.songs, elem => elem.bewertung_kleiner_kreis.bezeichner))
      return _.map(this.songs, elem => elem.bewertung_kleiner_kreis.bezeichner === '')
    },
    rated_song_data_list() {
      return _.countBy(this.rated_song_bezeichner)
    },
    song_rating_data() {
      console.log(this.rated_song_data_list)
      const labels = _.map(this.rated_song_data_list, (value, key) => key === 'false' ? 'bewertet' : 'unbewertet')
      const rated_songs = _.map(this.rated_song_data_list, (value, key) => this.rated_song_data_list[key])

      const vibrantPastelPalette = ['#1eb995', '#ff3341'];

      return {
        labels: labels,
        datasets: [
          {
            backgroundColor: vibrantPastelPalette,
            data: rated_songs
          }
        ]
      }
    },
  }
}

</script>


<style scoped>

</style>
