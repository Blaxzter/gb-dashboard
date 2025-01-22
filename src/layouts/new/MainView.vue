<template>
  <v-main class="bg-grey-lighten-3">
    <v-container fluid class="main-container">
      <v-row>
        <v-col v-if="$vuetify.display.lgAndUp" cols="2">
          <v-sheet rounded="lg" class="nav-sheet">
            <MenuList rounded />
          </v-sheet>
        </v-col>

        <v-col cols="12" lg="10">
          <v-sheet min-height="70vh" rounded="lg">
            <v-container>
              <router-view />
            </v-container>

            <v-divider class="my-4"></v-divider>

            <footer-bar />
          </v-sheet>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>

<script setup>
import MenuList from "@/components/util/MenuList.vue";
import FooterBar from "@/layouts/new/FooterBar.vue";
</script>

<style>
.main-container {
  max-width: 1600px;
}

.nav-sheet {
  position: sticky;
  top: 80px;
}
</style>
