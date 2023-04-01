<template>
  <div class="text-center">
    <v-menu v-model="menu" :close-on-content-click="false" location="top">
      <template v-slot:activator="{ props }">
        <v-text-field
          v-bind="props"
          outlined
          :label="label"
          v-model="visible_date"
          @input="date_changed"
          append-icon="mdi-calendar"
        ></v-text-field>
      </template>

      <div style="height: 278px">
        <VDatePicker
          ref="date_picker"
          class="w-100"
          :model-value="selected_date"
          mode="date"
          @dayclick="day_clicked($event)"
        ></VDatePicker>
      </div>
    </v-menu>
  </div>
</template>

<script>
import moment from "moment";

export default {
  props: {
    label: String,
    date: Date,
  },
  data: () => ({
    menu: false,
    visible_date: null,
    hidden_date: null,
  }),
  emits: ["update:date"],
  computed: {
    selected_date() {
      return this.hidden_date
    },
  },
  mounted() {
    if (this.date)
      this.visible_date = moment(this.date).format("DD.MM.YYYY");
  },
  methods: {
    async date_changed(event) {
      let dateString = event.target.value;
      if (dateString.length === 10) {
        const [day, month, year] = dateString.split(".");
        this.hidden_date = new Date(year, month - 1, day);
        await this.$refs.date_picker.move(this.hidden_date)
        this.$emit("update:date", this.hidden_date);
      }
    },
    day_clicked(event) {
      let visibleDate = moment(event.startDate).format("DD.MM.YYYY");
      this.$emit("update:date",  new Date(event.startDate));
      this.visible_date = visibleDate;
      this.hidden_date = new Date(event.startDate);
      this.menu = false;
    },
  },
};
</script>
