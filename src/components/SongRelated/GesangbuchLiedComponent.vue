<template>
  <v-card class="pa-3">
    <v-card-title
      class="d-flex justify-space-between pb-0 align-center flex-column flex-md-row"
    >
      <v-tooltip
        :text="
          copied
            ? 'In die zwischenablage kopiert'
            : 'Kopiere den Pfad in die Zwischenablage.'
        "
        location="bottom"
      >
        <template v-slot:activator="{ props }">
          <div
            @click="copyPathInClipboard"
            class="card-header"
            v-bind="props"
            :style="copied ? 'color: #1867c0' : 'color: black'"
          >
            <!--  Clipboard icon        -->
            <v-icon class="me-2"> mdi-content-copy </v-icon>

            {{ selected_song?.titel }}
          </div>
        </template>
      </v-tooltip>

      <div>
        <v-tooltip
          :text="`Mehr Text Informationen.${selected_song?.text.auftrag ? ' Es existiert ein Arbeitsauftrag' : ''}`"
          location="bottom"
          v-if="selected_song?.text"
        >
          <template v-slot:activator="{ props }">
            <v-btn
              icon="mdi-text-box"
              v-bind="props"
              variant="text"
              @click="text_dialog = true"
              :color="
                selected_song.text.auftrag
                  ? text_has_done_auftraege
                    ? 'success'
                    : 'warning'
                  : 'primary'
              "
            />
          </template>
        </v-tooltip>
        <v-tooltip
          :text="`Mehr Melodie Informationen.${selected_song?.melodie.auftrag ? ' Es existiert ein Arbeitsauftrag' : ''}`"
          location="bottom"
          v-if="selected_song?.melodie"
        >
          <template v-slot:activator="{ props }">
            <v-btn
              icon="mdi-music"
              v-bind="props"
              variant="text"
              @click="melodie_dialog = true"
              :color="
                selected_song.melodie.auftrag
                  ? melodie_has_done_auftraege
                    ? 'success'
                    : 'warning'
                  : 'primary'
              "
            />
          </template>
        </v-tooltip>
        <SingModeDialog
          :selected_song="selected_song"
          :selected_media_file="visible_file"
        />
      </div>
    </v-card-title>
    <v-card-title> </v-card-title>

    <v-card-text class="pt-0 px-8">
      <NotenCarousel
        :melodie="selected_song?.melodie"
        :gesangbuchlied_satz_mit_melodie_und_text="
          selected_song?.gesangbuchlied_satz_mit_melodie_und_text
        "
        @visible_file="visible_file = $event"
      />

      <div class="mb-4">
        <StrophenList
          :text="selected_song?.text"
          :show_extra_strophen_data="false"
        />
      </div>

      <v-chip-group>
        <v-chip
          :prepend-icon="
            gesangbuch_kategorie_name_to_icon(category?.kategorie_name?.name)
          "
          v-for="(category, index) in selected_song?.kategories"
          :key="index"
          :style="{ 'background-color': get_color(category) }"
        >
          {{ category?.kategorie_name?.name }}
        </v-chip>
      </v-chip-group>

      <div
        v-for="(author_source, index_1) in [
          { name: 'Text', src: selected_song?.text?.authors },
          { name: 'Melodie', src: selected_song?.melodie?.authors },
        ]"
        :key="index_1"
      >
        <div v-if="author_source?.src?.length">
          <div class="text-subtitle-1 font-weight-medium">
            {{ author_source.name }} Autor
          </div>
          <div
            class="d-flex flex-row mb-4"
            v-for="(author, index) in author_source.src"
            :key="index"
          >
            <div class="me-2">{{ index + 1 }}.</div>
            <div>
              {{ author.vorname }} {{ author.nachname }}
              {{
                author.geburtsjahr || author.sterbejahr
                  ? ` (${author.geburtsjahr ? "*" + author.geburtsjahr : ""}${author.sterbejahr ? " - " + author.sterbejahr : ""})`
                  : ""
              }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="selected_song?.einreicherName" class="mb-4">
        <span class="text-subtitle-1 font-weight-medium">
          Eingereicht von:
        </span>
        <span> {{ selected_song?.einreicherName }} </span>
      </div>

      <div
        v-if="
          selected_song?.anmerkung ||
          selected_song?.text?.anmerkung ||
          selected_song?.melodie?.anmerkung
        "
        class="mb-4"
      >
        <div class="text-subtitle-1 font-weight-medium">Anmerkung:</div>
        <div class="white-space-pre">{{ selected_song?.anmerkung }}</div>
        <div class="d-flex mt-2" v-if="selected_song?.text?.anmerkung">
          <v-icon class="me-2"> mdi-text-box </v-icon>
          <div class="white-space-pre">
            {{ selected_song?.text.anmerkung }}
          </div>
        </div>
        <div class="d-flex mt-2" v-if="selected_song?.melodie?.anmerkung">
          <!--  note icon         -->
          <v-icon class="me-2"> mdi-music </v-icon>
          <div>
            {{ selected_song?.melodie.anmerkung }}
          </div>
        </div>
      </div>

      <div v-if="is_kleiner_kreis && is_kleiner_kreis_ansicht">
        <div class="text-subtitle-1 font-weight-medium">
          Bewertung Kleiner Kreis:
        </div>
        <div>
          <div
            v-if="selected_song?.bewertung_kleiner_kreis?.bezeichner"
            class="d-flex"
            :style="{
              color:
                rang_to_color[
                  selected_song?.bewertung_kleiner_kreis?.rangfolge
                ],
            }"
          >
            <v-icon icon="mdi-music" class="me-2" />
            <span class="me-2">Lied</span>
            <v-icon icon="mdi-arrow-right" class="me-2" />
            {{ selected_song?.bewertung_kleiner_kreis?.bezeichner }}
          </div>
          <div class="ms-10 d-flex" v-if="selected_song?.bewertungAnmerkung">
            <v-icon icon="mdi-arrow-right-bottom" class="me-2" />
            <div class="pt-1">
              {{ selected_song?.bewertungAnmerkung }}
            </div>
          </div>
        </div>
        <div>
          <div
            v-if="selected_song?.text?.bewertung_kleiner_kreis?.bezeichner"
            :style="{
              color:
                rang_to_color[
                  selected_song?.text?.bewertung_kleiner_kreis?.rangfolge
                ],
            }"
          >
            <v-icon icon="mdi-text-box" class="me-2" />
            <span class="me-2">Text</span>
            <v-icon icon="mdi-arrow-right" class="me-2" />
            {{ selected_song?.text?.bewertung_kleiner_kreis?.bezeichner }}
          </div>
          <div
            class="ms-10 d-flex"
            v-if="selected_song?.text?.bewertungAnmerkung"
          >
            <v-icon icon="mdi-arrow-right-bottom" class="me-2" />
            <div class="pt-1">
              {{ selected_song?.text?.bewertungAnmerkung }}
            </div>
          </div>
        </div>
        <div>
          <div
            v-if="selected_song?.melodie?.bewertung_kleiner_kreis?.bezeichner"
            :style="{
              color:
                rang_to_color[
                  selected_song?.melodie?.bewertung_kleiner_kreis?.rangfolge
                ],
            }"
          >
            <v-icon icon="mdi-music-note" class="me-2" />
            <span class="me-2">Melodie</span>
            <v-icon icon="mdi-arrow-right" class="me-2" />
            {{ selected_song?.melodie?.bewertung_kleiner_kreis?.bezeichner }}
          </div>
          <div
            class="ms-10 d-flex"
            v-if="selected_song?.melodie?.bewertungAnmerkung"
          >
            <v-icon icon="mdi-arrow-right-bottom" class="me-2" />
            <div class="pt-1">
              {{ selected_song?.melodie?.bewertungAnmerkung }}
            </div>
          </div>
        </div>
      </div>

      <div>
        <span
          class="text-subtitle-1 font-weight-medium"
          v-if="selected_song?.liednummer2000"
        >
          Gesangbuchlied 2000:
        </span>
        <span> {{ selected_song?.liednummer2000 }} </span>
        <span
          v-if="selected_song?.melodieGeaendert || selected_song?.textGeaendert"
        >
          mit
        </span>
        <v-icon
          icon="mdi-music-box"
          v-if="selected_song?.melodieGeaendert"
          color="primary"
        />
        <span
          v-if="selected_song?.melodieGeaendert && selected_song?.textGeaendert"
        >
          und
        </span>
        <v-icon
          icon="mdi-text-box-edit"
          v-if="selected_song?.textGeaendert"
          color="primary"
        />
        <span
          v-if="selected_song?.melodieGeaendert || selected_song?.textGeaendert"
        >
          geändert.
        </span>
      </div>
    </v-card-text>
    <v-card-actions>
      <v-btn color="error" @click="$emit('close')">Schließen</v-btn>
    </v-card-actions>
  </v-card>

  <v-dialog v-model="text_dialog" width="700">
    <TextDialog :text="selected_song.text" @close="text_dialog = false" />
  </v-dialog>
  <v-dialog
    v-model="melodie_dialog"
    @close="melodie_dialog = false"
    width="700"
  >
    <MelodieDialog
      :melodie="selected_song.melodie"
      @close="melodie_dialog = false"
    />
  </v-dialog>
