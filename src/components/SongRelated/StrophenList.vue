<template>
  <div v-if="includeTitle" class="text-h6 mx-auto mb-1">
    <span class="me-2"> Strophen </span>
  </div>
  <div
    v-for="(strophe, index) in show_strophen"
    :key="index"
    :style="{ 'max-width': !includeTitle ? '' : '500px' }"
    class="mx-auto"
  >
    <div
      class="d-flex py-3 px-5"
      :class="
        (strophe.aenderungsvorschlag || strophe.anmerkung) && !showTextOnly
          ? 'hover-border'
          : ''
      "
    >
      <div class="pb-0 me-3" style="white-space: nowrap">{{ index + 1 }}.</div>
      <div
        class="pb-0"
        style="white-space: pre-line"
        @click="strophe.show = !strophe.show && !showTextOnly"
      >
        {{ strophe.strophe }}
      </div>
      <div class="d-flex flex-column align-center ms-3">
        <v-tooltip
          v-if="strophe.aenderungsvorschlag && !showTextOnly"
          text="Strophe hat einen Änderungsvorschlag"
          location="bottom"
        >
          <template #activator="{ props }">
            <v-icon
              v-bind="props"
              icon="mdi-pencil"
              size="tiny"
              color="warning"
            />
          </template>
        </v-tooltip>

        <v-tooltip
          v-if="strophe.anmerkung && !showTextOnly"
          text="Strophe hat eine Anmerkung"
          location="bottom"
        >
          <template #activator="{ props }">
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
        <div v-if="strophe.aenderungsvorschlag" class="pt-2 d-flex">
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
        <div v-if="strophe.anmerkung" class="pt-2 d-flex">
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
    text: {
      type: Object,
      required: true,
    },
    showExtraStrophenData: {
      type: Boolean,
      default: false,
    },
    showTextOnly: {
      type: Boolean,
      default: false,
    },
    includeTitle: {
      type: Boolean,
      default: true,
    },
  },
  data: () => ({
    show_strophen: [],
  }),
  mounted() {
    this.show_strophen = _.map(this.text?.strophenEinzeln, (obj) => ({
      ...obj,
      show: this.showExtraStrophenData,
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
