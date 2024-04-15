<script setup>
import { onMounted, ref } from "vue";
import { LottieAnimation } from "lottie-web-vue";
import book from "../../assets/animations/book.json";

let anim = ref();
let direction = ref(1);

// called after first loop
const complete = () => {
  direction.value *= -1;
  anim.value.setDirection(direction.value);
  anim.value.play();
};
</script>

<template>
  <div class="loader-component">
    <LottieAnimation
      :animation-data="book"
      :auto-play="true"
      :loop="false"
      :speed="1"
      ref="anim"
      @complete="complete"
      class="book-animation"
    />
    <div class="loader-text">Lade Gesangbuch Daten</div>
  </div>
</template>

<style scoped>
.loader-component {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;

  .book-animation {
    width: 400px;
    height: 400px;
    margin-bottom: -90px;
    margin-top: -90px;
  }

  .loader-text {
    font-family: "Roboto", sans-serif;
    font-size: 2.5em;
    margin-top: 20px;
  }
}
</style>
