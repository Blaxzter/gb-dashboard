<script>
import StrophenList from "@/components/SongRelated/StrophenList.vue";
import MediaComponent from "@/components/SongRelated/MediaComponent.vue";

import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

export default {
  name: "SingModeDialog",
  data: () => ({
    show_sing_mode_dialog: false,
    text_font_size: 1.3,
    book_open: false,
    book_fully_open: false,
    position: 50,
  }),
  components: { MediaComponent, StrophenList, Splitpanes, Pane },
  props: {
    selected_song: Object,
    selected_media_file: Object,
  },
  methods: {
    setPosition(event) {
      console.log(event[0].size);
      this.position = event[0].size;
    },
    open_dialog() {
      this.show_sing_mode_dialog = true;
      this.position = 50;
      setTimeout(() => {
        this.book_open = true;
      }, 100);
      setTimeout(() => {
        this.book_fully_open = true;
      }, 1050);
    },
    close_dialog() {
      this.book_open = false;
      this.book_fully_open = false;
      setTimeout(() => {
        this.show_sing_mode_dialog = false;
      }, 1100);
    },
  },
};
</script>

<template>
  <v-btn
    icon="mdi-music-clef-treble"
    variant="text"
    @click="open_dialog"
    color="primary"
  />
  <v-dialog v-model="show_sing_mode_dialog" fullscreen>
    <div class="book-wrapper">
      <div
        class="book"
        :class="{ 'book-open': book_open, 'book-closing': !book_open }"
      >
        <div
          :class="{ 'book-open': book_open, 'book-closing': !book_open }"
          class="back"
        ></div>
        <div
          :class="{ 'book-open': book_open, 'book-closing': !book_open }"
          class="page6"
        ></div>
        <div
          :class="{ 'book-open': book_open, 'book-closing': !book_open }"
          class="page4"
        ></div>
        <div
          :class="{ 'book-open': book_open, 'book-closing': !book_open }"
          class="page2"
          style="overflow: hidden"
        >
          <div style="position: absolute; z-index: 20" class="pl-5 pt-2">
            <v-btn
              icon="mdi-magnify-minus-outline"
              @click="
                text_font_size =
                  text_font_size - 0.1 < 0.5
                    ? text_font_size
                    : text_font_size - 0.1
              "
              variant="text"
              :disabled="text_font_size - 0.1 < 0.5"
              color="primary"
            />
            <v-btn
              icon="mdi-magnify-plus-outline"
              @click="
                text_font_size =
                  text_font_size + 0.1 > 2
                    ? text_font_size
                    : text_font_size + 0.1
              "
              variant="text"
              :disabled="text_font_size + 0.1 > 2"
              color="primary"
            />
          </div>
          <div class="pl-10 pt-10">
            <h2>{{ selected_song.titel }}</h2>
            <div style="overflow: scroll">
              <StrophenList
                :text="selected_song?.text"
                :show_extra_strophen_data="false"
                :show_text_only="true"
              />
            </div>
          </div>
        </div>
        <div
          :class="{ 'book-open': book_open, 'book-closing': !book_open }"
          class="page5"
          style="overflow: hidden"
        >
          <div
            class="flip-content position-relative h-100"
            v-if="!book_fully_open"
          >
            <MediaComponent
              :file="selected_media_file"
              :sing-mode-screen="true"
            />
          </div>
        </div>
        <div
          :class="{ 'book-open': book_open, 'book-closing': !book_open }"
          class="page3"
        ></div>
        <div
          :class="{ 'book-open': book_open, 'book-closing': !book_open }"
          class="page1"
        ></div>
        <div
          :class="{ 'book-open': book_open, 'book-closing': !book_open }"
          class="front"
        ></div>
      </div>
    </div>
    <div class="display-pane" v-if="book_fully_open">
      <v-icon
        icon="mdi-arrow-split-vertical"
        color="primary"
        class="splitter-icon"
        :style="{ left: `${position}%` }"
      />
      <splitpanes @resize="setPosition" :dbl-click-splitter="false">
        <pane min-size="20">
          <div class="position-relative h-100" style="overflow: auto">
            <MediaComponent
              :file="selected_media_file"
              :sing-mode-screen="true"
            />
          </div>
        </pane>
        <pane min-size="20" style="overflow: auto">
          <div style="position: absolute; z-index: 20" class="pl-5 pt-2">
            <v-btn
              icon="mdi-magnify-minus-outline"
              @click="
                text_font_size =
                  text_font_size - 0.1 < 0.5
                    ? text_font_size
                    : text_font_size - 0.1
              "
              variant="text"
              :disabled="text_font_size - 0.1 < 0.5"
              color="primary"
            />
            <v-btn
              icon="mdi-magnify-plus-outline"
              @click="
                text_font_size =
                  text_font_size + 0.1 > 3
                    ? text_font_size
                    : text_font_size + 0.1
              "
              variant="text"
              :disabled="text_font_size + 0.1 > 3"
              color="primary"
            />
          </div>
          <div
            class="pl-10 pt-10"
            :style="{ 'font-size': `${text_font_size}em` }"
          >
            <h2>{{ selected_song.titel }}</h2>
            <div style="overflow: scroll">
              <StrophenList
                :text="selected_song?.text"
                :show_extra_strophen_data="false"
                :show_text_only="true"
              />
            </div>
          </div>
        </pane>
      </splitpanes>
    </div>
    <v-btn
      icon="mdi-close"
      @click="close_dialog"
      size="small"
      class="close-button"
      variant="text"
    />
  </v-dialog>
</template>

