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

  <v-dialog v-model="song_dialog" width="auto">
    <v-card class="pa-3">
      <v-card-title>
        {{ selected_song.titel }}
      </v-card-title>
      <v-card-text>

        <v-carousel
          v-if="selected_song.melodie.files"
          :show-arrows="selected_song.melodie.files?.length <= 1 ? false : 'hover'"
          hide-delimiter-background
          height="300"
          v-model="pdf_carousel_model"
        >
          <v-carousel-item
            v-for="(file, i) in selected_song.melodie.files"
            :key="i"
            :src="file.type.includes('image') ? getImgUrl(file.id) : null"
          >
            <div class="d-flex align-center justify-center fill-height bg-grey" v-if="file.type === 'application/pdf'">
              <vue-pdf-embed
                height="300"
                :source="getPdfUrl(file.id)"
                @click="fullscreen_pdf($event, file)"
              />
            </div>
          </v-carousel-item>
        </v-carousel>
        <div class="text-subtitle-2" style="max-width: 600px;" v-if="selected_song.melodie.files">
          Name: {{selected_song.melodie.files[pdf_carousel_model]?.title}}
        </div>

        {{}}

        <div class="text-h6">
          Strophen
        </div>
        <div
          style="max-width: 500px;"
          class="d-flex flex-row mb-4"
          v-for="(strophe, index) in selected_song.text.strophenEinzeln"
          :key="index"
        >
          <div class="me-2">{{ index + 1 }}.</div>
          <div>
            {{ strophe.strophe }}
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog v-model="noten_dialog" style="height: 100vh; width: 100vw">
    <div class="position-relative" style="overflow: scroll">
      <v-btn icon="mdi-close" @click="noten_dialog = false" class="position-fixed ma-10" style="z-index: 10000; right: 0"></v-btn>
      <vue-pdf-embed
        v-if="selected_file"
        :source="getPdfUrl(selected_file.id)"
        :page="1"
      />
    </div>
  </v-dialog>
</template>
<script>
import { useAppStore } from "@/store/app";
import VuePdfEmbed from 'vue-pdf-embed';

export default {
  name: "SongOverview",
  components: { VuePdfEmbed },
  mounted() {
    // $(this.$refs.ref_data_table.dt.table().body()).on('click', 'tr', function (event) {
    //   console.log(event)
    // });
  },
  data: () => ({
    search: null,
    song_dialog: false,
    noten_dialog: false,
    selected_song: null,
    selected_file: null,
    pdf_carousel_model: 0,
    fullscreen: false,
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
    getPdfUrl(file_id) {
      return `https://gb26.***REMOVED***/assets/${file_id}.pdf`;
    },
    getImgUrl(file_id) {
      return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}`;
    },
    fullscreen_pdf(event, file) {
      console.log(event)
      console.log(file)
      this.selected_file = file;
      this.noten_dialog = true;
    }
  },
};
</script>

<style>
i.mdi-circle.mdi.v-icon.notranslate.v-theme--light.v-icon--size-default:before {
  color: #9595ff;
}
</style>
