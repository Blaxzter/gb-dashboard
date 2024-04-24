<template>
  <v-data-table
    style="min-height: 600px"
    :headers="headers"
    :items="auftraege"
    item-key="id"
    :search="search"
    locale="de"
    @click:row="rowClick"
  >
    <template #top>
      <v-text-field
        v-model="search"
        single-line
        prepend-icon="mdi-magnify"
        label="Suche"
        hide-details
        class="pa-4"
      ></v-text-field>
    </template>
  </v-data-table>

  <v-dialog v-model="text_dialog" width="700">
    <TextDialog :text="auftrag.text" @close="text_dialog = false" />
  </v-dialog>
  <v-dialog v-model="melodie_dialog" width="700">
    <MelodieDialog :melodie="auftrag.melodie" @close="melodie_dialog = false" />
  </v-dialog>
</template>

<script>
import _ from "lodash";

import { useAppStore } from "@/store/app";
import TextDialog from "@/components/SongRelated/TextDialog.vue";
import MelodieDialog from "@/components/SongRelated/MelodieDialog.vue";

export default {
  name: "AuftragTable",
  components: { MelodieDialog, TextDialog },
  props: {
    auftraege: {
      type: Array,
      required: true,
    },
  },
  data: () => ({
    store: useAppStore(),
    search: "",
    text_dialog: false,
    melodie_dialog: false,
    auftrag: {},
    headers: [
      { title: "Arbeitskreis", align: "start", key: "arbeitskreis_name" },
      { title: "Abgabetermin", align: "start", key: "abgabetermin" },
      { title: "Text", align: "start", key: "text.titel" },
      { title: "Melodie", align: "start", key: "melodie.titel" },
      { title: "Anmerkung", align: "start", key: "anmerkung" },
    ],
  }),
  methods: {
    rowClick(event, item) {
      this.auftrag = item.item;
      if (!_.isNil(item.item.text)) {
        this.text_dialog = true;
      } else if (!_.isNil(item.item.melodie)) {
        this.melodie_dialog = true;
      }
    },
  },
};
</script>

<style scoped></style>
