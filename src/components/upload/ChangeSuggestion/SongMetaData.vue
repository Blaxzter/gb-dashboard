<script>
export default {
  name: "SongMetaData",
  data: () => ({
    melodie_anmerkung: "",
    text_anmerkung: "",
  }),
  props: {
    selected_song: Object,
  },
  mounted() {
    console.log(this.selected_song);
    this.melodie_anmerkung = this.selected_song?.melodie?.anmerkung;
    this.text_anmerkung = this.selected_song?.text?.anmerkung;
  },
};
</script>

<template>
  <div class="text-h5 my-5">Text und Melodie Anmerkung</div>
  <div>
    <v-textarea
      v-model="text_anmerkung"
      label="Text Anmerkung"
      variant="filled"
      rows="4"
      type="text"
      clearable
      hide-details="auto"
      class="mb-3"
    ></v-textarea>
    <v-textarea
      v-model="melodie_anmerkung"
      label="Melodie Anmerkung"
      variant="filled"
      rows="4"
      type="text"
      clearable
      hide-details="auto"
      class="mb-3"
    ></v-textarea>
  </div>
</template>

<style scoped></style>
