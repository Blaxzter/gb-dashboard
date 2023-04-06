<template>
  <v-container>
    <div class="text-h4 mb-5">Nächste Meilenstein ersetzen</div>
    <div v-for="event in filteredEvents" :key="event.id" class="mb-4">
      <div
        class="border rounded d-flex pa-3"
        :style="
          event.type === 'deadline'
            ? 'border: 1px solid red !important;'
            : 'border: 1px solid black ; '
        "
      >
        <div class="d-flex justify-center align-center mr-5 ml-2">
          <v-icon
            v-if="event.type === 'deadline'"
            icon="mdi-lightning-bolt"
            color="red"
          />
          <v-icon
            v-else-if="event.type === 'normal'"
            icon="mdi-calendar-blank"
          />
        </div>
        <v-divider vertical class="mr-5"/>
        <div>
          <div class="text-h6">
            {{ event.name }}
          </div>
          <div class="text-caption mb-1">Termin: {{ toDate(event.date) }}</div>
          <div class="text-body-1">
            {{ event.description }}
          </div>
        </div>
      </div>
    </div>

    <v-divider class="my-10"/>

    <div class="text-h4 mb-5">Kalender</div>
    <vue-cal
      style="height: 535px"
      :time-from="9 * 60"
      :time-to="19 * 60"
      :events="events"
      active-view="week"
      locale="de"
      :on-event-click="onEventClick"
      :show-all-day-events="true"
      :events-on-month-view="'short'"
    />
  </v-container>

  <v-dialog v-model="showDialog">
    <v-card style="max-width: 600px; margin: auto">
      <v-card-title class="d-flex w-md-50 justify-center bg-blue-darken-2 align-center pa-4" color="primary">
        <v-icon class="mr-3">{{ selectedEvent.icon }}</v-icon>
        <span>{{ selectedEvent.title }}</span>
        <v-spacer/>
        <strong>{{
            selectedEvent.start && selectedEvent.start.format("DD/MM/YYYY")
          }}</strong>
      </v-card-title>
      <v-card-text class="px-12">
        <p v-html="selectedEvent.contentFull"/>
        <strong>Event details:</strong>
        <ul>
          <li>
            Event starts at:
            {{ selectedEvent.start && selectedEvent.start.formatTime() }}
          </li>
          <li>
            Event ends at:
            {{ selectedEvent.end && selectedEvent.end.formatTime() }}
          </li>
        </ul>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
// https://antoniandre.github.io/vue-cal/?ref=madewithvuejs.com

import _ from "lodash";

import {mapStores} from "pinia";
import {useAppStore} from "@/store/app";

import VueCal from "vue-cal";
import "vue-cal/dist/vuecal.css";
import moment from "moment";

export default {
  components: {VueCal},
  data: () => ({
    date: null,
    showDialog: false,
    store: useAppStore(),
    list_events: [
      {
        id: 1,
        date: 1679984928,
        name: "Dashboard Creation",
        description: "Startschuss für die Erstellung des Dashboards.",
        type: "normal",
      },
      {
        id: 2,
        date: 1680192000,
        name: "Dashboard Deadline",
        description: "IT Task, damit das Dashboard chique ist.",
        type: "deadline",
      },
    ],
  }),
  created() {
  },
  computed: {
    ...mapStores(useAppStore),
    events() {
      let test = _.map(this.db_events, (event) => {
        let event_start = event.start;
        let event_end = event.ende;

        return {
          start: moment(event.start).format(event_start === event_end ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'),
          end: moment(event.ende).format(event_start === event_end ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'),
          allDay: event_start === event_end,
          class: event.arbeitskreis_name?.replace(' ', '_').toLowerCase(),
          title: event.titel,
          contentFull: event.bemerkung,
          icon: "mdi-calendar-blank",
        };
      });
      return test;
    },
    db_events() {
      return this.store.termine;
    },
    filteredEvents() {
      return this.list_events;
    },
  },
  methods: {
    toDate(unix_timestamp) {
      return new Date(unix_timestamp * 1000).toLocaleDateString("de");
    },
    onEventClick(event, e) {
      this.selectedEvent = event;
      this.showDialog = true;

      // Prevent navigating to narrower view (default vue-cal behavior).
      e.stopPropagation();
    },
  },
};
</script>

<style>
.vuecal_event {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.text {
  background-color: #D7BDE2;
  color: #9B59B6;
}

.melodie {
  background-color: #7ca89f;
  color: #16A085;
}

.jugend {
  background-color: #FAD7A0;
  color: #F39C12;
}

.kinder {
  background-color: #E59866;
  color: #C0392B;
}

.it {
  background-color: #AED6F1;
  color: #3498DB;
}

.kleiner_kreis {
  background-color: #86E2D5;
  color: #27AE60;
}

.allgemein {
  background-color: #F5B7B1;
  color: #E74C3C;
}
</style>
