<template>
  <div class="text-h4 mb-5">Änderung Hochladen</div>

  <div class="text-body-1">
    Wähle ein Gesangbuchlied aus, bei welchem du Textvorschläge oder neue Melodie Dateien hochladen möchtest.
  </div>

  <v-form ref="form">
    <v-container>
      <div class="d-flex mb-5">
        <v-autocomplete
          :disabled="selected_song !== null"
          label="Suche nach existierenden Gesangbuchliedern"
          :items="store_gesangbuchlieder"
          :custom-filter="custom_filter"
          item-title="titel"
          item-value="id"
          hide-details="auto"
          class="py-0"
          return-object
          v-model="selected_song"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item
              v-bind="props"
              :title="item?.raw?.titel +  (item?.raw?.text?.strophenEinzeln ? ' - #' + item?.raw?.text?.strophenEinzeln?.length + ' Strophen' : '')"
              :subtitle="item?.raw?.author_name"
            >
              <span style="font-size: 0.8rem">{{ item?.raw?.text?.strophe_short }}</span>
            </v-list-item>
          </template>
        </v-autocomplete>

        <v-tooltip text="Neues Lies auswählen." location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn icon="mdi-repeat" size="tiny" variant="plain" class="ms-5" v-bind="props" color="primary"
                   @click="reset_form"/>
          </template>
        </v-tooltip>
      </div>


      <v-expand-transition>
      <div v-if="selected_song !== null">
        <AddFiles
          ref="add_files"
          :melodie="selected_song?.melodie"
          @update:noten="noten = $event"
          :selected_song="selected_song"
        />

        <TextSuggestion
          ref="text_suggestion"
          :text="selected_song?.text"
          :selected_song="selected_song"
        />
      </div>
      </v-expand-transition>

      <v-btn
        v-if="selected_song !== null"
        prepend-icon="mdi-send"
        block
        class="mt-5 py-5"
        color="primary"
        elevated
        size="x-large"
        @click="check_data"
      >
        Änderung Hochladen
      </v-btn>
    </v-container>
  </v-form>

  <div class="text-h6" v-if="melodie_files.length">
    Es wurden {{melodie_files.length}} Datein Hochgeladen.
  </div>
</template>

<script>


import {useAppStore} from "@/store/app";
import axios from "@/assets/js/axiossConfig";
import _ from "lodash";
import TextSuggestion from "@/components/upload/ChangeSuggestion/TextSuggestion.vue";
import AddFiles from "@/components/upload/ChangeSuggestion/AddFiles.vue";

export default {
  name: "ChangeSuggestionUpload",
  components: {AddFiles, TextSuggestion},
  data: () => ({
    store: useAppStore(),
    noten: [],
    selected_song: null,
    created_files: [],
    melodie_files: [],
  }),
  computed: {
    store_gesangbuchlieder() {
      return _.sortBy(this.store.gesangbuchlieder, 'titel');
    },
  },
  methods: {
    check_data() {
      // log data from ref
      console.log(this.$refs.add_files.new_melodie);
      console.log(this.$refs.text_suggestion.new_text);

      this.$refs.add_files.validate();
      this.$refs.text_suggestion.validate();


    },
    async send_data() {

      // TODO depending on if new melodie or text should be created call refs upload
      // And update gesangbuchlied accordingly with return of update method

      // // UPDATE AUTHOR WITH TEXT AND MELODIE
      // let update_gesangbuchlied = {}
      // // text und melodie
      // const textId = this.existing_text ? this.selected_text?.id : (created_text ? created_text.id : null)
      // if (textId) {
      //   update_gesangbuchlied['textId'] = textId
      // }
      // const melodieId = this.existing_melodie ? this.selected_melodie?.id : (created_melodie ? created_melodie.id : null)
      // if (melodieId) {
      //   update_gesangbuchlied['melodieId'] = melodieId
      // }
      //
      // console.log(update_gesangbuchlied)
      // if (!_.every(update_gesangbuchlied, (val) => val === null)) {
      //   console.log("update_gesangbuchlied", update_gesangbuchlied);
      //   await axios
      //     .patch(`${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied/${created_gesangbuchlied.id}`, update_gesangbuchlied)
      // }

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
          to_be_created_melodie_file_mapping
        );
        await axios
          .post(`${import.meta.env.VITE_BACKEND_URL}/items/melodie_files`, to_be_created_melodie_file_mapping)
          .then((resp) => {
            console.log(
              "created melodie_files",
              resp.data.data
            );
            this.melodie_files = resp.data.data;
          });
      }

      // UPDATE AUTHOR WITH TEXT AND MELODIE
      let update_text = {
        strophenEinzeln: this.selected_song?.text?.strophenEinzeln
      }

      if (!_.every(update_text, (val) => val === null || val === undefined)) {
        console.log("update_text", update_text);
        await axios
          .patch(`${import.meta.env.VITE_BACKEND_URL}/items/text/${this.selected_song.text.id}`, update_text)
      }

      this.noten = null;
      this.selected_song = null;
    },
    async upload_file() {
      for (let file of this.noten) {
        console.log("Upload file ", file);
        const formData = new FormData();
        formData.append("title", file.name);
        formData.append('file', file);

        await axios.post(`${import.meta.env.VITE_BACKEND_URL}/files`, formData)
          .then((resp) => {
            this.created_files.push(resp.data.data)
            this.selected_song.melodie.files.push(resp.data.data)
          });
      }
      return this.created_files;
    },
    custom_filter(item, queryText, itemText) {
      return itemText.value.autocomplete.includes(queryText)
    },
    reset_form() {
      this.selected_song = null;
    }
  }
}
</script>

<style>

</style>
