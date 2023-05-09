<template>
  <v-card
    class="mb-4"
    :class="`${arbeitskreis_name_to_css(auftrag.arbeitskreis_name)}-bg`"
  >
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
      <v-card
        v-if="auftrag.text"
        @click="text_dialog = true"
        :class="`${arbeitskreis_name_to_css(
          auftrag.arbeitskreis_name
        )}-bg-dark ${auftrag.melodie || auftrag.anmerkung ? 'mb-3' : ''}`"
        class="hover_card"
      >
        <template v-slot:title>
          <div class="d-flex align-center mb-1 text-body-1">
            <v-icon icon="mdi-pencil" size="tiny" class="me-2" />
            <div>Zugeordneter Text:</div>
            <div class="flex-grow-1"></div>
            <v-icon icon="mdi-cursor-pointer" size="tiny" />
          </div>
        </template>
        <template v-slot:subtitle>
          {{ auftrag_type_to_name[auftrag.auftragsartText] }}
        </template>
        <template v-slot:text>
          <div class="text-subtitle-1">
            <strong>{{ auftrag.text.titel }}</strong>
          </div>
        </template>
      </v-card>

      <v-card
        v-if="auftrag.melodie"
        :class="`${arbeitskreis_name_to_css(auftrag.arbeitskreis_name)}-bg-dark ${auftrag.anmerkung? 'mb-3' : ''}`"
        class="mb-3"
        @click="melodie_dialog = true"
      >
        <template v-slot:title>
          <div class="d-flex align-center mb-1 text-body-1">
            <v-icon icon="mdi-music-note" size="tiny" class="me-2" />
            <div>Zugeordnete Melodie:</div>
            <div class="flex-grow-1"></div>
            <v-icon icon="mdi-cursor-pointer" size="tiny" />
          </div>
        </template>
        <template v-slot:subtitle>
          {{ auftrag_type_to_name[auftrag.auftragsartMelodie] }}
        </template>
        <template v-slot:text>
          <div class="text-subtitle-1">
            <strong>
              {{ auftrag.melodie.titel }}
            </strong>
          </div>
        </template>
      </v-card>

      <v-card
        v-if="auftrag.anmerkung"
        :class="`${arbeitskreis_name_to_css(
          auftrag.arbeitskreis_name
        )}-bg-dark`"
      >
        <template v-slot:title>
          <div
            class="d-flex align-center mb-1 text-body-1"
            @click="text_dialog = true"
          >
            <v-icon icon="mdi-message-bulleted" size="tiny" class="me-2" />
            <div>Anmerkung:</div>
          </div>
        </template>
        <template v-slot:text>
          <div>
            {{ auftrag.anmerkung }}
          </div>
        </template>
      </v-card>
    </template>
  </v-card>

  <v-dialog v-model="text_dialog" width="700">
    <TextDialog :text="auftrag.text" @close="text_dialog = false" />
  </v-dialog>
  <v-dialog v-model="melodie_dialog" width="700">
    <MelodieDialog :melodie="auftrag.melodie" @close="melodie_dialog = false" />
  </v-dialog>
</template>

<script>
import { useAppStore } from "@/store/app";
import { work_group_icon, auftrag_type_to_name } from "@/assets/js/utils";
import moment from "moment/moment";
import TextDialog from "@/components/SongRelated/TextDialog.vue";
import MelodieDialog from "@/components/SongRelated/MelodieDialog.vue";

export default {
  name: "AuftragCard",
  components: { TextDialog, MelodieDialog },
  data: () => ({
    store: useAppStore(),
    text_dialog: false,
    melodie_dialog: false,
  }),
  props: {
    auftrag: Object,
  },
  computed: {
    work_group_icon() {
      return work_group_icon;
    },
    auftrag_type_to_name() {
      return auftrag_type_to_name;
    },
  },
  methods: {
    arbeitskreis_name_to_css(name) {
      return name.replace("ß", "ss").replace(" ", "-").toLowerCase();
    },
    arbeitskreis_name(id) {
      return this.store.arbeitskreis_by_id(id);
    },
    format_date(date) {
      if (date) return moment(date).format("DD.MM.YYYY");
      return "Kein Datum";
    },
  },
};
</script>

<style>
.hover_card:hover {
}
</style>
