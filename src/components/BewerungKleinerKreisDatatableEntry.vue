<template>
  <v-tooltip
    :text="item.bewertungAnmerkung || 'Keine Anmerkung'"
    location="bottom"
  >
    <template #activator="{ props }">
      <div
        :style="{
          color: rang_to_color[item.bewertung_kleiner_kreis?.rangfolge],
        }"
        v-bind="props"
      >
        <span v-if="item.bewertung_kleiner_kreis?.bezeichner">
          <v-icon icon="mdi-music" size="tiny" />
          {{ item.title?.bewertung_kleiner_kreis?.bezeichner }}
          {{ item.title?.bewertungAnmerkung ? "*" : "" }}
        </span>
      </div>
    </template>
  </v-tooltip>
  <v-tooltip
    :text="item.text?.bewertungAnmerkung || 'Keine Anmerkung'"
    location="bottom"
  >
    <template #activator="{ props }">
      <div
        :style="{
          color: rang_to_color[item.text?.bewertung_kleiner_kreis?.rangfolge],
        }"
        v-bind="props"
      >
        <span v-if="item.text?.bewertung_kleiner_kreis?.bezeichner">
          <v-icon icon="mdi-text-box" size="tiny" />
          {{ item.text?.bewertung_kleiner_kreis?.bezeichner }}
          {{ item.text?.bewertungAnmerkung ? "*" : "" }}
        </span>
      </div>
    </template>
  </v-tooltip>
  <v-tooltip
    :text="item.melodie?.bewertungAnmerkung || 'Keine Anmerkung'"
    location="bottom"
  >
    <template #activator="{ props }">
      <div
        :style="{
          color:
            rang_to_color[item.melodie?.bewertung_kleiner_kreis?.rangfolge],
        }"
        v-bind="props"
      >
        <span v-if="item.melodie?.bewertung_kleiner_kreis?.bezeichner">
          <v-icon icon="mdi-music-note" size="tiny" />
          {{ item.melodie?.bewertung_kleiner_kreis?.bezeichner }}
          {{ item.melodie?.bewertungAnmerkung ? "*" : "" }}
        </span>
      </div>
    </template>
  </v-tooltip>
</template>
<script>
import { rang_to_color } from "@/assets/js/utils";
export default {
  name: "BewerungKleinerKreisDatatableEntry",
  props: {
    item: {},
  },
  computed: {
    rang_to_color() {
      return rang_to_color;
    },
  },
};
</script>
