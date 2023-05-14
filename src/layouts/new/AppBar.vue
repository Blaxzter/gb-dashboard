<template>
  <v-app-bar flat class="my-app-bar header-banner">
    <v-container fluid class="main-container d-flex align-center">
      <v-avatar image="/src/assets/images/logo.png" rounded="0" class="me-10 ms-4 dashboard-icon"
                @click="$router.push('Dashboard')"></v-avatar>

      <div class="d-flex flex-column align-baseline flex-md-row">
        <span class="text-h6 font-weight-bold mr-3">Gesangbuch 2026</span>
        <span class="font-italic font-weight-light d-none d-sm-block">Einstiegs- und Übersichtsseite für den AK Gesangbuch</span>
      </div>

      <v-spacer></v-spacer>

      <!-- add tooltip  -->
      <v-tooltip text="Aktiviere die Ansicht für den kleinen Kreis" location="bottom" v-if="is_kleiner_kreis && $vuetify.display.lgAndUp">
        <template v-slot:activator="{ props }">
          <v-btn prepend-icon="mdi-record-circle-outline"
                 density="comfortable" class="me-4" variant="tonal"
                 :color="is_kleiner_kreis_ansicht ? 'primary' : null" v-bind="props"
                 @click="toggle_kleiner_kreis_ansicht">
            Kleiner Kreis
          </v-btn>
        </template>
      </v-tooltip>

      <v-tooltip text="Aktiviere die Ansicht für den kleinen Kreis" location="bottom" v-if="is_kleiner_kreis && !$vuetify.display.lgAndUp">
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-record-circle-outline"
                 :color="is_kleiner_kreis_ansicht ? 'primary' : null" v-bind="props"
                 @click="toggle_kleiner_kreis_ansicht">
          </v-btn>
        </template>
      </v-tooltip>

      <MenuComponent v-if="!$vuetify.display.lgAndUp"/>
    </v-container>
  </v-app-bar>
</template>

<script>
//
import MenuComponent from "@/components/util/MenuComponent.vue";
import {useUserStore} from "@/store/user";

export default {
  name: 'AppBar',
  data: () => ({
    userStore: useUserStore()
  }),
  components: {
    MenuComponent
  },
  computed: {
    is_kleiner_kreis_ansicht() {
      return this.userStore.is_kleiner_kreis_ansicht
    },
    is_kleiner_kreis() {
      return this.userStore.is_kleiner_kreis
    }
  },
  methods: {
    toggle_kleiner_kreis_ansicht() {
      this.userStore.toggle_kleiner_kreis_ansicht()
    }
  }
}


</script>

<style lang="scss">

.header-banner:before {
  max-width: 1200px;
  content: "";
  position: absolute;
  width: 100%;
  height: 100%;
}

.dashboard-icon {
  cursor: pointer;

  // add hover and zoom in a bit on hover
  &:hover {
    // aniomatio
    transition: all 0.2s ease-in-out;
    transform: scale(1.1);
  }
}

</style>
