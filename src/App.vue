<template>

  <router-view />
</template>

<script setup>

// On mounted preform autologin
import {onBeforeMount} from "vue";

// get pinia store from useeAppStore
import { useUserStore } from "@/store/user";

const user = useUserStore()

onBeforeMount(() => {
  user.autoLogin()
})

</script>