</template>

<script>
import TextDialog from "@/components/SongRelated/TextDialog.vue";
import MelodieDialog from "@/components/SongRelated/MelodieDialog.vue";
import {
  gesangbuch_kategorie_name_to_icon,
  chart_colors,
  rang_to_color,
} from "@/assets/js/utils";
import StrophenList from "@/components/SongRelated/StrophenList.vue";
import NotenCarousel from "@/components/SongRelated/NotenCarousel.vue";
import { useUserStore } from "@/store/user";

import _ from "lodash";
import SingModeDialog from "@/components/SongRelated/SingModeDialog.vue";

export default {
  name: "GesangbuchLiedComponent",
  components: {
    SingModeDialog,
    NotenCarousel,
    StrophenList,
    MelodieDialog,
    TextDialog,
  },
  props: {
    selected_song: Object,
  },
  emits: ["close"],
  data: () => ({
    user: useUserStore(),
    text_dialog: false,
    melodie_dialog: false,
    copied: false,
    visible_file: null,
  }),
  computed: {
    rang_to_color() {
      return rang_to_color;
    },
    is_kleiner_kreis() {
      return this.user.is_kleiner_kreis;
    },
    is_kleiner_kreis_ansicht() {
      return this.user.is_kleiner_kreis_ansicht;
    },
    text_has_done_auftraege() {
      return this.has_only_done_auftraege(this.selected_song.text.auftrag);
    },
    melodie_has_done_auftraege() {
      return this.has_only_done_auftraege(this.selected_song.melodie.auftrag);
    },
  },

  methods: {
    gesangbuch_kategorie_name_to_icon,
    get_color(category) {
      return chart_colors[category.id % chart_colors.length];
    },
    copyPathInClipboard() {
      navigator.clipboard.writeText(window.location.href);
      this.copied = true;
    },
    has_only_done_auftraege(auftrag) {
      return _.every(auftrag, (auftrag) => auftrag.status === "done");
    },
  },
};
</script>

<style lang="scss">
.card-header {
  cursor: pointer;

  &:hover {
    transition: all 0.2s ease-in-out;
    transform: scale(1.05);
  }
}
</style>
