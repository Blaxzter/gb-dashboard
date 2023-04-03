<template>
  <div>
    <div class="text-h4 mb-7">Bereits eingetragene Gesangbuchlieder</div>
  </div>

  <v-data-table
    style="min-height: 600px"
    :headers="headers"
    :items="data_table"
    item-key="id"
    @click:row.ctrl="rowCtrlClicked"
    @click:row="rowClick"
    :search="search"
  >
    <template v-slot:top>
      <v-text-field
        v-model="search"
        single-line
        prepend-icon="mdi-magnify"
        label="Suche"
        hide-details
        class="pa-4"
      ></v-text-field>
    </template>
  </v-data-table>

<!--  <DataTable-->
<!--    :data="data_table"-->
<!--    class="display"-->
<!--    :options="options"-->
<!--    ref="ref_data_table"-->
<!--    @click:row="handleClick"-->
<!--  >-->
<!--    <thead>-->
<!--      <tr>-->
<!--        <th class="text-left">Status</th>-->
<!--        <th class="text-left">Title</th>-->
<!--        <th class="text-left">Melodie Title</th>-->
<!--        <th class="text-left">Text Title</th>-->
<!--        <th class="text-left">Text</th>-->
<!--      </tr>-->
<!--    </thead>-->
<!--  </DataTable>-->
</template>
<script>
import { useAppStore } from "@/store/app";

// import DataTable from "datatables.net-vue3";
// import DataTablesCore from "datatables.net";

import _ from "lodash";

// DataTable.use(DataTablesCore);

export default {
  name: "SongOverview",
  components: {
  },
  mounted() {
    // $(this.$refs.ref_data_table.dt.table().body()).on('click', 'tr', function (event) {
    //   console.log(event)
    // });
  },
  data: () => ({
    search: null,

    store: useAppStore(),
    headers: [
      { title: "Status", align: "start", key: "status" },
      { title: "Title", align: "end", key: "titel" },
      { title: "Melodie Title", align: "end", key: "melodie_titel" },
      { title: "Text Title", align: "end", key: "text_titel" },
      { title: "Text", align: "start", key: "text_strophen" },
    ],
  }),
  computed: {
    auftraege() {
      return this.store.gesangbuchlieder;
    },
    data_table() {
      return _.map(this.auftraege, (obj) => ({
        id: obj.id,
        status: obj.status,
        titel: obj.titel,
        melodie_titel: obj.melodie?.titel,
        text_titel: obj.text?.titel,
        text_strophen: obj.text?.strophen.substring(0, 50) + '...',
      }));
    },
  },
  methods: {
    rowClick(event) {
      console.log("normal")
      console.log(event);
    },
    rowCtrlClicked(event) {
      console.log("ctrl")
      console.log(event);
    },
  },
};
</script>

<style></style>
