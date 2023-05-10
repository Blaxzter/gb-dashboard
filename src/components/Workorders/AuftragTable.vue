<template>

  <v-data-table
    style="min-height: 600px"
    :headers="headers"
    :items="auftraege"
    item-key="id"
    :search="search"
    locale="de"
  >
    <template v-slot:top>
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
</template>

<script>

import {useAppStore} from "@/store/app";

export default {
  name: "AuftragTable",
  data: () => ({
    store: useAppStore(),
    search: '',
    headers: [
      { title: "Arbeitskreis", align: "start", key: "arbeitskreis_name" },
      { title: "Abgabetermin", align: "start", key: "abgabetermin" },
      { title: "Text", align: "start", key: "text.titel" },
      { title: "Melodie", align: "start", key: "melodie.titel" },
      { title: "Anmerkung", align: "start", key: "anmerkung" },
    ],
  }),
  props: {
    auftraege: Array,
  },
}
</script>

<style scoped>

</style>
