<script>
import { useAppStore } from "@/store/app";
import _ from "lodash";

export default {
  name: "MissingMatching",
  data: () => ({
    store: useAppStore(),
    toggle: 0,
  }),
  computed: {
    selectedElements() {
      return {
        0: this.missingTexts,
        1: this.missingMelodies,
        2: this.missingFiles,
        3: this.missingAuthors,
      }[this.toggle];
    },
    href_base() {
      return {
        0: "https://gb26-admin.***REMOVED***/admin/content/text/",
        1: "https://gb26-admin.***REMOVED***/admin/content/melodie/",
        2: "https://gb26-admin.***REMOVED***/admin/files/",
        3: "https://gb26-admin.***REMOVED***/admin/content/autor/",
      }[this.toggle];
    },
    missingTexts() {
      const used_texts = _.flatMap(this.store.gesangbuchlieder, (lied) => [
        lied.textId,
      ]);
      return _.filter(
        this.store.texts,
        (text) => used_texts.indexOf(text.id) === -1,
      );
    },
    missingMelodies() {
      const used_melodies = _.flatMap(this.store.gesangbuchlieder, (lied) => [
        lied.melodie?.id,
      ]);
      return _.filter(
        this.store.melodies,
        (melody) => used_melodies.indexOf(melody.id) === -1,
      );
    },
    missingFiles() {
      const used_files = _.uniq(
        _.flatMap(this.store.gesangbuchlieder, (lied) =>
          _.map(lied.melodie?.files, (file) => file.id),
        ),
      );
      return _.filter(
        this.store.files,
        (file) => used_files.indexOf(file.id) === -1,
      );
    },
    missingAuthors() {
      const text_author_ids = _.flatMap(this.store.gesangbuchlieder, (lied) =>
        _.map(lied.text?.authors, (author) => author.id),
      );
      const melody_author_ids = _.flatMap(this.store.gesangbuchlieder, (lied) =>
        _.map(lied.melodie?.authors, (author) => author.id),
      );

      return _.filter(
        this.store.authors,
        (author) =>
          text_author_ids.indexOf(author.id) === -1 &&
          melody_author_ids.indexOf(author.id) === -1,
      );
    },
  },
};
</script>

<template>
  <div class="text-h4 mb-6">Fehlende Zuordnungen</div>
  <div class="mb-2 d-flex align-center">
    <v-btn-toggle v-model="toggle" mandatory variant="tonal">
      <v-btn @click="toggle = 0" color="primary">
        <v-icon class="me-2">mdi-text-box</v-icon>
        Texte
      </v-btn>
      <v-btn @click="toggle = 1" color="primary">
        <v-icon class="me-2">mdi-music-note</v-icon>
        Melodien
      </v-btn>
      <v-btn @click="toggle = 2" color="primary">
        <v-icon class="me-2">mdi-file-document</v-icon>
        Dateien
      </v-btn>
      <v-btn @click="toggle = 3" color="primary">
        <v-icon class="me-2">mdi-account</v-icon>
        Autor
      </v-btn>
    </v-btn-toggle>
  </div>
  <div class="text-body-1">
    Gefundene Einträge: {{ selectedElements.length }}
  </div>
  <v-list dense>
    <v-list-item
      prepend-icon="mdi-square-medium"
      v-for="(entry, i) in selectedElements"
      :key="i"
      :title="
        entry.titel ??
        entry.author_str ??
        entry.filename_download ??
        ` ---- Kein Titel ---- `
      "
      variant="tonal"
      class="mb-1 py-0"
      lines="one"
      :href="`${href_base}${entry.id}`"
      target="_blank"
    >
    </v-list-item>
  </v-list>
</template>

<style scoped></style>
