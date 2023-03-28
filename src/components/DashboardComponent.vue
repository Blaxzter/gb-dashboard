<template>
  <v-container class="fill-height">
    <v-responsive>

      <CurrentState/>

      <v-divider class="my-8"/>

      <Calender/>

      <v-divider class="my-8"/>

      <WorkOrders/>

      <v-divider class="my-8"/>

    </v-responsive>
  </v-container>
</template>

<script setup>

import Calender from "@/components/Calender.vue";
import WorkOrders from "@/components/WorkOrders.vue";
import CurrentState from "@/components/CurrentState.vue";

</script>
