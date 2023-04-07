<template>
  <v-list :rounded="rounded ? 'lg' : 'none'"
    :lines="false"
    density="compact"
    nav
  >
    <v-list-item
      v-for="(item, i) in links"
      :key="i"
      :href="item.route"
      class="mb-3"
    >
      <template v-slot:prepend>
        <v-icon class="me-3" :icon="item.icon" />
      </template>

      <v-list-item-title class="text-wrap" v-html="item.name" />
    </v-list-item>
  </v-list>
</template>

<script>
export default {
  name: "MenuList",
  props: {
    rounded: {
      type: Boolean,
      default: false
    },
  },
  data: () => ({
    links: [
      {
        name: "Dashboard",
        route: "dashboard",
        icon: "mdi-home"
      },
      {
        name: "Neues Gesangbuchlied",
        route: "hochladen",
        icon: "mdi-upload"
      },
      {
        name: "Kalender",
        route: "kalender",
        icon: "mdi-calendar-month"
      },
      {
        name: "Gesangbuch<wbr>lieder",
        route: "gesangbuchlieder",
        icon: "mdi-music"
      },
      {
        name: "Arbeitsaufträge",
        route: "arbeitsauftraege",
        icon: "mdi-file-document-outline"
      }
    ]
  })
}
</script>

<style scoped>

</style>
