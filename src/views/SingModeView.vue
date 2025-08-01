<template>
  <v-container fluid class="h-100">
    <!-- Selection Layout -->
    <div v-if="!showSongView" class="h-100">
      <div class="d-flex align-center justify-space-between mb-8">
        <div class="text-h4">Fokusmodus Konfiguration</div>
        <v-btn
          :color="isSelectionLinked ? 'primary' : 'black'"
          :variant="isSelectionLinked ? 'tonal' : 'outlined'"
          @click="toggleSelectionLink"
        >
          <v-icon start>{{
            isSelectionLinked ? "mdi-link" : "mdi-link-off"
          }}</v-icon>
          {{ isSelectionLinked ? "Auswahl vereint" : "Auswahl getrennt" }}
        </v-btn>
      </div>

      <!-- Linked Song Selection -->
      <div v-if="isSelectionLinked" class="mb-6">
        <div class="text-h5 mb-4">Gesangbuchlied auswählen</div>
        <v-autocomplete
          v-model="selectedLinkedSong"
          label="Suche nach existierenden Gesangbuchliedern"
          :items="store_gesangbuchlieder"
          :custom-filter="custom_filter"
          item-title="titel"
          item-value="id"
          hide-details="auto"
          class="mb-4"
          return-object
          clearable
          @update:model-value="onLinkedSongSelected"
        >
          <template #item="{ props, item }">
            <v-list-item
              v-bind="props"
              :title="
                item?.raw?.titel +
                (item?.raw?.text?.strophenEinzeln
                  ? ' - #' +
                    item?.raw?.text?.strophenEinzeln?.length +
                    ' Strophen'
                  : '')
              "
              :subtitle="item?.raw?.author_name"
            >
              <span style="font-size: 0.8rem">{{
                item?.raw?.text?.strophe_short
              }}</span>
            </v-list-item>
          </template>
        </v-autocomplete>

        <!-- File Selection for Linked Mode -->
        <div
          v-if="selectedLinkedSong && availableLinkedMediaFiles.length > 0"
          class="mt-6"
        >
          <div class="text-h6 mb-3">Datei auswählen:</div>

          <div class="file-grid">
            <div
              v-for="file in availableLinkedMediaFiles"
              :key="file.id"
              class="file-card"
              :class="{
                'file-card--selected': selectedMediaFile?.id === file.id,
              }"
              @click="selectedMediaFile = file"
            >
              <v-icon
                :icon="getFileIcon(file)"
                size="40"
                :color="selectedMediaFile?.id === file.id ? 'primary' : 'grey'"
                class="mb-2"
              />
              <div class="text-caption text-center">
                {{ file.title || file.filename_download }}
              </div>
              <div class="text-overline text-center">
                {{ getFileTypeLabel(file) }}
              </div>
            </div>
          </div>

          <v-alert
            v-if="!selectedMediaFile"
            type="info"
            variant="tonal"
            class="mt-3"
          >
            Bitte wählen Sie eine Datei aus
          </v-alert>
        </div>

        <v-alert
          v-else-if="
            selectedLinkedSong && availableLinkedMediaFiles.length === 0
          "
          type="warning"
          variant="tonal"
          class="mt-4"
        >
          Keine Mediendateien für dieses Lied verfügbar
        </v-alert>

        <!-- Text Preview for Linked Mode -->
        <div v-if="selectedLinkedSong?.text?.strophenEinzeln" class="mt-6">
          <div class="text-h6 mb-3">Textvorschau:</div>
          <div class="preview-box">
            <h3>
              {{ selectedLinkedSong?.text?.titel || selectedLinkedSong?.titel }}
            </h3>
            <div
              v-for="(
                strophe, index
              ) in selectedLinkedSong.text.strophenEinzeln.slice(0, 2)"
              :key="index"
              class="mb-2"
            >
              <strong>{{ index + 1 }}.</strong>
              {{ strophe.strophe }}
            </div>
            <div
              v-if="selectedLinkedSong.text.strophenEinzeln.length > 2"
              class="text-caption"
            >
              ... und
              {{ selectedLinkedSong.text.strophenEinzeln.length - 2 }} weitere
              Strophen
            </div>
          </div>
        </div>
      </div>

      <!-- Two Column Selection Layout (when not linked) -->
      <div v-else class="selection-layout">
        <!-- Left Column: Melodie Selection -->
        <div class="melodie-section">
          <v-card variant="outlined" class="h-100">
            <v-card-title class="d-flex align-center">
              <v-icon class="me-2">mdi-music</v-icon>
              Melodie & Noten
            </v-card-title>
            <v-card-text class="flex-grow-1">
              <!-- Audio/Melodie Selection -->
              <div class="mb-4">
                <div class="text-h6 mb-3">Melodie auswählen</div>
                <v-autocomplete
                  v-model="selectedMelodie"
                  label="Suche nach Melodien"
                  :items="store_melodien"
                  :custom-filter="custom_filter"
                  item-title="titel"
                  item-value="id"
                  hide-details="auto"
                  class="mb-4"
                  return-object
                  clearable
                  @update:model-value="onMelodieSelected"
                >
                  <template #item="{ props, item }">
                    <v-list-item
                      v-bind="props"
                      :title="item?.raw?.titel"
                      :subtitle="item?.raw?.author_name"
                    >
                      <template #append>
                        <v-chip size="small" color="primary">
                          {{ item?.raw?.files?.length || 0 }} Dateien
                        </v-chip>
                      </template>
                    </v-list-item>
                  </template>
                </v-autocomplete>
              </div>

              <!-- File Selection -->
              <div v-if="selectedMelodie && availableMediaFiles.length > 0">
                <div class="text-subtitle-1 mb-3">Datei auswählen:</div>

                <div class="file-grid">
                  <div
                    v-for="file in availableMediaFiles"
                    :key="file.id"
                    class="file-card"
                    :class="{
                      'file-card--selected': selectedMediaFile?.id === file.id,
                    }"
                    @click="selectedMediaFile = file"
                  >
                    <v-icon
                      :icon="getFileIcon(file)"
                      size="40"
                      :color="
                        selectedMediaFile?.id === file.id ? 'primary' : 'grey'
                      "
                      class="mb-2"
                    />
                    <div class="text-caption text-center">
                      {{ file.title || file.filename_download }}
                    </div>
                    <div class="text-overline text-center">
                      {{ getFileTypeLabel(file) }}
                    </div>
                  </div>
                </div>

                <v-alert
                  v-if="!selectedMediaFile"
                  type="info"
                  variant="tonal"
                  class="mt-3"
                >
                  Bitte wählen Sie eine Datei aus
                </v-alert>
              </div>

              <v-alert
                v-else-if="selectedMelodie && availableMediaFiles.length === 0"
                type="warning"
                variant="tonal"
              >
                Keine Mediendateien für diese Melodie verfügbar
              </v-alert>

              <v-alert v-else-if="!selectedMelodie" type="info" variant="tonal">
                Bitte wählen Sie eine Melodie aus
              </v-alert>
            </v-card-text>
          </v-card>
        </div>

        <!-- Right Column: Text Selection -->
        <div class="text-section">
          <v-card variant="outlined" class="h-100">
            <v-card-title class="d-flex align-center">
              <v-icon class="me-2">mdi-text</v-icon>
              Text & Strophen
            </v-card-title>
            <v-card-text class="flex-grow-1">
              <!-- Text Selection -->
              <div class="mb-4">
                <div class="text-h6 mb-3">Text auswählen</div>
                <v-autocomplete
                  v-model="selectedText"
                  label="Suche nach Texten"
                  :items="store_texte"
                  :custom-filter="custom_filter"
                  item-title="titel"
                  item-value="id"
                  hide-details="auto"
                  class="mb-4"
                  return-object
                  clearable
                  @update:model-value="onTextSelected"
                >
                  <template #item="{ props, item }">
                    <v-list-item
                      v-bind="props"
                      :title="item?.raw?.titel"
                      :subtitle="item?.raw?.author_name"
                    >
                      <template #append>
                        <v-chip size="small" color="primary">
                          {{ item?.raw?.strophenEinzeln?.length || 0 }} Strophen
                        </v-chip>
                      </template>
                      <span style="font-size: 0.8rem">{{
                        item?.raw?.strophe_short
                      }}</span>
                    </v-list-item>
                  </template>
                </v-autocomplete>
              </div>

              <!-- Text Preview -->
              <div v-if="selectedText?.strophenEinzeln">
                <div class="text-subtitle-1 mb-2">Textvorschau:</div>
                <div class="preview-box">
                  <h3>{{ selectedText?.titel }}</h3>
                  <div
                    v-for="(
                      strophe, index
                    ) in selectedText.strophenEinzeln.slice(0, 2)"
                    :key="index"
                    class="mb-2"
                  >
                    <strong>{{ index + 1 }}.</strong>
                    {{ strophe.strophe }}
                  </div>
                  <div
                    v-if="selectedText.strophenEinzeln.length > 2"
                    class="text-caption"
                  >
                    ... und
                    {{ selectedText.strophenEinzeln.length - 2 }} weitere
                    Strophen
                  </div>
                </div>

                <v-alert type="success" variant="tonal" class="mt-3">
                  Text verfügbar und bereit zur Anzeige
                </v-alert>
              </div>
              <div v-else-if="!selectedText">
                <v-alert type="info" variant="tonal">
                  Bitte wählen Sie einen Text aus
                </v-alert>
              </div>
              <div v-else>
                <v-alert type="warning" variant="tonal">
                  Ausgewählter Text hat keine Strophen
                </v-alert>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </div>

      <!-- Start Button -->
      <div class="d-flex justify-center mt-6">
        <v-btn
          color="primary"
          size="large"
          :disabled="!canStartSingMode"
          @click="startSingMode"
        >
          <v-icon start>mdi-play</v-icon>
          Singemodus starten
        </v-btn>
      </div>
    </div>

    <!-- Song Display View -->
    <div v-else class="h-100">
      <div class="display-pane" :class="{ 'fullscreen-mode': isFullscreen }">
        <!-- Top Bar -->
        <div class="top-bar">
          <div class="top-bar-left">
            <v-btn
              icon="mdi-arrow-left"
              variant="text"
              color="primary"
              @click="goBackToSelection"
            >
              <v-icon>mdi-arrow-left</v-icon>
            </v-btn>
            <span class="text-h6 ml-3">
              {{ selectedText?.titel || selectedMelodie?.titel }}
            </span>
          </div>

          <div class="top-bar-right">
            <v-btn
              :icon="isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
              variant="text"
              color="primary"
              @click="toggleFullscreen"
            >
              <v-icon>{{
                isFullscreen ? "mdi-fullscreen-exit" : "mdi-fullscreen"
              }}</v-icon>
            </v-btn>
          </div>
        </div>

        <!-- Splitter Icon -->
        <v-icon
          icon="mdi-arrow-split-vertical"
          color="primary"
          class="splitter-icon"
          :style="{ left: `${position}%` }"
        />

        <!-- Split Panes Display -->
        <div class="splitpanes-container">
          <splitpanes :dbl-click-splitter="false" @resize="setPosition">
            <pane min-size="20">
              <div class="position-relative h-100" style="overflow: auto">
                <MediaComponent
                  :file="selectedMediaFile"
                  :sing-mode-screen="true"
                />
              </div>
            </pane>
            <pane min-size="20" style="overflow: auto">
              <div class="pane-controls">
                <v-btn
                  icon="mdi-magnify-minus-outline"
                  variant="text"
                  :disabled="text_font_size - 0.1 < 0.5"
                  color="primary"
                  @click="decreaseFontSize"
                />
                <v-btn
                  icon="mdi-magnify-plus-outline"
                  variant="text"
                  :disabled="text_font_size + 0.1 > 3"
                  color="primary"
                  @click="increaseFontSize"
                />
              </div>
              <div
                class="text-content"
                :style="{ 'font-size': `${text_font_size}em` }"
              >
                <h2>{{ selectedText?.titel || selectedMelodie?.titel }}</h2>
                <StrophenList
                  :text="selectedText"
                  :show-extra-strophen-data="false"
                  :show-text-only="true"
                  :include-title="false"
                />
              </div>
            </pane>
          </splitpanes>
        </div>
      </div>
    </div>
  </v-container>
