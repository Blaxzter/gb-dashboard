<template>
  <div>
    <div class="text-h4 mb-5">Bereits eingetragene Gesangbuchlieder</div>
  </div>

  <v-data-table
    style="min-height: 600px"
    :headers="headers"
    :items="filtered_gesangbuchlieder"
    item-key="id"
    @click:row="rowClick"
    :search="search"
  >
    <template v-slot:top>
      <div class="d-flex align-center">
        <v-text-field
          v-model="search"
          single-line
          prepend-icon="mdi-magnify"
          label="Suche"
          hide-details
          class="pa-4"
        ></v-text-field>
        <v-btn icon="mdi-filter-variant" :color="filter_expanded ? 'primary' : null" class="my-4"
               @click="filter_expanded = !filter_expanded"></v-btn>
      </div>
      <v-expand-transition v-show="filter_expanded">
        <v-card title="Filter" class="mb-5">
          <v-card-text>
            <div class="d-flex align-center mb-4">
              <!-- Select vuetify element if admin is true that has status as values -->
              <v-select
                v-if="admin"
                v-model="selected_status"
                :items="status_list"
                label="Filter Status nach"
                hide-details
                clearable
                single-line/>
            </div>
            <div class="d-flex align-center">
              <v-autocomplete
                label="Zugehörige Kategorie"
                class="me-3"
                :items="this.store.kategorie"
                item-title="name"
                item-value="id"
                hide-details="auto"
                return-object
                multiple
                chips
                closable-chips
                v-model="kategorie"
              >
                <template v-slot:chip="{ props, item }">
                  <v-chip
                    v-bind="props"
                    :prepend-icon="get_icon(item)"
                    :text="item.raw.name"
                  ></v-chip>
                </template>

                <template v-slot:item="{ props, item }">
                  <v-list-item
                    v-bind="props"
                    :prepend-icon="get_icon(item)"
                    :title="item?.raw?.name"
                  ></v-list-item>
                </template>
              </v-autocomplete>

              <v-btn-toggle v-model="filter" variant="outlined" multiple color="primary">
                <v-tooltip text="Nur Gesangbuchlieder mit Textvorschlägen anzeigen." location="bottom">
                  <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" value="suggestions">
                      <v-icon color="primary">mdi-text-box-edit</v-icon>
                    </v-btn>
                  </template>
                </v-tooltip>
                <v-tooltip text="Nur Gesangbuchlieder mit Anmerkung anzeigen." location="bottom">
                  <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" value="remarks">
                      <v-icon color="primary">mdi-message</v-icon>
                    </v-btn>
                  </template>
                </v-tooltip>
              </v-btn-toggle>

            </div>
          </v-card-text>
        </v-card>
      </v-expand-transition>

    </template>

    <template v-slot:[`item.text_titel`]="{ item }">
      <v-tooltip text="Wie Liedtitel" location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon icon="mdi-arrow-left" v-bind="props" v-if="item.props.title.titel === item.props.title.text_titel"/>
          <span v-else>{{ item.props.title.text_titel }}</span>
        </template>
      </v-tooltip>
    </template>
    <template v-slot:[`item.melodie_titel`]="{ item }">
      <v-tooltip text="Wie Liedtitel" location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon icon="mdi-arrow-left" v-bind="props"
                  v-if="item.props.title.titel === item.props.title.melodie_titel"/>
          <span v-else>{{ item.props.title.melodie_titel }}</span>
        </template>
      </v-tooltip>
    </template>

    <template v-slot:[`item.text_work_order`]="{ item }">
      <v-tooltip :text="item.props.title.text_work_order ? 'Text Arbeitsauftrag' : 'Keinen Arbeitsauftrag'"
                 location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon v-if="item.props.title.text_work_order"
                  :icon="item.props.title.text_work_order === 2 ? 'mdi-file-document' : 'mdi-check'" v-bind="props"
                  :color="item.props.title.text_work_order ? 'primary' : 'success'"/>
        </template>
      </v-tooltip>
    </template>
    <template v-slot:[`item.melodie_work_order`]="{ item }">
      <v-tooltip :text="item.props.title.melodie_work_order ? 'Melodie Arbeitsauftrag' : 'Keinen Arbeitsauftrag'"
                 location="bottom">
        <template v-slot:activator="{ props }">
          <v-icon v-if="item.props.title.melodie_work_order"
                  :icon="item.props.title.melodie_work_order === 2 ? 'mdi-music' : 'mdi-check'" v-bind="props"
                  :color="item.props.title.melodie_work_order ? 'primary' : 'success'"/>
        </template>
      </v-tooltip>
    </template>
    <template v-slot:[`item.bewertung_kleiner_kreis`]="{ item }">
      <div :style="{'color': rang_to_color[item.props.title.bewertung_kleiner_kreis?.rangfolge]}">
        <span v-if="item.props.title.bewertung_kleiner_kreis?.bezeichner">
          <v-icon icon="mdi-music" size="tiny"/> {{ item.props.title.bewertung_kleiner_kreis?.bezeichner }}
        </span>
      </div>
      <div :style="{'color': rang_to_color[item.props.title.text?.bewertung_kleiner_kreis?.rangfolge]}">
        <span v-if="item.props.title.text?.bewertung_kleiner_kreis?.bezeichner">
          <v-icon icon="mdi-text-box" size="tiny"/> {{ item.props.title.text?.bewertung_kleiner_kreis?.bezeichner }}
        </span>
      </div>
      <div :style="{'color': rang_to_color[item.props.title.melodie?.bewertung_kleiner_kreis?.rangfolge]}">
        <span v-if="item.props.title.melodie?.bewertung_kleiner_kreis?.bezeichner">
          <v-icon icon="mdi-music-note"
                  size="tiny"/> {{ item.props.title.melodie?.bewertung_kleiner_kreis?.bezeichner }}
        </span>
      </div>
    </template>
  </v-data-table>

  <v-dialog v-model="song_dialog" width="700">
    <GesangbuchLiedComponent :selected_song="selected_song" @close="song_dialog = false"/>
  </v-dialog>
