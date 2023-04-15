<template>
  <div>
    <v-row>
      <v-col cols="12" class="pb-0">
        <div class="d-flex align-center">
          <div class="h-100">
            <v-tooltip text="Kopiere den Gesangbuchs Titel" location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn icon="mdi-content-copy" size="tiny" variant="plain" class="me-5" v-bind="props" color="primary"
                       @click="copy_song_title"/>
              </template>
            </v-tooltip>
          </div>
          <v-text-field
            v-model="title"
            @change="$emit('update:title', $event.target.value)"
            label="Melodie Titel"
            hide-details="auto"
            class="mb-3"
          ></v-text-field>
          <div v-if="title_already_exists">
            <v-tooltip text="Titel existiert bereits" location="bottom">
              <template v-slot:activator="{ props }">
                <v-icon icon="mdi-alert" v-bind="props" class="px-5" color="warning"/>
              </template>
            </v-tooltip>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" class="pb-0">
        <v-file-input
          v-model="noten"
          show-size
          label="Noten Datein"
          multiple
          counter
          chips
          @change="$emit('update:noten', noten)"
        >
        </v-file-input>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6" class="py-0">
        <v-text-field
          v-model="quelle"
          @change="$emit('update:quelle', $event.target.value)"
          label="Quelle"
          hide-details="auto"
          class="mb-3"
        ></v-text-field>
      </v-col>
      <v-col cols="12" md="6" class="py-0">
        <v-text-field
          v-model="quellelink"
          @change="$emit('update:quellelink', $event.target.value)"
          label="Melodie Quelle Link"
          hide-details="auto"
          class="mb-3"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" class="pt-0">
        <v-textarea
          v-model="anmerkung"
          @change="$emit('update:anmerkung', $event.target.value)"
          label="Melodie Anmerkung"
          hide-details="auto"
          class="mb-3"
        ></v-textarea>
      </v-col>
    </v-row>
  </div>
</template>

<script>
import _ from "lodash";
import {useAppStore} from "@/store/app";

export default {
  name: "MelodieData",
  props: {
    song_title: String
  },
  data: () => ({
    store: useAppStore(),
    noten: [],
    title: "",
    quelle: "",
    quellelink: "",
    anmerkung: "",
  }),
  computed: {
    store_melodies() {
      return this.store.melodies;
    },
    existing_melodies_title() {
      return _.map(this.store_melodies, 'titel')
    },
    title_already_exists() {
      return this.existing_melodies_title.includes(this.title)
    },
  },
  methods: {
    copy_song_title() {
      this.$emit('update:title', this.song_title);
      this.title = this.song_title;
    }
  }
};
</script>

<style scoped></style>
