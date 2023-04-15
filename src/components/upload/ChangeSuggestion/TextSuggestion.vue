<template>
  <div class="text-h5 ps-0 my-5" v-if="text">
    Änderungsvorschlag oder Anmerkungen
  </div>
  <div v-if="!text" class="mb-5">
    <v-alert
      color="primary"
      icon="$warning"
      title="Hinweis"
      text="Das ausgewählte Gesangbuchlied hat keinen Text zugeordnet. Eine Aktualisierung der Noten ist deshalb nicht möglich."
    ></v-alert>
  </div>
  <div v-else>
    <div v-for="(strophe, index) in text?.strophenEinzeln" :key="index" class="d-flex flex-column mb-2">
      <div class="text-h6 mb-1">
        Strophe {{ index + 1 }}
      </div>

      <div class="text-subtitle-1 mb-3">
        {{ strophe.strophe }}
      </div>

      <v-textarea
        v-model="strophe.aenderungsvorschlag"
        :label="'Änderungsvorschlag für Strophe ' + (index + 1)"
        variant="filled"
        rows="2"
        type="text"
        clearable
        hide-details="auto"
        class="mb-3"
        @click:clear="strophe.aenderungsvorschlag = ''"
      ></v-textarea>
      <v-textarea
        v-model="strophe.anmerkung"
        :label="'Anmerkung für Strophe ' + (index + 1)"
        variant="filled"
        rows="2"
        type="text"
        hide-details="auto"
        clearable
        class="mb-3"
        @click:clear="strophe.anmerkung = ''"
      ></v-textarea>
    </div>
  </div>
</template>

<script>
export default {
  name: "TextSuggestion",
  props: {
    text: Object,
  }
}
</script>

<style scoped>

</style>