</template>
<script>
import {useAppStore} from "@/store/app";
import GesangbuchLiedComponent from "@/components/SongRelated/GesangbuchLiedComponent.vue";

import _ from "lodash"
import {gesangbuch_kategorie_name_to_icon, rang_to_color, status_mapping} from "@/assets/js/utils";

export default {
  name: "SongOverview",
  components: {GesangbuchLiedComponent},
  mounted() {
    // if route contains ?ansicht=kleiner_kreis then set admin to true
    this.admin = this.$route.query.ansicht === "kleiner_kreis";

    if (this.$route.query.filter_kategorie) {
      this.kategorie = [{name: this.$route.query.filter_kategorie}];
      this.filter_expanded = ['filter_expanded'];
      console.log(this.kategorie)
    }

    if (this.admin) {
      // Berwertung kleiner kreis
      this.headers.push({
        title: "Bewertung",
        align: "center",
        key: "bewertung_kleiner_kreis",
        sort: (a, b) => a?.rangfolge - b?.rangfolge
      });
    }
  },
  data: () => ({
    selected_status: null,
    kategorie: null,
    filter_expanded: false,
    admin: false,
    search: null,
    song_dialog: false,
    selected_song: null,
    filter: [],
    store: useAppStore(),
    headers: [
      {title: "Title", align: "start", key: "gesangbuch_titel"},
      {title: "Text Title", align: "start", key: "text_titel"},
      {title: "Text Auftrag", align: "center", key: "text_work_order"},
      {title: "Melodie Title", align: "start", key: "melodie_titel"},
      {title: "Melodie Auftrag", align: "center", key: "melodie_work_order"},
      {title: "Strophe", align: "start", key: "text.strophen_connected_short"},
    ],
  }),
  computed: {
    rang_to_color() {
      return rang_to_color
    },
    gesangbuchlieder() {
      return this.store.gesangbuchlieder;
    },
    status_list() {
      // return unique status from all songs
      return _.uniq(_.map(this.gesangbuchlieder, elem => status_mapping[elem["status"]]));
    },
    filtered_gesangbuchlieder() {

      let filtered_gesangbuchlied = _.filter(this.gesangbuchlieder, (elem) =>
        this.selected_status == null || (this.selected_status && status_mapping[elem["status"]] === this.selected_status));

      filtered_gesangbuchlied = _.filter(filtered_gesangbuchlied, (elem) => (
        !this.filter_by_suggestions ||
        _.some(elem?.text?.strophenEinzeln, obj => {
          return _.has(obj, 'aenderungsvorschlag') && !_.isEmpty(obj.aenderungsvorschlag)
        }))
      )

      filtered_gesangbuchlied = _.filter(filtered_gesangbuchlied, (elem) => (
        !this.filter_by_remarks ||
        _.some(elem?.text?.strophenEinzeln, obj => {
          return _.has(obj, 'anmerkung') && !_.isEmpty(obj.anmerkung)
        }))
      )

      // get kategorie names
      const selected_kategorie_names = _.map(this.kategorie, 'name')
      console.log(selected_kategorie_names)

      filtered_gesangbuchlied = _.filter(filtered_gesangbuchlied, (elem) => (
        !selected_kategorie_names.length ||
        _.every(selected_kategorie_names, obj => {
          return _.some(elem?.kategories, kategorie => kategorie.kategorie_name.name === obj)
        }))
      )

      return filtered_gesangbuchlied
    },
    filter_by_remarks() {
      return this.filter.includes('remarks')
    },
    filter_by_suggestions() {
      return this.filter.includes('suggestions')
    },
  },
  methods: {
    rowClick(item, value) {
      this.song_dialog = true;
      this.selected_song = value.item.raw;
      console.log(this.selected_song)
    },
    get_icon(item) {
      return gesangbuch_kategorie_name_to_icon(item.title)
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
