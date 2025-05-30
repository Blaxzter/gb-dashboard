<template>
  <v-row class="mb-5">
    <v-col class="d-flex justify-space-between">
      <div class="text-h4">Lied/Text/Melodie hochladen</div>
      <!--      <v-btn density="default" icon="mdi-undo" v-if="show_undo_button" @click="delete_created_stuff" flat></v-btn>-->
    </v-col>
  </v-row>

  <UploadProgress
    v-if="show_undo_button || loading"
    :loading="loading"
    :gesangbuchlied="successfully_created.gesangbuchlied"
    :text="successfully_created.text"
    :melodie="successfully_created.melodie"
    :category-gesangbuchlied-mapping="
      successfully_created.category_gesangbuchlied_mapping
    "
    :authors="successfully_created.authors"
    :text-author-mapping="successfully_created.text_author_mapping"
    :melodie-author-mapping="successfully_created.melodie_author_mapping"
    :melodie-files="successfully_created.melodie_files"
    :created-files="successfully_created.created_files"
    @reset="reset_data"
  />

  <v-form v-else ref="form" v-model="form_valid" lazy-validation>
    <v-container>
      <div class="py-0 mb-3 d-flex align-center">
        <v-text-field
          v-model="title"
          hide-details="auto"
          label="Titel des Gesangbuchlieds"
          required
        ></v-text-field>
        <div v-if="title_already_exists">
          <v-tooltip text="Titel existiert bereits" location="bottom">
            <template #activator="{ props }">
              <v-icon
                icon="mdi-alert"
                v-bind="props"
                class="px-5"
                color="warning"
              />
            </template>
          </v-tooltip>
        </div>
      </div>

      <v-autocomplete
        v-model="kategorie"
        label="Zugehörige Kategorie"
        class="mb-3"
        :items="store.kategorie"
        item-title="name"
        item-value="id"
        hide-details="auto"
        return-object
        multiple
        chips
        closable-chips
      >
        <template #chip="{ props, item }">
          <v-chip
            v-bind="props"
            :prepend-icon="get_icon(item)"
            :text="item.raw.name"
          ></v-chip>
        </template>

        <template #item="{ props, item }">
          <v-list-item
            v-bind="props"
            :prepend-icon="get_icon(item)"
            :title="item?.raw?.name"
          ></v-list-item>
        </template>
      </v-autocomplete>

      <NewTextData
        :in-text="text"
        :song-title="title"
        :upload-page="true"
        @update:text="text = $event"
        @update:existing_text="existing_text = $event"
        @update:selected_text="selected_text = $event"
      />

      <NewMelodieData
        :in-melodie="melodie"
        :song-title="title"
        :upload-page="true"
        @update:melodie="melodie = $event"
        @update:existing_melodie="existing_melodie = $event"
        @update:selected_melodie="selected_melodie = $event"
      />

      <v-row>
        <v-col v-show="false" cols="6">
          <v-text-field
            v-model="externer_link"
            hide-details="auto"
            label="Externer Link"
          ></v-text-field>
        </v-col>
        <v-col cols="12">
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

      <v-row>
        <v-col cols="12">
          <v-text-field
            v-model="einreicherName"
            hide-details="auto"
            type="text"
            clearable
            label="Name des Einreichers"
          ></v-text-field>
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
      <!--      <v-btn-->
      <!--        prepend-icon="mdi-bug-check"-->
      <!--        block-->
      <!--        class="mt-5 py-5"-->
      <!--        color="warning"-->
      <!--        elevated-->
      <!--        size="x-large"-->
      <!--        @click="see_data"-->
      <!--      >-->
      <!--        Show data-->
      <!--      </v-btn>-->
    </v-container>
  </v-form>
</template>

<script>
import { useAppStore } from "@/store/app";
import axios from "@/assets/js/axiossConfig";
import _ from "lodash";
import moment from "moment";
import { gesangbuch_kategorie_name_to_icon } from "@/assets/js/utils";
import UploadProgress from "@/components/upload/NewSongComponents/UploadProgress.vue";
import NewMelodieData from "@/components/upload/NewSongComponents/NewMelodieData.vue";
import NewTextData from "@/components/upload/NewSongComponents/NewTextData.vue";
import { useUserStore } from "@/store/user";

