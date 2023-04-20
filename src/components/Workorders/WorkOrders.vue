<template>
  <div class="d-flex align-start align-md-center justify-space-between mb-0 mb-md-6 flex-column flex-md-row">
    <div class="text-h4 mb-4 text-no-wrap">{{this.filter_auftraege.length}} Arbeitsaufträge</div>
    <div class="d-flex align-end justify-end mb-6 flex-column flex-md-row w-100">
      <v-btn-toggle v-model="selected_tabs" elevation="1" color="success" class="mb-3 mb-md-0 me-md-3">
        <v-btn prepend-icon="mdi-arm-flex">Auftrags Typen</v-btn>
        <v-btn prepend-icon="mdi-shape">Kategorien</v-btn>
      </v-btn-toggle>

      <v-btn-toggle v-model="display_style" elevation="1" color="primary">
        <v-btn>
          <v-icon>
            mdi-card-multiple-outline
          </v-icon>
        </v-btn>
        <v-btn>
          <v-icon>
            mdi-table
          </v-icon>
        </v-btn>
      </v-btn-toggle>
    </div>
  </div>

  <v-card elevation="0">
    <v-tabs v-model="tab" fixed-tabs bg-color="primary">
      <v-tab value="alle">Alle</v-tab>
      <v-tab v-for="(label, index) in current_tabs" :key="index" :value="index">
        {{ selected_tabs === 1 ? label : auftrag_type_to_name[label] }}
      </v-tab>
    </v-tabs>

    <v-card-text>
      <v-window v-model="tab">
        <v-window-item value="alle">
          <AuftragCards :auftraege="auftraege" v-if="display_style === 0"/>
          <AuftragTable :auftraege="auftraege" v-else-if="display_style === 1"/>
        </v-window-item>
        <v-window-item v-for="(label, index) in current_tabs" :key="index" :value="index">
          <AuftragCards :auftraege="current_group[label]" v-if="display_style === 0"/>
          <AuftragTable :auftraege="current_group[label]" v-else-if="display_style === 1"/>
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-card>
</template>

<script>
import {mapStores} from "pinia";
import {useAppStore} from "@/store/app";
import AuftragTable from "@/components/Workorders/AuftragTable.vue";
import AuftragCards from "@/components/Workorders/AuftragCards.vue";
import {auftrag_type_to_name} from "@/assets/js/utils";
import _ from "lodash";

export default {
  name: "WorkOrders",
  components: {
    AuftragTable,
    AuftragCards,
  },
  data: () => ({
    tab: null,
    store: useAppStore(),
    display_style: 0,
    selected_tabs: 0,
    group_by_auftrag: {},
    group_by_arbeitskreis: {},
  }),
  watch: {
    selected_tabs() {
      this.tab = 0
    }
  },
  mounted() {
    let auftragsartText =  _.groupBy(this.filter_auftraege, (elem) => elem.auftragsartText)
    let auftragsartMelodie =  _.groupBy(this.filter_auftraege, (elem) => elem.auftragsartMelodie)

    let status = []
    if ('sonstiges' in auftragsartText) status.push(...auftragsartText['sonstiges'])
    if ('sonstiges' in auftragsartMelodie) status.push(
      ..._.filter(auftragsartMelodie['sonstiges'], (elem) => _.find(status, (elem_c) => elem_c.id === elem.id) === undefined)
    )

    let rueckfrageAutor = []
    if ('rueckfrageAutor' in auftragsartText) rueckfrageAutor.push(...auftragsartText['rueckfrageAutor'])
    if ('rueckfrageAutor' in auftragsartMelodie) rueckfrageAutor.push(
      ..._.filter(auftragsartMelodie['rueckfrageAutor'], (elem) => _.find(rueckfrageAutor, (elem_c) => elem_c.id === elem.id)  === undefined)
    )

    delete auftragsartText['auftragsartText']
    delete auftragsartText['sonstiges']
    delete auftragsartMelodie['auftragsartText']
    delete auftragsartMelodie['sonstiges']

    this.group_by_auftrag = {sonstiges: status, rueckfrageAutor: rueckfrageAutor, ...auftragsartText, ...auftragsartMelodie}
    this.group_by_arbeitskreis = _.groupBy(this.auftraege, (elem) => elem.arbeitskreis_name)
  },
  computed: {
    auftrag_type_to_name() {
      return auftrag_type_to_name
    },
    ...mapStores(useAppStore),
    auftraege() {
      return this.store.auftraege;
    },
    categories() {
      return this.store.auftrags_categories
    },
    filter_auftraege() {
      // Filter by status not done
      return _.filter(this.auftraege, (elem) => elem.status !== 'done')
    },
    current_tabs() {
      return this.selected_tabs === 1 ? this.categories : this.auftrag_types;
    },
    current_group() {
      return this.selected_tabs === 1 ? this.group_by_arbeitskreis : this.group_by_auftrag;
    },
    auftrag_types() {
      return this.store.auftrags_typen
    }
  },
};
</script>

<style scoped></style>
