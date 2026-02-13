<script setup>
import _ from 'lodash';
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/store/app.js';
import { useUserStore } from '@/store/user.js';
import {
    chart_colors,
    chipColors,
    gesangbuch_kategorie_name_to_icon,
    status_mapping,
} from '@/assets/js/utils.js';
import MediaComponent from '@/components/SongRelated/MediaComponent.vue';
import StrophenList from '@/components/SongRelated/StrophenList.vue';

import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';

const store = useAppStore();
const userStore = useUserStore();

const { author, gesangbuchlieder } = store;

const showSongs = ref(false);

// Initialize refs for all filter states
const strophenSearch = ref('');
const selected_status = ref(null);
const selected_bewertung = ref(null);
const selected_aenderung = ref(null);
const kategorie = ref(null);
const filter_by_suggestions = ref(false);
const filter_by_remarks = ref(false);
const selected_author = ref(null);
const check_autor_copyright = ref(null);

// Snackbar state
const snackbar = ref(false);
const snackbar_message = ref('');

const route = useRoute();

const applyFilterFromLink = () => {
    try {
        // Get the current URL parameters
        const filterParam = route.query.filter;

        // If no filter parameter is present, do nothing
        if (!filterParam) {
            return;
        }

        // Decode the base64 string and parse the JSON
        const jsonString = atob(filterParam);
        const appliedFilter = JSON.parse(jsonString);

        // Reset all filters first
        strophenSearch.value = '';
        selected_status.value = null;
        selected_bewertung.value = null;
        selected_aenderung.value = null;
        kategorie.value = null;
        filter_by_suggestions.value = false;
        filter_by_remarks.value = false;
        selected_author.value = null;
        check_autor_copyright.value = null;

        // Apply each filter if it exists in the decoded object
        if (appliedFilter.strophenSearch !== undefined) {
            strophenSearch.value = appliedFilter.strophenSearch;
        }
        if (appliedFilter.selected_status !== undefined) {
            selected_status.value = appliedFilter.selected_status;
        }
        if (appliedFilter.selected_bewertung !== undefined) {
            selected_bewertung.value = appliedFilter.selected_bewertung;
        }
        if (appliedFilter.selected_aenderung !== undefined) {
            selected_aenderung.value = appliedFilter.selected_aenderung;
        }
        if (appliedFilter.kategorie !== undefined) {
            kategorie.value = appliedFilter.kategorie;
        }
        if (appliedFilter.filter_by_suggestions !== undefined) {
            filter_by_suggestions.value = appliedFilter.filter_by_suggestions;
        }
        if (appliedFilter.filter_by_remarks !== undefined) {
            filter_by_remarks.value = appliedFilter.filter_by_remarks;
        }
        if (appliedFilter.selected_author !== undefined) {
            selected_author.value = appliedFilter.selected_author;
        }
        if (appliedFilter.check_autor_copyright !== undefined) {
            check_autor_copyright.value = appliedFilter.check_autor_copyright;
        }

        snackbar_message.value = 'Filter wurden erfolgreich angewendet';
        snackbar.value = true;
        showSongs.value = true;
    } catch (error) {
        console.error('Error applying filters from URL:', error);
        snackbar_message.value = 'Fehler beim Anwenden der Filter';
        snackbar.value = true;
    }
};

const authors = computed(() => {
    return _.filter(author, (a) => {
        return selected_author.value.includes(a.id);
    }).map((a) => a.name);
});

// Watch for route changes to apply filters
watch(
    () => route.query,
    () => applyFilterFromLink(),
    { immediate: true },
);

