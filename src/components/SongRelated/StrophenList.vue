<template>
  <div class="text-h6 mx-auto mb-3">
    <span class="me-2">
      Strophen
    </span>
    <v-tooltip text="Es gibt Änderungsvorschläge" location="bottom">
      <template v-slot:activator="{ props }">
        <v-icon v-bind="props" v-if="!show_extra_strophen_data && has_suggestion" class="me-2" size="tiny" color="primary">mdi-text-box-edit</v-icon>
      </template>
    </v-tooltip>
    <v-tooltip text="Es gibt Anmerkungen" location="bottom">
      <template v-slot:activator="{ props }">
        <v-icon v-bind="props" v-if="!show_extra_strophen_data && has_anmerkung" size="tiny" color="primary">mdi-message</v-icon>
      </template>
    </v-tooltip>


  </div>
  <div
    style="max-width: 500px;"
    class="mb-4 mx-auto"
    v-for="(strophe, index) in text.strophenEinzeln"
    :key="index"
  >
    <v-row class="pb-0">
      <v-col cols="1" class="pb-0">{{ index + 1 }}.</v-col>
      <v-col cols="11" class="pb-0">
        {{ strophe.strophe }}
      </v-col>
    </v-row>
    <v-row class="pt-2" v-if="strophe.aenderungsvorschlag && show_extra_strophen_data">
      <v-col cols="1" class="d-flex align-center pt-0"></v-col>
      <v-col cols="11" class="pt-0" :class="{'pb-0': strophe.anmerkung}" style="font-size: 0.9rem">
        <v-icon icon="mdi-pencil" size="tiny" class="me-3" :class="{'pb-0': strophe.anmerkung}"></v-icon>
        {{ strophe.aenderungsvorschlag }}
      </v-col>
    </v-row>
    <v-row class="pt-2" v-if="strophe.anmerkung && show_extra_strophen_data">
      <v-col cols="1" class="d-flex align-center pt-0"></v-col>
      <v-col cols="11" class="pt-0" style="font-size: 0.9rem">
        <v-icon icon="mdi-message" size="tiny" class="me-3"></v-icon>
        {{ strophe.anmerkung }}
      </v-col>
    </v-row>
  </div>
</template>

<script>

import _ from "lodash"

export default {
  name: "StrophenList",
  props: {
    text: Object,
    show_extra_strophen_data: Boolean
  },
  computed: {
    has_suggestion() {
      return  _.some(this.text?.strophenEinzeln, obj => _.has(obj, 'aenderungsvorschlag') && !_.isEmpty(obj.aenderungsvorschlag))
    },
    has_anmerkung() {
      return  _.some(this.text?.strophenEinzeln, obj => _.has(obj, 'anmerkung') && !_.isEmpty(obj.anmerkung))
    }
  }
}
</script>

<style scoped>

</style>
