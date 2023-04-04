<template>
  <div>
    <v-row>
      <v-col cols="12" class="pb-0">
        <v-text-field
          :model-value="title"
          @change="$emit('update:title', $event.target.value)"
          label="Text Titel"
          hide-details="auto"
          class="mb-3"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" md="6" class="py-0">
        <v-text-field
          :model-value="quelle"
          @change="$emit('update:quelle', $event.target.value)"
          label="Quelle"
          hide-details="auto"
          class="mb-3"
        ></v-text-field>
      </v-col>
      <v-col cols="12" md="6" class="py-0">
        <v-text-field
          :model-value="quellelink"
          @change="$emit('update:quellelink', $event.target.value)"
          label="Quelle Link"
          hide-details="auto"
          class="mb-3"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" class="pt-0">
        <v-textarea
          :model-value="anmerkung"
          @change="$emit('update:anmerkung', $event.target.value)"
          label="Text Anmerkung"
          hide-details="auto"
          class="mb-3"
          rows="2"
        ></v-textarea>
      </v-col>
    </v-row>
  </div>
</template>

<script>
export default {
  name: "TextData",
  props: {
    title: String,
    quelle: String,
    quellelink: String,
    anmerkung: String
  }
};
</script>

<style scoped></style>
