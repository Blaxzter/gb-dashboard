<template>
  <v-card class="mb-5" :elevation="$vuetify.display.xs ? 0 : 1">
    <v-card-title class="text-grey text-subtitle-1" :class="{'px-0': $vuetify.display.xs}">
      Text Daten
    </v-card-title>
    <v-card-text class="pb-0" :class="{'px-0': $vuetify.display.xs}">
      <v-row class="my-0">
        <v-col cols="12" class="d-flex align-center py-0 flex-column flex-sm-row">
              <span class="mr-4 mb-3 mb-sm-0">
                Nach Text in Datenbank suchen oder neuen Anlegen:
              </span>
          <v-switch
            v-model="existing_text"
            class="ps-5"
            color="primary"
            density="compact"
            hide-details
            :label="
                  existing_text
                    ? 'Bestehenden Text verwenden'
                    : 'Neuen Text anlegen'
                "
          ></v-switch>
        </v-col>
      </v-row>
      <v-row class="my-0">
        <v-col cols="12" class="my-0">
          <v-autocomplete
            :disabled="!existing_text"
            label="Suche nach existierenden Texten"
            :items="sorted_store_text"
            :custom-filter="custom_filter"
            item-title="titel"
            item-value="id"
            hide-details="auto"
            class="py-0"
            return-object
            v-model="selected_text"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item
                v-bind="props"
                :title="item?.raw?.titel +  (item?.raw?.strophenEinzeln ? ' - #' + item?.raw?.strophenEinzeln?.length + ' Strophen' : '')"
                :subtitle="item?.raw?.author_name"
              >
                <span style="font-size: 0.85rem">{{ item?.raw?.strophe_short }}</span>
              </v-list-item>
            </template>

          </v-autocomplete>
        </v-col>
      </v-row>

      <v-expansion-panels class="mt-0 mb-5" :disabled="existing_text" >
        <v-expansion-panel
          title="Neuer Text des Gesangbuchlieds"
          ref="text_expansion_panel"
          :value="existing_text"
        >
          <v-expansion-panel-text >
            <TextData
              :song_title="song_title"
              :in_anmerkung="text.anmerkung"
              :in_quelle="text.quelle"
              :in_quellelink="text.quelllink"
              :in_title="text.title"
              @update:anmerkung="text.anmerkung = $event"
              @update:quelle="text.quelle = $event"
              @update:quellelink="text.quelllink = $event"
              @update:title="text.title = $event"
            />

            <TextStrophen :strophen="text.strophen" class="mb-3"/>
            <AuthorenFom
              :label="'Text Autoren'"
              @update:selected_author="text.selected_authors = $event"
              :selected_author="text.selected_authors"
              v-model:authors="text.authors"
              class="mb-3"
            />
            <!--                <LizensComponent-->
            <!--                  :label="'Text Lizensen'"-->
            <!--                  :lizenz="text.lizenz"-->
            <!--                  :use_lizenz="text.use_lizenz"-->
            <!--                />-->
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script>
import AuthorenFom from "@/components/upload/NewSongComponents/AuthorenFom.vue";
import TextStrophen from "@/components/upload/NewSongComponents/TextStrophen.vue";
import TextData from "@/components/upload/NewSongComponents/TextData.vue";
import {useAppStore} from "@/store/app";
import _ from "lodash";

export default {
  name: "NewTextData",
  components: {TextData, TextStrophen, AuthorenFom},
  data: () => ({
    store: useAppStore(),
    text: {},
    existing_text: false,
    selected_text: null,
  }),
  props: {
    song_title: String,
    in_text: Object,
  },
  mounted() {
    this.text = this.in_text;
    console.log(this.in_text)
    this.$emit("update:text", this.text)
  },
  watch: {
    text: {
      handler() {
        console.log("Test: ",this.text)
        this.$emit("update:text", this.text)
      },
      deep: true
    },
    existing_text() {
      this.$emit("update:existing_text", this.existing_text)
    },
    selected_text() {
      this.$emit("update:selected_text", this.selected_text)
    }
  },
  computed: {
    store_text() {
      return this.store.texts;
    },
    sorted_store_text() {
      return _.sortBy(this.store_text, 'titel');
    },
  },
  methods: {
    custom_filter(item, queryText, itemText) {
      return itemText.value.autocomplete.includes(queryText)
    },
  }
}
</script>

<style scoped>

</style>
