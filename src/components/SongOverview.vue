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
    locale="de"
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
                v-if="admin && admin_ansicht"
                v-model="selected_status"
                :items="status_list"
                label="Filter Status nach"
                class="w-100 me-5"
                hide-details
                clearable
                single-line/>

              <v-checkbox
                v-if="admin && admin_ansicht"
                v-model="selected_aenderung"
                label="Hat Änderungen"
                style="min-width: 158px"
                hide-details
                single-line>
              </v-checkbox>

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
import {useUserStore} from "@/store/user";

import GesangbuchLiedComponent from "@/components/SongRelated/GesangbuchLiedComponent.vue";
import _ from "lodash"
import {gesangbuch_kategorie_name_to_icon, rang_to_color, status_mapping} from "@/assets/js/utils";

export default {
  name: "SongOverview",
  components: {GesangbuchLiedComponent},
  mounted() {

    if (this.$route.query.filter_kategorie) {
      this.kategorie = [{name: this.$route.query.filter_kategorie}];
      this.filter_expanded = ['filter_expanded'];
    }
  },
  data: () => ({
    selected_status: null,
    kategorie: null,
    filter_expanded: false,
    search: null,
    song_dialog: false,
    selected_song: null,
    selected_aenderung: false,
    filter: [],
    store: useAppStore(),
    userStore: useUserStore(),
  }),
  computed: {
    headers() {
      let headers = [
        {title: "Titel", align: "start", key: "gesangbuch_titel"},
        {title: "Text Titel", align: "start", key: "text_titel"},
        {title: "Text Auftrag", align: "center", key: "text_work_order"},
        {title: "Melodie Titel", align: "start", key: "melodie_titel"},
        {title: "Melodie Auftrag", align: "center", key: "melodie_work_order"},
        {title: "Strophe", align: "start", key: "text.strophen_connected_short"},
      ]
      if (this.admin && this.admin_ansicht) {
        // Berwertung kleiner kreis
        headers.push({
          title: "Bewertung",
          align: "center",
          key: "bewertung_kleiner_kreis",
          sort: (a, b) => a?.rangfolge - b?.rangfolge
        });
      }
      return headers
    },
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

      console.log(this.gesangbuchlieder)

      let filtered_gesangbuchlied = _.filter(this.gesangbuchlieder, (elem) =>
        this.selected_status == null || (this.selected_status && status_mapping[elem["status"]] === this.selected_status));

      // filter by selected_aenderung
      if (this.selected_aenderung) {
        filtered_gesangbuchlied = _.filter(filtered_gesangbuchlied, (elem) => (
          elem.liedHatAenderung
        ))
      }

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
    admin() {
      return this.userStore.is_kleiner_kreis
    },
    admin_ansicht() {
      return this.userStore.is_kleiner_kreis_ansicht
    }
  },
  methods: {
    rowClick(item, value) {
      this.song_dialog = true;
      this.selected_song = value.item.raw;
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
