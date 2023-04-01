<template>
  <v-expansion-panels>
    <v-expansion-panel :title="label">
      <v-expansion-panel-text>
        <template
          v-for="(author, index) in author_model"
          :key="`author-${index}`"
        >
          <v-row>
            <v-col
              cols="12"
              class="text-h6 d-flex justify-space-between align-center"
            >
              <span class="text-grey-darken-1 text-subtitle-1"
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

export default {
  name: "AuthorenFom",
  components: { VuetifyDatepicker },
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
