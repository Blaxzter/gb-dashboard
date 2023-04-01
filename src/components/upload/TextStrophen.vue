<template>
  <v-expansion-panels>
    <v-expansion-panel title="Strophen">
      <v-expansion-panel-text class="pt-3">
        <v-row v-for="(strophe, index) in strophen_model" :key="index">
          <v-col cols="12" class="py-0">
            <v-text-field
              v-model="strophe.text"
              :label="'Strophe ' + index"
              :append-icon="strophen_model.length > 1 ? 'mdi-minus' : null"
              variant="filled"
              clear-icon="mdi-close-circle"
              clearable
              type="text"
              hide-details="auto"
              class="mb-3"
              @click:append="strophen_model.splice(index, 1)"
              @click:clear="strophe.text = ''"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-btn
              color="primary"
              @click="addStrophe"
              prepend-icon="mdi-plus"
              variant="tonal"
            >
              Einene weitere Strophe
            </v-btn>
          </v-col>
        </v-row>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script>
export default {
  name: "TextStrophen",
  props: {
    strophen: Array,
  },
  computed: {
    strophen_model: {
      get() {
        return this.strophen;
      },
      set(value) {
        this.$emit("update:strophen", value);
      },
    },
  },
  methods: {
    addStrophe() {
      console.log("Test");
      this.strophen_model.push({ text: "" });
    },
  },
};
</script>

<style scoped></style>
