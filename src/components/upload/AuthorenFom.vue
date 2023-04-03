<template>
  <v-expansion-panels>
    <v-expansion-panel :title="label">
      <v-expansion-panel-text>
        <v-row>
          <v-col cols="12" class="text-grey text-subtitle-1 pt-0 pb-2">
            Vorhandenen Autor suchen
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-autocomplete
              label="Suche nach existierende Autoren"
              :items="store_authors"
              item-text="author_str"
              item-value="id"
              return-object
              v-model="selected_author"
            ></v-autocomplete>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" class="text-grey text-subtitle-1">

          </v-col>
          Neuen Autor hinzufügen
          <div >
          </div>
        </v-row>
        <template
          v-for="(author, index) in author_model"
          :key="`author-${index}`"
        >
          <v-row>
            <v-col
              cols="12"
              class="text-h6 d-flex justify-space-between align-center"
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
            <v-col cols="6">
              <v-text-field
                label="Vorname des Autors"
                v-model="author.firstName"
              ></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field
                label="Nachname des Autors"
                v-model="author.lastName"
              ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="6">
              <VuetifyDatepicker
                v-model:date="author.birthdate"
                label="Geburtsdatum"
              ></VuetifyDatepicker>
            </v-col>
            <v-col cols="6">
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
        >
          Einen weiteren Author
        </v-btn>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script>
import VuetifyDatepicker from "@/components/upload/VuetifyDatepicker.vue";
import {useAppStore} from "@/store/app";

export default {
  name: "AuthorenFom",
  components: { VuetifyDatepicker },
  data: () => ({
    store: useAppStore(),
    selected_author: null
  }),
  props: {
    authors: Array,
    label: String,
  },
  computed: {
    author_model: {
      get() {
        return this.authors;
      },
      set(value) {
        console.log("Authos emit.");
        this.$emit("update:authors", value);
      },
    },
    store_authors() {
      return this.store.authors
    },
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
