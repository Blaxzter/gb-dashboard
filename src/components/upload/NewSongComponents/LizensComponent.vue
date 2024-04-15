<template>
  <v-expansion-panels class="mb-3">
    <v-expansion-panel :title="label">
      <v-expansion-panel-text class="pt-3">
        <v-row>
          <v-col cols="12" class="py-0">
            <v-checkbox
              :checked="use_lizenz"
              hide-details="auto"
              label="Besitzt eine Lizens"
              @change="$emit('update:use_lizenz', $event.target.checked)"
            ></v-checkbox>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" class="py-0">
            <v-text-field
              v-model="lizenz_model.name"
              label="Name der Lizens"
              hide-details="auto"
              class="mb-3"
              required
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6" class="py-0">
            <v-checkbox
              v-model="lizenz_model.digital"
              hide-details="auto"
              label="Lizens ist Digital"
            ></v-checkbox>
          </v-col>
          <v-col cols="6" class="py-0">
            <v-checkbox
              v-model="lizenz_model.print"
              hide-details="auto"
              label="Lizens ist Print"
            ></v-checkbox>
          </v-col>
        </v-row>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script>
export default {
  name: "LizensComponent",
  props: {
    lizenz: Object,
    use_lizenz: Boolean,
    label: String,
  },
  computed: {
    lizenz_model: {
      get() {
        return this.lizenz;
      },
      set(value) {
        this.$emit("update:lizenz", value);
      },
    },
  },
};
</script>

<style scoped></style>
