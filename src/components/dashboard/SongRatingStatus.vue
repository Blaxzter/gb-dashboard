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
import _ from "lodash";

import { useAppStore } from "@/store/app";

import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { Doughnut } from "vue-chartjs";

ChartJS.register(ArcElement, Tooltip, Legend);

export default {
  name: "SongRatingStatus",
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
        if (elem.bewertung_kleiner_kreis.bezeichner === "") {
          return "Unbewertet";
        } else {
          if (elem?.liedHatAenderung) {
            return "Bewertet mit Änderungsvorschlag";
          } else {
            return "Bewertet";
          }
        }
      });
    },
    rated_song_data_list() {
      return _.countBy(this.rated_song_bezeichner);
    },
    song_rating_data() {
      const rated_songs = _.map(
        this.rated_song_data_list,
        (value, key) => this.rated_song_data_list[key],
      );

      const vibrantPastelPalette = ["#1eb995", "#ffcd56", "#ff3341"];

      return {
        labels: [
          "Bewertet",
          ["Bewertet mit", "Änderungsvorschlag"],
          "Unbewertet",
        ],
        datasets: [
          {
            backgroundColor: vibrantPastelPalette,
            data: rated_songs,
          },
        ],
      };
    },
    enhancedChartOptions() {
      return {
        ...this.chartOptions,
        plugins: {
          ...this.chartOptions.plugins,
          legend: {
            ...this.chartOptions.plugins.legend,
            position: "right",
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
};
</script>

<style scoped></style>
