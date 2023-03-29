<template>
  <v-container>

    <div class="text-h4 mb-5">
      Nächste Deadlines
    </div>
    <div v-for="event in filteredEvents" :key="event.id" class="mb-4">
      <div class="border rounded d-flex pa-3"
           :style="event.type === 'deadline' ? 'border: 1px solid red !important;' : 'border: 1px solid black ; '">
        <div class="d-flex justify-center align-center mr-5 ml-2">
          <v-icon v-if="event.type === 'deadline'" icon="mdi-lightning-bolt" color="red"/>
          <v-icon v-else-if="event.type === 'normal'" icon="mdi-calendar-blank"/>
        </div>
        <v-divider vertical class="mr-5" />
        <div>
          <div class="text-h6">
            {{ event.name }}
          </div>
          <div class="text-caption mb-1">
            Termin: {{ toDate(event.date) }}
          </div>
          <div class="text-body-1">
            {{ event.description }}
          </div>
        </div>
      </div>
    </div>

    <v-divider class="my-10" />

    <div class="text-h4  mb-5">
      Kalender
    </div>
    <vue-cal style="height: 500px" active-view="month" locale="de"/>
  </v-container>

</template>

<script>
// https://antoniandre.github.io/vue-cal/?ref=madewithvuejs.com

import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'

export default {
  components: {VueCal},
  data: () => ({
    date: null,
    events: [
      {
        id: 1,
        date: 1679984928,
        name: "Dashboard Creation",
        description: "Startschuss für die Erstellung des Dashboards.",
        type: 'normal'
      },
      {
        id: 2,
        date: 1680192000,
        name: "Dashboard Deadline",
        description: "IT Task, damit das Dashboard chique ist.",
        type: 'deadline'
      },
    ]
  }),
  computed: {
    filteredEvents() {
      return this.events;
    }
  },
  methods: {
    toDate(unix_timestamp) {
      return new Date(unix_timestamp * 1000).toLocaleDateString("de")
    }
  }
}

</script>