const filtered_gesangbuchlieder = computed(() => {
    let filtered_gesangbuchlied = _.filter(
        gesangbuchlieder,
        (elem) =>
            selected_status.value == null ||
            (selected_status.value && status_mapping[elem['status']] === selected_status.value),
    );

    if (selected_bewertung.value) {
        filtered_gesangbuchlied = _.filter(
            filtered_gesangbuchlied,
            (elem) => elem['bewertung_kleiner_kreis'].bezeichner === selected_bewertung.value,
        );
    }

    if (selected_author.value && selected_author.value.length > 0) {
        filtered_gesangbuchlied = _.filter(filtered_gesangbuchlied, (elem) =>
            _.some(elem.authors, (author) => selected_author.value.includes(author.id)),
        );
    }

    // filter by selected_aenderung
    if (selected_aenderung.value) {
        filtered_gesangbuchlied = _.filter(
            filtered_gesangbuchlied,
            (elem) => elem.liedHatAenderung,
        );
    }

    filtered_gesangbuchlied = _.filter(
        filtered_gesangbuchlied,
        (elem) =>
            !filter_by_suggestions.value ||
            _.some(elem?.text?.strophenEinzeln, (obj) => {
                return _.has(obj, 'aenderungsvorschlag') && !_.isEmpty(obj.aenderungsvorschlag);
            }),
    );

    if (filter_by_remarks.value) {
        filtered_gesangbuchlied = _.filter(
            filtered_gesangbuchlied,
            (elem) =>
                !filter_by_remarks.value ||
                _.some(elem?.text?.strophenEinzeln, (obj) => {
                    return _.has(obj, 'anmerkung') && !_.isEmpty(obj.anmerkung);
                }),
        );
    }

    // get kategorie names
    const selected_kategorie_names = _.map(kategorie.value, 'name');

    if (selected_kategorie_names.length > 0) {
        filtered_gesangbuchlied = _.filter(
            filtered_gesangbuchlied,
            (elem) =>
                !selected_kategorie_names.length ||
                _.every(selected_kategorie_names, (obj) => {
                    return _.some(
                        elem?.kategories,
                        (kategorie) => kategorie.kategorie_name.name === obj,
                    );
                }),
        );
    }

    if (strophenSearch.value) {
        filtered_gesangbuchlied = _.filter(filtered_gesangbuchlied, (elem) => {
            return elem.strophen_connected?.includes(strophenSearch.value.toLowerCase());
        });
    }

    // Add the autor_oder_copyright_checken filter
    if (check_autor_copyright.value !== null) {
        filtered_gesangbuchlied = _.filter(
            filtered_gesangbuchlied,
            (elem) => elem.autor_oder_copyright_checken === check_autor_copyright.value,
        );
    }

    // sort by titel
    filtered_gesangbuchlied = _.sortBy(filtered_gesangbuchlied, 'titel');

    return filtered_gesangbuchlied;
});

// Syllable view state for each song
const syllableViewEnabled = ref({});

const toggleSyllableView = (liedId) => {
    syllableViewEnabled.value[liedId] = !syllableViewEnabled.value[liedId];
};

// Edit mode state for each song
const editModeEnabled = ref({});

const toggleEditMode = (liedId) => {
    editModeEnabled.value[liedId] = !editModeEnabled.value[liedId];
};

// Song dialog stuff
const song_dialog = ref(false);
const selected_song = ref(null);

const modalClose = () => {
    song_dialog.value = false;
    selected_song.value = null;
};

const get_color = (category) => {
    return chart_colors[category.id % chart_colors.length];
};
</script>

