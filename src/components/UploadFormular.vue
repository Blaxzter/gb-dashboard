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
            class="d-flex flex-row h-100"
            divided
          >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-teddy-bear"
              value="kinder"
            >
              kinder
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-skateboarding"
              value="jugend"
            >
              jugend
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-pine-tree"
              value="weihnachten"
            >
              weihnachten
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-cross"
              value="heimgang"
            >
              heimgang
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-weather-night"
              value="abendlied"
            >
              abendlied
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-candle"
              value="advent"
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
                  :selected_author="text.selected_authors"
                  :authors="text.authors"
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
              value="kinder"
            >
              Melodie Geändert
            </v-btn>
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-text-box-edit"
              value="jugend"
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
// import axios from "axios";
import _ from "lodash";

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
    liednummer2000: "",
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
      let to_be_created_text_author = [];

      for (let author of this.text.authors) {
        if (!this.validate_author(author)) {
          alert("Ein Text Autor hat keinen Nachnamen.");
          return;
        }
        to_be_created_text_author.push({
          vorname: author.firstName,
          nachname: author.lastName,
          birthdate: author.birthdate,
          sterbejahr: author.deathdate,
        });
      }

      let to_be_created_melodie_author = [];

      for (let author of this.melodie.authors) {
        if (!this.validate_author(author)) {
          alert("Ein Melodie Autor hat keinen Nachnamen.");
          return;
        }
        to_be_created_melodie_author.push({
          vorname: author.firstName,
          nachname: author.lastName,
          birthdate: author.birthdate,
          sterbejahr: author.deathdate,
        });
      }

      console.log(to_be_created_text_author);
      console.log(to_be_created_melodie_author);
      let created_text_author = [];
      // await axios
      //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/autor?limit=-1`, author_data)
      //   .then((resp) => created_text_author.push(resp.data.data));

      let created_melodie_author = [];
      // await axios
      //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/autor?limit=-1`, author_data)
      //   .then((resp) => created_melodie_author.push(resp.data.data));

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
      console.log(create_text);
      let created_text = -1;
      // await axios
      //   .post(`${import.meta.env.VITE_BACKEND_URL}/items/autor?limit=-1`, author_data)
      //   .then((resp) => created_text = resp.data.data);

      let to_be_created_text_author_mapping = [];
      for(let created_author of created_text_author) {
        let create_author_text = {
          text_id: created_text,
          autor_id: created_author.id,
        }
        to_be_created_text_author_mapping.push(create_author_text);
      }
      console.log(to_be_created_text_author_mapping)


      // this.$refs.form.reset();
    },
    async upload_file() {
      import axios from 'axios';

      const fileInput = document.querySelector('input[type="file"]');
      const formData = new FormData();

      formData.append('title', 'My First File');
      formData.append('file', fileInput.files[0]);

      await axios.post('/files', formData);
    },

    validate_author(author) {
      console.log("Validate Author");

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
