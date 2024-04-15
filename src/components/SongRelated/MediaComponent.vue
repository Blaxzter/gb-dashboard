<script>
import VuePdfEmbed from "vue-pdf-embed";
import VuePdfApp from "vue3-pdf-app";
// import this to use default icons for buttons
import "vue3-pdf-app/dist/icons/main.css";

export default {
  name: "MediaComponent",
  data: () => ({
    maxWidth: 100,
    config: {
      secondaryToolbar: {
        cursorSelectTool: false,
        secondaryPresentationMode: false,
      },
      toolbar: {
        toolbarViewerRight: {
          openFile: false,
        },
      },
    },
  }),
  props: {
    file: Object,
    singModeScreen: {
      type: Boolean,
      default: false,
    },
  },
  watch: {
    file() {
      console.log("file changed");
    },
  },
  components: { VuePdfEmbed, VuePdfApp },
  emits: ["fullscreen_pdf"],
  methods: {
    changeToHandTool(pdfApp) {
      pdfApp.pdfCursorTools.switchTool(1);
    },
    is_audio(file) {
      // include audio and add opus
      return (
        file.type.includes("audio") ||
        file.type.includes("application/octet-stream")
      );
    },
    is_opus(file) {
      return file.type.includes("application/octet-stream");
    },
    is_video(file) {
      return file.type.includes("video");
    },
    is_image(file) {
      return file.type.includes("image");
    },
    getPdfUrl(file_id) {
      return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}.pdf`;
    },
    getImgUrl(file_id) {
      return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}`;
    },
    fullscreen_pdf(event, file) {
      this.$emit("fullscreen_pdf", event, file);
    },
  },
};
</script>

<template>
  <div
    style="position: absolute; z-index: 20"
    v-if="singModeScreen && file.type !== 'application/pdf'"
    class="pl-5 pt-2"
  >
    <v-btn
      icon="mdi-magnify-minus-outline"
      @click="maxWidth = maxWidth - 5 < 20 ? maxWidth : maxWidth - 5"
      variant="text"
      :disabled="maxWidth === 20"
      color="primary"
    />
    <v-btn
      icon="mdi-magnify-plus-outline"
      @click="maxWidth = maxWidth + 5 > 100 ? maxWidth : maxWidth + 5"
      variant="text"
      :disabled="maxWidth === 100"
      color="primary"
    />
  </div>
  <div v-if="file.type === 'application/pdf'" class="h-100">
    <div v-if="singModeScreen" class="h-100">
      <vue-pdf-app
        :config="config"
        @pages-rendered="changeToHandTool"
        :pdf="getPdfUrl(file.id)"
        theme="light"
        ref="pdfApp"
      ></vue-pdf-app>
    </div>
    <div
      v-else
      class="d-flex align-center justify-center fill-height"
      :class="{ 'bg-grey': !singModeScreen }"
    >
      <vue-pdf-embed
        :height="300"
        :source="getPdfUrl(file.id)"
        @click="fullscreen_pdf($event, file)"
        :page="1"
        style="cursor: pointer"
      />
    </div>
  </div>
  <div
    class="d-flex flex-column align-center justify-center h-100"
    v-else-if="is_audio(file)"
  >
    <div>
      <div class="text-h6 mb-3">
        {{ file.title }}
      </div>
      <div class="d-flex align-center justify-center">
        <v-icon class="me-4" size="40">mdi-music-note-eighth</v-icon>
        <audio controls>
          <source
            :src="getImgUrl(file.id)"
            type="audio/ogg; codecs=opus"
            v-if="is_opus(file)"
          />
          <source :src="getImgUrl(file.id)" :type="file.type" v-else />
        </audio>
      </div>
    </div>
  </div>
  <div
    class="d-flex flex-column align-center justify-center h-100"
    v-else-if="is_video(file)"
  >
    <div>
      <div class="text-h6 mb-3">
        {{ file.title }}
      </div>
      <div class="d-flex align-center justify-center">
        <div :style="{ maxWidth: `${maxWidth}%` }">
          <video controls>
            <source :src="getImgUrl(file.id)" :type="file.type" />
          </video>
        </div>
      </div>
    </div>
  </div>
  <div
    class="d-flex flex-column align-center pt-5 h-100"
    v-else-if="is_image(file) && singModeScreen"
  >
    <div :class="{ 'pa-10': singModeScreen }">
      <div class="text-h6 mb-3">
        {{ file.title }}
      </div>
      <div class="d-flex align-center justify-center">
        <div :style="{ maxWidth: `${maxWidth}%` }">
          <img
            :src="getImgUrl(file.id)"
            alt="Bild"
            style="max-height: 100%; max-width: 100%"
          />
        </div>
      </div>
    </div>
  </div>
  <div
    class="d-flex flex-column align-center justify-center h-100"
    v-else-if="!is_image(file)"
  >
    <div class="d-flex align-center">
      <div class="me-4">
        <v-icon size="40">mdi-file</v-icon>
      </div>
      <div>
        <div class="text-h6">
          {{ file.title }}
        </div>
        <div class="d-flex align-center">
          <div class="me-3">
            Dieses Dateiformat wird aktuell <br />
            noch nicht unterstützt.
          </div>
          <v-icon size="40">mdi-emoticon-sad-outline</v-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
