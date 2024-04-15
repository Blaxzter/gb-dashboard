<template>
  <v-card class="mb-5" :elevation="$vuetify.display.xs ? 0 : 1">
    <v-card-title
      class="text-grey text-subtitle-1"
      :class="{ 'px-0': $vuetify.display.xs }"
    >
      Text Daten
    </v-card-title>
    <v-card-text class="pb-0" :class="{ 'px-0': $vuetify.display.xs }">
      <v-row class="my-0">
        <v-col
          cols="12"
          class="d-flex align-center py-0 flex-column flex-sm-row"
        >
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
                :title="
                  item?.raw?.titel +
                  (item?.raw?.strophenEinzeln
                    ? ' - #' + item?.raw?.strophenEinzeln?.length + ' Strophen'
                    : '')
                "
                :subtitle="item?.raw?.author_name"
              >
                <span style="font-size: 0.85rem">{{
                  item?.raw?.strophe_short
                }}</span>
              </v-list-item>
            </template>
          </v-autocomplete>
        </v-col>
      </v-row>

      <v-expansion-panels class="mt-0 mb-5" :disabled="existing_text">
        <v-expansion-panel
          title="Neuer Text des Gesangbuchlieds"
          ref="text_expansion_panel"
          :value="existing_text"
        >
          <v-expansion-panel-text>
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

            <TextStrophen :strophen="text.strophen" class="mb-3" />
            <AuthorenFom
              :label="'Text Autoren'"
              @update:selected_author="text.selected_authors = $event"
              :selected_author="text.selected_authors"
              v-model:authors="text.authors"
              class="mb-3"
              :upload_page="upload_page"
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
import { useAppStore } from "@/store/app";
import _ from "lodash";
import axios from "@/assets/js/axiossConfig";
import moment from "moment/moment";

export default {
  name: "NewTextData",
  components: { TextData, TextStrophen, AuthorenFom },
  data: () => ({
    store: useAppStore(),
    text: {},
    existing_text: false,
    selected_text: null,
    successfully_created: {
      text_author_mapping: [], // {text_id: 1, author_id: 1}
      authors: [],
      text: null,
    },
  }),
  props: {
    song_title: String,
    in_text: Object,
    upload_page: Boolean,
  },
  mounted() {
    this.text = this.in_text;
    this.$emit("update:text", this.text);
  },
  watch: {
    text: {
      handler() {
        this.$emit("update:text", this.text);
      },
      deep: true,
    },
    existing_text() {
      this.$emit("update:existing_text", this.existing_text);
    },
    selected_text() {
      this.$emit("update:selected_text", this.selected_text);
    },
  },
  computed: {
    store_text() {
      return this.store.texts;
    },
    sorted_store_text() {
      return _.sortBy(this.store_text, "titel");
    },
  },
  methods: {
    validate() {
      // VALIDATE TEXT AUTHORS
      console.log("VALIDATE TEXT AUTHORS");
      this.to_be_created_text_authors = [];
      if (!this.existing_text) {
        for (let author of this.text.authors) {
          console.log(author);
          if (!this.validate_author(author)) {
            alert("Ein Text Autor hat keinen Nachnamen.");
            return;
          }
          let to_be_created_text_author = {
            vorname: author.firstName == "" ? null : author.firstName,
            nachname: author.lastName == "" ? null : author.lastName,
            geburtsjahr: author.birthdate
              ? Number(moment(author.birthdate).format("YYYY"))
              : null,
            sterbejahr: author.deathdate
              ? Number(moment(author.deathdate).format("YYYY"))
              : null,
          };
          if (!_.every(to_be_created_text_author, (val) => val === null)) {
            this.to_be_created_text_authors["status"] = "uploaded";
            this.to_be_created_text_authors.push(to_be_created_text_author);
          }
        }
      }
    },

    async upload() {
      // CREATE TEXT
      console.log("CREATE TEXT");
      let created_text = null;
      if (!this.existing_text) {
        let create_text = {
          titel: _.isEmpty(this.text.title) ? null : this.text.title,
          quelle: _.isEmpty(this.text.quelle) ? null : this.text.quelle,
          quelllink: _.isEmpty(this.text.quelllink)
            ? null
            : this.text.quelllink,
          anmerkung: _.isEmpty(this.text.anmerkung)
            ? null
            : this.text.anmerkung,
        };

        const strophen_empty = !_.includes(
          _.map(this.text.strophen, (elem) => _.isEmpty(elem.strophe)),
          false,
        );

        // Check if a value is set
        if (!_.every(create_text, (val) => val === null) || !strophen_empty) {
          create_text["status"] = "uploaded";
          // trim strophen.strophe in every element before assigning to strophenEinzeln
          create_text["strophenEinzeln"] = _.map(this.text.strophen, (elem) => {
            return {
              ...elem,
              strophe: _.isEmpty(elem.strophe) ? null : elem.strophe.trim(),
            };
          });
          console.log("create_text", create_text);
          await axios
            .post(`${import.meta.env.VITE_BACKEND_URL}/items/text`, create_text)
            .then((resp) => {
              console.log("created text", resp.data.data);
              created_text = resp.data.data;
              this.successfully_created.text = resp.data.data;
            });

          // CREATE NEW TEXT AUTHORS
          console.log("CREATE NEW TEXT AUTHORS");
          let created_text_authors = [];
          if (
            !this.existing_text &&
            this.to_be_created_text_authors.length !== 0
          ) {
            console.log(
              "to_be_created_text_authors",
              this.to_be_created_text_authors,
            );
            await axios
              .post(
                `${import.meta.env.VITE_BACKEND_URL}/items/autor`,
                this.to_be_created_text_authors,
              )
              .then((resp) => {
                console.log("created authors", resp.data.data);
                created_text_authors = resp.data.data;
                this.successfully_created.authors.push(...resp.data.data);
              });
          }

          // CRATE TEXT AUTHOR MAPPING N:M
          created_text_authors.push(...this.text.selected_authors);
          let to_be_created_text_author_mapping = [];
          for (let created_author of created_text_authors) {
            let create_author_text = {
              text_id: created_text?.id,
              autor_id: created_author.id,
            };
            if (!_.every(create_author_text, (val) => val === null))
              to_be_created_text_author_mapping.push(create_author_text);
          }

          if (to_be_created_text_author_mapping.length !== 0) {
            console.log(
              "to_be_created_text_author_mapping",
              to_be_created_text_author_mapping,
            );
            await axios
              .post(
                `${import.meta.env.VITE_BACKEND_URL}/items/text_autor`,
                to_be_created_text_author_mapping,
              )
              .then((resp) => {
                console.log("created text_author_mapping", resp.data.data);
                this.successfully_created.text_author_mapping.push(
                  ...resp.data.data,
                );
              });
          }
        }
      }

      return this.existing_text
        ? this.selected_text?.id
        : created_text
          ? created_text.id
          : null;
    },
    custom_filter(item, queryText, itemText) {
      return itemText.raw.autocomplete
        .toLowerCase()
        .includes(queryText.toLowerCase());
    },
    validate_author(author) {
      if (
        !_.isEmpty(author.firstName) ||
        !_.isEmpty(author.birthdate) ||
        !_.isEmpty(author.deathdate)
      )
        if (_.isEmpty(author.firstName)) return false;
      return true;
    },
  },
};
</script>

<style scoped></style>
