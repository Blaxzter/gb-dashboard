<template>
    <UploadFormular />

    <v-divider class="my-8" />

    <CurrentState />

    <v-divider class="my-8" />

    <Calender />

    <v-divider class="my-8" />

    <WorkOrders />

    <v-divider class="my-8" />

    <SongOverview />
</template>

<script setup>
import Calender from '@/components/Calender.vue';
import WorkOrders from '@/components/Workorders/WorkOrders.vue';
import CurrentState from '@/components/CurrentState.vue';
import UploadFormular from '@/components/upload/UploadFormular.vue';
import SongOverview from '@/components/SongOverview.vue';
</script>
