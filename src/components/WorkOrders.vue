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
            <AuftragTable :auftraege="auftraege"/>
          </v-window-item>

          <v-window-item value="two">
            <AuftragTable :auftraege="auftraege"/>
          </v-window-item>

          <v-window-item value="three">
            <AuftragTable :auftraege="auftraege"/>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-container>

</template>

<script>

import { mapStores } from 'pinia'
import {useAppStore} from "@/store/app";
import AuftragTable from "@/components/AuftragTable.vue";

export default {
  name: "WorkOrders",
  components: {AuftragTable},
  data: () => ({
    tab: null,
    store: useAppStore(),
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
