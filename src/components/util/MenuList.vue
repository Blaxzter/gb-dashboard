<template>
  <v-list :rounded="rounded ? 'lg' : 'none'" :lines="false" nav>
    <v-list-item v-for="(item, i) in links" :key="i" :to="item.route" :class="{'ms-2': item.indent, 'mb-3': item.marginButton}">
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
        indent: false,
        marginButton: true,
      },
      {
        name: "Kalender",
        route: "kalender",
        icon: "mdi-calendar-month",
        indent: false,
        marginButton: true,
      },
      {
        name: "Gesangbuch<wbr>lieder",
        route: "gesangbuchlieder",
        icon: "mdi-music",
        indent: false,
        marginButton: true,
      },
      {
        name: "Arbeitsaufträge",
        route: "arbeitsauftraege",
        icon: "mdi-file-document-outline",
        indent: false,
        marginButton: true,
      },{
        name: "Hochladen",
        route: "",
        icon: null,
        indent: false,
        marginButton: false,
      },
      {
        name: "Gesangbuchlied Hochladen",
        route: "gesangbuchliedhochladen",
        icon: "mdi-upload",
        indent: true,
        marginButton: false,
      },
      {
        name: "Änderung Eintragen",
        route: "aenderunghochladen",
        icon: "mdi-pencil",
        indent: true,
        marginButton: true,
      },
    ],
  }),
};
</script>

<style scoped></style>
