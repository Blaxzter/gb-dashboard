<template>
  <v-app id="inspire" class="app-root-style">
    <default-bar />

    <default-view />

    <footer-bar />
  </v-app>
</template>

<script setup>
import DefaultBar from "./AppBar.vue";
import DefaultView from "./MainView.vue";
import FooterBar from "./FooterBar.vue";
</script>

<style>
.app-root-style {
  max-width: 1500px;
  margin: auto;
}
</style>
