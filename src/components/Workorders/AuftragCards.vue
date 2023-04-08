<template>
  <v-row>
    <v-col v-for="i in 3" :key="i" cols="12" sm="4">
      <v-row no-gutters class="flex-column">
        <v-col v-for="(auftrag, index) in chunked_auftraege[i - 1]" :key="index">
          <v-card class="mb-4" :class="`${arbeitskreis_name_to_css(auftrag.arbeitskreis_name)}-bg`">
            <template v-slot:title>
              <div class="d-flex align-center">
                <v-icon
                  :icon="work_group_icon[auftrag.arbeitskreis_name]"
                  size="tiny"
                  class="me-2"
                  :class="`${arbeitskreis_name_to_css(auftrag.arbeitskreis_name)}`"
                />
                {{ auftrag.arbeitskreis_name }}
              </div>
            </template>
            <template v-slot:subtitle>
              {{ format_date(auftrag.abgabetermin) }}
            </template>
            <template v-slot:text>
              <div v-if="auftrag.text.titel" class="rounded border pa-1 mb-1">
                <div class="d-flex align-center mb-1 text-subtitle-1">
                  <v-icon icon="mdi-pencil" size="tiny" class="me-2"/>
                  <div>
                    Zugeordneter Text:
                  </div>
                </div>
                <div>
                  {{ auftrag.text.titel }}
                </div>
              </div>

              <div v-if="auftrag.melodie.titel" class="rounded border pa-1 mb-1">
                <div class="d-flex align-center mb-1 text-subtitle-1">
                  <v-icon icon="mdi-music-note" size="tiny" class="me-2"/>
                  <div>
                    Zugeordnete Melodie:
                  </div>
                </div>
                <div>
                  {{ auftrag.melodie.titel }}
                </div>
              </div>

              <div v-if="auftrag.anmerkung" class="rounded border pa-1">
                <div class="d-flex align-center mb-1 text-subtitle-1">
                  <v-icon icon="mdi-message-bulleted" size="tiny" class="me-2"/>
                  <div>
                    Anmerkung:
                  </div>
                </div>
                <div>
                  {{ auftrag.anmerkung }}
                </div>
              </div>
            </template>
          </v-card>
        </v-col>
      </v-row>
    </v-col>
  </v-row>
</template>

<script>
import moment from "moment";
import _ from "lodash";

import { useAppStore } from "@/store/app";
import { work_group_icon } from "@/assets/js/utils";

export default {
  name: "AuftragCards",
  data: () => ({
    store: useAppStore(),
  }),
  props: {
    auftraege: Array,
  },
  computed: {
    chunked_auftraege() {
      return _.chunk(this.auftraege, Math.ceil(this.auftraege.length / 3));
    },
    work_group_icon() {
      return work_group_icon;
    }
  },
  methods: {
    arbeitskreis_name_to_css(name) {
      return name.replace('ß', 'ss').replace(' ', '-').toLowerCase()
    },
    arbeitskreis_name(id) {
      return this.store.arbeitskreis_by_id(id);
    },
    format_date(date) {
      if (date)
        return moment(date).format("DD.MM.YYYY");
      return 'Kein Datum'
    },
  }
};
</script>

<style scoped></style>
