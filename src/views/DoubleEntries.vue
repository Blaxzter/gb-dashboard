<template>
  <div>
    <div class="text-h4 mb-6">Doppelte Elemente</div>
    <div class="mb-2 d-flex align-center">
      <v-btn-toggle v-model="toggle" mandatory variant="tonal">
        <v-btn @click="toggle = 0" color="primary">
          <v-icon class="me-2">mdi-music</v-icon>
          Gesangbuchlieder
        </v-btn>
        <v-btn @click="toggle = 1" color="primary">
          <v-icon class="me-2">mdi-text-box</v-icon>
          Texte
        </v-btn>
        <v-btn @click="toggle = 2" color="primary">
          <v-icon class="me-2">mdi-music-note</v-icon>
          Melodien
        </v-btn>
        <v-btn @click="toggle = 3" color="primary">
          <v-icon class="me-2">mdi-file-document</v-icon>
          Dateien
        </v-btn>
        <v-btn @click="toggle = 4" color="primary">
          <v-icon class="me-2">mdi-account</v-icon>
          Autor
        </v-btn>
      </v-btn-toggle>
      <v-spacer></v-spacer>
      <div class="d-flex align-center">
        <div class="me-2">
          Vergleichsart: <br />
          <strong>{{ similarity_type_show ? "Ähnlich" : "Gleich" }}</strong>
        </div>
        <v-icon
          size="40"
          class="me-2"
          @click="similarity_type_show = !similarity_type_show"
          :color="similarity_type_show ? 'primary' : ''"
        >
          mdi-magnify
        </v-icon>
        <v-expand-x-transition :duration="500">
          <div
            class="d-flex justify-center"
            style="width: 90px"
            v-if="similarity_type_show"
          >
            <v-text-field
              v-model="dice_threshold_temp"
              variant="underlined"
              append-icon="mdi-send"
              type="number"
              label="Prozent"
              @click:append="
                dice_threshold = dice_threshold_temp;
                similarity_type = true;
              "
              density="compact"
              hide-details
            >
            </v-text-field>
          </div>
        </v-expand-x-transition>
      </div>
    </div>
    <div class="text-body-1">
      Gefundene Einträge: {{ filtered_entries.length }}
      <span v-if="toggle >= 3">Klicke auf die chips um die ID zu kopieren</span>
    </div>
    <v-list v-if="toggle < 3">
      <v-list-group
        v-for="(duplicates, idx) in filtered_entries"
        :key="idx + 'toggle' + toggle"
        prepend-icon="mdi-cursor-pointer"
      >
        <template v-slot:activator="{ props }">
          <v-list-item
            v-bind="props"
            :title="duplicates[0].titel + ' (' + duplicates.length + 'x)'"
          ></v-list-item>
        </template>

        <template v-if="toggle === 0">
          <v-list-item
            v-for="(song, i) in duplicates"
            :key="'song' + i"
            @click="openSong(song)"
            variant="outlined"
            class="mb-2 rounded-lg"
          >
            <template v-slot:prepend>
              <v-icon>mdi-music</v-icon>
            </template>
            <v-list-item-title class="text-wrap text-body-1 v-row align-center">
              <span
                v-if="similarity_type"
                class="font-weight-bold v-col-12 pb-0"
                >{{ song.titel }}</span
              >
              <div class="v-col-1">
                ID:<span class="font-weight-bold">{{ song.id }}</span>
              </div>
              <span class="v-col-1"
                ><v-icon icon="mdi-file" />
                {{ song.melodie?.files?.length || "-" }}</span
              >
              <span class="v-col-1"
                ><v-icon icon="mdi-text-box" />
                {{ song.text?.strophenEinzeln?.length || "-" }}</span
              >
              <span class="v-col-5">{{
                song.text?.strophen_connected_short || "Keine Strophen"
              }}</span>
              <span class="v-col-1"
                ><v-icon icon="mdi-text-box-edit" />
                {{ song?.text?.auftrag?.length || "-" }}</span
              >
              <span class="v-col-1"
                ><v-icon icon="mdi-music-clef-treble" />
                {{ song?.melodie?.auftrag?.length || "-" }}</span
              >
            </v-list-item-title>
          </v-list-item>
        </template>
        <template v-if="toggle === 1">
          <v-list-item
            v-for="(text, i) in duplicates"
            :key="'text' + i"
            @click="openSong(text)"
            variant="outlined"
            class="mb-2 rounded-lg"
          >
            <template v-slot:prepend>
              <v-icon>mdi-text-box</v-icon>
            </template>
            <v-list-item-title class="text-wrap text-body-1 v-row align-center">
              <span
                v-if="similarity_type"
                class="font-weight-bold v-col-12 pb-0"
                >{{ text.titel }}</span
              >
              <span class="font-weight-bold v-col-1">{{ text.id }}</span>
              <span class="v-col-4">{{ text.strophen_connected_short }}</span>
              <span class="v-col-1"
                ><v-icon icon="mdi-text-box-edit" />
                {{ text?.auftrag?.length || "-" }}</span
              >
              <span class="v-col-6">{{ text?.anmerkung || "-" }}</span>
            </v-list-item-title>
          </v-list-item>
        </template>
        <template v-if="toggle === 2">
          <v-list-item
            v-for="(melodie, i) in duplicates"
            :key="'melodie' + i"
            @click="openSong(melodie)"
            variant="outlined"
            class="mb-2 rounded-lg"
          >
            <template v-slot:prepend>
              <v-icon>mdi-music-note</v-icon>
            </template>
            <v-list-item-title class="text-wrap text-body-1 v-row align-center">
              <span
                v-if="similarity_type"
                class="font-weight-bold v-col-12 pb-0"
                >{{ melodie.titel }}</span
              >
              <div class="v-col-1">
                ID:<span class="font-weight-bold">{{ melodie.id }}</span>
              </div>
              <span class="v-col-1"
                ><v-icon icon="mdi-file" />
                {{ melodie?.files?.length || "-" }}</span
              >
              <span class="v-col-10">{{ melodie?.anmerkung || "-" }}</span>
            </v-list-item-title>
          </v-list-item>
        </template>
      </v-list-group>
    </v-list>
    <v-list v-else>
      <v-list-item v-for="(duplicates, idx) in filtered_entries" :key="idx">
        <template v-slot:title>
          <template v-if="toggle === 3">
            <div class="d-flex flex-wrap">
              <span class="me-2"
                >{{ duplicates.length }}x {{ duplicates[0].title }}</span
              >
              <br v-if="similarity_type" />
              <template v-for="(obj, idx) in duplicates" :key="obj.id">
                <v-chip
                  class="me-2"
                  :class="{ 'mb-1': similarity_type }"
                  @click="copy_to_clipboard(obj.id)"
                >
                  {{ idx + 1 }}.
                  {{ similarity_type ? obj.filename_download : "" }}
                  {{ obj.filesize }} bytes
                </v-chip>
              </template>
            </div>
          </template>
          <template v-else>
            <div class="d-flex flex-wrap align-center">
              <span class="me-2">{{ duplicates.length }}x</span>
              <v-chip
                v-for="(obj, idx) in duplicates"
                :key="obj.id"
                class="me-2"
                :class="{ 'mb-1': similarity_type }"
                @click="copy_to_clipboard(obj.id)"
              >
                {{
                  `${idx + 1}. ${obj.vorname} ${obj.nachname}` +
                  (obj.geburtsjahr || obj.sterbejahr
                    ? ` (${obj.geburtsjahr ? "*" + obj.geburtsjahr : ""} ${obj.sterbejahr ? " - " + obj.sterbejahr : ""})`
                    : "")
                }}
                -
                {{
                  count_text_and_melodie_entries_per_author(obj)
                }}
                Lieder/Texte
              </v-chip>
            </div>
          </template>
        </template>
      </v-list-item>
    </v-list>

    <v-dialog
      v-model="duplicates_dialog"
      width="700"
      @close="modalClose"
      v-if="toggle === 0"
    >
      <GesangbuchLiedComponent
        :selected_song="selected_element"
        @close="duplicates_dialog = false"
      />
    </v-dialog>
    <v-dialog
      v-model="duplicates_dialog"
      width="700"
      @close="modalClose"
      v-else-if="toggle === 1"
    >
      <TextDialog :text="selected_element" @close="duplicates_dialog = false" />
    </v-dialog>
    <v-dialog
      v-model="duplicates_dialog"
      width="700"
      @close="modalClose"
      v-else-if="toggle === 2"
    >
      <MelodieDialog
        :melodie="selected_element"
        @close="duplicates_dialog = false"
      />
    </v-dialog>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { useAppStore } from "@/store/app";
