<template>
  <div class="text-h4 mb-5">Änderung Hochladen</div>

  <div class="text-body-1">
    Wähle ein Gesangbuchlied aus, bei welchem du Textvorschläge oder neue
    Melodie Dateien hochladen möchtest.
  </div>

  <v-form ref="form">
    <v-container>
      <div class="d-flex mb-5 justify-center align-center">
        <v-autocomplete
          v-model="selected_song"
          :disabled="selected_song !== null"
          label="Suche nach existierenden Gesangbuchliedern"
          :items="store_gesangbuchlieder"
          :custom-filter="custom_filter"
          item-title="titel"
          item-value="id"
          hide-details="auto"
          class="py-0"
          return-object
          @change="song_selected"
        >
          <template #item="{ props, item }">
            <v-list-item
              v-bind="props"
              :title="
                item?.raw?.titel +
                (item?.raw?.text?.strophenEinzeln
                  ? ' - #' +
                    item?.raw?.text?.strophenEinzeln?.length +
                    ' Strophen'
                  : '')
              "
              :subtitle="item?.raw?.author_name"
            >
              <span style="font-size: 0.8rem">{{
                item?.raw?.text?.strophe_short
              }}</span>
            </v-list-item>
          </template>
        </v-autocomplete>

        <v-tooltip
          text="Neues Lies auswählen."
          location="bottom"
          :disabled="!selected_song"
        >
          <template #activator="{ props }">
            <v-btn
              icon="mdi-repeat"
              variant="tonal"
              size="small"
              v-bind="props"
              color="primary"
              class="ms-5"
              :disabled="!selected_song"
              @click="reset_form"
            />
          </template>
        </v-tooltip>
      </div>

      <v-expand-transition>
        <div v-if="selected_song !== null">
          <div v-if="selected_song.status === 'accepted'">
            <v-alert
              class="mb-5"
              border="top"
              border-color="success"
              elevation="2"
              icon="$success"
              title="Hinweis"
            >
              Das ausgewählte Gesangbuchlied wurde bereits akzeptiert. <br />
              Eine Aktualisierung der Noten oder des Textes ist deshalb nicht
              mehr möglich.
            </v-alert>
          </div>
          <div v-else>
            <AddFiles
              ref="add_files"
              :melodie="selected_song?.melodie"
              :selected-song="selected_song"
              @update:noten="noten = $event"
            />

            <TextSuggestion
              ref="text_suggestion"
              :text="selected_song?.text"
              :selected-song="selected_song"
              @add_strophe="add_strophe"
              @remove_strophe="remove_strophe($event)"
            />

            <SongMetaData ref="song_data" :selected-song="selected_song" />

            <v-btn
              prepend-icon="mdi-send"
              block
              class="mt-5 py-5"
              color="primary"
              elevated
              size="x-large"
              @click="send_data"
            >
              Änderung Hochladen
            </v-btn>
          </div>
        </div>
      </v-expand-transition>
    </v-container>
  </v-form>

  <div v-if="melodie_files.length" class="text-h6">
    Es wurden {{ melodie_files.length }} Datein Hochgeladen.
  </div>
</template>

<script>
import { useAppStore } from "@/store/app";
import axios from "@/assets/js/axiossConfig";
import _ from "lodash";
import TextSuggestion from "@/components/upload/ChangeSuggestion/TextSuggestion.vue";
import AddFiles from "@/components/upload/ChangeSuggestion/AddFiles.vue";
import { useUserStore } from "@/store/user";
import SongMetaData from "@/components/upload/ChangeSuggestion/SongMetaData.vue";

