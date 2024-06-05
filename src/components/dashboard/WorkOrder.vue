<template>
  <div class="text-h5">
    {{ filtered_auftraege.length }} Arbeitsaufträge der Arbeitskreise
  </div>
  <div class="mt-3">
    <div style="height: 400px">
      <Doughnut :data="work_chart_data" :options="chartOptions" />
    </div>
  </div>
</template>

<script>
import _ from "lodash";

import { useAppStore } from "@/store/app";

import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { Doughnut } from "vue-chartjs";

import chroma from "chroma-js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default {
  name: "WorkOrder",
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
    auftraege() {
      return this.store.auftraege;
    },
    filtered_auftraege() {
      return _.filter(this.auftraege, (a) => a.status !== "done");
    },
    work_order_label() {
      return _.uniq(_.map(this.filtered_auftraege, "arbeitskreis_name"));
    },
    work_orders_data_list() {
      let work_order_data = _.countBy(
        this.filtered_auftraege,
        "arbeitskreis_name",
      );
      return _.filter(
        _.map(this.work_order_label, (elem) => work_order_data[elem]),
        (elem) => elem !== 0,
      );
    },
    work_chart_data() {
      let labels = this.work_order_label;
      const vibrantPastelPalette = [
        "#1ba3c6",
        "#2cb5c0",
        "#30bcad",
        "#21B087",
        "#33a65c",
        "#57a337",
        "#a2b627",
        "#d5bb21",
        "#f8b620",
        "#f89217",
        "#f06719",
        "#e03426",
        "#f64971",
        "#fc719e",
        "#eb73b3",
        "#ce69be",
        "#a26dc2",
        "#7873c0",
        "#4f7cba",
      ];

      const bezierColors = chroma.bezier(vibrantPastelPalette);
      const colorScale = chroma.scale(bezierColors).mode("lch");
      const pastelColors = colorScale.colors(labels.length);
      return {
        labels: labels,
        datasets: [
          {
            backgroundColor: pastelColors,
            data: this.work_orders_data_list,
          },
        ],
      };
    },
  },
};
</script>

<style scoped></style>
