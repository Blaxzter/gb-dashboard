<template>
  <div>
    <v-row>
      <v-col cols="12" class="pb-0">
        <div class="d-flex align-center">
          <div>
            <v-tooltip text="Kopiere den Gesangbuchs Titel" location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn icon="mdi-content-copy" size="tiny" variant="plain" class="me-5" v-bind="props" color="primary" @click="copy_song_title"/>
              </template>
            </v-tooltip>
          </div>

          <v-text-field
            :model-value="title"
            @change="$emit('update:title', $event.target.value)"
            label="Text Titel"
            hide-details="auto"
            class="mb-3"
          ></v-text-field>
        </div>
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
    song_title: String,
  },
  data: () => ({
    title: "",
    quelle: "",
    quellelink: "",
    anmerkung: ""
  }),
  methods: {
    copy_song_title(){
      this.$emit('update:title', this.song_title);
      this.title = this.song_title;
    }
  }
};
</script>

<style scoped></style>
