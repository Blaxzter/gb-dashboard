<template>
  <div>
    <div class="text-h4 mb-5">Bereits eingetragene Gesangbuchlieder</div>
  </div>

  <v-data-table
    style="min-height: 600px"
    :headers="headers"
    :items="filtered_gesangbuchlieder"
    item-key="id"
    @click:row="rowClick"
    :search="search"
  >
    <template v-slot:top>
      <div class="d-flex align-center">
        <v-text-field
          v-model="search"
          single-line
          prepend-icon="mdi-magnify"
          label="Suche"
          hide-details
          class="pa-4"
        ></v-text-field>
        <v-btn-toggle v-model="filter" variant="outlined" multiple color="primary">
          <v-tooltip text="Nur Gesangbuchlieder mit Textvorschlägen anzeigen." location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" value="suggestions" ><v-icon color="primary">mdi-text-box-edit</v-icon></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip text="Nur Gesangbuchlieder mit Anmerkung anzeigen." location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" value="remarks"><v-icon color="primary">mdi-message</v-icon></v-btn>
            </template>
          </v-tooltip>
        </v-btn-toggle>
      </div>
    </template>

    <template v-slot:[`item.text_work_order`]="{ item }">
      <v-tooltip :text="item.props.title.text_work_order ? 'Text Arbeitsauftrag' : 'Keinen Arbeitsauftrag'" location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon :icon="item.props.title.text_work_order ? 'mdi-file-document' : 'mdi-check'" v-bind="props" :color="item.props.title.text_work_order ? 'primary' : 'success'"/>
        </template>
      </v-tooltip>
    </template>
    <template v-slot:[`item.music_work_order`]="{ item }">
      <v-tooltip :text="item.props.title.melodie_work_order ? 'Melodie Arbeitsauftrag' : 'Keinen Arbeitsauftrag'" location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon :icon="item.props.title.melodie_work_order ? 'mdi-music' : 'mdi-check'" v-bind="props" :color="item.props.title.melodie_work_order ? 'primary' : 'success'"/>
        </template>
      </v-tooltip>
    </template>
  </v-data-table>

  <v-dialog v-model="song_dialog" width="700">
    <GesangbuchLiedComponent :selected_song="selected_song" @close="song_dialog = false"/>
  </v-dialog>
</template>
<script>
import { useAppStore } from "@/store/app";
import GesangbuchLiedComponent from "@/components/SongRelated/GesangbuchLiedComponent.vue";

import _ from "lodash"

export default {
  name: "SongOverview",
  components: {GesangbuchLiedComponent},
  mounted() {
    // $(this.$refs.ref_data_table.dt.table().body()).on('click', 'tr', function (event) {
    //   console.log(event)
    // });
  },
  data: () => ({
    search: null,
    song_dialog: false,
    selected_song: null,
    filter: [],
    store: useAppStore(),
    headers: [
      { title: "Title", align: "start", key: "titel" },
      { title: "Text Title", align: "start", key: "text.titel" },
      { title: "Text Auftrag", align: "center", key: "text_work_order", sort: (a, b) => (a && !b) ? -1 : (!a && b ? 1 : 0)},
      { title: "Melodie Title", align: "start", key: "melodie.titel" },
      { title: "Melodie Auftrag", align: "center", key: "music_work_order", sort: (a, b) => (a && !b) ? -1 : (!a && b ? 1 : 0)},
      { title: "Strophe", align: "start", key: "text.strophen_connected_short" },
    ],
  }),
  computed: {
    gesangbuchlieder() {
      return this.store.gesangbuchlieder;
    },
    filtered_gesangbuchlieder() {
      let ret_gesangbuchlieder = this.gesangbuchlieder;
      if (this.filter.includes('suggestions'))
        ret_gesangbuchlieder = _.filter(this.gesangbuchlieder, (elem) =>  _.some(elem?.text?.strophenEinzeln, obj => _.has(obj, 'aenderungsvorschlag') && !_.isEmpty(obj.aenderungsvorschlag)))
      if (this.filter.includes('remarks'))
        ret_gesangbuchlieder = _.filter(this.gesangbuchlieder, (elem) =>  _.some(elem?.text?.strophenEinzeln, obj => _.has(obj, 'anmerkung') && !_.isEmpty(obj.anmerkung)))
      return ret_gesangbuchlieder
    }
  },
  methods: {
    rowClick(item, value) {
      this.song_dialog = true;
      this.selected_song = value.item.raw;
      console.log(this.selected_song)
    },
  },
};
</script>

<style>
i.mdi-circle.mdi.v-icon.notranslate.v-theme--light.v-icon--size-default:before {
  color: #9595ff;
}

.v-data-table__tr:hover  {
  background-color: #cbd5e1;
}
.v-data-table__td {
  background-color: transparent !important;
}
</style>
