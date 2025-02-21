<template>
  <div>
    <div class="text-h4 mb-5">Bereits eingetragene Gesangbuchlieder</div>
  </div>

  <v-data-table
    style="min-height: 600px"
    :headers="headers"
    :items="filtered_gesangbuchlieder"
    :search="search"
    locale="de"
    @click:row="rowClick"
  >
    <template #top>
      <div class="d-flex align-center">
        <v-text-field
          v-model="search"
          single-line
          prepend-icon="mdi-magnify"
          label="Suche"
          hide-details
          class="pa-4"
        ></v-text-field>
        <v-btn
          icon="mdi-filter-variant"
          :color="filter_expanded ? 'primary' : null"
          class="my-4"
          @click="filter_expanded = !filter_expanded"
        ></v-btn>
      </div>
      <v-expand-transition v-show="filter_expanded">
        <v-card class="mb-5">
          <v-card-title>
            <div class="d-flex justify-space-between align-center">
              <div>Filter</div>
              <div class="d-flex ga-2">
                <v-tooltip text="Filter Zurücksetzen" location="left">
                  <template #activator="{ props }">
                    <div v-bind="props">
                      <v-btn
                        icon
                        variant="text"
                        height="36"
                        width="36"
                        class="pa-0"
                        @click="resetFilter"
                      >
                        <v-icon>mdi-filter-remove</v-icon>
                      </v-btn>
                    </div>
                  </template>
                </v-tooltip>

                <v-tooltip
                  v-if="admin && admin_ansicht"
                  text="Share filter"
                  location="left"
                >
                  <template #activator="{ props }">
                    <div v-bind="props">
                      <v-btn
                        icon
                        variant="text"
                        height="36"
                        width="36"
                        class="pa-0"
                        @click="copyFilterIntoLink"
                      >
                        <v-icon>mdi-link-variant</v-icon>
                      </v-btn>
                    </div>
                  </template>
                </v-tooltip>
              </div>
            </div>
          </v-card-title>
          <v-card-text>
            <div class="d-flex align-center mb-4">
              <v-text-field
                v-model="strophenSearch"
                single-line
                prepend-inner-icon="mdi-magnify"
                e="mdi-magnify"
                label="Strophen Suche"
                hide-details
              ></v-text-field>
            </div>

            <div v-if="admin && admin_ansicht" class="d-flex align-center mb-4">
              <!-- Select vuetify element if admin is true that has status as values -->

              <v-select
                v-model="selected_bewertung"
                :items="bewertungen"
                prepend-inner-icon="mdi-list-status"
                label="Filter Bewertung nach"
                class="w-100 me-5"
                hide-details
                clearable
                single-line
              />

              <v-select
                v-model="selected_status"
                prepend-inner-icon="mdi-check"
                :items="status_list"
                label="Filter Status nach"
                class="w-100 me-5"
                hide-details
                clearable
                single-line
              />

              <v-checkbox
                v-model="selected_aenderung"
                label="Hat Änderungen"
                style="min-width: 158px"
                hide-details
                single-line
              >
              </v-checkbox>
            </div>

            <div class="d-flex align-center mb-4">
              <v-autocomplete
                v-model="selected_author"
                prepend-inner-icon="mdi-account"
                :items="authors"
                item-value="id"
                item-title="name"
                label="Filter nach Autor"
                class="w-100 me-5"
                hide-details
                clearable
                multiple
                single-line
              />

              <v-select
                v-model="check_autor_copyright"
                label="Autor/Copyright prüfen"
                prepend-inner-icon="mdi-copyright"
                :items="[
                  { title: 'Zu prüfen', value: true },
                  { title: 'Geprüft', value: false },
                ]"
                class="w-100"
                hide-details
                clearable
                single-line
              />
            </div>

            <div class="d-flex align-center mb-4">
              <v-autocomplete
                v-model="kategorie"
                prepend-inner-icon="mdi-tag"
                label="Zugehörige Kategorie"
                class="me-3"
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

              <v-btn-toggle
                v-model="filter"
                variant="outlined"
                multiple
                color="primary"
              >
                <v-tooltip
                  text="Nur Gesangbuchlieder mit Textvorschlägen anzeigen."
                  location="bottom"
                >
                  <template #activator="{ props }">
                    <v-btn v-bind="props" value="suggestions">
                      <v-icon color="primary">mdi-text-box-edit</v-icon>
                    </v-btn>
                  </template>
                </v-tooltip>
                <v-tooltip
                  text="Nur Gesangbuchlieder mit Anmerkung anzeigen."
                  location="bottom"
                >
                  <template #activator="{ props }">
                    <v-btn v-bind="props" value="remarks">
                      <v-icon color="primary">mdi-message</v-icon>
                    </v-btn>
                  </template>
                </v-tooltip>
              </v-btn-toggle>
            </div>
            <!-- Drop down with multi select  -->
            <v-select
              :model-value="visible_selected_columns"
              chips
              label="Angezeigte Tabellenspalten"
              :items="possible_columns"
              multiple
              @update:model-value="selected_columns = $event"
            ></v-select>
          </v-card-text>
        </v-card>
      </v-expand-transition>
    </template>

    <template #[`item.gesangbuch_titel`]="{ value }">
      <span v-if="value !== 'null'">
        {{ value }}
      </span>
      <span v-else>
        <!--  <keine Angaben>      -->
        &lt;keine Angaben&gt;
      </span>
    </template>
    <template #[`item.text_titel`]="{ item }">
      <v-tooltip
        v-if="item.titel === item.text_titel"
        text="Wie Liedtitel"
        location="bottom"
      >
        <template #activator="{ props }">
          <v-icon icon="mdi-arrow-left" v-bind="props" />
        </template>
      </v-tooltip>

      <v-tooltip
        v-else-if="undefined === item.text_titel"
        text="Keine Text oder Text-Titel"
        location="bottom"
      >
        <template #activator="{ props }">
          <v-icon icon="mdi-alert-circle-outline" v-bind="props" color="grey" />
        </template>
      </v-tooltip>

      <span v-else>{{ item.text_titel }}</span>
    </template>
    <template #[`item.melodie_titel`]="{ item }">
      <v-tooltip
        v-if="item.titel === item.melodie_titel"
        text="Wie Liedtitel"
        location="bottom"
      >
        <template #activator="{ props }">
          <v-icon icon="mdi-arrow-left" v-bind="props" />
        </template>
      </v-tooltip>

      <v-tooltip
        v-else-if="undefined === item.melodie_titel"
        text="Keine Melodie oder Melodie-Titel"
        location="bottom"
      >
        <template #activator="{ props }">
          <v-icon icon="mdi-alert-circle-outline" v-bind="props" color="grey" />
        </template>
      </v-tooltip>

      <span v-else>{{ item.melodie_titel }}</span>
    </template>

    <template #[`item.text_work_order`]="{ item }">
      <v-tooltip
        :text="
          item.text_work_order ? 'Text Arbeitsauftrag' : 'Keinen Arbeitsauftrag'
        "
        location="bottom"
      >
        <template #activator="{ props }">
          <v-icon
            v-if="item.text_work_order"
            :icon="
              item.text_work_order === 2 ? 'mdi-file-document' : 'mdi-check'
            "
            v-bind="props"
            :color="item.text_work_order ? 'primary' : 'success'"
          />
        </template>
      </v-tooltip>
    </template>
    <template #[`item.melodie_work_order`]="{ item }">
      <v-tooltip
        :text="
          item.melodie_work_order
            ? 'Melodie Arbeitsauftrag'
            : 'Keinen Arbeitsauftrag'
        "
        location="bottom"
      >
        <template #activator="{ props }">
          <v-icon
            v-if="item.melodie_work_order"
            :icon="item.melodie_work_order === 2 ? 'mdi-music' : 'mdi-check'"
            v-bind="props"
            :color="item.melodie_work_order ? 'primary' : 'success'"
          />
        </template>
      </v-tooltip>
    </template>
    <template #[`item.bewertung_kleiner_kreis`]="{ item }">
      <BewerungKleinerKreisDatatableEntry :item="item" />
    </template>
  </v-data-table>

  <v-dialog v-model="song_dialog" width="700" @close="modalClose">
    <GesangbuchLiedComponent
      :selected-song="selected_song"
      @close="song_dialog = false"
    />
  </v-dialog>

  <v-snackbar v-model="snackbar" :timeout="3000">
    {{ snackbar_message }}

    <template #actions>
      <v-btn color="pink" variant="text" @click="snackbar = false">
        Close
      </v-btn>
    </template>
  </v-snackbar>
