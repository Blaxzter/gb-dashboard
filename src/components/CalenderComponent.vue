<template>
  <MeilenSteineComponent :events="meilenstein_event" />

  <v-divider class="my-10" />

  <div class="text-h4 mb-5">Kalender</div>
  <vue-cal
    style="height: 535px"
    :time-from="9 * 60"
    :time-to="19 * 60"
    :events="events"
    active-view="month"
    locale="de"
    :on-event-click="onEventClick"
    :show-all-day-events="true"
    :events-on-month-view="'short'"
  />

  <v-dialog v-model="showDialog" width="600">
    <v-card width="auto">
      <v-card-title
        class="d-flex justify-center align-center pa-4"
        :class="`${arbeitskreis_name_to_css(
          selectedEvent.event.arbeitskreis_name,
        )}-bg`"
      >
        <v-icon class="mr-3">{{ selectedEvent.icon }}</v-icon>
        <span>{{ selectedEvent.title }}</span>
        <v-spacer />
        <strong>{{
          selectedEvent.start && selectedEvent.start.format("DD.MM.YYYY")
        }}</strong>
      </v-card-title>
      <v-card-subtitle class="bg-grey-lighten-2 py-2">
        <strong>Arbeitskreis:</strong>
        {{ selectedEvent.event.arbeitskreis_name }}
      </v-card-subtitle>
      <v-card-text class="px-12">
        <p v-html="selectedEvent.contentFull" />
        <div>
          <strong> Termin details:</strong>
        </div>
        <div>
          Termin ist von
          {{ selectedEvent.start && selectedEvent.start.formatTime() }} bis
          {{ selectedEvent.end && selectedEvent.end.formatTime() }}
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="showDialog = false" color="error">Schließen</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
// https://antoniandre.github.io/vue-cal/?ref=madewithvuejs.com

import _ from "lodash";

import { useAppStore } from "@/store/app";

import VueCal from "vue-cal";
import "vue-cal/dist/vuecal.css";
import moment from "moment";
import MeilenSteineComponent from "@/components/calender/MeilenSteineComponent.vue";
import { work_group_icon } from "@/assets/js/utils";

export default {
  name: "CalenderComponent",
  components: { MeilenSteineComponent, VueCal },
  data: () => ({
    date: null,
    showDialog: false,
    store: useAppStore(),
    selectedEvent: null,
  }),
  computed: {
    events() {
      return _.map(this.db_events, (event) => {
        let event_start = event.start;
        let event_end = event.ende;

        return {
          start: moment(event.start).format(
            event_start === event_end ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm",
          ),
          end: moment(event.ende).format(
            event_start === event_end ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm",
          ),
          allDay: event_start === event_end,
          class: this.arbeitskreis_name_to_css(event.arbeitskreis_name),
          event: event,
          title: event.titel,
          contentFull: event.bemerkung,
          icon: work_group_icon[event.arbeitskreis_name],
        };
      });
    },
    db_events() {
      return this.store.termine;
    },
    meilenstein_event() {
      return _.filter(
        this.db_events,
        (event) =>
          event.istMeilenstein && moment(event.start).isAfter(moment()),
      );
    },
  },
  methods: {
    arbeitskreis_name_to_css(name) {
      return name?.replace("ß", "ss").replace(" ", "-").toLowerCase();
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
.vuecal__event {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