import _ from "lodash";
import GesangbuchLiedComponent from "@/components/SongRelated/GesangbuchLiedComponent.vue";
import MelodieDialog from "@/components/SongRelated/MelodieDialog.vue";
import TextDialog from "@/components/SongRelated/TextDialog.vue";

export default defineComponent({
  name: "DoubleEntries",
  components: { TextDialog, MelodieDialog, GesangbuchLiedComponent },
  data: () => ({
    toggle: 0,
    similarity_type: false,
    similarity_type_show: false,
    dice_threshold: 80,
    dice_threshold_temp: 80,
    store: useAppStore(),
    duplicates_dialog: false,
    selected_element: null,
  }),
  mounted() {
    if (this.$route.query.kategorie) {
      switch (this.$route.query.kategorie) {
        case "Gesangbuchlieder":
          this.toggle = 0;
          break;
        case "Texte":
          this.toggle = 1;
          break;
        case "Melodien":
          this.toggle = 2;
          break;
        case "Dateien":
          this.toggle = 3;
          break;
        case "Autoren":
          this.toggle = 4;
          break;
      }
    }
  },
  watch: {
    toggle() {
      this.$router.replace({
        query: { kategorie: this.toggle_to_kategorie(this.toggle) },
      });
    },
    similarity_type_show() {
      if (!this.similarity_type_show) {
        this.similarity_type = false;
      }
    },
  },
  computed: {
    filtered_entries() {
      let entries = this.entries;
      let flattened_entries = [];
      let ret_list = [];

      for (let entry of entries) {
        let exists = false;
        for (let element of entry) {
          if (
            this.toggle >= 3 &&
            _.find(flattened_entries, { id: element.id })
          ) {
            exists = true;
            break;
          } else if (flattened_entries.includes(element)) {
            exists = true;
            break;
          }
        }

        if (!exists) {
          ret_list.push(entry);
          flattened_entries = flattened_entries.concat(entry);
        }
      }
      return ret_list;
    },
    entries() {
      switch (this.toggle) {
        case 0:
          return this.doubleEntriesGesangbuchlieder;
        case 1:
          return this.doubleEntriesText;
        case 2:
          return this.doubleEntriesMelodie;
        case 3:
          return this.doubleEntriesFiles;
        case 4:
          return this.doubleEntriesAuthor;
      }
      return [];
    },
    doubleEntriesGesangbuchlieder() {
      return _.filter(
        _.map(this.store.gesangbuchlieder, (entry) => {
          return _.filter(this.store.gesangbuchlieder, (entry2) => {
            if (!this.similarity_type) {
              return entry.titel === entry2.titel;
            }

            if (entry.titel === null || _.isEmpty(entry.titel)) {
              return entry2.titel === null || _.isEmpty(entry2.titel);
            }
            if (entry2.titel === null || _.isEmpty(entry2.titel)) {
              return false;
            }

            // eslint-disable-next-line no-undef
            return (
              stringSimilarity.compareTwoStrings(entry.titel, entry2.titel) >
              this.dice_threshold / 100
            );
          });
        }),
        (entry) => {
          return entry.length > 1;
        },
      );
    },
    doubleEntriesText() {
      return _.filter(
        _.map(this.store.texts, (entry) => {
          return _.filter(this.store.texts, (entry2) => {
            if (!this.similarity_type) {
              return entry.titel === entry2.titel;
            }

            if (entry.titel === null || _.isEmpty(entry.titel)) {
              return entry2.titel === null || _.isEmpty(entry2.titel);
            }
            if (entry2.titel === null || _.isEmpty(entry2.titel)) {
              return false;
            }

            // eslint-disable-next-line no-undef
            return (
              stringSimilarity.compareTwoStrings(entry.titel, entry2.titel) >
              this.dice_threshold / 100
            );
          });
        }),
        (entry) => {
          return entry.length > 1;
        },
      );
    },
    doubleEntriesMelodie() {
      return _.filter(
        _.map(this.store.melodies, (entry) => {
          return _.filter(this.store.melodies, (entry2) => {
            if (!this.similarity_type) {
              return entry.titel === entry2.titel;
            }

            if (entry.titel === null || _.isEmpty(entry.titel)) {
              return entry2.titel === null || _.isEmpty(entry2.titel);
            }
            if (entry2.titel === null || _.isEmpty(entry2.titel)) {
              return false;
            }

            // eslint-disable-next-line no-undef
            return (
              stringSimilarity.compareTwoStrings(entry.titel, entry2.titel) >
              this.dice_threshold / 100
            );
          });
        }),
        (entry) => {
          return entry.length > 1;
        },
      );
    },
    doubleEntriesAuthor() {
      return _.filter(
        _.map(this.store.author, (entry) => {
          return _.filter(this.store.author, (entry2) => {
            let first = `${entry.vorname} ${entry.nachname}`;
            let second = `${entry2.vorname} ${entry2.nachname}`;

            if (!this.similarity_type) {
              return first === second;
            }

            if (_.isEmpty(first)) {
              return _.isEmpty(second);
            }

            // eslint-disable-next-line no-undef
            return (
              stringSimilarity.compareTwoStrings(first, second) >
              this.dice_threshold / 100
            );
          });
        }),
        (entry) => {
          return entry.length > 1;
        },
      );
    },
    doubleEntriesFiles() {
      return _.filter(
        _.map(this.store.files, (entry) => {
          return _.filter(
            _.map(this.store.files, (entry2) => ({
              ...entry2,
              titel: entry2.title,
            })),
            (entry2) => {
              if (!this.similarity_type) {
                return entry.title === entry2.title;
              }

              // eslint-disable-next-line no-undef
              return (
                stringSimilarity.compareTwoStrings(entry.title, entry2.title) >
                0.8
              );
            },
          );
        }),
        (entry) => {
          return entry.length > 1;
        },
      );
    },
  },
  methods: {
    copy_to_clipboard(text) {
      navigator.clipboard.writeText(text);
    },
    count_text_and_melodie_entries_per_author(author) {
      let count = 0;
      for (let text of this.store.texts) {
        if (text.autorId.includes(author.id)) {
          count++;
        }
      }
      for (let melodie of this.store.melodies) {
        if (melodie.autorId.includes(author.id)) {
          count++;
        }
      }
      return count;
    },
    modalClose() {
      this.duplicates_dialog = false;
      this.selected_element = null;
    },
    openSong(song) {
      this.selected_element = song;
      this.duplicates_dialog = true;
    },
    toggle_to_kategorie(toggle) {
      switch (toggle) {
        case 0:
          return "Gesangbuchlieder";
        case 1:
          return "Texte";
        case 2:
          return "Melodien";
        case 3:
          return "Dateien";
        case 4:
          return "Autoren";
      }
    },
  },
});
</script>

<style scoped></style>
