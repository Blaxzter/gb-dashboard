<template>
  <v-container class="fill-height">
    <v-responsive>
      <Calender/>

      <v-divider class="my-8"/>

      <WorkOrders/>

    </v-responsive>
  </v-container>
</template>

<script setup>

import Calender from "@/components/Calender.vue";
import WorkOrders from "@/components/WorkOrders.vue";

</script>
