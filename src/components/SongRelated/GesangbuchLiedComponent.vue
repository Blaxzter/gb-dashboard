<template>
  <v-card class="pa-3">
    <v-card-title>
      <v-card-title class="d-flex justify-space-between pb-0 align-center">
        <div>
          {{ selected_song?.titel }}
        </div>
        <div>
          <v-tooltip text="Mehr Text Informationen" location="bottom" v-if="selected_song?.text">
            <template v-slot:activator="{ props }">
              <v-btn icon="mdi-text-box" v-bind="props" variant="text" @click="text_dialog = true"/>
            </template>
          </v-tooltip>
          <v-tooltip text="Mehr Melodie Informationen" location="bottom" v-if="selected_song?.melodie">
            <template v-slot:activator="{ props }">
              <v-btn icon="mdi-music" v-bind="props" variant="text" @click="melodie_dialog = true"/>
            </template>
          </v-tooltip>
        </div>
      </v-card-title>
    </v-card-title>
    <v-card-text class="pt-0 px-8">
      <v-carousel
        v-if="selected_song.melodie?.files.length"
        :show-arrows="selected_song.melodie?.files?.length <= 1 ? false : 'hover'"
        hide-delimiter-background
        :hide-delimiters="selected_song?.melodie?.files?.length <= 1"
        height="300"
        v-model="pdf_carousel_model"
      >
        <v-carousel-item
          v-for="(file, i) in selected_song?.melodie?.files"
          :key="i"
          :src="file.type.includes('image') ? getImgUrl(file.id) : null"
        >
          <div class="d-flex align-center justify-center fill-height bg-grey" v-if="file.type === 'application/pdf'">
            <vue-pdf-embed
              height="300"
              :source="getPdfUrl(file.id)"
              @click="fullscreen_pdf($event, file)"
              style="cursor: pointer;"
            />
          </div>
        </v-carousel-item>
      </v-carousel>
      <div class="d-flex flex-row text-subtitle-2" style="max-width: 600px;" v-if="selected_song?.melodie?.files.length">
        <div class="me-3">
          Dateiname:
        </div>
        <div>
          {{selected_song?.melodie?.files[pdf_carousel_model]?.title}}
        </div>
      </div>

      <div class="text-h6 mx-auto mb-3">
        Strophen
      </div>
      <div
        style="max-width: 500px;"
        class="mb-4 mx-auto"
        v-for="(strophe, index) in selected_song?.text.strophenEinzeln"
        :key="index"
      >
        <v-row class="pb-0">
          <v-col cols="1" class="pb-0">{{ index + 1 }}.</v-col>
          <v-col cols="11" class="pb-0">
            {{ strophe.strophe }}
          </v-col>
        </v-row>
        <v-row class="pt-2" v-if="strophe.aenderungsvorschlag">
          <v-col cols="1" class="d-flex align-center pt-0"></v-col>
          <v-col cols="11" class="pt-0" :class="{'pb-0': strophe.anmerkung}" style="font-size: 0.9rem">
            <v-icon icon="mdi-pencil" size="tiny" class="me-3" :class="{'pb-0': strophe.anmerkung}"></v-icon>
            {{ strophe.aenderungsvorschlag }}
          </v-col>
        </v-row>
        <v-row class="pt-2" v-if="strophe.anmerkung">
          <v-col cols="1" class="d-flex align-center pt-0"></v-col>
          <v-col cols="11" class="pt-0" style="font-size: 0.9rem">
            <v-icon icon="mdi-message" size="tiny" class="me-3"></v-icon>
            {{ strophe.anmerkung }}
          </v-col>
        </v-row>
      </div>

      <v-chip-group>
        <v-chip :prepend-icon="gesangbuch_kategorie_name_to_icon(category?.kategorie_name?.name)" v-for="(category, index) in selected_song?.kategories" :key="index">
          {{ category?.kategorie_name?.name }}
        </v-chip>
      </v-chip-group>

      <div v-for="(author_source, index_1) in [{name: 'Text', src: selected_song?.text?.authors}, {name: 'Melodie', src: selected_song?.melodie?.authors}]" :key="index_1">
        <div v-if="author_source?.src">
          <div class="text-subtitle-1 font-weight-medium">
            {{ author_source.name }} Author
          </div>
          <div
            class="d-flex flex-row mb-4"
            v-for="(author, index) in author_source.src"
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

  <v-dialog v-model="text_dialog" width="700">
    <TextDialog :text="selected_song.text" @close="text_dialog = false" />
  </v-dialog>
  <v-dialog v-model="melodie_dialog" @close="melodie_dialog = false" width="700">
    <MelodieDialog :melodie="selected_song.melodie" @close="melodie_dialog = false" />
  </v-dialog>
</template>

<script>
import VuePdfEmbed from "vue-pdf-embed";
import TextDialog from "@/components/SongRelated/TextDialog.vue";
import MelodieDialog from "@/components/SongRelated/MelodieDialog.vue";
import {gesangbuch_kategorie_name_to_icon} from "@/assets/js/utils";

export default {
  name: "GesangbuchLiedComponent",
  components: {MelodieDialog, TextDialog, VuePdfEmbed},
  props: {
    selected_song: Object,
  },
  data: () => ({
    noten_dialog: false,
    text_dialog: false,
    melodie_dialog: false,
    selected_file: null,
    pdf_carousel_model: 0
  }),
  methods: {
    gesangbuch_kategorie_name_to_icon,
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
  }
}
</script>

<style scoped>

</style>
