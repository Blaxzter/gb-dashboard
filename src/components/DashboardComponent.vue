<template>
  <CurrentState />
  <div class="text-h4 mt-10 mb-5 d-flex align-center">
    <v-icon class="me-5">mdi-video</v-icon>
    Tutorial Video
  </div>

  <div style="padding: 56.25% 0 0 0; position: relative" class="mb-5">
    <iframe
      src="https://player.vimeo.com/video/825475103?h=97f1880690&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
      frameborder="0"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%"
      title="Gesangbuch 2026 - Neue Webseite -Einf&amp;uuml;hrungsvideo01 - Allgemeines"
    ></iframe>
  </div>

  <div style="padding: 56.25% 0 0 0; position: relative">
    <iframe
      src="https://player.vimeo.com/video/825783809?h=d917ebb9bc&badge=0&autopause=0&player_id=0&app_id=58479/embed"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      frameborder="0"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%"
    ></iframe>
  </div>
</template>

<script setup>
import CurrentState from "@/components/CurrentState.vue";
</script>
