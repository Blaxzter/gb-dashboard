<template>
  <div class="text-h4 mb-6">Nächste Meilenstein</div>

  <div v-for="event in events" :key="event.id" class="mb-4">
    <div
      class="border rounded d-flex pa-3 align-center"
      :style="
        is_next_thirty_days(event.start)
          ? 'border: 1px solid red !important;'
          : 'border: 1px solid black; '
      "
    >
      <div>
        <v-icon
          icon="mdi-calendar-blank"
          class="ms-3 me-5"
          v-if="!is_next_thirty_days(event.start)"
        />
        <v-icon
          icon="mdi-lightning-bolt"
          color="red"
          class="ms-3 me-5"
          v-else
        />
      </div>

      <v-divider vertical class="mr-5" />
      <div>
        <div class="text-h6">
          {{ event.titel }}
        </div>
        <div class="text-caption mb-1">
          Termin: {{ format_date(event.start) }}
        </div>
        <div class="text-body-1">
          {{ event.description }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import moment from "moment";

export default {
  name: "MeilenSteineComponent",
  props: {
    events: Array,
  },
  methods: {
    is_next_thirty_days(start_date) {
      return !moment(start_date).isAfter(moment().add(30, "days"));
    },
    format_date(start_date) {
      return moment(start_date).format("DD.MM.yyyy");
    },
  },
};
</script>

<style scoped></style>
