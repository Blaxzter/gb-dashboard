<template>
  <v-carousel
    v-if="carousel_files.length"
    ref="carousel"
    v-model="pdf_carousel_model"
    :show-arrows="carousel_files?.length <= 1 ? false : 'hover'"
    hide-delimiter-background
    :hide-delimiters="carousel_files?.length <= 1"
    height="300"
  >
    <v-carousel-item
      v-for="(file, i) in carousel_files"
      :key="i"
      :src="file.type.includes('image') ? getImgUrl(file.id) : null"
    >
      <MediaComponent
        v-if="file"
        :file="file"
        @fullscreen_pdf="fullscreen_pdf"
      />
    </v-carousel-item>
  </v-carousel>
  <div
    v-if="carousel_files.length && !print"
    class="d-flex flex-row text-subtitle-2 align-center"
    style="max-width: 600px"
  >
    <div class="me-3">Dateiname:</div>
    <div>
      {{ carousel_files[pdf_carousel_model]?.filename_download }}
    </div>

    <div class="flex-grow-1" />

    <!-- Download button -->
    <v-btn
      icon
      class="ml-3"
      variant="text"
      size="tiny"
      @click="download_file(carousel_files[pdf_carousel_model])"
    >
      <v-icon>mdi-download</v-icon>
    </v-btn>
    <!-- Open in new tab      -->
    <v-btn
      icon
      class="ml-3"
      :href="getImgUrl(carousel_files[pdf_carousel_model]?.id)"
      target="_blank"
      :download="carousel_files[pdf_carousel_model]?.filename_download"
      variant="text"
      size="tiny"
    >
      <v-icon>mdi-open-in-new</v-icon>
    </v-btn>
  </div>

  <v-dialog v-model="noten_dialog">
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
      />
    </div>
  </v-dialog>
</template>

<script>
import VuePdfEmbed from "vue-pdf-embed";
import _ from "lodash";
import MediaComponent from "@/components/SongRelated/MediaComponent.vue";

export default {
  name: "NotenCarousel",
  components: { MediaComponent, VuePdfEmbed },
  props: {
    melodie: {
      type: Object,
      required: true,
    },
    gesangbuchliedSatzMitMelodieUndText: {
      type: Array,
      required: true,
    },
    print: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["visible_file"],
  data: () => ({
    selected_file: null,
    noten_dialog: false,
    pdf_carousel_model: 0,
  }),
  computed: {
    carousel_files() {
      let uniqBy = _.uniqBy(
        _.concat(
          _.map(this.gesangbuchliedSatzMitMelodieUndText, (obj) => {
            return {
              ...obj,
              from_melodie: false,
            };
          }),
          _.map(this.melodie?.files, (obj) => {
            return {
              ...obj,
              from_melodie: true,
            };
          }),
        ),
        "id",
      );
      console.log(uniqBy);
      return uniqBy;
    },
    filtered_audio_files() {
      return this.melodie?.files.filter(
        (file) =>
          file.type.includes("audio") ||
          file.type.includes("application/octet-stream"),
      );
    },
  },
  watch: {
    pdf_carousel_model() {
      console.log(
        this.pdf_carousel_model,
        this.carousel_files[this.pdf_carousel_model],
      );
      this.$emit("visible_file", this.carousel_files[this.pdf_carousel_model]);
    },
  },
  mounted() {
    this.colorDelimiters();
    this.$emit("visible_file", this.carousel_files[this.pdf_carousel_model]);
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
    download_file(file) {
      console.log(file);
      const file_url = this.getImgUrl(file?.id);
      // create local file blob with name filename_download
      fetch(file_url)
        .then((res) => {
          return res.blob();
        })
        .then((blob) => {
          const href = window.URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.download = file?.filename_download;
          a.href = href;
          // open download link in new tab
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        })
        .catch((err) => console.error(err));
    },
    colorDelimiters() {
      // Wait for the next tick to ensure the DOM has been updated
      this.$nextTick(() => {
        const delimiters = this.$refs.carousel.$el.querySelectorAll(
          ".v-carousel__controls .v-btn",
        );

        delimiters.forEach((delimiter, index) => {
          // Apply color based on the index (position) of the delimiter
          if (this.carousel_files[index]["from_melodie"]) {
            delimiter.style.color = "#4CAF50"; // First delimiter
            // also style the ::before of the nested i child in span v-btn__content
            delimiter
              .querySelector("i")
              .classList.add("melodie-delimiter-color");
          } else {
            delimiter.style.color = "#9595ff"; // Middle delimiters
            delimiter.querySelector("i").classList.add("song-delimiter-color");
          }
        });
      });
    },
  },
};
</script>

<style>
.melodie-delimiter-color::before {
  color: #4caf50 !important;
}
.song-delimiter-color::before {
  color: #9595ff !important;
}
</style>
