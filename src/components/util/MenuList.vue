<template>
  <v-list :rounded="rounded ? 'lg' : 'none'" :lines="false" nav>
    <v-list-item v-for="(item, i) in links" :key="i" :to="item.route" :class="{'mb-3': item.marginButton}">
      <template v-slot:prepend v-if="item.icon">
        <v-icon :icon="item.icon" />
      </template>

      <v-list-item-title class="text-wrap" >
        <span :class="{'text-subtitle-1': !item.icon}" v-html="item.name">
        </span>
      </v-list-item-title>
    </v-list-item>
  </v-list>
</template>

<script>
export default {
  name: "MenuList",
  props: {
    rounded: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    links: [
      {
        name: "Dashboard",
        route: "dashboard",
        icon: "mdi-home",
        marginButton: true,
      },
      {
        name: "Kalender",
        route: "kalender",
        icon: "mdi-calendar-month",
        marginButton: true,
      },
      {
        name: "Gesangbuch<wbr>lieder",
        route: "gesangbuchlieder",
        icon: "mdi-music",
        marginButton: true,
      },
      {
        name: "Arbeitsaufträge",
        route: "arbeitsauftraege",
        icon: "mdi-file-document-outline",
        marginButton: true,
      },{
        name: "Hochladen",
        route: "",
        icon: null,
        marginButton: false,
      },
      {
        name: "Gesangbuchlied Hochladen",
        route: "gesangbuchliedhochladen",
        icon: "mdi-upload",
        marginButton: false,
      },
      {
        name: "Änderung Eintragen",
        route: "aenderunghochladen",
        icon: "mdi-pencil",
        marginButton: true,
      },
    ],
  }),
};
</script>

<style scoped></style>
