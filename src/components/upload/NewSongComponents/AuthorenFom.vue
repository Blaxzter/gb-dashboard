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
              v-model="selected_author_model"
              label="Suche nach existierenden Autoren"
              :items="sorted_store_authors"
              item-title="author_str"
              item-value="id"
              hide-details="auto"
              class="mb-0"
              return-object
              chips
              closable-chips
              multiple
            ></v-autocomplete>
          </v-col>
        </v-row>

        <v-row v-if="melodie_authors && uploadPage">
          <v-col
            cols="12"
            class="text-grey text-subtitle-1 pt-3 pb-1 d-flex align-center"
          >
            <div class="mx-4">
              <v-switch
                v-model="use_same_author_for_text"
                color="primary"
                hide-details="auto"
                class="mb-0"
              ></v-switch>
            </div>
            <div>Gleichen Autor wie bei Text verwenden</div>
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
              <div class="d-flex">
                <v-tooltip
                  v-if="author.exists"
                  text="Autor existiert bereits"
                  location="bottom"
                >
                  <template #activator="{ props }">
                    <v-icon
                      icon="mdi-alert"
                      v-bind="props"
                      class="px-5"
                      color="warning"
                      size="tiny"
                    />
                  </template>
                </v-tooltip>
                <span class="text-grey-darken-1 text-subtitle-2">
                  Autor {{ index + 1 }}
                </span>
              </div>
              <v-btn
                v-if="author_model.length > 1"
                color="error"
                icon="mdi-minus"
                size="small"
                density="compact"
                @click="removeAuthor(index)"
              />
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="author.firstName"
                label="Vorname des Autors"
                hide-details="auto"
                class="mb-0"
                @update:model-value="check_author(index)"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="author.lastName"
                label="Nachname des Autors"
                hide-details="auto"
                class="mb-0"
                @update:model-value="check_author(index)"
              ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="author.birthdate"
                label="Geburtsjahr"
                type="number"
                hide-details="auto"
                class="mb-0"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="author.deathdate"
                label="Sterbejahr"
                type="number"
                hide-details="auto"
                class="mb-0"
              ></v-text-field>
            </v-col>
          </v-row>

          <v-divider
            v-if="author_model.length > 1 && index + 1 < author_model.length"
            class="mt-2 mb-4"
          />
        </template>

        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          variant="tonal"
          class="mt-4"
          @click="addAuthor"
        >
          Einen weiteren Author
        </v-btn>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script>
// import VuetifyDatepicker from "@/components/upload/NewSongComponents/VuetifyDatepicker.vue";
import { useAppStore } from "@/store/app";

import _ from "lodash";

export default {
  name: "AuthorenFom",
  // components: { VuetifyDatepicker },
  props: {
    selectedAuthor: {
      type: Array,
      required: false,
      default: () => [],
    },
    authors: {
      type: Array,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    uploadPage: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: [
    "update:authors",
    "update:selected_author",
    "update:use_same_author_for_text",
  ],
  data: () => ({
    store: useAppStore(),
    selected_author_model: [],
    use_same_author_for_text: false,
  }),
  computed: {
    author_model: {
      get() {
        return this.authors;
      },
      set(value) {
        this.$emit("update:authors", value);
      },
    },
    melodie_authors() {
      return this.label.includes("Melodie");
    },
    store_authors() {
      return this.store.authors;
    },
    sorted_store_authors() {
      return _.sortBy(this.store_authors, "vorname");
    },
  },

  watch: {
    selected_author_model() {
      this.$emit("update:selected_author", this.selected_author_model);
    },
    use_same_author_for_text() {
      this.$emit(
        "update:use_same_author_for_text",
        this.use_same_author_for_text,
      );
    },
  },
  mounted() {
    this.selected_author_model = this.selectedAuthor;
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
    check_author(index) {
      const author = this.author_model[index];
      const author_obj = this.store_authors.find(
        (a) => a.vorname === author.firstName && a.nachname === author.lastName,
      );
      this.author_model[index].exists = !!author_obj;
    },
    removeAuthor(author_index) {
      this.author_model.splice(author_index, 1);
    },
  },
};
</script>

<style scoped></style>
