<template>
  <v-app-bar flat class="my-app-bar header-banner">
    <v-container fluid class="main-container d-flex align-center">
      <v-avatar image="/src/assets/images/logo.png" rounded="0" class="me-10 ms-4 dashboard-icon" @click="$router.push('Dashboard')"></v-avatar>

      <div class="d-flex flex-column align-baseline flex-md-row">
        <span class="text-h6 font-weight-bold mr-3">Gesangbuch 2026</span>
        <span class="font-italic font-weight-light d-none d-sm-block">Einstiegs- und Übersichtsseite für den AK Gesangbuch</span>
      </div>

      <v-spacer></v-spacer>

      <MenuComponent v-if="!$vuetify.display.lgAndUp" />
    </v-container>
  </v-app-bar>
</template>

<script setup>
//
import MenuComponent from "@/components/util/MenuComponent.vue";
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