export default {
  name: "ChangeSuggestionUpload",
  components: { SongMetaData, AddFiles, TextSuggestion },
  data: () => ({
    store: useAppStore(),
    userStore: useUserStore(),
    noten: [],
    selected_song: null,
    created_files: [],
    melodie_files: [],
  }),
  computed: {
    store_gesangbuchlieder() {
      return _.sortBy(this.store.gesangbuchlieder, "titel");
    },
    top_100_songs() {
      return _.take(this.store_gesangbuchlieder, 100);
    },
  },
  methods: {
    async send_data() {
      console.log(this.$refs.song_data.text_anmerkung);

      let create_new_text = false;
      if (this.selected_song.text) {
        // UPDATE AUTHOR WITH TEXT

        this.selected_song?.text.strophenEinzeln?.forEach((strophe) => {
          // remove new stophe
          delete strophe.new_strophe;
        });

        await axios.patch(
          `${import.meta.env.VITE_BACKEND_URL}/items/text/${this.selected_song.text.id}`,
          {
            anmerkung: this.$refs.song_data.text_anmerkung,
            strophenEinzeln: this.selected_song?.text?.strophenEinzeln,
          },
        );
      } else {
        if (this.$refs.text_suggestion.show_new_text) {
          // CREATE NEW TEXT
          await this.$refs.text_suggestion.validate();
          create_new_text = true;
        }
      }

      let create_new_melodie = false;
      if (this.selected_song.melodie) {
        // Update melodie anmerkung
        await axios.patch(
          `${import.meta.env.VITE_BACKEND_URL}/items/melodie/${this.selected_song.melodie.id}`,
          {
            anmerkung: this.$refs.song_data.melodie_anmerkung,
          },
        );

        // MELODIE TO FILE MELODIE MAPPING
        const created_files = await this.upload_file();
        let to_be_created_melodie_file_mapping = [];
        for (let created_file of created_files) {
          let create_file_melodie = {
            melodie_id: this.selected_song.melodie.id,
            directus_files_id: created_file.id,
          };
          to_be_created_melodie_file_mapping.push(create_file_melodie);
        }

        if (to_be_created_melodie_file_mapping.length !== 0) {
          console.log(
            "to_be_created_melodie_file_mapping",
            to_be_created_melodie_file_mapping,
          );
          await axios
            .post(
              `${import.meta.env.VITE_BACKEND_URL}/items/melodie_files`,
              to_be_created_melodie_file_mapping,
            )
            .then((resp) => {
              console.log("created melodie_files", resp.data.data);
              this.melodie_files = resp.data.data;
            });
        }
      } else {
        if (this.$refs.add_files.show_new_melodie) {
          // CREATE NEW MELODIE
          await this.$refs.add_files.validate();
          create_new_melodie = true;
        }
      }

      // Upload text and melodie
      let created_text_id = null;
      if (create_new_text) {
        created_text_id = await this.$refs.text_suggestion.upload();
        console.log("created_text", created_text_id);
      }

      let created_melodie_id = null;
      if (create_new_melodie) {
        created_melodie_id = await this.$refs.add_files.upload();
        console.log("created_melodie", created_melodie_id);
      }

      // UPDATE AUTHOR WITH TEXT AND MELODIE
      // Set the field lied hat aenderung to true in the gesangbuchlied
      let update_gesangbuchlied = {
        liedHatAenderung: true,
      };
      // text und melodie
      if (created_text_id) {
        update_gesangbuchlied["textId"] = created_text_id;
        this.selected_song.text = this.$refs.text_suggestion.text;
      }
      if (created_melodie_id) {
        update_gesangbuchlied["melodieId"] = created_melodie_id;
        this.selected_song.melodie = this.$refs.add_files.melodie;
      }

      console.log(update_gesangbuchlied);
      if (!_.every(update_gesangbuchlied, (val) => val === null)) {
        console.log("update_gesangbuchlied", update_gesangbuchlied);
        await axios.patch(
          `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied/${this.selected_song.id}`,
          update_gesangbuchlied,
        );
      }

      this.noten = [];
      this.selected_song = null;
    },
    async upload_file() {
      for (let file of this.noten) {
        console.log("Upload file ", file);
        const formData = new FormData();
        formData.append("title", file.name);
        formData.append("file", file);

        await axios
          .post(`${import.meta.env.VITE_BACKEND_URL}/files`, formData)
          .then((resp) => {
            this.created_files.push(resp.data.data);
            this.selected_song.melodie.files.push(resp.data.data);
          });
      }
      return this.created_files;
    },
    add_strophe() {
      this.selected_song?.text?.strophenEinzeln.push({
        strophe: "",
        aenderungsvorschlag: "",
        anmerkung: "",
        new_strophe: true,
      });
    },
    song_selected() {
      if (this.selected_song.text) {
        if (!this.selected_song.text.strophenEinzeln) {
          this.selected_song.text.strophenEinzeln = [
            {
              strophe: "",
              aenderungsvorschlag: "",
              anmerkung: "",
              new_strophe: true,
            },
          ];
        }
      }
    },
    remove_strophe(index) {
      this.selected_song?.text?.strophenEinzeln.splice(index, 1);
    },
    custom_filter(item, queryText, itemText) {
      return itemText.raw.autocomplete
        .toLowerCase()
        .includes(queryText.toLowerCase());
    },
    reset_form() {
      this.selected_song = null;
    },
  },
};
</script>

<style></style>
