<template>
  <div class="text-h5 mb-5" v-if="melodie">
    Lade neue Dateien hoch
  </div>
  <div v-if="!melodie">
    <v-alert
      color="primary"
      icon="$warning"
      title="Hinweis"
      text="Das ausgewählte Gesangbuchlied hat keine Melodie zugeordnet. Eine Aktualisierung der Noten ist deshalb nicht möglich."
    ></v-alert>
  </div>
  <div v-else>
    <v-chip-group>
      <v-chip v-for="(file, index) in melodie?.files" :key="index" prepend-icon="mdi-file-music" >
        {{ file.filename_download }}
      </v-chip>
    </v-chip-group>
    <v-file-input
      v-model="noten"
      show-size
      label="Noten Datein"
      multiple
      counter
      chips
      @change="$emit('update:noten', noten)"
    >
    </v-file-input>
  </div>
</template>

<script>
export default {
  name: "AddFiles",
  props: {
    melodie: Object,
  },
  data: () => ({
    noten: []
  })
}
</script>

<style scoped>

</style>
