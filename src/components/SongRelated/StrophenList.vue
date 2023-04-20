<template>
  <div class="text-h6 mx-auto mb-3">
    <span class="me-2">
      Strophen
    </span>

  </div>
  <div
    style="max-width: 500px;"
    class="mb-4 mx-auto"
    v-for="(strophe, index) in show_strophen"
    :key="index"
  >
    <div class="pb-0 d-flex">
      <div class="pb-0 me-3" style="white-space: nowrap;">{{ index + 1 }}.</div>
      <div class="pb-0" style="white-space: pre-line" @click="strophe.show = !strophe.show">
        {{ strophe.strophe }}
      </div>
      <div class="d-flex flex-column align-center ms-3">
        <v-icon icon="mdi-pencil" size="tiny" color="warning" v-if="strophe.aenderungsvorschlag"/>
        <v-icon icon="mdi-message" size="tiny" color="warning" v-if="strophe.anmerkung"/>
      </div>
    </div>
    <v-expand-transition>
      <div v-if="strophe.show">
        <div class="pt-2 d-flex" v-if="strophe.aenderungsvorschlag">
          <div class="d-flex align-center pt-0"></div>
          <div class="pt-0 ms-7" :class="{'pb-0': strophe.anmerkung}" style="font-size: 0.9rem">
            <v-icon icon="mdi-pencil" size="tiny" class="me-3" :class="{'pb-0': strophe.anmerkung}"></v-icon>
            {{ strophe.aenderungsvorschlag }}
          </div>
        </div>
        <div class="pt-2 d-flex" v-if="strophe.anmerkung">
          <div class="d-flex align-center pt-0"></div>
          <div class="pt-0 ms-7" style="font-size: 0.9rem">
            <v-icon icon="mdi-message" size="tiny" class="me-3"></v-icon>
            {{ strophe.anmerkung }}
          </div>
        </div>
      </div>
    </v-expand-transition>

  </div>
</template>

<script>

import _ from "lodash"

export default {
  name: "StrophenList",
  props: {
    text: Object,
    show_extra_strophen_data: Boolean,
  },
  data: () => ({
    show_strophen: [],
  }),
  mounted() {
    this.show_strophen = _.map(this.text?.strophenEinzeln, obj => ({
      ...obj,
        show: this.show_extra_strophen_data,
    }))
  },
}
</script>

<style scoped>

</style>
