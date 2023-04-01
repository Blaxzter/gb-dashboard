<template>
  <div class="text-h5 mb-2">Gesangbuchlied hochladen</div>
  <v-form v-model="valid">
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

      <v-row class="pt-4 pb-0">
        <v-col cols="12" class="py-0">
          <div class="text-grey text-subtitle-1">Kategorie</div>
        </v-col>
      </v-row>
      <v-row class="pt-0 pb-3">
        <v-col cols="12">
          <v-btn-toggle
            v-model="kategorie"
            color="primary"
            multiple
            class="d-flex flex-row"
            divided
          >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-teddy-bear"
              value="kinder"
              >kinder</v-btn
            >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-skateboarding"
              value="jugend"
              >jugend</v-btn
            >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-pine-tree"
              value="weihnachten"
              >weihnachten</v-btn
            >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-cross"
              value="heimgang"
              >heimgang</v-btn
            >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-weather-night"
              value="abendlied"
              >abendlied</v-btn
            >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-candle"
              value="advent"
              >advent</v-btn
            >
          </v-btn-toggle>
        </v-col>
      </v-row>

      <v-expansion-panels class="my-5">
        <v-expansion-panel title="Text des Gesangbuchlieds">
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
              :authors="text.authors"
              class="mb-3"
            />
            <LizensComponent
              :label="'Text Lizensen'"
              :lizenz="text.lizenz"
              :use_lizenz="text.use_lizenz"
            />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-expansion-panels class="mb-5">
        <v-expansion-panel title="Melodie des Gesangbuchlieds">
          <v-expansion-panel-text>
            <MelodieData
              :anmerkung="melodie.anmerkung"
              :quelle="melodie.quelle"
              :noten="melodie.noten"
              :quellelink="melodie.quelllink"
              :title="melodie.title"
            />

            <AuthorenFom
              :label="'Melodie Autoren'"
              :authors="melodie.authors"
              class="mb-3"
            />
            <LizensComponent
              :label="'Melodie Lizensen'"
              :lizenz="melodie.lizenz"
              :use_lizenz="melodie.use_lizenz"
            />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

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
        <v-col cols="6">
          <v-text-field
            v-model="liednummer2000"
            hide-details="auto"
            type="number"
            label="Liednummer aus dem 2000er GB"
          ></v-text-field>
        </v-col>
        <v-col cols="6">
          <v-btn-toggle
            v-model="geandert"
            color="primary"
            multiple
            class="d-flex flex-row"
            divided
            variant="outlined"
          >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-music"
              value="kinder"
              >Melodie Geändert</v-btn
            >
            <v-btn
              stacked
              class="flex-grow-1"
              prepend-icon="mdi-text-box-edit"
              value="jugend"
              >Text Geändert</v-btn
            >
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
import LizensComponent from "@/components/upload/LizensComponent.vue";
import TextData from "@/components/upload/TextData.vue";
import MelodieData from "@/components/upload/MelodieData.vue";

export default {
  components: {
    MelodieData,
    TextData,
    LizensComponent,
    AuthorenFom,
    TextStrophen,
  },
  data: () => ({
    valid: false,
    title: "",
    kategorie: [],
    externer_link: "",
    cloud_link: "",
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
  methods: {
    send_data() {
      console.dir(this.text);
      console.dir(this.melodie);
    },
  },
};
</script>
