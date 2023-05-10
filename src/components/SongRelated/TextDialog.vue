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

      <StrophenList :text="text" :show_extra_strophen_data="true" />

      <div>
        <v-card :text-dialog="true" v-for="(auftrag, index) in text.auftrag" :key="index"/>
      </div>

      <div class="text-subtitle-1 font-weight-medium" v-if="text?.auftrag?.length">
        Aufträge:
      </div>
      <div v-if="text?.auftrag?.length">
        <div v-for="(auftrag, index) in text?.auftrag" :key="index" class="mb-3">
          <v-card :subtitle="`Auftrag ${index + 1}`">
            <v-card-text>
              <div class="text-subtitle-1 font-weight-medium">Auftragsart:</div>
              <div>
                {{ auftrag_type_to_name[auftrag.auftragsartText] }}
              </div>
              <div class="text-subtitle-1 font-weight-medium">Anmerkung:</div>
              <div>
                {{ auftrag.anmerkung }}
              </div>
            </v-card-text>
          </v-card>
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

      <div class="text-subtitle-1 font-weight-medium" v-if="text?.authors?.length">Text Authoren</div>
      <div
        class="d-flex flex-row mb-4"
        v-for="(author, index) in text?.authors"
        :key="index"
      >
        <div class="me-2">{{ index + 1 }}.</div>
        <div>
          {{ author.vorname }} {{ author.nachname }}
          {{
            (author.geburtsjahr || author.sterbejahr ? ` (${author.geburtsjahr ? '*' + author.geburtsjahr : ''} ${author.sterbejahr ? ' - ' + author.sterbejahr : ''})` : '')
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
import {auftrag_type_to_name, status_mapping} from "../../assets/js/utils";
import StrophenList from "@/components/SongRelated/StrophenList.vue";

export default {
  name: "TextDialog",
  components: {StrophenList},
  computed: {
    auftrag_type_to_name() {
      return auftrag_type_to_name
    },
    status_mapping() {
      return status_mapping;
    },
  },
  props: {
    text: Object,
  },
};
</script>

<style scoped></style>
