<template>
  <div>
    <div class="d-flex align-center mb-3">
      <v-tooltip text="Den Gesangbuchlied-Titel kopieren" location="bottom">
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-content-copy" size="tiny" variant="plain" class="me-5" v-bind="props" color="primary" @click="copy_song_title"/>
        </template>
      </v-tooltip>

      <v-text-field
        v-model="title"
        @change="$emit('update:title', $event.target.value)"
        label="Text Titel"
        hide-details="auto"
      ></v-text-field>
      <div v-if="title_already_exists">
        <v-tooltip text="Titel existiert bereits" location="bottom">
          <template v-slot:activator="{ props }">
            <v-icon icon="mdi-alert" v-bind="props" class="px-5" color="warning"/>
          </template>
        </v-tooltip>
      </div>
    </div>
    <div class="d-flex flex-column flex-md-row">
      <v-text-field
        :model-value="quelle"
        @change="$emit('update:quelle', $event.target.value)"
        label="Quelle"
        hide-details="auto"
        class="mb-3 me-md-5"
      ></v-text-field>
      <v-text-field
        :model-value="quellelink"
        @change="$emit('update:quellelink', $event.target.value)"
        label="Quelle Link"
        hide-details="auto"
        class="mb-3"
      ></v-text-field>
    </div>
    <v-textarea
      :model-value="anmerkung"
      @change="$emit('update:anmerkung', $event.target.value)"
      label="Text Anmerkung"
      hide-details="auto"
      class="mb-3"
      rows="2"
    ></v-textarea>
  </div>
</template>

<script>
import _ from "lodash";
import {useAppStore} from "@/store/app";

export default {
  name: "TextData",
  props: {
    song_title: String,
    in_title: String,
    in_quelle: String,
    in_quellelink: String,
    in_anmerkung: String,
  },
  data: () => ({
    store: useAppStore(),
    title: "",
    quelle: "",
    quellelink: "",
    anmerkung: ""
  }),
  mounted() {
    this.title = this.in_title
    this.quelle = this.in_quelle
    this.quellelink = this.in_quellelink
    this.anmerkung = this.in_anmerkung
  },
  computed: {
    store_text() {
      return this.store.texts;
    },
    existing_text_title() {
      return _.map(this.store_text, 'titel')
    },
    title_already_exists() {
      console.log(this.title)
      return this.existing_text_title.includes(this.title)
    },
  },
  methods: {
    copy_song_title(){
      this.$emit('update:title', this.song_title);
      this.title = this.song_title;
    }
  }
};
</script>

<style scoped></style>
