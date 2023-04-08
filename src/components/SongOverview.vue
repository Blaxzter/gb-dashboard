<template>
  <div>
    <div class="text-h4 mb-5">Bereits eingetragene Gesangbuchlieder</div>
  </div>

  <v-data-table
    style="min-height: 600px"
    :headers="headers"
    :items="gesangbuchlieder"
    item-key="id"
    @click:row="rowClick"
    :search="search"
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

  <v-dialog v-model="song_dialog" width="700">
    <GesangbuchLiedComponent :selected_song="selected_song" @close="song_dialog = false"/>
  </v-dialog>
</template>
<script>
import { useAppStore } from "@/store/app";
import GesangbuchLiedComponent from "@/components/SongRelated/GesangbuchLiedComponent.vue";

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

    store: useAppStore(),
    headers: [
      { title: "Status", align: "start", key: "status_mapped" },
      { title: "Title", align: "start", key: "titel" },
      { title: "Melodie Title", align: "start", key: "melodie.titel" },
      { title: "Text Title", align: "start", key: "text.titel" },
      { title: "Strophe", align: "start", key: "text.strophen_connected_short" },
    ],
  }),
  computed: {
    gesangbuchlieder() {
      console.log(this.store.gesangbuchlieder)
      return this.store.gesangbuchlieder;
    },
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
