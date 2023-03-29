<template>
  <v-container>
    <v-responsive class="d-flex">
      <v-img
        gradient="rgba(0,0,0,.5), rgba(100,100,100,.2)"
        aspect-ratio="8"
        cover
        src="/src/assets/header-banner.jpg"
      >
        <v-row class="pa-5">
          <v-col cols="2">
            <v-img
              aspect-ratio="1s"
              src="/src/assets/kirchenlogo.png"
            ></v-img>
          </v-col>
          <v-col cols="10">
            <div class="d-flex justify-center flex-column h-100 text-white">
              <div class="text-h2 mb-6 mt-7 font-weight-light">Gesangbuch 2026</div>
              <div class="text-h4 font-italic font-weight-light">Einstiegs- und Übersichtsseite für den AK Gesangbuch</div>
            </div>
          </v-col>
        </v-row>
      </v-img>
    </v-responsive>
  </v-container>
</template>

<script setup>
//
</script>

<style>
.header-banner:before {
  content: "";
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
}
</style>
