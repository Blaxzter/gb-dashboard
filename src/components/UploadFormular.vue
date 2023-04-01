<template>
  <div class="text-h5">Gesangbuchlied Hochladen</div>
  <v-form v-model="valid">
    <v-container>
      <v-row>
        <v-col cols="12">
          <v-text-field
            v-model="title"
            label="Titel des Gesangbuchlied"
            required
          ></v-text-field>
        </v-col>
      </v-row>

      <v-expansion-panels>
        <v-expansion-panel title="Text des Gesangbuchlieds">
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" class="pb-0">
                <v-text-field
                  v-model="text.title"
                  label="Text Titel"
                  hide-details="auto"
                  class="mb-3"
                  required
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="6" class="py-0">
                <v-text-field
                  v-model="text.quelle"
                  label="Quelle"
                  hide-details="auto"
                  class="mb-3"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6" class="py-0">
                <v-text-field
                  v-model="text.quellelink"
                  label="Quelle Link"
                  hide-details="auto"
                  class="mb-3"
                  required
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" class="pt-0">
                <v-textarea
                  v-model="text.anmerkung"
                  label="Text Anmerkung"
                  hide-details="auto"
                  class="mb-3"
                  required
                ></v-textarea>
              </v-col>
            </v-row>

            <v-expansion-panels class="mb-3">
              <v-expansion-panel title="Strophen">
                <v-expansion-panel-text class="pt-3">
                  <v-row v-for="(strophe, index) in text.strophen" :key="index">
                    <v-col cols="12" class="py-0">
                      <v-text-field
                        v-model="strophe.text"
                        :label="'Strophe ' + index"
                        :append-icon="
                          text.strophen.length > 1 ? 'mdi-minus' : null
                        "
                        variant="filled"
                        clear-icon="mdi-close-circle"
                        clearable
                        type="text"
                        hide-details="auto"
                        class="mb-3"
                        @click:append="text.strophen.splice(index, 1)"
                        @click:clear="strophe.text = ''"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col>
                      <v-btn
                        color="primary"
                        @click="addStrophe"
                        prepend-icon="mdi-plus"
                        variant="tonal"
                      >
                        Einene weitere Strophe
                      </v-btn>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <v-expansion-panels>
              <v-expansion-panel title="Autoren">
                <v-expansion-panel-text>
                  <div class="d-flex justify-space-between mb-4">
                    <span class="text-h6"> Autoren: </span>
                    <v-btn
                      color="primary"
                      @click="addAuthor"
                      prepend-icon="mdi-plus"
                      variant="tonal"
                    >
                      Einen weiteren Author
                    </v-btn>
                  </div>
                  <template
                    v-for="(author, index) in text.authors"
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
                          v-if="text.authors.length > 1"
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
                      v-if="
                        text.authors.length > 1 &&
                        index + 1 < text.authors.length
                      "
                    />
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-container>
  </v-form>
</template>

<script>
import VuetifyDatepicker from "@/components/upload/VuetifyDatepicker.vue";

export default {
  components: {
    VuetifyDatepicker,
  },
  data: () => ({
    valid: false,
    title: "",
    text: {
      title: "",
      strophen: [{ text: "" }],
      quelle: "",
      quelllink: "",
      anmerkung: "",
      lizens: {},
      authors: [
        {
          firstName: "",
          lastName: "",
          birthdate: null,
          deathdate: null,
        },
      ],
    },
  }),
  methods: {
    addAuthor() {
      this.text.authors.push({
        firstName: "",
        lastName: "",
        birthdate: null,
        deathdate: null,
      });
    },
    removeAuthor(author_index) {
      this.text.authors.splice(author_index, 1);
    },
    addStrophe(index) {
      console.log("Test");
      this.text.strophen.push({ text: "" });
    },
  },
};
</script>
