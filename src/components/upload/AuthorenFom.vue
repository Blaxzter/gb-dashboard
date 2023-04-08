<template>
  <v-expansion-panels>
    <v-expansion-panel :title="label">
      <v-expansion-panel-text>
        <v-row>
          <v-col cols="12" class="text-grey text-subtitle-1 pt-3 pb-1">
            Vorhandenen Autor suchen
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-autocomplete
              label="Suche nach existierende Autoren"
              :items="sorted_store_authors"
              item-title="author_str"
              item-value="id"
              hide-details="auto"
              class="mb-0"
              return-object
              chips
              closable-chips
              multiple
              v-model="selected_author_model"
            ></v-autocomplete>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" class="text-grey text-subtitle-1 py-0 pt-3">
            Neuen Autor hinzufügen
          </v-col>
        </v-row>
        <template
          v-for="(author, index) in author_model"
          :key="`author-${index}`"
        >
          <v-row>
            <v-col
              cols="12"
              class="text-h6 d-flex justify-space-between align-center pt-3 pb-0"
            >
              <span class="text-grey-darken-1 text-subtitle-2"
                >Autor {{ index + 1 }}
              </span>
              <v-btn
                color="error"
                @click="removeAuthor(index)"
                icon="mdi-minus"
                v-if="author_model.length > 1"
                size="small"
                density="compact"
              />
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                label="Vorname des Autors"
                v-model="author.firstName"
                hide-details="auto"
                class="mb-0"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                label="Nachname des Autors"
                v-model="author.lastName"
                hide-details="auto"
                class="mb-0"
              ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <VuetifyDatepicker
                v-model:date="author.birthdate"
                label="Geburtsdatum"
              ></VuetifyDatepicker>
            </v-col>
            <v-col cols="12" md="6">
              <VuetifyDatepicker
                v-model:date="author.deathdate"
                label="Sterbedatum"
              ></VuetifyDatepicker>
            </v-col>
          </v-row>

          <v-divider
            class="mt-2 mb-4"
            v-if="author_model.length > 1 && index + 1 < author_model.length"
          />
        </template>

        <v-btn
          color="primary"
          @click="addAuthor"
          prepend-icon="mdi-plus"
          variant="tonal"
          class="mt-4"
        >
          Einen weiteren Author
        </v-btn>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script>
import VuetifyDatepicker from "@/components/upload/VuetifyDatepicker.vue";
import { useAppStore } from "@/store/app";

import _ from "lodash"

export default {
  name: "AuthorenFom",
  components: { VuetifyDatepicker },
  data: () => ({
    store: useAppStore(),
    selected_author_model: []
  }),
  props: {
    selected_author: Array,
    authors: Array,
    label: String,
  },
  computed: {
    author_model: {
      get() {
        return this.authors;
      },
      set(value) {
        this.$emit("update:authors", value);
      },
    },
    store_authors() {
      return this.store.authors;
    },
    sorted_store_authors() {
      return _.sortBy(this.store_authors, 'vorname')
    }
  },

  watch: {
    selected_author_model() {
      this.$emit("update:selected_author", this.selected_author_model)
    }
  },

  methods: {
    addAuthor() {
      this.author_model.push({
        firstName: "",
        lastName: "",
        birthdate: null,
        deathdate: null,
      });
    },
    removeAuthor(author_index) {
      this.author_model.splice(author_index, 1);
    },
  },
};
</script>

<style scoped></style>
