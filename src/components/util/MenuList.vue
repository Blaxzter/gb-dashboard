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
    <v-divider class="my-2"/>
    <v-list-item @click="logout" link variant="flat" >
      <template v-slot:prepend >
        <v-icon class="text-red">mdi-logout</v-icon>
      </template>

      <v-list-item-title class="text-wrap" >
        <span class="text-red">
          Logout
        </span>
      </v-list-item-title>
    </v-list-item>
  </v-list>
</template>

<script>
import {useUserStore} from "@/store/user";

export default {
  name: "MenuList",
  props: {
    rounded: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    userStore: useUserStore(),
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
        name: "Lied/Text/Melodie <wbr>hochladen",
        route: "gesangbuchliedhochladen",
        icon: "mdi-upload",
        marginButton: false,
      },
      {
        name: "Änderung eintragen",
        route: "aenderunghochladen",
        icon: "mdi-pencil",
        marginButton: true,
      },
    ],
  }),
  methods: {
    logout() {
      console.log()
      this.userStore.logout()
    }
  }
};
</script>

<style scoped></style>
