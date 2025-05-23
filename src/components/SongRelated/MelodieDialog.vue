<template>
  <v-card class="pa-3">
    <v-card-title class="d-flex justify-space-between">
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
        v-model="pdf_carousel_model"
        :show-arrows="melodie.files?.length <= 1 ? false : 'hover'"
        hide-delimiter-background
        :hide-delimiters="melodie.files?.length <= 1"
        height="300"
      >
        <v-carousel-item
          v-for="(file, i) in melodie.files"
          :key="i"
          :src="file.type.includes('image') ? getImgUrl(file.id) : null"
        >
          <div
            v-if="file.type === 'application/pdf'"
            class="d-flex align-center justify-center fill-height bg-grey"
          >
            <vue-pdf-embed
              height="300"
              :source="getPdfUrl(file.id)"
              @click="fullscreen_pdf($event, file)"
            />
          </div>
        </v-carousel-item>
      </v-carousel>
      <div
        v-if="melodie.files.length"
        class="d-flex flex-row text-subtitle-2"
        style="max-width: 600px"
      >
        <div class="me-3">Dateiname:</div>
        <div>
          {{ melodie.files[pdf_carousel_model]?.title }}
        </div>
      </div>

      <div
        v-if="melodie?.auftrag?.length"
        class="text-subtitle-1 font-weight-medium"
      >
        Aufträge:
      </div>
      <div v-if="melodie?.auftrag?.length">
        <div
          v-for="(auftrag, index) in melodie?.auftrag"
          :key="index"
          class="mb-3"
        >
          <v-card :subtitle="`Auftrag ${index + 1}`">
            <v-card-text>
              <div class="text-subtitle-1 font-weight-medium">Auftragsart:</div>
              <div>
                {{ auftrag_type_to_name[auftrag.auftragsartMelodie] }}
              </div>
              <div class="text-subtitle-1 font-weight-medium">Anmerkung:</div>
              <div class="white-space-pre">
                {{ auftrag.anmerkung }}
              </div>
            </v-card-text>
          </v-card>
        </div>
      </div>

      <div v-if="melodie?.anmerkung" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium">Anmerkung:</div>
        <div class="ps-3 white-space-pre">
          {{ melodie?.anmerkung }}
        </div>
      </div>

      <div v-if="melodie?.rueckfrageAutor" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium">Rückfrage Autor:</div>
        <div class="ps-3">
          {{ melodie?.rueckfrageAutor }}
        </div>
      </div>

      <div v-if="melodie?.quelle" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium">Quelle:</div>
        <div class="ps-3">
          {{ melodie?.quelle }}
        </div>
      </div>

      <div v-if="melodie?.quelllink" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium">Quelle Link:</div>
        <div class="ps-3">
          {{ melodie?.quelllink }}
        </div>
      </div>

      <div v-if="melodie?.verse && melodie?.silben" class="mb-2">
        <div class="d-flex flex-row align-center" style="gap: 6px">
          <div class="text-subtitle-1 font-weight-medium">Verse:</div>
          <div class="me-5">{{ melodie?.verse }}</div>
          <div class="text-subtitle-1 font-weight-medium">Silben:</div>
          <div class="me-5">{{ melodie?.silben }}</div>
          <div class="text-subtitle-1 font-weight-medium">Summe:</div>
          <div>{{ melodie?.silben_pro_strophe }}</div>
        </div>
      </div>

      <div
        v-if="melodie?.authors?.length"
        class="text-subtitle-1 font-weight-medium"
      >
        Autoren
      </div>
      <div
        v-for="(author, index) in melodie?.authors"
        :key="index"
        class="d-flex flex-row mb-1 ps-3"
      >
        <div class="me-2">{{ index + 1 }}.</div>
        <div>
          {{ author.vorname }} {{ author.nachname }}
          {{
            author.geburtsjahr || author.sterbejahr
              ? ` (${author.geburtsjahr ? "*" + author.geburtsjahr : ""} ${author.sterbejahr ? " - " + author.sterbejahr : ""})`
              : ""
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
      <v-btn
        icon="mdi-close"
        class="position-fixed ma-10"
        style="z-index: 10000; right: 0"
        @click="noten_dialog = false"
      ></v-btn>
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
import { auftrag_type_to_name, status_mapping } from "@/assets/js/utils";

export default {
  name: "MelodieDialog",
  components: { VuePdfEmbed },
  props: {
    melodie: {
      type: Object,
      required: true,
    },
  },
  emits: ["close"],
  data: () => ({
    noten_dialog: false,
    selected_file: null,
    pdf_carousel_model: 0,
  }),
  computed: {
    auftrag_type_to_name() {
      return auftrag_type_to_name;
    },
    status_mapping() {
      return status_mapping;
    },
  },
  methods: {
    getPdfUrl(file_id) {
      return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}.pdf`;
    },
    getImgUrl(file_id) {
      return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}`;
    },
    fullscreen_pdf(event, file) {
      this.selected_file = file;
      this.noten_dialog = true;
    },
  },
};
</script>

<style scoped></style>