</template>
<script>
import { useAppStore } from "@/store/app";
import { useUserStore } from "@/store/user";

import GesangbuchLiedComponent from "@/components/SongRelated/GesangbuchLiedComponent.vue";
import _ from "lodash";
import {
  gesangbuch_kategorie_name_to_icon,
  status_mapping,
} from "@/assets/js/utils";
import BewerungKleinerKreisDatatableEntry from "@/components/BewerungKleinerKreisDatatableEntry.vue";

export default {
  name: "SongOverview",
  components: { BewerungKleinerKreisDatatableEntry, GesangbuchLiedComponent },
  data: () => ({
    selected_columns: [
      "Titel",
      "Text Titel",
      "Text Auftrag",
      "Melodie Titel",
      "Melodie Auftrag",
      "Strophe",
    ],
    snackbar: false,
    snackbar_message: "",
    selected_bewertung: null,
    selected_author: null,
    selected_status: null,
    kategorie: null,
    filter_expanded: false,
    search: null,
    strophenSearch: null,
    song_dialog: false,
    selected_song: null,
    selected_aenderung: false,
    filter: [],
    store: useAppStore(),
    userStore: useUserStore(),
    check_autor_copyright: null,
  }),
  computed: {
    possible_columns() {
      let columns = [
        "Titel",
        "Text Titel",
        "Text Auftrag",
        "Melodie Titel",
        "Melodie Auftrag",
        "Strophe",
        "Text Autor",
        "Musik Autor",
      ];
      if (this.admin && this.admin_ansicht) {
        columns.push("Bewertung");
      }
      return columns;
    },
    visible_selected_columns() {
      return this.selected_columns.filter((column) =>
        this.possible_columns.includes(column),
      );
    },
    headers() {
      let headers = [];
      if (this.selected_columns.includes("Titel")) {
        headers.push({
          title: "Titel",
          align: "start",
          key: "gesangbuch_titel",
        });
      }

      if (this.selected_columns.includes("Text Titel"))
        headers.push({
          title: "Text Titel",
          align: "start",
          key: "text_titel",
          sort: (a, b) =>
            (a === undefined ? "" : a).localeCompare(b === undefined ? "" : b),
        });
      if (this.selected_columns.includes("Text Auftrag"))
        headers.push({
          title: "Text Auftrag",
          align: "center",
          key: "text_work_order",
        });
      if (this.selected_columns.includes("Melodie Titel"))
        headers.push({
          title: "Melodie Titel",
          align: "start",
          key: "melodie_titel",
          sort: (a, b) =>
            (a === undefined ? "" : a).localeCompare(b === undefined ? "" : b),
        });
      if (this.selected_columns.includes("Melodie Auftrag"))
        headers.push({
          title: "Melodie Auftrag",
          align: "center",
          key: "melodie_work_order",
        });
      if (this.selected_columns.includes("Strophe"))
        headers.push({
          title: "Strophe",
          align: "start",
          key: "text.strophen_connected_short",
        });

      if (this.selected_columns.includes("Text Autor"))
        headers.push({
          title: "Text Autor",
          align: "start",
          key: "text.author_name",
        });
      if (this.selected_columns.includes("Musik Autor"))
        headers.push({
          title: "Musik Autor",
          align: "start",
          key: "melodie.author_name",
        });

      if (
        this.admin &&
        this.admin_ansicht &&
        this.selected_columns.includes("Bewertung")
      ) {
        // Berwertung kleiner kreis
        headers.push({
          title: "Bewertung",
          align: "center",
          key: "bewertung_kleiner_kreis",
          sort: (a, b) => a?.rangfolge - b?.rangfolge,
        });
      }
      return headers;
    },
    gesangbuchlieder() {
      return this.store.gesangbuchlieder;
    },
    authors() {
      return this.store.used_authors;
    },
    status_list() {
      // return unique status from all songs
      return _.uniq(
        _.map(
          this.gesangbuchlieder,
          (elem) => status_mapping[elem["status"]],
        ).filter((status) => _.isEmpty(status) === false),
      );
    },
    bewertungen() {
      // return unique status from all songs
      return _.uniq(
        _.map(
          this.gesangbuchlieder,
          (song) => song["bewertung_kleiner_kreis"].bezeichner,
        ),
      );
    },
    filtered_gesangbuchlieder() {
      let filtered_gesangbuchlied = _.filter(
        this.gesangbuchlieder,
        (elem) =>
          this.selected_status == null ||
          (this.selected_status &&
            status_mapping[elem["status"]] === this.selected_status),
      );

      if (this.selected_bewertung) {
        filtered_gesangbuchlied = _.filter(
          filtered_gesangbuchlied,
          (elem) =>
            elem["bewertung_kleiner_kreis"].bezeichner ===
            this.selected_bewertung,
        );
      }

      if (this.selected_author && this.selected_author.length > 0) {
        filtered_gesangbuchlied = _.filter(filtered_gesangbuchlied, (elem) =>
          _.some(elem.authors, (author) =>
            this.selected_author.includes(author.id),
          ),
        );
      }

      // filter by selected_aenderung
      if (this.selected_aenderung) {
        filtered_gesangbuchlied = _.filter(
          filtered_gesangbuchlied,
          (elem) => elem.liedHatAenderung,
        );
      }

      filtered_gesangbuchlied = _.filter(
        filtered_gesangbuchlied,
        (elem) =>
          !this.filter_by_suggestions ||
          _.some(elem?.text?.strophenEinzeln, (obj) => {
            return (
              _.has(obj, "aenderungsvorschlag") &&
              !_.isEmpty(obj.aenderungsvorschlag)
            );
          }),
      );

      if (this.filter_by_remarks) {
        filtered_gesangbuchlied = _.filter(
          filtered_gesangbuchlied,
          (elem) =>
            !this.filter_by_remarks ||
            _.some(elem?.text?.strophenEinzeln, (obj) => {
              return _.has(obj, "anmerkung") && !_.isEmpty(obj.anmerkung);
            }),
        );
      }

      // get kategorie names
      const selected_kategorie_names = _.map(this.kategorie, "name");

      if (selected_kategorie_names.length > 0) {
        filtered_gesangbuchlied = _.filter(
          filtered_gesangbuchlied,
          (elem) =>
            !selected_kategorie_names.length ||
            _.every(selected_kategorie_names, (obj) => {
              return _.some(
                elem?.kategories,
                (kategorie) => kategorie.kategorie_name.name === obj,
              );
            }),
        );
      }

      if (this.strophenSearch) {
        filtered_gesangbuchlied = _.filter(filtered_gesangbuchlied, (elem) => {
          return elem.strophen_connected?.includes(
            this.strophenSearch.toLowerCase(),
          );
        });
      }

      // Update the autor_oder_copyright_checken filter
      if (this.check_autor_copyright !== null) {
        filtered_gesangbuchlied = _.filter(
          filtered_gesangbuchlied,
          (elem) =>
            elem.autor_oder_copyright_checken === this.check_autor_copyright,
        );
      }

      return filtered_gesangbuchlied;
    },
    filter_by_remarks() {
      return this.filter.includes("remarks");
    },
    filter_by_suggestions() {
      return this.filter.includes("suggestions");
    },
    admin() {
      return this.userStore.is_kleiner_kreis;
    },
    admin_ansicht() {
      return this.userStore.is_kleiner_kreis_ansicht;
    },
  },
  watch: {
    selected_columns(newValue) {
      localStorage.setItem("selected_columns", JSON.stringify(newValue));
    },
    song_dialog: function (newValue) {
      if (!newValue) {
        this.$router.replace(`/gesangbuchlieder`);
        document.title = "Gesangbuch 2026";
      }
    },
  },
  mounted() {
    if (this.$route.query.filter_kategorie) {
      this.kategorie = [{ name: this.$route.query.filter_kategorie }];
      this.filter_expanded = ["filter_expanded"];
    }

    // get selected columns from local storage
    if (localStorage.getItem("selected_columns")) {
      this.selected_columns = JSON.parse(
        localStorage.getItem("selected_columns"),
      );
    } else {
      // check for admin
      if (this.admin && this.admin_ansicht) {
        this.selected_columns.push("Bewertung");
      }
    }

    if (this.$route.params.id) {
      this.selected_song = _.find(this.gesangbuchlieder, {
        id: parseInt(this.$route.params.id),
      });
      console.log(this.selected_song);
      this.song_dialog = true;
    }
  },
  methods: {
    resetFilter() {
      this.selected_status = null;
      this.selected_bewertung = null;
      this.selected_aenderung = false;
      this.kategorie = null;
      this.filter_by_suggestions = false;
      this.filter_by_remarks = false;
      this.selected_author = null;
      this.strophenSearch = null;
      this.check_autor_copyright = null;
    },
    copyFilterIntoLink() {
      const appliedFilter = {};
      if (this.strophenSearch)
        appliedFilter.strophenSearch = this.strophenSearch;
      if (this.selected_status)
        appliedFilter.selected_status = this.selected_status;
      if (this.selected_bewertung)
        appliedFilter.selected_bewertung = this.selected_bewertung;
      if (this.selected_aenderung)
        appliedFilter.selected_aenderung = this.selected_aenderung;
      if (this.kategorie) appliedFilter.kategorie = this.kategorie;
      if (this.filter_by_suggestions)
        appliedFilter.filter_by_suggestions = this.filter_by_suggestions;
      if (this.filter_by_remarks)
        appliedFilter.filter_by_remarks = this.filter_by_remarks;
      if (this.selected_author)
        appliedFilter.selected_author = this.selected_author;
      if (this.check_autor_copyright !== null)
        appliedFilter.check_autor_copyright = this.check_autor_copyright;

      if (Object.keys(appliedFilter).length === 0) {
        this.snackbar_message = "Wähle zuerst einen filter an.";
        this.snackbar = true;
        return;
      }

      const jsonString = JSON.stringify(appliedFilter);
      const base64String = btoa(jsonString);
      const url = `${window.location.origin}/korrektur-lesung?filter=${base64String}`;

      navigator.clipboard.writeText(url).then(
        () => {
          this.snackbar_message = "Filter wurde kopiert";
          this.snackbar = true;
        },
        (err) => {
          this.snackbar_message = `Ein fehler ist beim kopieren des links aufgetreten: ${url}`;
          this.snackbar = true;
          console.error(err);
        },
      );
    },
    rowClick(item, value) {
      this.song_dialog = true;
      this.selected_song = value.item;
      this.$router.replace(`/gesangbuchlieder/${this.selected_song.id}`);
      // set tab title to song title
      document.title = this.selected_song.gesangbuch_titel;
    },
    modalClose() {
      this.song_dialog = false;
      this.selected_song = null;
      console.log("modal closed");
      // revert tab title
      document.title = "Gesangbuch 2026";
    },
    get_icon(item) {
      return gesangbuch_kategorie_name_to_icon(item.titel);
    },
  },
};
</script>

<style>
i.mdi-circle.mdi.v-icon.notranslate.v-theme--light.v-icon--size-default:before {
  color: #9595ff;
}

.v-data-table__tr:hover {
  background-color: #cbd5e1;
}

.v-data-table__td {
  background-color: transparent !important;
}
</style>