</template>

<script>
import { useAppStore } from "@/store/app";
import _ from "lodash";
import StrophenList from "@/components/SongRelated/StrophenList.vue";
import MediaComponent from "@/components/SongRelated/MediaComponent.vue";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";

export default {
  name: "SingModeView",
  components: {
    StrophenList,
    MediaComponent,
    Splitpanes,
    Pane,
  },
  data: () => ({
    store: useAppStore(),
    selectedText: null,
    selectedMelodie: null,
    selectedMediaFile: null,
    selectedLinkedSong: null,
    isSelectionLinked: true, // Default to linked mode
    showSongView: false,
    text_font_size: 1.3,
    position: 50,
    isFullscreen: false,
  }),
  computed: {
    store_gesangbuchlieder() {
      return _.sortBy(this.store.gesangbuchlieder, "titel");
    },
    store_melodien() {
      // Extract all melodien from gesangbuchlieder
      const melodien = [];
      this.store.gesangbuchlieder.forEach((song) => {
        if (song.melodie) {
          melodien.push({
            ...song.melodie,
            autocomplete: `${song.melodie.titel} ${
              song.melodie.author_name || ""
            }`.toLowerCase(),
          });
        }
      });
      return _.uniqBy(_.sortBy(melodien, "titel"), "id");
    },
    store_texte() {
      // Extract all texts from gesangbuchlieder
      const texts = [];
      this.store.gesangbuchlieder.forEach((song) => {
        if (song.text) {
          texts.push({
            ...song.text,
            titel: song.text.titel || song.titel, // Use song title if text title is missing
            autocomplete: `${song.text.titel || song.titel} ${
              song.text.strophe_short || ""
            }`.toLowerCase(),
          });
        }
      });
      return _.uniqBy(_.sortBy(texts, "titel"), "id");
    },
    availableMediaFiles() {
      if (!this.selectedMelodie?.files) return [];
      return this.selectedMelodie.files;
    },
    availableLinkedMediaFiles() {
      if (!this.selectedLinkedSong?.melodie?.files) return [];
      return this.selectedLinkedSong.melodie.files;
    },
    canStartSingMode() {
      if (this.isSelectionLinked) {
        // In linked mode, need a selected song with both text and melody
        return (
          this.selectedLinkedSong &&
          this.selectedLinkedSong.text?.strophenEinzeln &&
          this.selectedLinkedSong.melodie?.files?.length > 0 &&
          this.selectedMediaFile
        );
      } else {
        // In separate mode, need individual text and melody selections
        return (
          this.selectedText &&
          this.selectedText?.strophenEinzeln &&
          this.selectedMelodie &&
          this.selectedMediaFile
        );
      }
    },
  },
  mounted() {
    // Add keyboard listener for escape key
    document.addEventListener("keydown", this.handleKeydown);
  },
  beforeUnmount() {
    // Remove keyboard listener
    document.removeEventListener("keydown", this.handleKeydown);
  },
  methods: {
    toggleSelectionLink() {
      this.isSelectionLinked = !this.isSelectionLinked;
      // Clear selections when switching modes
      this.selectedLinkedSong = null;
      this.selectedText = null;
      this.selectedMelodie = null;
      this.selectedMediaFile = null;
    },
    onLinkedSongSelected() {
      if (this.selectedLinkedSong) {
        // Automatically set text and melody from the selected song
        this.selectedText = this.selectedLinkedSong.text;
        this.selectedMelodie = this.selectedLinkedSong.melodie;

        // Clear media file selection so user must choose
        this.selectedMediaFile = null;
      } else {
        // Clear selections if no song is selected
        this.selectedText = null;
        this.selectedMelodie = null;
        this.selectedMediaFile = null;
      }
    },
    onTextSelected() {
      // Text selection changed
      console.log("Text selected:", this.selectedText);
    },
    onMelodieSelected() {
      if (this.selectedMelodie && this.availableMediaFiles.length > 0) {
        // Auto-select first media file if available
        this.selectedMediaFile = this.availableMediaFiles[0];
      } else {
        this.selectedMediaFile = null;
      }
    },
    startSingMode() {
      this.showSongView = true;
    },
    goBackToSelection() {
      this.showSongView = false;
      this.isFullscreen = false; // Reset fullscreen when going back
    },
    toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
    },
    handleKeydown(event) {
      // Exit fullscreen on Escape key
      if (event.key === "Escape" && this.isFullscreen) {
        this.isFullscreen = false;
      }
    },
    setPosition(event) {
      this.position = event[0].size;
    },
    increaseFontSize() {
      if (this.text_font_size + 0.1 <= 3) {
        this.text_font_size += 0.1;
      }
    },
    decreaseFontSize() {
      if (this.text_font_size - 0.1 >= 0.5) {
        this.text_font_size -= 0.1;
      }
    },
    custom_filter(item, queryText, itemText) {
      return itemText.raw.autocomplete
        .toLowerCase()
        .includes(queryText.toLowerCase());
    },
    getFileIcon(file) {
      if (file.type?.includes("pdf")) return "mdi-file-pdf-box";
      if (file.type?.includes("image")) return "mdi-image";
      if (file.type?.includes("audio")) return "mdi-music";
      return "mdi-file";
    },
    getFileTypeLabel(file) {
      if (file.type?.includes("pdf")) return "PDF";
      if (file.type?.includes("image")) return "Bild";
      if (file.type?.includes("audio")) return "Audio";
      return "Datei";
    },
  },
};
</script>

