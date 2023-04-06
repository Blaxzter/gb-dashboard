<template>
  <v-expansion-panels>
    <v-expansion-panel title="Strophen">
      <v-expansion-panel-text class="pt-3">
        <v-row v-for="(strophe, index) in strophen_model" :key="index">
          <v-col cols="12" class="py-0">
            <v-textarea
              v-model="strophe.text"
              :label="'Strophe ' + (index + 1)"
              :append-icon="strophen_model.length > 1 ? 'mdi-minus' : null"
              variant="filled"
              clear-icon="mdi-close-circle"
              rows="2"
              clearable
              type="text"
              hide-details="auto"
              class="mb-3"
              @click:append="remove_strophe(index);"
              @click:clear="strophe.text = ''"
            ></v-textarea>
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
    remove_strophe(index) {
      if (this.strophen_model[index].text.length === 0)
        this.strophen_model.splice(index, 1)
      else {
        const response = confirm("Strophe wirklich löschen?");
        if (response) {
          this.strophen_model.splice(index, 1)
        }
      }
    },
    addStrophe() {
      this.strophen_model.push({ text: "" });
    },
  },
};

</script>

<style scoped></style>
