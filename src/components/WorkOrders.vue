<template>

  <v-container>
    <div class="text-h4 mb-6">
      Arbeitsaufträge
    </div>

    <v-card height="500px">
      <v-tabs
        v-model="tab"
        fixed-tabs
      >
        <v-tab value="one">Texte, die Melodie benötigen</v-tab>
        <v-tab value="two">Texte, die Bearbeitung benötigen</v-tab>
        <v-tab value="three">Melodien, die Bearbeitungen benötigen</v-tab>
      </v-tabs>

      <v-card-text>
        <v-window v-model="tab">
          <v-window-item value="one">
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
                <td>{{ auftrag.arbeitskreisId }}</td>
                <td>{{ auftrag.abgabetermin }}</td>
                <td>{{ auftrag.textId }}</td>
                <td>{{ auftrag.melodieId }}</td>
                <td>{{ auftrag.anmerkung }}</td>
              </tr>
              </tbody>
            </v-table>
          </v-window-item>

          <v-window-item value="two">
            {{ auftraege }}
          </v-window-item>

          <v-window-item value="three">
            Three
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-container>

</template>

<script>

import { mapStores } from 'pinia'
import {useAppStore} from "@/store/app";

export default {
  name: "WorkOrders",
  data: () => ({
    tab: null,
    store: useAppStore(),
    table_header: ['Arbeitskreis', 'Abgabetermin', 'Text', 'Melodie', 'Anmerkung'],
    desserts: [
      {
        name: 'Frozen Yogurt',
        calories: 159,
      },
      {
        name: 'Ice cream sandwich',
        calories: 237,
      },
      {
        name: 'Eclair',
        calories: 262,
      },
      {
        name: 'Cupcake',
        calories: 305,
      },
    ],
  }),
  computed: {
    ...mapStores(useAppStore),
    auftraege() {
      return this.store.auftraege;
    },

  }
}
</script>

<style scoped>

</style>
