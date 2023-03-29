<template>
  <v-container>
    <div class="text-h4 mb-5">Nächste Deadlines</div>
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
        <v-divider vertical class="mr-5" />
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

    <v-divider class="my-10" />

    <div class="text-h4 mb-5">Kalender</div>
    <vue-cal
      style="height: 500px"
      :time-from="9 * 60"
      :time-to="19 * 60"
      :events="events"
      active-view="month"
      locale="de"
      :on-event-click="onEventClick"
    />
  </v-container>

  <v-dialog v-model="showDialog">
    <v-card style="max-width: 600px; margin: auto">
      <v-card-title class="d-flex w-md-50 justify-center bg-blue-darken-2 align-center pa-4" color="primary">
        <v-icon class="mr-3">{{ selectedEvent.icon }}</v-icon>
        <span>{{ selectedEvent.title }}</span>
        <v-spacer />
        <strong>{{
          selectedEvent.start && selectedEvent.start.format("DD/MM/YYYY")
        }}</strong>
      </v-card-title>
      <v-card-text class="px-12">
        <p v-html="selectedEvent.contentFull" />
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

import { mapStores } from "pinia";
import { useAppStore } from "@/store/app";

import VueCal from "vue-cal";
import "vue-cal/dist/vuecal.css";

export default {
  components: { VueCal },
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
  created() {},
  computed: {
    ...mapStores(useAppStore),
    events() {
      console.log(this.db_events);
      let test = _.map(this.db_events, (event) => {
        return {
          start: new Date(event.start),
          end: new Date(event.ende),
          class: event.arbeitskreisId,
          title: event.titel,
          contentFull: event.bemerkung,
          icon: "mdi-calendar-blank",
        };
      });
      console.log(test);
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
      console.log(event);

      this.selectedEvent = event;
      this.showDialog = true;

      // Prevent navigating to narrower view (default vue-cal behavior).
      e.stopPropagation();
    },
  },
};
</script>
