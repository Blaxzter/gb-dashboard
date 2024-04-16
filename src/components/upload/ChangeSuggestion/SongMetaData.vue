<script>
export default {
  name: "SongMetaData",
  props: {
    selectedSong: {
      type: Object,
      required: true,
    },
  },
  data: () => ({
    melodie_anmerkung: "",
    text_anmerkung: "",
  }),
  mounted() {
    console.log(this.selectedSong);
    this.melodie_anmerkung = this.selectedSong?.melodie?.anmerkung;
    this.text_anmerkung = this.selectedSong?.text?.anmerkung;
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
