<template>
  <v-card class="pa-3">
    <v-card-title>
      <v-card-title class="d-flex justify-space-between pb-0 align-center flex-column flex-md-row">
        <div>
          {{ selected_song?.titel }}
        </div>
        <div>
          <v-tooltip :text="`Mehr Text Informationen.${selected_song?.text.auftrag ? ' Es existiert ein Arbeitsauftrag' : ''}`" location="bottom" v-if="selected_song?.text">
            <template v-slot:activator="{ props }">
              <v-btn icon="mdi-text-box" v-bind="props" variant="text" @click="text_dialog = true" :color="selected_song.text.auftrag ? 'warning' : 'primary'"/>
            </template>
          </v-tooltip>
          <v-tooltip :text="`Mehr Melodie Informationen.${selected_song?.melodie.auftrag ? ' Es existiert ein Arbeitsauftrag' : ''}`" location="bottom" v-if="selected_song?.melodie">
            <template v-slot:activator="{ props }">
              <v-btn icon="mdi-music" v-bind="props" variant="text" @click="melodie_dialog = true" :color="selected_song.melodie.auftrag ? 'warning' : 'primary'"/>
            </template>
          </v-tooltip>
        </div>
      </v-card-title>
    </v-card-title>

    <v-card-text class="pt-0 px-8">

      <NotenCarousel :melodie="selected_song?.melodie" />

      <StrophenList :text="selected_song?.text" :show_extra_strophen_data="false" />

      <v-chip-group>
        <v-chip :prepend-icon="gesangbuch_kategorie_name_to_icon(category?.kategorie_name?.name)" v-for="(category, index) in selected_song?.kategories" :key="index" :style="{'background-color': get_color(category)}">
          {{ category?.kategorie_name?.name }}
        </v-chip>
      </v-chip-group>

      <div v-for="(author_source, index_1) in [{name: 'Text', src: selected_song?.text?.authors}, {name: 'Melodie', src: selected_song?.melodie?.authors}]" :key="index_1">
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
              {{ author.vorname }} {{ author.nachname }} {{
                author.geburtsjahr || author.sterbejahr ? ` (${author.geburtsjahr ? '*' + author.geburtsjahr : ''}${author.sterbejahr ? ' - ' + author.sterbejahr : '' })` : ''
              }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="selected_song?.einreicherName" class="mb-4">
        <span class="text-subtitle-1 font-weight-medium"> Eingereicht von: </span>
        <span> {{ selected_song?.einreicherName }} </span>
      </div>

      <div v-if="selected_song?.anmerkung" class="mb-4">
        <div class="text-subtitle-1 font-weight-medium"> Anmerkung: </div>
        <span> {{ selected_song?.anmerkung }} </span>
      </div>

      <div>
        <span class="text-subtitle-1 font-weight-medium" v-if="selected_song?.liednummer2000"> Gesangbuchlied 2000: </span>
        <span> {{ selected_song?.liednummer2000 }} </span>
        <span v-if="selected_song?.melodieGeaendert || selected_song?.textGeaendert"> mit </span>
        <v-icon icon="mdi-music-box" v-if="selected_song?.melodieGeaendert" color="primary" />
        <span v-if="selected_song?.melodieGeaendert && selected_song?.textGeaendert"> und </span>
        <v-icon icon="mdi-text-box-edit" v-if="selected_song?.textGeaendert" color="primary" />
        <span v-if="selected_song?.melodieGeaendert || selected_song?.textGeaendert"> geändert. </span>
      </div>

    </v-card-text>
    <v-card-actions>
      <v-btn color="error" @click="$emit('close')">Schließen</v-btn>
    </v-card-actions>
  </v-card>

  <v-dialog v-model="text_dialog" width="700">
    <TextDialog :text="selected_song.text" @close="text_dialog = false" />
  </v-dialog>
  <v-dialog v-model="melodie_dialog" @close="melodie_dialog = false" width="700">
    <MelodieDialog :melodie="selected_song.melodie" @close="melodie_dialog = false" />
  </v-dialog>
</template>

<script>
import TextDialog from "@/components/SongRelated/TextDialog.vue";
import MelodieDialog from "@/components/SongRelated/MelodieDialog.vue";
import {gesangbuch_kategorie_name_to_icon, chart_colors} from "@/assets/js/utils";
import StrophenList from "@/components/SongRelated/StrophenList.vue";
import NotenCarousel from "@/components/SongRelated/NotenCarousel.vue";

export default {
  name: "GesangbuchLiedComponent",
  components: {NotenCarousel, StrophenList, MelodieDialog, TextDialog},
  props: {
    selected_song: Object,
  },
  data: () => ({
    text_dialog: false,
    melodie_dialog: false,
  }),
  mounted() {
    console.log(this.selected_song)
  },
  methods: {
    gesangbuch_kategorie_name_to_icon,
    get_color(category) {
      return chart_colors[category.id % chart_colors.length]
    }
  }
}
</script>

<style scoped>

</style>