<template>
    <!-- Your template code here -->
    <h1>Korrektur Ansicht</h1>
    <div class="d-flex flex-wrap ga-1">
        <v-chip
            v-if="strophenSearch"
            prepend-icon="mdi-magnify"
            :color="chipColors[0]"
            variant="flat"
        >
            Titel beinhaltet: {{ strophenSearch }}
        </v-chip>
        <v-chip
            v-if="selected_status"
            prepend-icon="mdi-check-circle"
            :color="chipColors[1]"
            variant="flat"
            >Status: {{ selected_status }}</v-chip
        >
        <v-chip
            v-if="selected_bewertung"
            prepend-icon="mdi-star"
            :color="chipColors[2]"
            variant="flat"
        >
            Bewertung {{ selected_bewertung }}
        </v-chip>
        <v-chip
            v-if="selected_aenderung"
            prepend-icon="mdi-pencil"
            :color="chipColors[3]"
            variant="flat"
            >Hat Änderungen</v-chip
        >
        <template v-if="kategorie">
            <v-chip
                v-for="_kategorie in kategorie"
                :key="_kategorie.id"
                :color="chipColors[4]"
                variant="flat"
                prepend-icon="mdi-tag"
                >{{ _kategorie.name }}</v-chip
            >
        </template>
        <v-chip
            v-if="filter_by_suggestions"
            prepend-icon="mdi-lightbulb-on"
            :color="chipColors[5]"
            variant="flat"
            >Hat Vorschläge</v-chip
        >
        <v-chip
            v-if="filter_by_remarks"
            prepend-icon="mdi-comment"
            class="text-black"
            :color="chipColors[6]"
            variant="flat"
            >Hat Bemerkungen</v-chip
        >
        <template v-if="selected_author">
            <v-chip
                v-for="_author in authors"
                :key="_author"
                class="text-black"
                :color="chipColors[7]"
                variant="flat"
                prepend-icon="mdi-account"
                >{{ _author }}</v-chip
            >
        </template>
        <v-chip
            v-if="check_autor_copyright !== null"
            prepend-icon="mdi-copyright"
            :color="chipColors[8]"
            variant="flat"
        >
            Autor/Copyright: {{ check_autor_copyright ? 'Zu prüfen' : 'Geprüft' }}
        </v-chip>
    </div>

    <div v-if="!showSongs">
        <v-alert outlined color="warning" icon="mdi-alert">
            Beim decoding des Filters ist ein Fehler aufgetreten
        </v-alert>
    </div>
    <div v-else-if="filtered_gesangbuchlieder.length === 0" class="mt-2">
        <v-alert outlined color="warning" icon="mdi-alert">Keine Lieder gefunden</v-alert>
    </div>
    <div v-else class="mt-5">
        <v-expansion-panels>
            <v-expansion-panel v-for="lied in filtered_gesangbuchlieder" :key="lied.id">
                <v-expansion-panel-title>
                    <div class="w-100">
                        <div class="d-flex justify-space-between">
                            <div class="text-h6">
                                <v-tooltip
                                    v-if="lied.text?.korrekturlesung1"
                                    text="Korrektur gelesen"
                                    location="bottom"
                                >
                                    <template #activator="{ props }">
                                        <v-icon
                                            v-bind="props"
                                            icon="mdi-check-circle"
                                            color="success"
                                            size="small"
                                            class="me-1"
                                        />
                                    </template>
                                </v-tooltip>
                                {{ lied.titel }}
                                <v-icon
                                    v-if="lied.autor_oder_copyright_checken"
                                    icon="mdi-copyright"
                                    color="warning"
                                    size="small"
                                />
                            </div>
                            <div class="d-flex ga-1">
                                <v-chip
                                    v-for="(category, index) in lied?.kategories"
                                    :key="index"
                                    label
                                    size="small"
                                    :prepend-icon="
                                        gesangbuch_kategorie_name_to_icon(
                                            category?.kategorie_name?.name,
                                        )
                                    "
                                    :style="{ 'background-color': get_color(category) }"
                                >
                                    {{ category?.kategorie_name?.name }}
                                </v-chip>
                            </div>
                        </div>
                        <div v-if="lied?.text?.strophen_connected" class="text-caption">
                            {{
                                lied.text.strophen_connected.length > 150
                                    ? lied.text.strophen_connected.substring(0, 150) + '...'
                                    : lied.text.strophen_connected
                            }}
                        </div>
                        <div v-else class="text-caption">
                            Dieses Lied hat keinen verknüpften Text oder Strophen.
                        </div>
                        <div class="text-caption">
                            {{ lied.author_name }}
                        </div>
                    </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                    <splitpanes :dbl-click-splitter="false">
                        <pane min-size="20">
                            <div class="position-relative h-100" style="min-height: 70vh">
                                <MediaComponent
                                    v-if="
                                        lied.gesangbuchlied_satz_mit_melodie_und_text?.[0] ||
                                        lied.melodie?.files?.[0]
                                    "
                                    :file="
                                        lied.gesangbuchlied_satz_mit_melodie_und_text?.[0] ||
                                        lied.melodie?.files?.[0]
                                    "
                                    :screen-mode="'sing-mode'"
                                />
                            </div>
                        </pane>
                        <pane min-size="20">
                            <div class="pl-10 pt-10">
                                <div class="d-flex align-center justify-space-between ga-2 mb-3">
                                    <h2 class="mb-0">{{ lied.titel }}</h2>
                                    <div class="d-flex ga-2">
                                        <v-tooltip
                                            text="Silbensymbole und Leerzeichen anzeigen"
                                            location="bottom"
                                        >
                                            <template #activator="{ props }">
                                                <v-btn
                                                    icon="mdi-format-letter-matches"
                                                    size="small"
                                                    variant="text"
                                                    :color="
                                                        syllableViewEnabled[lied.id]
                                                            ? 'primary'
                                                            : 'grey'
                                                    "
                                                    v-bind="props"
                                                    @click="toggleSyllableView(lied.id)"
                                                />
                                            </template>
                                        </v-tooltip>
                                        <v-tooltip
                                            v-if="
                                                userStore.is_kleiner_kreis &&
                                                userStore.is_kleiner_kreis_ansicht
                                            "
                                            text="Text bearbeiten"
                                            location="bottom"
                                        >
                                            <template #activator="{ props }">
                                                <v-btn
                                                    icon="mdi-pencil"
                                                    size="small"
                                                    variant="text"
                                                    :color="
                                                        editModeEnabled[lied.id]
                                                            ? 'primary'
                                                            : 'grey'
                                                    "
                                                    v-bind="props"
                                                    @click="toggleEditMode(lied.id)"
                                                />
                                            </template>
                                        </v-tooltip>
                                    </div>
                                </div>
                                <div class="pe-1">
                                    <StrophenList
                                        :text="lied?.text"
                                        :show-extra-strophen-data="true"
                                        :show-text-only="false"
                                        :include-title="false"
                                        :show-syllable-symbols="
                                            syllableViewEnabled[lied.id] || false
                                        "
                                        :show-spaces-as-dots="syllableViewEnabled[lied.id] || false"
                                        :edit-mode="editModeEnabled[lied.id] || false"
                                        @toggle-edit-mode="toggleEditMode(lied.id)"
                                        @edit-completed="editModeEnabled[lied.id] = false"
                                    />
                                </div>
                                <v-btn
                                    style="position: absolute; right: 10px; bottom: 10px"
                                    icon
                                    @click="
                                        selected_song = lied;
                                        song_dialog = true;
                                    "
                                >
                                    <v-icon>mdi-open-in-app</v-icon>
                                </v-btn>
                            </div>
                        </pane>
                    </splitpanes>
                </v-expansion-panel-text>
            </v-expansion-panel>
        </v-expansion-panels>
    </div>

    <v-dialog v-model="song_dialog" width="700" @close="modalClose">
        <GesangbuchLiedComponent :selected-song="selected_song" @close="song_dialog = false" />
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="3000">
        {{ snackbar_message }}

        <template #actions>
            <v-btn color="pink" variant="text" @click="snackbar = false"> Close </v-btn>
        </template>
    </v-snackbar>
</template>

<style>
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
    content: '' !important;
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
    content: '' !important;
    padding-left: 14px;
    height: 100%;
    border-right: 3px rgb(24, 103, 192) solid;
}
</style>
