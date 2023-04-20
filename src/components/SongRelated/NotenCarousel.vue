<template>

    <v-carousel
      v-if="melodie?.files.length"
      :show-arrows="melodie?.files?.length <= 1 ? false : 'hover'"
      hide-delimiter-background
      :hide-delimiters="melodie?.files?.length <= 1"
      height="300"
      v-model="pdf_carousel_model"
    >
      <v-carousel-item
        v-for="(file, i) in melodie?.files"
        :key="i"
        :src="file.type.includes('image') ? getImgUrl(file.id) : null"
      >
        <div class="d-flex align-center justify-center fill-height bg-grey" v-if="file.type === 'application/pdf'">
          <vue-pdf-embed
            height="300"
            :source="getPdfUrl(file.id)"
            @click="fullscreen_pdf($event, file)"
            :page="1"
            style="cursor: pointer;"
          />
        </div>

        <div class="d-flex flex-column align-center justify-center h-100" v-if="is_audio(file)">
          <div>
            <div class="text-h6">
              {{file.title}}
            </div>
            <div class="d-flex align-center">
              <v-icon class="me-4" size="40">mdi-music-note-eighth</v-icon>
              <audio controls>
                <source :src="getImgUrl(file.id)" :type="file.type">
              </audio>
            </div>
          </div>
        </div>
      </v-carousel-item>
    </v-carousel>
    <div class="d-flex flex-row text-subtitle-2" style="max-width: 600px;" v-if="melodie?.files.length">
      <div class="me-3">
        Dateiname:
      </div>
      <div>
        {{melodie?.files[pdf_carousel_model]?.title}}
      </div>
    </div>

    <AudioCarousel v-if="filtered_audio_files?.length" :files="filtered_audio_files"/>

    <v-dialog v-model="noten_dialog" style="height: 100vh; width: 100vw">
      <div class="position-relative" style="overflow: scroll">
        <v-btn icon="mdi-close" @click="noten_dialog = false" class="position-fixed ma-10" style="z-index: 10000; right: 0"></v-btn>
        <vue-pdf-embed
          v-if="selected_file"
          :source="getPdfUrl(selected_file.id)"
        />
      </div>
    </v-dialog>
</template>

<script>
import VuePdfEmbed from "vue-pdf-embed";

export default {
  name: "NotenCarousel",
  components: {VuePdfEmbed},
  props: {
    melodie: Array
  },
  data: () => ({
    selected_file: null,
    noten_dialog: false,
    pdf_carousel_model: 0
  }),
  computed: {
    filtered_audio_files() {
      console.log(this.melodie?.files)
      return this.melodie?.files.filter(file => file.type.includes('audio'))
    },
  },
  methods: {
    is_audio(file) {
      return file.type.includes('audio')
    },
    getPdfUrl(file_id) {
      return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}.pdf`;
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
