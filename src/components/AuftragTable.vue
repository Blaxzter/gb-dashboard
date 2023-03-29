<template>
  <v-table>
    <thead>
    <tr>
      <th class="text-left" v-for="table_head in table_header" :key="table_head">
        {{ table_head }}
      </th>
    </tr>
    </thead>
    <tbody>
    <tr
      v-for="auftrag in auftraege"
      :key="auftrag.id"
    >
      <td>{{ auftrag.arbeitskreis_name }}</td>
      <td>{{ auftrag.abgabetermin }}</td>
      <td>{{ auftrag.text_name }}</td>
      <td>{{ auftrag.melodie_name }}</td>
      <td>{{ auftrag.anmerkung }}</td>
    </tr>
    </tbody>
  </v-table>
</template>

<script>

import {useAppStore} from "@/store/app";

export default {
  name: "AuftragTable",
  data: () => ({
    store: useAppStore(),
    table_header: ['Arbeitskreis', 'Abgabetermin', 'Text', 'Melodie', 'Anmerkung'],
  }),
  props: {
    auftraege: Array,
  },
  computed: {
    arbeitskreis_name(id) {
      return this.store.arbeitskreis_by_id(id)
    }
  }
}
</script>

<style scoped>

</style>
