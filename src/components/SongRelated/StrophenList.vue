<template>
  <div class="text-h6 mx-auto mb-1" v-if="!show_text_only">
    <span class="me-2"> Strophen </span>
  </div>
  <div
    :style="{ 'max-width': show_text_only ? '' : '500px' }"
    class="mx-auto"
    v-for="(strophe, index) in show_strophen"
    :key="index"
  >
    <div
      class="d-flex py-3 px-5"
      :class="
        (strophe.aenderungsvorschlag || strophe.anmerkung) && !show_text_only
          ? 'hover-border'
          : ''
      "
    >
      <div class="pb-0 me-3" style="white-space: nowrap">{{ index + 1 }}.</div>
      <div
        class="pb-0"
        style="white-space: pre-line"
        @click="strophe.show = !strophe.show && !show_text_only"
      >
        {{ strophe.strophe }}
      </div>
      <div class="d-flex flex-column align-center ms-3">
        <v-tooltip
          v-if="strophe.aenderungsvorschlag && !show_text_only"
          text="Strophe hat einen Änderungsvorschlag"
          location="bottom"
        >
          <template v-slot:activator="{ props }">
            <v-icon
              v-bind="props"
              icon="mdi-pencil"
              size="tiny"
              color="warning"
            />
          </template>
        </v-tooltip>

        <v-tooltip
          v-if="strophe.anmerkung && !show_text_only"
          text="Strophe hat eine Anmerkung"
          location="bottom"
        >
          <template v-slot:activator="{ props }">
            <v-icon
              v-bind="props"
              icon="mdi-message"
              size="tiny"
              color="warning"
              :class="strophe.aenderungsvorschlag ? 'pt-2' : ''"
            />
          </template>
        </v-tooltip>
      </div>
    </div>
    <v-expand-transition>
      <div v-if="strophe.show">
        <div class="pt-2 d-flex" v-if="strophe.aenderungsvorschlag">
          <div class="d-flex align-center pt-0"></div>
          <div
            class="pt-0 ms-7"
            :class="{ 'pb-0': strophe.anmerkung }"
            style="font-size: 0.9rem; white-space: pre-wrap"
          >
            <v-icon
              icon="mdi-pencil"
              size="tiny"
              class="me-3"
              :class="{ 'pb-0': strophe.anmerkung }"
            ></v-icon>
            {{ strophe.aenderungsvorschlag }}
          </div>
        </div>
        <div class="pt-2 d-flex" v-if="strophe.anmerkung">
          <div class="d-flex align-center pt-0"></div>
          <div
            class="pt-0 ms-7"
            style="font-size: 0.9rem; white-space: pre-wrap"
          >
            <v-icon icon="mdi-message" size="tiny" class="me-3"></v-icon>
            {{ strophe.anmerkung }}
          </div>
        </div>
      </div>
    </v-expand-transition>
  </div>
</template>

<script>
import _ from "lodash";

export default {
  name: "StrophenList",
  props: {
    text: Object,
    show_extra_strophen_data: Boolean,
    show_text_only: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    show_strophen: [],
  }),
  mounted() {
    this.show_strophen = _.map(this.text?.strophenEinzeln, (obj) => ({
      ...obj,
      show: this.show_extra_strophen_data,
    }));
  },
};
</script>

<style scoped>
.bigger_text {
  font-size: 1.3rem;
}

.hover-border:hover {
  box-shadow:
    rgba(255, 255, 255, 0.2) 0px 0px 0px 1px inset,
    rgba(0, 0, 0, 0.9) 0px 0px 0px 1px;
  transition: box-shadow 0.3s ease-in-out;
  cursor: pointer;
}
</style>
