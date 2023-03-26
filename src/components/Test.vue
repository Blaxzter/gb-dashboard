<template>
<div>
  <p v-for="author in authors">{{author}}</p>
</div>
</template>

<script>

import { useStore } from '@/stores/store';

export default {
  name: "TestComponent",
  data() {
    return {
      store: useStore()
    }
  },
  computed: {
    authors() {
      return this.store.authors;
    }
  }
}
</script>

<style scoped>

</style>