<template>
  <v-row>
    <v-col v-for="i in 3" :key="i" cols="12" sm="4">
      <v-row no-gutters class="flex-column">
        <v-col
          v-for="(auftrag, index) in chunked_auftraege[i - 1]"
          :key="index"
        >
          <AuftragCard :auftrag="auftrag" />
        </v-col>
      </v-row>
    </v-col>
  </v-row>
</template>

<script>
import moment from "moment";
import _ from "lodash";

import { useAppStore } from "@/store/app";
import { work_group_icon } from "@/assets/js/utils";
import AuftragCard from "@/components/Workorders/AuftragsCard.vue";

export default {
  name: "AuftragCards",
  components: { AuftragCard },
  data: () => ({
    store: useAppStore(),
  }),
  props: {
    auftraege: Array,
  },
  computed: {
    chunked_auftraege() {
      return _.chunk(this.auftraege, Math.ceil(this.auftraege.length / 3));
    },
    work_group_icon() {
      return work_group_icon;
    },
  },
  methods: {
    arbeitskreis_name_to_css(name) {
      return name.replace("ß", "ss").replace(" ", "-").toLowerCase();
    },
    arbeitskreis_name(id) {
      return this.store.arbeitskreis_by_id(id);
    },
    format_date(date) {
      if (date) return moment(date).format("DD.MM.YYYY");
      return "Kein Datum";
    },
  },
};
</script>

<style scoped></style>
