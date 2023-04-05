<template>
  <div class="text-h5 mb-2">Gesangbuchlied hochladen</div>
  <v-form ref="form">
    <v-container>
      <v-row>
        <v-col cols="12" class="py-0">
          <v-text-field
            v-model="title"
            hide-details="auto"
            label="Titel des Gesangbuchlieds"
            required
          ></v-text-field>
        </v-col>
      </v-row>

      <v-row class="mt-7 mb-0">
        <v-col cols="12" class="py-0">
          <div class="text-grey text-subtitle-1">Kategorie</div>
        </v-col>
      </v-row>
      <v-row class="mt-0 mb-3">
        <v-col cols="12">
          <v-btn-toggle
            v-model="kategorie"
            color="primary"
            multiple
            class="d-flex flex-row h-100 overflow-x-auto"
            divided
          >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-teddy-bear"
              value="Kinder"
            >
              kinder
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-skateboarding"
              value="Jugend"
            >
              jugend
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-pine-tree"
              value="Weihnachten"
            >
              weihnachten
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-cross"
              value="Heimgang"
            >
              heimgang
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-weather-night"
              value="Abendlied"
            >
              abendlied
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-candle"
              value="Advent"
            >
              advent
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-glass-wine"
              value="Abendmahl"
            >
              Abendmahl
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-image-filter-hdr"
              value="Joseph Weißenberg – Geburtstag"
            >
              Weißenberg <br />
              B-Day
            </v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>

      <v-card class="mb-5">
        <v-card-title class="text-grey text-subtitle-1">
          Text Daten
        </v-card-title>
        <v-card-text class="pb-0">
          <v-row class="my-0">
            <v-col cols="12" class="d-flex align-center py-0">
              <span class="mr-4">
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
                :items="store_text"
                item-title="titel"
                item-value="id"
                hide-details="auto"
                class="py-0"
                return-object
                v-model="selected_text"
              ></v-autocomplete>
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
                  :anmerkung="text.anmerkung"
                  :quelle="text.quelle"
                  :quellelink="text.quelllink"
                  :title="text.title"
                />

                <TextStrophen :strophen="text.strophen" class="mb-3" />
                <AuthorenFom
                  :label="'Text Autoren'"
                  v-model:selected_author="text.selected_authors"
                  v-model:authors="text.authors"
                  class="mb-3"
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

      <v-card class="mb-5">
        <v-card-title class="text-grey text-subtitle-1">
          Melodie Daten
        </v-card-title>
        <v-card-text>
          <v-row class="my-0">
            <v-col cols="12" class="d-flex align-center py-0">
              <span class="mr-4">
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
                :items="store_melodie"
                item-title="titel"
                item-value="id"
                hide-details="auto"
                class="py-0"
                return-object
                v-model="selected_melodie"
              ></v-autocomplete>
            </v-col>
          </v-row>

          <v-expansion-panels class="mb-5" :disabled="existing_melodie">
            <v-expansion-panel
              title="Neue Melodie des Gesangbuchlieds"
              :value="existing_melodie"
            >
              <v-expansion-panel-text>
                <MelodieData
                  :anmerkung="melodie.anmerkung"
                  :quelle="melodie.quelle"
                  :noten="melodie.noten"
                  :quellelink="melodie.quelllink"
                  :title="melodie.title"
                />

                <AuthorenFom
                  :disabled="true"
                  :label="'Melodie Autoren'"
                  :selected_author="melodie.selected_authors"
                  :authors="melodie.authors"
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

      <v-row>
        <v-col cols="6">
          <v-text-field
            v-model="externer_link"
            hide-details="auto"
            label="Externer Link"
          ></v-text-field>
        </v-col>
        <v-col cols="6">
          <v-text-field
            v-model="cloud_link"
            hide-details="auto"
            label="Interner Cloud Link"
          ></v-text-field>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-textarea
            v-model="anmerkung"
            hide-details="auto"
            rows="2"
            label="Weitere Anmerkungen"
          ></v-textarea>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="liednummer2000"
            hide-details="auto"
            type="number"
            clearable
            label="Liednummer aus dem 2000er GB"
          ></v-text-field>
        </v-col>
        <v-col cols="12" md="6">
          <v-btn-toggle
            v-model="geandert"
            color="primary"
            multiple
            class="d-flex flex-row h-100"
            divided
            variant="outlined"
          >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-music"
              value="melodie_geaendert"
            >
              Melodie Geändert
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-text-box-edit"
              value="text_geaendert"
            >
              Text Geändert
            </v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>

      <v-btn
        prepend-icon="mdi-send"
        block
        class="mt-5 py-5"
        color="primary"
        elevated
        size="x-large"
        @click="send_data"
      >
        Senden
      </v-btn>
    </v-container>
  </v-form>
