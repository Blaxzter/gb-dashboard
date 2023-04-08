<template>
  <v-card class="pa-3">
    <v-card-title class="d-flex justify-space-between ">
      <div>
        {{ melodie.titel }}
      </div>
      <div>
        {{ status_mapping[melodie.status] }}
      </div>
    </v-card-title>
    <v-card-text class="px-8">
      <v-carousel
        v-if="melodie.files.length"
        :show-arrows="melodie.files?.length <= 1 ? false : 'hover'"
        hide-delimiter-background
        :hide-delimiters="melodie.files?.length <= 1"
        height="300"
        v-model="pdf_carousel_model"
      >
        <v-carousel-item
          v-for="(file, i) in melodie.files"
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
      <div class="d-flex flex-row text-subtitle-2" style="max-width: 600px;" v-if="melodie.files.length">
        <div class="me-3">
          Dateiname:
        </div>
        <div>
          {{melodie.files[pdf_carousel_model]?.title}}
        </div>
      </div>

      <div v-if="melodie?.anmerkung" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium" >
          Anmerkung:
        </div>
        <div class="ps-3">
          {{ melodie?.anmerkung }}
        </div>
      </div>

      <div v-if="melodie?.rueckfrageAutor" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium" >
          Rückfrage Author:
        </div>
        <div class="ps-3">
          {{ melodie?.rueckfrageAutor }}
        </div>
      </div>

      <div v-if="melodie?.quelle" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium" >
          Quelle:
        </div>
        <div class="ps-3">
          {{ melodie?.quelle }}
        </div>
      </div>

      <div v-if="melodie?.quelllink" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium" >
          Quelle Link:
        </div>
        <div class="ps-3">
          {{ melodie?.quelllink }}
        </div>
      </div>

      <div class="text-subtitle-1 font-weight-medium" v-if="melodie?.authors">
        Authoren
      </div>
      <div
        class="d-flex flex-row mb-1 ps-3"
        v-for="(author, index) in melodie?.authors"
        :key="index"
      >
        <div class="me-2">{{ index + 1 }}.</div>
        <div>
          {{ author.vorname }} {{ author.nachname }} {{
            author.geburtsjahr || author.sterbejahr ? ` (${author.geburtsjahr ?
              author.geburtsjahr : ''} - ${author.sterbejahr ? author.sterbejahr : '?'})` : ''
          }}
        </div>
      </div>
    </v-card-text>
    <v-card-actions>
      <v-btn color="error" @click="$emit('close')">Schließen</v-btn>
    </v-card-actions>
  </v-card>

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
import VuePdfEmbed from "vue-pdf-embed";
import { status_mapping } from "@/assets/js/utils";

export default {
  name: "MelodieDialog",
  computed: {
    status_mapping() {
      return status_mapping
    }
  },
  components: {VuePdfEmbed},
  props: {
    melodie: Object,
  },
  data: () => ({
    noten_dialog: false,
    selected_file: null,
    pdf_carousel_model: 0
  }),
  methods: {
    getPdfUrl(file_id) {
      return `https://gb26.***REMOVED***/assets/${file_id}.pdf`;
    },
    getImgUrl(file_id) {
      return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}`;
    },
    fullscreen_pdf(event, file) {
      this.selected_file = file;
      this.noten_dialog = true;
    }
  }
}
</script>

<style scoped>

</style>
