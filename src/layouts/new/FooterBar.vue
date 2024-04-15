<template>
  <v-container class="mb-1">
    <v-responsive class="d-flex">
      <v-footer class="d-flex">
        <div>
          &copy; {{ new Date().getFullYear() }} —
          <strong>Gesangbuch Dashboard</strong>
        </div>
        <div class="flex-grow-1"></div>
        <div class="d-flex">
          <div>Brauchst du Hilfe? Schreib uns eine E-Mail:</div>
          <v-btn
            icon
            class="ml-3 mail-icon"
            href="mailto:gb-it@ml.***REMOVED***"
            target="_blank"
            variant="text"
            size="tiny"
          >
            <v-icon>mdi-email</v-icon>
          </v-btn>
        </div>
      </v-footer>
    </v-responsive>
  </v-container>
</template>

<script setup></script>

<style scoped>
.mail-icon {
  cursor: pointer;
  &:hover {
    transition: all 0.2s ease-in-out;
    transform: scale(1.8);
    color: #1867c0;
  }
}
</style>