</template>

<script>
import TextStrophen from "@/components/upload/TextStrophen.vue";
import AuthorenFom from "@/components/upload/AuthorenFom.vue";
// import LizensComponent from "@/components/upload/LizensComponent.vue";
import TextData from "@/components/upload/TextData.vue";
import MelodieData from "@/components/upload/MelodieData.vue";

import { useAppStore } from "@/store/app";
import axios from "axios";
import _ from "lodash";
import moment from "moment";

export default {
  components: {
    MelodieData,
    TextData,
    // LizensComponent,
    AuthorenFom,
    TextStrophen,
  },
  data: () => ({
    store: useAppStore(),

    title: "",
    kategorie: [],
    externer_link: "",
    cloud_link: "",
    existing_text: false,
    selected_text: null,
    existing_melodie: false,
    selected_melodie: null,
    text: {
      title: "",
      strophen: [{ text: "" }],
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
    melodie: {
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
    anmerkung: "",
    liednummer2000: null,
    geandert: [],
  }),
  computed: {
    store_text() {
      return this.store.texts;
    },
    store_melodie() {
      return this.store.melodies;
    },
  },
  methods: {
    async send_data() {
      // VALIDATE TEXT AUTHORS
      console.log("VALIDATE TEXT AUTHORS");
      let to_be_created_text_authors = [];
      if (!this.existing_text) {
        for (let author of this.text.authors) {
          if (!this.validate_author(author)) {
            alert("Ein Text Autor hat keinen Nachnamen.");
            return;
          }
          let to_be_created_text_author = {
            vorname: author.firstName == "" ? null : author.firstName,
            nachname: author.lastName == "" ? null : author.lastName,
            geburtsjahr: moment(author.birthdate).format('YYYY'),
            sterbejahr: moment(author.deathdate).format('YYYY'),
          };
          if (!_.every(to_be_created_text_author, (val) => val === null))
            to_be_created_text_authors.push(to_be_created_text_author);
        }
      }

      // VALIDATE MELODIE AUTHORS
      console.log("VALIDATE MELODIE AUTHORS");
      let to_be_created_melodie_authors = [];
      if (!this.existing_melodie) {
        for (let author of this.melodie.authors) {
          if (!this.validate_author(author)) {
            alert("Ein Melodie Autor hat keinen Nachnamen.");
            return;
          }
          let to_be_created_melodie_author = {
            vorname: author.firstName === "" ? null : author.firstName,
            nachname: author.lastName === "" ? null : author.lastName,
            geburtsjahr: moment(author.birthdate).format('YYYY'),
            sterbejahr: moment(author.deathdate).format('YYYY'),
          };
          if (!_.every(to_be_created_melodie_author, (val) => val === null))
            to_be_created_melodie_authors.push(to_be_created_melodie_author);
        }
      }

      if (!Number.isInteger(Number(this.liednummer2000))) {
        alert("LIed Nummer 2000 ist keine Zahl.")
        this.liednummer2000 = null;
        return
      }

      // CREATE GESANGBUCHLIED
      console.log("CREATE GESANGBUCHLIED");
      let create_gesangbuchlied = {
        titel: this.title === "" ? null : this.title,
        externerLink: this.externer_link === "" ? null : this.externer_link,
        linkCloud: this.cloud_link === "" ? null : this.cloud_link,
        anmerkung: this.anmerkung === "" ? null : this.anmerkung,
        liednummer2000: this.liednummer2000 === '' ? null : Number(this.liednummer2000),
      };

      if (!_.every(create_gesangbuchlied, (val) => val === null)) {
        create_gesangbuchlied["melodieGeaendert"] =
          _.find(this.geandert, (elem) => elem == "melodie_geaendert") !==
          undefined;
        create_gesangbuchlied["textGeaendert"] =
          _.find(this.geandert, (elem) => elem == "text_geaendert") !==
          undefined;

        console.log(create_gesangbuchlied);
        let created_gesangbuchlied = null;
        await axios
          .post(
            `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied`,
            create_gesangbuchlied
          )
          .then((resp) => (created_gesangbuchlied = resp.data.data));

        if (created_gesangbuchlied !== null) {
          // CREATE KATEGORIE GESANGBUCHLIED
          console.log("CREATE KATEGORIE GESANGBUCHLIED");
          let to_be_created_category_lied_mapping = [];
          for (let current_category of this.kategorie) {
            let category_lied = {
              gesangbuchlied_id: created_gesangbuchlied.id,
              kategorie_id: _.find(
                this.store.kategorie,
                (elem) => elem.name === current_category
              )?.id,
            };
            if (!_.every(category_lied, (val) => val === null))
              to_be_created_category_lied_mapping.push(category_lied);
          }
          if (to_be_created_category_lied_mapping.length !== 0) {
            console.log(
              "to_be_created_category_lied_mapping",
              to_be_created_category_lied_mapping
            );
            // await axios
            //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied_kategorie`, to_be_created_category_lied_mapping)
            //   .then((resp) => created_text = resp.data.data);
          }
        }

        // CREATE TEXT
        console.log("CREATE TEXT");
        let created_text = null;
        if (!this.existing_text) {
          let create_text = {
            titel: this.text.title === "" ? null : this.text.title,
            strophen:
              this.text.strophen[0].text === ""
                ? null
                : _.map(this.text.strophen, "text").join("\n\n"),
            quelle: this.text.quelle === "" ? null : this.text.quelle,
            quelllink: this.text.quelllink === "" ? null : this.text.quelllink,
            anmerkung: this.text.anmerkung === "" ? null : this.text.anmerkung,
          };

          // Check if a value is set
          if (!_.every(create_text, (val) => val === null)) {
            console.log("create_text", create_text);
            // await axios
            //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/text`, author_data)
            //   .then((resp) => created_text = resp.data.data);

            // CREATE NEW TEXT AUTHORS
            console.log("CREATE NEW TEXT AUTHORS");
            let created_text_authors = [];
            if (
              !this.existing_text &&
              to_be_created_text_authors.length !== 0
            ) {
              console.log(
                "to_be_created_text_authors",
                to_be_created_text_authors
              );
              // await axios
              //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/autor`, to_be_created_text_authors)
              //   .then((resp) => created_text_authors = resp.data.data);
            }

            // CRATE TEXT AUTHOR MAPPING N:M
            created_text_authors.push(...this.text.selected_authors);
            let to_be_created_text_author_mapping = [];
            for (let created_author of created_text_authors) {
              let create_author_text = {
                text_id: created_text,
                autor_id: created_author.id,
              };
              if (!_.every(create_author_text, (val) => val === null))
                to_be_created_text_author_mapping.push(create_author_text);
            }

            if (to_be_created_text_author_mapping.length !== 0) {
              console.log(
                "to_be_created_text_author_mapping",
                to_be_created_text_author_mapping
              );
              // await axios
              //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/text_autor`, to_be_created_text_author_mapping)
            }
          }
        }

        // CREATE MELODIE
        console.log("CREATE MELODIE");
        let created_melodie = -1;
        if (!this.existing_melodie) {
          let create_melodie = {
            titel: this.melodie.title === "" ? null : this.melodie.title,
            quelle: this.melodie.quelle === "" ? null : this.melodie.quelle,
            quelllink:
              this.melodie.quelllink === "" ? null : this.melodie.quelllink,
            anmerkung:
              this.melodie.anmerkung === "" ? null : this.melodie.anmerkung,
          };

          if (!_.every(create_melodie, (val) => val === null)) {
            console.log("create_melodie", create_melodie);

            // await axios
            //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/melodie`, author_data)
            //   .then((resp) => created_text = resp.data.data);

            // CREATE NEW MELODIE AUTHORS
            console.log("CREATE NEW MELODIE AUTHORS");
            let created_melodie_authors = [];
            if (
              !this.existing_melodie &&
              to_be_created_melodie_authors.length !== 0
            ) {
              console.log(
                "created_melodie_author",
                to_be_created_melodie_authors
              );
              // await axios
              //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/autor`, to_be_created_melodie_authors)
              //   .then((resp) => created_melodie_author = resp.data.data);
            }

            // MELODIE AUTHOR N TO M MAPPING
            created_melodie_authors.push(...this.melodie.selected_authors);

            let to_be_created_melodie_author_mapping = [];
            for (let created_author of created_melodie_authors) {
              let create_author_melodie = {
                melodie_id: created_melodie,
                autor_id: created_author.id,
              };
              if (!_.every(create_author_melodie, (val) => val === null))
                to_be_created_melodie_author_mapping.push(
                  create_author_melodie
                );
            }
            if (to_be_created_melodie_author_mapping.length !== 0) {
              console.log(
                "to_be_created_melodie_author_mapping",
                to_be_created_melodie_author_mapping
              );
              // await axios
              //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/melodie_autor`, to_be_created_melodie_author_mapping)
              //   .then((resp) => created_text = resp.data.data);
            }

            // MELODIE TO FILE MELODIE MAPPING
            const created_files = await this.upload_file();
            let to_be_created_melodie_file_mapping = [];
            for (let created_author of created_files) {
              let create_file_melodie = {
                melodie_id: created_melodie,
                autor_id: created_author.id,
              };
              to_be_created_melodie_file_mapping.push(create_file_melodie);
            }

            if (to_be_created_melodie_author_mapping.length !== 0) {
              console.log(
                "to_be_created_melodie_file_mapping",
                to_be_created_melodie_file_mapping
              );
              // await axios
              //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/melodie_files`, to_be_created_melodie_file_mapping)
              //   .then((resp) => created_text = resp.data.data);
            }
          }
        }

        // UPDATE AUTHOR WITH TEXT AND MELODIE
        let update_gesangbuchlied = {
          // text und melodie
          textId: this.existing_text
            ? this.selected_text?.id
            : created_text === -1
            ? null
            : created_text,
          melodieId: this.existing_melodie
            ? this.selected_melodie?.id
            : created_melodie === -1
            ? null
            : created_melodie,
        };
        if (!_.every(update_gesangbuchlied, (val) => val === null)) {
          console.log("update_gesangbuchlied", update_gesangbuchlied);
          await axios
            .patch(`${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied/${created_gesangbuchlied.id}`, update_gesangbuchlied)
        }
      }
    },
    async upload_file() {
      console.log("File Upload");
      console.log("this.melodie.noten", this.melodie.noten);

      const formData = new FormData();
      formData.append("title", "My First File");
      // formData.append('file', fileInput.files[0]);

      let created_file = [];
      // await axios.post('/files', formData).then((resp) => created_file = resp.data.data);
      return created_file;
    },

    validate_author(author) {
      return !(
        author.lastName === "" &&
        (author.firstName !== "" ||
          author.birthdate != null ||
          author.deathdate != null)
      );
    },
  },
};
</script>
