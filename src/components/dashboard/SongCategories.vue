<template>
  <div class="text-h5">
    Lieder nach Kategorien
  </div>
  <div class="mt-3">
    <div style="height: 400px">
      <Doughnut :data="song_chart_data" :options="categorie_options" ref="categorie_chart" />
    </div>
  </div>
</template>

<script >

import _ from 'lodash';

import {useAppStore} from "@/store/app";

import {ArcElement, Chart as ChartJS, Legend, Tooltip} from 'chart.js'
import {Doughnut} from 'vue-chartjs'

import chroma from "chroma-js";

ChartJS.register(ArcElement, Tooltip, Legend)

export default {
  name: "SongCategories",
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
    existing_categories() {
      return _.map(
        _.filter(
          _.flatten(
            _.map(this.songs, (elem) => elem?.kategories)
          ),elem => elem
        ), elem => elem.kategorie_name.name
      );
    },
    song_category_label() {
      let existing_categories = this.existing_categories
      return _.uniq(existing_categories)
    },
    song_data_list() {
      const song_data = _.countBy(this.existing_categories)
      return _.map(this.song_category_label, elem => song_data[elem])
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
