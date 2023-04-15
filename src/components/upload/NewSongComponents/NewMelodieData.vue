<template>
  <v-card class="mb-5" :elevation="$vuetify.display.xs ? 0 : 1">
    <v-card-title class="text-grey text-subtitle-1" :class="{'px-0': $vuetify.display.xs}">
      Melodie Daten
    </v-card-title>
    <v-card-text :class="{'px-0': $vuetify.display.xs}">
      <v-row class="my-0">
        <v-col cols="12" class="d-flex align-center py-0 flex-column flex-sm-row">
              <span class="mr-4 mb-3 mb-sm-0">
                Nach Melodie in Datenbank suchen oder neuen Anlegen:
              </span>
          <v-switch
            v-model="existing_melodie"
            class="ps-5"
            color="primary"
            density="compact"
            hide-details
            :label="
                  existing_melodie
                    ? 'Bestehenden Melodie verwenden'
                    : 'Neue Melodie anlegen'
                "
          ></v-switch>
        </v-col>
      </v-row>

      <v-row class="my-0">
        <v-col cols="12" class="my-0">
          <v-autocomplete
            :disabled="!existing_melodie"
            label="Suche nach existierenden Melodien"
            :items="sorted_store_melodie"
            :custom-filter="custom_filter"
            item-title="titel"
            item-value="id"
            hide-details="auto"
            class="py-0"
            return-object
            v-model="selected_melodie"
          >

            <template v-slot:item="{ props, item }">
              <v-list-item
                v-bind="props"
                :title="item?.raw?.titel"
                :subtitle="item?.raw?.author_name"
              ></v-list-item>
            </template>
          </v-autocomplete>
        </v-col>
      </v-row>

      <v-expansion-panels class="mb-5" :disabled="existing_melodie">
        <v-expansion-panel
          title="Neue Melodie des Gesangbuchlieds"
          :value="existing_melodie"
        >
          <v-expansion-panel-text>
            <MelodieData
              :song_title="song_title"
              :in_noten="melodie.noten"
              :in_quellelink="melodie.quelllink"
              :in_title="melodie.title"
              :in_quelle="melodie.quelle"
              :in_anmerkung="melodie.anmerkung"
              @update:noten="update_file"
              @update:quellelink="melodie.quelllink = $event"
              @update:title="melodie.title = $event"
              @update:quelle="melodie.quelle = $event"
              @update:anmerkung="melodie.anmerkung = $event"
            />

            <AuthorenFom
              :label="'Melodie Autoren'"
              @update:selected_author="melodie.selected_authors = $event"
              :selected_author="melodie.selected_authors"
              v-model:authors="melodie.authors"
              class="mb-3"
            />
            <!--                <LizensComponent-->
            <!--                  :label="'Melodie Lizensen'"-->
            <!--                  :lizenz="melodie.lizenz"-->
            <!--                  :use_lizenz="melodie.use_lizenz"-->
            <!--                />-->
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script>
import MelodieData from "@/components/upload/NewSongComponents/MelodieData.vue";
import AuthorenFom from "@/components/upload/NewSongComponents/AuthorenFom.vue";
import _ from "lodash";
import {useAppStore} from "@/store/app";

export default {
  name: "NewMelodieData",
  components: {AuthorenFom, MelodieData},
  data: () => ({
    store: useAppStore(),
    existing_melodie: false,
    selected_melodie: null,
    melodie: {}
  }),
  props: {
    song_title: String,
    in_melodie: Object
  },
  mounted() {
    this.melodie = this.in_melodie;
    this.$emit("update:melodie", this.melodie)
  },
  watch: {
    melodie: {
      handler() {
        this.$emit("update:melodie", this.melodie)
      },
      deep: true
    },
    existing_melodie() {
      this.$emit("update:existing_melodie", this.existing_melodie)
    },
    selected_melodie() {
      this.$emit("update:selected_melodie", this.selected_melodie)
    }
  },
  computed: {
    store_melodie() {
      return this.store.melodies;
    },
    sorted_store_melodie() {
      return _.sortBy(this.store_melodie, 'titel');
    },
  },
  methods: {
    custom_filter(item, queryText, itemText) {
      return itemText.value.autocomplete.includes(queryText)
    },
    update_file(event) {
      this.melodie.noten = event
    },
  }
}
</script>

<style scoped>

</style>
