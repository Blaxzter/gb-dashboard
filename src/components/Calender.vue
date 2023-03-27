<template>
  <v-container>
    <div class="text-h4">
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
