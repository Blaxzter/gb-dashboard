<template>
  <div v-if="includeTitle" class="text-h6 mx-auto mb-1">
    <span class="me-2"> Strophen (Silbenmodus) </span>
  </div>
  <div
    v-for="(strophe, index) in editableStrophen"
    :key="index"
    :style="{ 'max-width': !includeTitle ? '' : '500px' }"
    class="mx-auto"
  >
    <div class="d-flex py-3 px-5">
      <div class="pb-0 me-3" style="white-space: nowrap">{{ index + 1 }}.</div>
      <div class="pb-0 syllable-edit-area">
        <div
          v-for="(line, lineIndex) in strophe.lines"
          :key="lineIndex"
          class="syllable-line"
        >
          <span
            v-for="(char, charIndex) in line.characters"
            :key="`${lineIndex}-${charIndex}`"
            class="character-container"
          >
            <!-- Clickable space before character for inserting syllable symbols -->
            <span
              class="syllable-insert-point"
              @click="insertSyllableSymbol(index, lineIndex, charIndex)"
            ></span>
            <!-- The actual character -->
            <span
              :class="{ 'syllable-symbol': char === '¬' }"
              @click="
                char === '¬'
                  ? removeSyllableSymbol(index, lineIndex, charIndex)
                  : null
              "
            >
              {{ formatCharacterDisplay(char) }}
            </span>
          </span>
          <!-- Final insert point at end of line -->
          <span
            class="syllable-insert-point"
            @click="
              insertSyllableSymbol(index, lineIndex, line.characters.length)
            "
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import _ from "lodash";

export default {
  name: "SyllableEditList",
  props: {
    text: {
      type: Object,
      required: true,
    },
    includeTitle: {
      type: Boolean,
      default: true,
    },
    showSyllableSymbols: {
      type: Boolean,
      default: false,
    },
    showSpacesAsDots: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update-strophen"],
  data: () => ({
    editableStrophen: [],
  }),
  watch: {
    text: {
      handler() {
        this.initializeEditableStrophen();
      },
      deep: true,
    },
  },
  mounted() {
    this.initializeEditableStrophen();
  },
  methods: {
    initializeEditableStrophen() {
      this.editableStrophen =
        this.text?.strophenEinzeln?.map((strophe) => {
          const lines = strophe.strophe.split("\n").map((line) => ({
            characters: line.split(""),
          }));
          return {
            ...strophe,
            lines,
          };
        }) || [];
    },

    formatCharacterDisplay(char) {
      // Always show syllable symbols in edit mode
      if (char === "¬") {
        return char;
      }

      // Always show spaces as dots in edit mode for better visibility
      if (char === " ") {
        return "·";
      }

      return char;
    },

    insertSyllableSymbol(stropheIndex, lineIndex, charIndex) {
      const line = this.editableStrophen[stropheIndex].lines[lineIndex];
      line.characters.splice(charIndex, 0, "¬");
      this.updateOriginalStrophen();
    },

    removeSyllableSymbol(stropheIndex, lineIndex, charIndex) {
      const line = this.editableStrophen[stropheIndex].lines[lineIndex];
      if (line.characters[charIndex] === "¬") {
        line.characters.splice(charIndex, 1);
        this.updateOriginalStrophen();
      }
    },

    updateOriginalStrophen() {
      // Convert back to original format and emit update
      const updatedStrophen = this.editableStrophen.map((strophe) => ({
        ...strophe,
        strophe: strophe.lines
          .map((line) => line.characters.join(""))
          .join("\n"),
      }));

      this.$emit("update-strophen", updatedStrophen);
    },
  },
};
</script>

<style scoped>
.syllable-edit-area {
  font-family: monospace;
  line-height: 1.6;
}

.syllable-line {
  display: block;
  margin-bottom: 4px;
  word-break: break-all;
  word-wrap: break-word;
}

.character-container {
  position: relative;
  display: inline-block;
}

.syllable-insert-point {
  position: absolute;
  left: -3px;
  width: 6px;
  height: 1.2em;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: border-color 0.2s;
  border-left-width: 0;
}

.syllable-insert-point:hover {
  border-left-width: 6px;
  border-left-color: #1976d2aa;
  height: 1.2em;
  top: 0.2em;
  background-color: rgba(25, 118, 210, 0.1);
}

.syllable-symbol {
  color: #1976d2;
  font-weight: bold;
  cursor: pointer;
  padding: 0 1px;
  border-radius: 2px;
  transition: background-color 0.2s;
}

.syllable-symbol:hover {
  background-color: #e3f2fd;
}

/* Allow line breaks at dot positions when showing spaces as dots */
.syllable-line {
  display: block;
  margin-bottom: 4px;
  word-break: break-all;
  word-wrap: break-word;
}

/* Specific styling for dot replacements */
.character-container:has(.dot-replacement) {
  word-break: break-all;
}

/* Ensure dots are visible when replacing spaces */
span:has-text("·") {
  word-break: break-all;
}
</style>
