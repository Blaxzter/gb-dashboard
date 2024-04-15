<template>
  <v-menu transition="scale-transition">
    <template #activator="{ props }">
      <v-btn color="primary" v-bind="props" icon="mdi-menu"> </v-btn>
    </template>

    <MenuList />
  </v-menu>
</template>

<script>
import MenuList from "@/components/util/MenuList.vue";

export default {
  name: "MenuComponent",
  components: { MenuList },
};
</script>

<style scoped></style>
