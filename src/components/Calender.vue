<template>
  <v-container>
    <v-expansion-panels>
      <v-expansion-panel title="Kalender">
        <v-expansion-panel-text>
          <vue-cal style="height: 600px" active-view="month" locale="de"/>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
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
    trip: {
      name: '',
      location: null,
      start: null,
      end: null,
    },
    locations: ['Australia', 'Barbados', 'Chile', 'Denmark', 'Ecuador', 'France'],
  }),
}

</script>
