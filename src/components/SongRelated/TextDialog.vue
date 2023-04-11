<template>
  <v-card class="pa-3">
    <v-card-title>
      <v-card-title class="d-flex justify-space-between">
        <div>
          {{ text.titel }}
        </div>
        <div>
          {{ status_mapping[text.status] }}
        </div>
      </v-card-title>
    </v-card-title>
    <v-card-text class="px-8">
      <div v-if="text?.strophenEinzeln?.length" class="mb-2">
        <div class="text-h6 mb-2">Strophen</div>
        <div
          style="max-width: 500px"
          class="d-flex flex-row mb-1 mx-auto bg-grey-lighten-4 pa-2 rounded"
          v-for="(strophe, index) in text?.strophenEinzeln"
          :key="index"
        >
          <div class="me-2">{{ index + 1 }}.</div>
          <div>
            <div>
              {{ strophe.strophe }}
            </div>
            <div class="font-weight-thin" v-if="strophe.aenderungsvorschlag">
              Änderungsvorschlag: {{ strophe.aenderungsvorschlag }}
            </div>
          </div>

        </div>
      </div>

      <div v-if="text?.anmerkung" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium">Anmerkung:</div>
        <div>
          {{ text?.anmerkung }}
        </div>
      </div>

      <div v-if="text?.rueckfrageAutor" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium">Rückfrage Author:</div>
        <div>
          {{ text?.rueckfrageAutor }}
        </div>
      </div>

      <div v-if="text?.quelle" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium">Quelle:</div>
        <div>
          {{ text?.quelle }}
        </div>
      </div>

      <div v-if="text?.quelllink" class="mb-2">
        <div class="text-subtitle-1 font-weight-medium">Quelle Link:</div>
        <div class="d-flex flex-row align-center">
          <v-icon
            icon="mdi-open-in-new"
            size="tiny"
            class="me-2"
            color="blue-darken-3"
          />
          <a :href="text?.quelllink" target="_blank">
            {{ text?.quelllink }}
          </a>
        </div>
      </div>

      <div class="text-subtitle-1 font-weight-medium">Authoren</div>
      <div
        class="d-flex flex-row mb-4"
        v-for="(author, index) in text?.authors"
        :key="index"
      >
        <div class="me-2">{{ index + 1 }}.</div>
        <div>
          {{ author.vorname }} {{ author.nachname }}
          {{
            author.geburtsjahr || author.sterbejahr
              ? ` (${author.geburtsjahr ? author.geburtsjahr : ""} - ${
                  author.sterbejahr ? author.sterbejahr : "?"
                })`
              : ""
          }}
        </div>
      </div>
    </v-card-text>
    <v-card-actions>
      <v-btn color="error" @click="$emit('close')">Schließen</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import { status_mapping } from "../../assets/js/utils";

export default {
  name: "TextDialog",
  computed: {
    status_mapping() {
      return status_mapping;
    },
  },
  components: {},
  props: {
    text: Object,
  },
};
</script>

<style scoped></style>
