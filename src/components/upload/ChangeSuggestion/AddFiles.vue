<template>
  <div v-if="melodie" class="text-h5 my-5">Lade neue Dateien hoch</div>
  <div v-if="!melodie">
    <v-alert
      class="mb-5"
      border="top"
      border-color="primary"
      elevation="2"
      icon="$warning"
      title="Hinweis"
      text="Das ausgewählte Gesangbuchlied hat keine Melodie zugeordnet. Eine Aktualisierung der Noten ist deshalb nicht möglich."
    >
      <div class="d-flex justify-end">
        <v-btn
          :color="!show_new_melodie ? 'success' : 'error'"
          :prepend-icon="!show_new_text ? 'mdi-plus' : 'mdi-minus'"
          class="mt-5"
          variant="tonal"
          @click="show_new_melodie = !show_new_melodie"
        >
          {{
            !show_new_melodie
              ? "Neuen Melodie hinzufügen"
              : "Doch kein Lied Hinzufügen."
          }}
        </v-btn>
      </div>
    </v-alert>
    <v-expand-transition v-show="show_new_melodie">
      <NewMelodieData
        ref="new_melodie_data"
        :in_melodie="new_melodie"
        :song_title="selectedSong?.titel"
        :upload_page="false"
        @update:melodie="new_melodie = $event"
        @update:existing_melodie="existing_melodie = $event"
        @update:selected_melodie="selected_melodie = $event"
      />
    </v-expand-transition>
  </div>
  <div v-else>
    <v-chip-group>
      <v-chip
        v-for="(file, index) in melodie?.files"
        :key="index"
        prepend-icon="mdi-file-music"
      >
        {{ file.filename_download }}
      </v-chip>
    </v-chip-group>
    <v-file-input
      v-model="noten"
      show-size
      label="Noten Datein"
      multiple
      counter
      chips
      @change="$emit('update:noten', noten)"
    >
    </v-file-input>
  </div>
</template>

<script>
import NewMelodieData from "@/components/upload/NewSongComponents/NewMelodieData.vue";

export default {
  name: "AddFiles",
  components: { NewMelodieData },
  props: {
    melodie: {
      type: Object,
      required: false,
      default: null,
    },
    selectedSong: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:noten"],
  data: () => ({
    show_new_melodie: false,
    noten: [],
    new_melodie: {
      title: "",
      quelle: "",
      quelllink: "",
      anmerkung: "",
      noten: null,
      lizenz: {
        name: "",
        digital: false,
        print: false,
      },
      use_lizenz: true,
      selected_authors: [],
      authors: [
        {
          firstName: "",
          lastName: "",
          birthdate: null,
          deathdate: null,
        },
      ],
    },
    existing_melodie: null,
    selected_melodie: null,
  }),
  methods: {
    validate() {
      this.$refs.new_melodie_data.validate();
    },
    upload() {
      return this.$refs.new_melodie_data.upload();
    },
  },
};
</script>

<style scoped></style>
