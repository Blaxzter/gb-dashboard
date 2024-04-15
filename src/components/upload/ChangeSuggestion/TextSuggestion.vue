<template>
  <div class="text-h5 ps-0 my-5" v-if="text">
    Änderungsvorschlag oder Anmerkungen
  </div>
  <div v-if="!text" class="mb-5">
    <v-alert
      class="mb-5"
      border="top"
      border-color="primary"
      elevation="2"
      icon="$warning"
      title="Hinweis"
      text="Das ausgewählte Gesangbuchlied hat keinen Text zugeordnet. Eine Aktualisierung der Noten ist deshalb nicht möglich."
    >
      <div class="d-flex justify-end">
        <v-btn
          :color="!show_new_text ? 'success' : 'error'"
          :prepend-icon="!show_new_text ? 'mdi-plus' : 'mdi-minus'"
          class="mt-5"
          @click="show_new_text = !show_new_text"
          variant="tonal"
        >
          {{
            !show_new_text
              ? "Neuen Text hinzufügen"
              : "Doch kein Text hinzufügen."
          }}
        </v-btn>
      </div>
    </v-alert>

    <v-expand-transition v-show="show_new_text">
      <NewTextData
        ref="new_text_data"
        :in_text="new_text"
        @update:text="new_text = $event"
        @update:existing_text="existing_text = $event"
        @update:selected_text="selected_text = $event"
        :song_title="selected_song?.titel"
        :upload_page="false"
      />
    </v-expand-transition>
  </div>
  <div v-else>
    <div
      v-for="(strophe, index) in text?.strophenEinzeln"
      :key="index"
      class="d-flex flex-column mb-2"
    >
      <div
        class="d-flex justify-space-between align-center"
        :class="{ 'mb-3': strophe?.new_strophe }"
      >
        <div class="text-h6 mb-1">
          {{ strophe?.new_strophe ? "Neue" : "" }} Strophe {{ index + 1 }}
        </div>
        <div>
          <v-icon
            v-if="strophe?.new_strophe"
            icon="mdi-delete"
            class="px-5"
            color="error"
            @click="$emit('remove_strophe', index)"
          />
        </div>
      </div>

      <div class="text-subtitle-1 mb-3" v-if="!strophe?.new_strophe">
        {{ strophe.strophe }}
      </div>
      <v-textarea
        v-else
        v-model="strophe.strophe"
        :label="'Text für Strophe ' + (index + 1)"
        variant="filled"
        rows="4"
        type="text"
        clearable
        hide-details="auto"
        class="mb-3"
        @click:clear="strophe.strophe = ''"
      ></v-textarea>

      <v-textarea
        v-model="strophe.aenderungsvorschlag"
        :label="'Änderungsvorschlag für Strophe ' + (index + 1)"
        variant="filled"
        rows="2"
        type="text"
        clearable
        hide-details="auto"
        class="mb-3"
        @click:clear="strophe.aenderungsvorschlag = ''"
      ></v-textarea>
      <v-textarea
        v-model="strophe.anmerkung"
        :label="'Anmerkung für Strophe ' + (index + 1)"
        variant="filled"
        rows="2"
        type="text"
        hide-details="auto"
        clearable
        class="mb-3"
        @click:clear="strophe.anmerkung = ''"
      ></v-textarea>
    </div>

    <v-btn
      class="mt-5"
      color="success"
      prepend-icon="mdi-plus"
      @click="$emit('add_strophe', text)"
    >
      Neue Strophe hinzufügen
    </v-btn>
  </div>
</template>

<script>
import NewTextData from "@/components/upload/NewSongComponents/NewTextData.vue";

export default {
  name: "TextSuggestion",
  components: { NewTextData },
  props: {
    text: Object,
    selected_song: Object,
  },
  mounted() {
    // add bool value with key new_strophe to each strophe
    if (this.text) {
      this.text.strophenEinzeln?.forEach((strophe) => {
        // check if new_strophe exists
        if (strophe.new_strophe === undefined) {
          strophe.new_strophe = false;
        }
      });
    }
  },
  emits: ["remove_strophe", "add_strophe"],
  data: () => ({
    show_new_text: false,
    new_text: {
      title: "",
      strophen: [{ strophe: "" }],
      quelle: "",
      quelllink: "",
      anmerkung: "",
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
    existing_text: null,
    selected_text: null,
  }),
  methods: {
    validate() {
      this.$refs.new_text_data.validate();
    },
    upload() {
      return this.$refs.new_text_data.upload();
    },
  },
};
</script>

<style scoped></style>