export default {
  name: "SongUploadForm",
  components: {
    NewTextData,
    NewMelodieData,
    UploadProgress,
  },
  data: () => ({
    store: useAppStore(),
    userStore: useUserStore(),

    form_valid: false,
    loading: false,

    successfully_created: {
      gesangbuchlied: null,
      text: null,
      melodie: null,
      category_gesangbuchlied_mapping: [],
      authors: [],
      text_author_mapping: [],
      melodie_author_mapping: [],
      melodie_files: [],
      created_files: [],
    },

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
      use_same_author_for_text: false,
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
    einreicherName: null,
    geandert: [],
  }),
  computed: {
    store_gesangbuchlieder() {
      return this.store.gesangbuchlieder;
    },
    existing_gesangbuchlieder_title() {
      return _.map(this.store_gesangbuchlieder, "titel");
    },
    title_already_exists() {
      return this.existing_gesangbuchlieder_title.includes(this.title);
    },
    show_undo_button() {
      return (
        this.successfully_created.gesangbuchlied !== null ||
        this.successfully_created.text !== null ||
        this.successfully_created.melodie !== null ||
        this.successfully_created.category_gesangbuchlied_mapping.length !==
          0 ||
        this.successfully_created.authors.length !== 0 ||
        this.successfully_created.text_author_mapping.length !== 0 ||
        this.successfully_created.melodie_author_mapping.length !== 0
      );
    },
  },
  methods: {
    see_data() {
      console.log("title", this.title);
      console.log("kategorie", this.kategorie);
      console.log("externer_link", this.externer_link);
      console.log("cloud_link", this.cloud_link);
      console.log("existing_text", this.existing_text);
      console.log("selected_text", this.selected_text);
      console.log("existing_melodie", this.existing_melodie);
      console.log("selected_melodie", this.selected_melodie);
      console.log("text", this.text);
      console.log("melodie", this.melodie);
      console.log("anmerkung", this.anmerkung);
      console.log("liednummer2000", this.liednummer2000);
      console.log("geandert", this.geandert);
    },
    get_icon(item) {
      return gesangbuch_kategorie_name_to_icon(item.title);
    },
    custom_filter(item, queryText, itemText) {
      return itemText.raw.autocomplete
        .toLowerCase()
        .includes(queryText.toLowerCase());
    },
    async delete_created_stuff() {
      if (this.successfully_created.gesangbuchlied) {
        await axios
          .delete(`${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied`, {
            data: [this.successfully_created.gesangbuchlied.id],
          })
          .then((resp) => console.log("Deleted gesangbuchlied: ", resp));
      }

      if (this.successfully_created.text) {
        await axios
          .delete(`${import.meta.env.VITE_BACKEND_URL}/items/text`, {
            data: [this.successfully_created.text.id],
          })
          .then((resp) => console.log("Deleted text: ", resp));
      }
      if (
        this.successfully_created.category_gesangbuchlied_mapping.length !== 0
      ) {
        await axios
          .delete(
            `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied_kategorie`,
            {
              data: [
                _.map(
                  this.successfully_created.category_gesangbuchlied_mapping,
                  "id",
                ),
              ],
            },
          )
          .then((resp) => console.log("Deleted autor: ", resp));
      }
      if (this.successfully_created.authors.length !== 0) {
        await axios
          .delete(`${import.meta.env.VITE_BACKEND_URL}/items/autor`, {
            data: [_.map(this.successfully_created.authors, "id")],
          })
          .then((resp) => console.log("Deleted autor: ", resp));
      }
      if (this.successfully_created.text_author_mapping.length !== 0) {
        await axios
          .delete(`${import.meta.env.VITE_BACKEND_URL}/items/text_autor`, {
            data: [_.map(this.successfully_created.text_author_mapping, "id")],
          })
          .then((resp) => console.log("Deleted text_autor: ", resp));
      }
      if (this.successfully_created.melodie) {
        await axios
          .delete(`${import.meta.env.VITE_BACKEND_URL}/items/melodie`, {
            data: [this.successfully_created.melodie.id],
          })
          .then((resp) => console.log("Deleted melodie: ", resp));
      }
      if (this.successfully_created.melodie_author_mapping.length !== 0) {
        await axios
          .delete(`${import.meta.env.VITE_BACKEND_URL}/items/melodie_autor`, {
            data: [
              _.map(this.successfully_created.melodie_author_mapping, "id"),
            ],
          })
          .then((resp) => console.log("Deleted melodie_autor: ", resp));
      }
      if (this.successfully_created.melodie_files.length !== 0) {
        await axios
          .delete(`${import.meta.env.VITE_BACKEND_URL}/items/melodie_files`, {
            data: [_.map(this.successfully_created.melodie_files, "id")],
          })
          .then((resp) => console.log("Deleted melodie_files: ", resp));
      }
    },
    async send_data() {
      // VALIDATE TEXT AUTHORS
      console.log("VALIDATE TEXT AUTHORS");
      let to_be_created_text_authors = [];
      if (!this.existing_text) {
        for (let author of this.text.authors) {
          console.log(author);
          if (!this.validate_author(author)) {
            alert("Ein Text Autor hat keinen Nachnamen.");
            return;
          }
          let to_be_created_text_author = {
            vorname: author.firstName === "" ? null : author.firstName,
            nachname: author.lastName === "" ? null : author.lastName,
            geburtsjahr: author.birthdate
              ? Number(moment(author.birthdate).format("YYYY"))
              : null,
            sterbejahr: author.deathdate
              ? Number(moment(author.deathdate).format("YYYY"))
              : null,
          };
          if (!_.every(to_be_created_text_author, (val) => val === null)) {
            to_be_created_text_author["status"] = "uploaded";
            to_be_created_text_authors.push(to_be_created_text_author);
          }
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
            geburtsjahr: author.birthdate
              ? Number(moment(author.birthdate).format("YYYY"))
              : null,
            sterbejahr: author.deathdate
              ? Number(moment(author.deathdate).format("YYYY"))
              : null,
          };
          if (!_.every(to_be_created_melodie_author, (val) => val === null)) {
            to_be_created_melodie_author["status"] = "uploaded";
            to_be_created_melodie_authors.push(to_be_created_melodie_author);
          }
        }
      }

      if (!Number.isInteger(Number(this.liednummer2000))) {
        alert("Lied Nummer 2000 ist keine Zahl.");
        this.liednummer2000 = null;
        return;
      }

      // CREATE GESANGBUCHLIED
      console.log("CREATE GESANGBUCHLIED");
      let create_gesangbuchlied = {
        titel: _.isEmpty(this.title) ? null : this.title,
        externerLink: _.isEmpty(this.externer_link) ? null : this.externer_link,
        linkCloud: _.isEmpty(this.cloud_link) ? null : this.cloud_link,
        anmerkung: _.isEmpty(this.anmerkung) ? null : this.anmerkung,
        liednummer2000: _.isEmpty(this.liednummer2000)
          ? null
          : Number(this.liednummer2000),
        einreicherName: _.isEmpty(this.einreicherName)
          ? null
          : this.einreicherName,
      };

      if (!_.every(create_gesangbuchlied, (val) => val === null)) {
        create_gesangbuchlied["melodieGeaendert"] =
          _.find(this.geandert, (elem) => elem === "melodie_geaendert") !==
          undefined;
        create_gesangbuchlied["textGeaendert"] =
          _.find(this.geandert, (elem) => elem === "text_geaendert") !==
          undefined;
        create_gesangbuchlied["status"] = "uploaded";

        console.log(create_gesangbuchlied);
        let created_gesangbuchlied = null;
        await axios
          .post(
            `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied`,
            create_gesangbuchlied,
          )
          .then((resp) => {
            console.log("created gesangbuchlied", resp.data.data);
            created_gesangbuchlied = resp.data.data;
            this.successfully_created.gesangbuchlied = resp.data.data;
            this.store.addGesangbuchlied(resp.data.data);
          });

        if (created_gesangbuchlied !== null) {
          // CREATE KATEGORIE GESANGBUCHLIED
          console.log("CREATE KATEGORIE GESANGBUCHLIED");
          let to_be_created_category_lied_mapping = [];
          for (let current_category of this.kategorie) {
            let category_lied = {
              gesangbuchlied_id: created_gesangbuchlied.id,
              kategorie_id: current_category.id,
            };
            if (!_.every(category_lied, (val) => val === null))
              to_be_created_category_lied_mapping.push(category_lied);
          }
          if (to_be_created_category_lied_mapping.length !== 0) {
            console.log(
              "to_be_created_category_lied_mapping",
              to_be_created_category_lied_mapping,
            );
            await axios
              .post(
                `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied_kategorie`,
                to_be_created_category_lied_mapping,
              )
              .then((resp) => {
                console.log(
                  "created to_be_created_category_lied_mapping",
                  resp.data.data,
                );
                this.successfully_created.category_gesangbuchlied_mapping =
                  resp.data.data;
                _.forEach(resp.data.data, (elem) =>
                  this.store.addKategorieGesangbuchlied(elem),
                );
              });
          }
        }

        // CREATE TEXT
        console.log("CREATE TEXT");
        let created_text = null;
        let created_text_authors = [];
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
            create_text["strophenEinzeln"] = _.map(
              this.text.strophen,
              (elem) => {
                return {
                  ...elem,
                  strophe: _.isEmpty(elem.strophe) ? null : elem.strophe.trim(),
                };
              },
            );

            console.log("create_text", create_text);
            await axios
              .post(
                `${import.meta.env.VITE_BACKEND_URL}/items/text`,
                create_text,
              )
              .then((resp) => {
                console.log("created text", resp.data.data);
                created_text = resp.data.data;
                this.successfully_created.text = resp.data.data;
                this.store.addText(resp.data.data);
              });

            // CREATE NEW TEXT AUTHORS
            console.log("CREATE NEW TEXT AUTHORS");
            if (
              !this.existing_text &&
              to_be_created_text_authors.length !== 0
            ) {
              console.log(
                "to_be_created_text_authors",
                to_be_created_text_authors,
              );
              await axios
                .post(
                  `${import.meta.env.VITE_BACKEND_URL}/items/autor`,
                  to_be_created_text_authors,
                )
                .then((resp) => {
                  console.log("created authors", resp.data.data);
                  created_text_authors = resp.data.data;
                  this.successfully_created.authors.push(...resp.data.data);
                  _.forEach(resp.data.data, (elem) =>
                    this.store.addAuthor(elem),
                  );
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
                  _.forEach(resp.data.data, (elem) =>
                    this.store.addTextAutor(elem),
                  );
                });
            }
          }
        }

        // CREATE MELODIE
        console.log("CREATE MELODIE");
        let created_melodie = null;
        if (!this.existing_melodie) {
          let create_melodie = {
            titel: _.isEmpty(this.melodie.title) ? null : this.melodie.title,
            quelle: _.isEmpty(this.melodie.quelle) ? null : this.melodie.quelle,
            quelllink: _.isEmpty(this.melodie.quelllink)
              ? null
              : this.melodie.quelllink,
            anmerkung: _.isEmpty(this.melodie.anmerkung)
              ? null
              : this.melodie.anmerkung,
          };

          if (!_.every(create_melodie, (val) => val === null)) {
            create_melodie["status"] = "uploaded";
            console.log("create_melodie", create_melodie);

            await axios
              .post(
                `${import.meta.env.VITE_BACKEND_URL}/items/melodie`,
                create_melodie,
              )
              .then((resp) => {
                console.log("created created_melodie", resp.data.data);
                created_melodie = resp.data.data;
                this.successfully_created.melodie = resp.data.data;
                this.store.addMelodie(resp.data.data);
              });

            // CREATE NEW MELODIE AUTHORS
            console.log("CREATE NEW MELODIE AUTHORS");
            let created_melodie_authors = [];
            if (
              !this.existing_melodie &&
              to_be_created_melodie_authors.length !== 0
            ) {
              console.log(
                "created_melodie_author",
                to_be_created_melodie_authors,
              );
              await axios
                .post(
                  `${import.meta.env.VITE_BACKEND_URL}/items/autor`,
                  to_be_created_melodie_authors,
                )
                .then((resp) => {
                  console.log("created melodie authors", resp.data.data);
                  created_melodie_authors = resp.data.data;
                  this.successfully_created.authors.push(...resp.data.data);
                  _.forEach(resp.data.data, (elem) =>
                    this.store.addAuthor(elem),
                  );
                });
            }

            // MELODIE AUTHOR N TO M MAPPING
            created_melodie_authors.push(...this.melodie.selected_authors);
            if (this.melodie.use_same_author_for_text) {
              created_melodie_authors.push(...created_text_authors);
            }

            let to_be_created_melodie_author_mapping = [];
            for (let created_author of created_melodie_authors) {
              let create_author_melodie = {
                melodie_id: created_melodie.id,
                autor_id: created_author.id,
              };
              if (!_.every(create_author_melodie, (val) => val === null))
                to_be_created_melodie_author_mapping.push(
                  create_author_melodie,
                );
            }
            if (to_be_created_melodie_author_mapping.length !== 0) {
              console.log(
                "to_be_created_melodie_author_mapping",
                to_be_created_melodie_author_mapping,
              );
              await axios
                .post(
                  `${import.meta.env.VITE_BACKEND_URL}/items/melodie_autor`,
                  to_be_created_melodie_author_mapping,
                )
                .then((resp) => {
                  console.log("created melodie_author_mapping", resp.data.data);
                  this.successfully_created.melodie_author_mapping.push(
                    ...resp.data.data,
                  );
                  _.forEach(resp.data.data, (elem) =>
                    this.store.addMelodieAutor(elem),
                  );
                });
            }

            // MELODIE TO FILE MELODIE MAPPING
            const created_files = await this.upload_file();
            let to_be_created_melodie_file_mapping = [];
            for (let created_file of created_files) {
              let create_file_melodie = {
                melodie_id: created_melodie.id,
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
                  this.successfully_created.melodie_files = resp.data.data;
                  _.forEach(resp.data.data, (elem) =>
                    this.store.addMelodieFile(elem),
                  );
                });
            }
          }
        }

        // UPDATE AUTHOR WITH TEXT AND MELODIE
        let update_gesangbuchlied = {};
        // text und melodie
        const textId = this.existing_text
          ? this.selected_text?.id
          : created_text
            ? created_text.id
            : null;
        if (textId) {
          update_gesangbuchlied["textId"] = textId;
        }
        const melodieId = this.existing_melodie
          ? this.selected_melodie?.id
          : created_melodie
            ? created_melodie.id
            : null;
        if (melodieId) {
          update_gesangbuchlied["melodieId"] = melodieId;
        }

        console.log(update_gesangbuchlied);
        if (!_.every(update_gesangbuchlied, (val) => val === null)) {
          console.log("update_gesangbuchlied", update_gesangbuchlied);
          await axios
            .patch(
              `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied/${created_gesangbuchlied.id}`,
              update_gesangbuchlied,
            )
            .then((resp) => {
              console.log("updated gesangbuchlied", resp.data.data);
              this.successfully_created.gesangbuchlied = resp.data.data;
              this.store.updateGesangbuchlied(resp.data.data);
            });
        }
      }

      // loadData again
      this.store.update_store_local();
    },
    async upload_file() {
      if (this.melodie.noten) {
        for (let file of this.melodie.noten) {
          console.log("Upload file ", file);
          const formData = new FormData();
          formData.append("title", file.name);
          formData.append("file", file);

          await axios
            .post(`${import.meta.env.VITE_BACKEND_URL}/files`, formData)
            .then((resp) => {
              this.successfully_created.created_files.push(resp.data.data);
              this.store.addFile(resp.data.data);
            });
        }
      }
      return this.successfully_created.created_files;
    },

    reset_data() {
      this.successfully_created = {
        gesangbuchlied: null,
        text: null,
        melodie: null,
        category_gesangbuchlied_mapping: [],
        authors: [],
        text_author_mapping: [],
        melodie_author_mapping: [],
        melodie_files: [],
        created_files: [],
      };

      this.title = "";
      this.kategorie = [];
      this.externer_link = "";
      this.cloud_link = "";
      this.existing_text = false;
      this.selected_text = null;
      this.existing_melodie = false;
      this.selected_melodie = null;
      this.text = {
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
      };
      this.melodie = {
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
      };
      this.anmerkung = "";
      this.liednummer2000 = null;
      this.geandert = [];
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

<style>
@media (max-width: 600px) {
  .v-expansion-panel-text__wrapper {
    padding-left: 4px !important;
    padding-right: 4px !important;
  }
}
</style>
