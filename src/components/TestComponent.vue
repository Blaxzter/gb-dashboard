<template>
  <v-container class="fill-height">
    <v-responsive class="d-flex align-center text-center fill-height">
        <v-list lines="two">
          <v-list-item
              v-for="author in authors"
              :key="author.id"
          >
            {{author}}
          </v-list-item>
        </v-list>
    </v-responsive>
  </v-container>
</template>

<script setup>

import { useAppStore } from '@/stores/store';
import {computed} from "vue";

const store = useAppStore();

const authors = computed(() => {
  return store.authors;
});

</script>