<style lang="scss">
// Global splitpanes styles (not scoped to fix splitpanes functionality)
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

<style lang="scss" scoped>
.selection-layout {
  display: flex;
  gap: 24px;
  height: calc(100vh - 300px);
  min-height: 400px;
}

.melodie-section,
.text-section {
  flex: 1;
  min-width: 0; // Allows flex items to shrink below their content size
}

.file-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.file-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;

  &:hover {
    border-color: #1976d2;
    background-color: #f5f5f5;
  }

  &--selected {
    border-color: #1976d2;
    background-color: rgba(25, 118, 210, 0.1);
  }
}

.preview-box {
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
  max-height: 200px;
  overflow-y: auto;
}

.display-pane {
  position: relative;
  width: 100%;
  height: 100vh;
  background-color: #fcfcfc;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease-in-out;

  &.fullscreen-mode {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    border-radius: 0;
  }
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid #e0e0e0;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.top-bar-left,
.top-bar-right {
  display: flex;
  align-items: center;
}

.splitpanes-container {
  flex: 1;
  position: relative;
}

.back-button {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  background-color: rgba(255, 255, 255, 0.9);
}

.splitter-icon {
  position: absolute;
  top: calc(50% + 30px); // Account for top bar height
  margin-left: 15px;
  transform: translate(-50%, -50%);
  z-index: 2;
  pointer-events: none;
  background-color: #fcfcfc;
  padding: 20px 0px;
}

.pane-controls {
  position: absolute;
  z-index: 20;
  padding: 8px 20px;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 0 0 8px 8px;
}

.text-content {
  padding: 60px 40px 40px;
}
</style>