<style lang="scss">
.close-button {
  position: absolute;
  top: 5px;
  right: 50px;
  z-index: 5;
}

.book-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  perspective: 1200px;
}

.book {
  transform-style: preserve-3d;
  position: relative;
  height: 89vh;
  backface-visibility: visible;
  transform: scaleY(0.3);
  transition: transform 1s ease-in-out;
}

.book-border {
  border: 5px solid #800000;
  border-radius: 5px;
}

.book.book-open {
  transform: scaleY(1.1);
}

.book.book-closing {
  transition-duration: 1.1s;
}

.front,
.back,
.page1,
.page2,
.page3,
.page4,
.page5,
.page6 {
  transform-style: preserve-3d;
  position: absolute;
  width: 40.2vw;
  height: 100%;
  top: 0;
  left: 0;
  transform: scaleX(0.3);
  transform-origin: left center;
}

.front,
.back {
  background: rgb(24, 103, 192);
}

.front,
.page1,
.page3,
.page5 {
  border-bottom-right-radius: 0.5em;
  border-top-right-radius: 0.5em;
  box-shadow: 0 1em 3em 0 rgba(0, 0, 0, 0.2);
}

.back,
.page2,
.page4,
.page6 {
  border-bottom-right-radius: 0.5em;
  border-top-right-radius: 0.5em;
  box-shadow: 0 1em 3em 0 rgba(0, 0, 0, 0.2);
}

// Mixin to generate keyframe animations and apply them
@mixin animateTransform(
  $rotate-duration,
  $rotate-deg,
  $scaleX,
  $reverse-rotate-duration
) {
  $unique-id: random(100000);
  @keyframes rotateAnimation-open-#{$unique-id} {
    from {
      transform: rotateY(0deg) scaleX(0.3);
    }
    to {
      transform: rotateY($rotate-deg) scaleX($scaleX);
    }
  }

  @keyframes rotateAnimation-close-#{$unique-id} {
    from {
      transform: rotateY(0deg) scaleX(0.3);
    }
    to {
      transform: rotateY($rotate-deg) scaleX($scaleX);
    }
  }

  // Forward animations
  &.book-open {
    animation: rotateAnimation-open-#{$unique-id} $rotate-duration forwards ease-in-out;
  }

  // Reverse animations
  &.book-closing {
    animation: rotateAnimation-close-#{$unique-id} $reverse-rotate-duration reverse
      ease-in-out;
  }
}

.front {
  transition: box-shadow 0.35s ease-in-out; // transform .5s ease-in-out,
  @include animateTransform(0.5s, -179.99deg, 1.23, 1.1s);
}

.page1 {
  background: #dfdfdf;
  transition: box-shadow 0.35s ease-in-out; // transform .7s ease-in-out,
  @include animateTransform(0.7s, -179.6deg, 1.21, 0.9s);
}

.page3 {
  background: #e5e5e5;
  transition: box-shadow 0.35s ease-in-out; // transform 0.9s ease-in-out,
  @include animateTransform(0.9s, -179.2deg, 1.19, 0.7s);
}

.page5 {
  background: #fcfcfc;
  transition: box-shadow 0.35s ease-in-out; // transform 1.1s ease-in-out,
  @include animateTransform(1.1s, -178.7deg, 1.166, 0.5s);
}

.page2 {
  background: #fcfcfc;
  transition: box-shadow 0.35s ease-in-out; // transform 1.1s ease-in-out,
  @include animateTransform(1.1s, -1.3deg, 1.166, 0.5s);
}

.page4 {
  background: #e5e5e5;
  transition: box-shadow 0.35s ease-in-out; // transform 0.9s ease-in-out,
  @include animateTransform(0.9s, -0.8deg, 1.19, 0.7s);
}

.page6 {
  background: #dfdfdf;
  transition: box-shadow 0.35s ease-in-out; // transform 0.7s ease-in-out,
  @include animateTransform(0.7s, -0.4deg, 1.21, 0.9s);
}

.back {
  transition: box-shadow 0.35s ease-in-out; // transform .5s ease-in-out,
  @include animateTransform(0.5s, 0deg, 1.23, 1.1s);
}

.flip-content {
  transform: scaleX(-1) !important;
}

.display-pane {
  position: fixed;
  top: 0;
  left: 0;
  width: 95vw;
  height: 96.6vh;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0.8rem 3rem;
  border-radius: 5px;
  background-color: #fcfcfc;
}

.splitter-icon {
  position: absolute;
  top: 50%;
  margin-left: 15px;
  transform: translate(-50%, -50%);
  z-index: 2;
  pointer-events: none;
  background-color: #fcfcfc;
  padding: 20px 0px;
}

.splitpanes.default-theme .splitpanes__pane {
  background-color: #fcfcfc;
}

.splitpanes__splitter {
  background-color: #ccc;
  position: relative;
}
.splitpanes__splitter:before {
  content: "" !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  transition: opacity 0.4s !important;
  background-color: rgba(237, 237, 237, 0.3) !important;
  opacity: 0 !important;
  z-index: 1 !important;
}
.splitpanes__splitter:hover:before {
  opacity: 1 !important;
}
.splitpanes--vertical > .splitpanes__splitter:before {
  left: -30px;
  right: -30px;
  height: 100%;
}
.splitpanes--horizontal > .splitpanes__splitter:before {
  top: -30px;
  bottom: -30px;
  width: 100%;
}

.splitpanes__splitter:after {
  position: absolute;
  content: "" !important;
  padding-left: 14px;
  height: 100%;
  border-right: 3px rgb(24, 103, 192) solid;
}
</style>
