<template>
    <div>
        <div class="text-h4 mb-5">Bereits eingetragene Gesangbuchlieder</div>
    </div>

    <!-- Virtualisierte Tabelle: rendert nur die sichtbaren Zeilen, statt alle
         (bei "alle Rows" sonst ~30k DOM-Knoten / tausende Tooltip-Overlays →
         jeder Hover/Sort erzwang einen Reflow über den ganzen DOM). Zeigt
         weiterhin alle Lieder, nur eben virtuell gescrollt – daher kein Footer/
         keine Pagination. Braucht eine feste Höhe + fixed-header. -->
    <v-data-table-virtual
        height="calc(100dvh - 190px)"
        fixed-header
        :headers="headers"
        :items="filtered_gesangbuchlieder"
        :search="search"
        :sort-by="sortBy"
        multi-sort
        locale="de"
        @click:row="rowClick"
        @update:sort-by="onSortBy"
    >
        <template #top>
            <div class="d-flex align-center">
                <v-text-field
                    v-model="search"
                    single-line
                    prepend-icon="mdi-magnify"
                    label="Suche"
                    hide-details
                    class="pa-4"
                ></v-text-field>
                <v-badge
                    :model-value="active_filter_count > 0"
                    :content="active_filter_count"
                    color="primary"
                    class="my-4"
                >
                    <v-btn
                        icon="mdi-filter-variant"
                        :color="filter_expanded ? 'primary' : null"
                        @click="filter_expanded = !filter_expanded"
                    ></v-btn>
                </v-badge>
            </div>
            <v-expand-transition v-show="filter_expanded">
                <v-card class="mb-5" variant="outlined">
                    <v-card-title>
                        <div class="d-flex justify-space-between align-center">
                            <div>Filter</div>
                            <div class="d-flex ga-2">
                                <v-tooltip text="Filter Zurücksetzen" location="left">
                                    <template #activator="{ props }">
                                        <div v-bind="props">
                                            <v-btn
                                                icon
                                                variant="text"
                                                height="36"
                                                width="36"
                                                class="pa-0"
                                                @click="resetFilter"
                                            >
                                                <v-icon>mdi-filter-remove</v-icon>
                                            </v-btn>
                                        </div>
                                    </template>
                                </v-tooltip>

                                <v-tooltip
                                    v-if="admin && admin_ansicht"
                                    text="Filter teilen (Link kopieren)"
                                    location="left"
                                >
                                    <template #activator="{ props }">
                                        <div v-bind="props">
                                            <v-btn
                                                icon
                                                variant="text"
                                                height="36"
                                                width="36"
                                                class="pa-0"
                                                @click="copyFilterIntoLink"
                                            >
                                                <v-icon>mdi-link-variant</v-icon>
                                            </v-btn>
                                        </div>
                                    </template>
                                </v-tooltip>
                            </div>
                        </div>
                    </v-card-title>
                    <v-card-text>
                        <!-- Aktive Filter als entfernbare Chips -->
                        <div
                            v-if="active_filters.length"
                            class="d-flex flex-wrap align-center ga-1 mb-4"
                        >
                            <span class="text-caption text-medium-emphasis me-1">Aktiv:</span>
                            <v-chip
                                v-for="chip in active_filters"
                                :key="chip.key"
                                :color="chip.color"
                                :prepend-icon="chip.icon"
                                variant="flat"
                                size="small"
                                closable
                                @click:close="chip.remove()"
                            >
                                {{ chip.text }}
                            </v-chip>
                        </div>

                        <div class="d-flex align-center mb-4">
                            <v-text-field
                                v-model="filters.strophenSearch"
                                single-line
                                prepend-inner-icon="mdi-magnify"
                                label="Strophen Suche"
                                hide-details
                                clearable
                            ></v-text-field>
                        </div>

                        <div v-if="admin && admin_ansicht" class="d-flex align-center mb-4">
                            <v-select
                                v-model="filters.bewertung"
                                :items="bewertungen"
                                prepend-inner-icon="mdi-list-status"
                                label="Filter Bewertung nach"
                                class="w-100 me-5"
                                hide-details
                                clearable
                                single-line
                            />

                            <v-select
                                v-model="filters.status"
                                prepend-inner-icon="mdi-check"
                                :items="status_list"
                                label="Filter Status nach"
                                class="w-100 me-5"
                                hide-details
                                clearable
                                single-line
                            />

                            <v-checkbox
                                v-model="filters.aenderung"
                                label="Hat Änderungen"
                                style="min-width: 158px"
                                hide-details
                                single-line
                            />
                        </div>

                        <div class="d-flex align-center mb-4">
                            <v-autocomplete
                                v-model="filters.authors"
                                prepend-inner-icon="mdi-account"
                                :items="authors"
                                item-value="autor_id"
                                item-title="name"
                                label="Filter nach Autor"
                                class="w-100 me-5"
                                hide-details
                                clearable
                                multiple
                                single-line
                            />

                            <v-select
                                v-model="filters.copyright"
                                label="Autor/Copyright prüfen"
                                prepend-inner-icon="mdi-copyright"
                                :items="[
                                    { title: 'Zu prüfen', value: true },
                                    { title: 'Geprüft', value: false },
                                ]"
                                class="w-100"
                                hide-details
                                clearable
                                single-line
                            />
                        </div>

                        <div class="d-flex align-center mb-4 ga-3">
                            <v-autocomplete
                                v-model="filters.kategorie"
                                prepend-inner-icon="mdi-tag"
                                label="Zugehörige Kategorie"
                                class="flex-grow-1"
                                :items="store.kategorie"
                                item-title="name"
                                item-value="id"
                                hide-details="auto"
                                return-object
                                multiple
                                chips
                                closable-chips
                            >
                                <template #chip="{ props, item }">
                                    <v-chip
                                        v-bind="props"
                                        :prepend-icon="get_icon(item)"
                                        :text="item.raw.name"
                                    ></v-chip>
                                </template>

                                <template #item="{ props, item }">
                                    <v-list-item
                                        v-bind="props"
                                        :prepend-icon="get_icon(item)"
                                        :title="item?.raw?.name"
                                    ></v-list-item>
                                </template>
                            </v-autocomplete>

                            <!-- Status- & Korrektur-Filter als An/Aus/Egal-Liste im Popover. -->
                            <v-btn
                                variant="outlined"
                                height="56"
                                prepend-icon="mdi-tune-variant"
                                :color="quick_filter_count > 0 ? 'primary' : undefined"
                            >
                                Status &amp; Korrektur
                                <span v-if="quick_filter_count > 0" class="ms-1"
                                    >({{ quick_filter_count }})</span
                                >
                                <v-menu
                                    activator="parent"
                                    :close-on-content-click="false"
                                    location="bottom end"
                                    offset="8"
                                >
                                    <v-card width="400">
                                        <v-card-text>
                                            <TriStateFilter
                                                v-model="filters.suggestions"
                                                label="Textvorschläge"
                                                icon="mdi-text-box-edit"
                                            />
                                            <TriStateFilter
                                                v-model="filters.remarks"
                                                label="Anmerkungen"
                                                icon="mdi-message"
                                            />
                                            <TriStateFilter
                                                v-model="filters.korrekturlesung1"
                                                label="Korrekturlesung"
                                                icon="mdi-check-circle"
                                            />
                                            <TriStateFilter
                                                v-model="filters.korrekturlesung1_alle"
                                                label="1. KL · alle Strophen"
                                                icon="mdi-numeric-1-circle"
                                            />
                                            <TriStateFilter
                                                v-model="filters.korrekturlesung2"
                                                label="2. KL · alle Strophen"
                                                icon="mdi-numeric-2-circle"
                                            />
                                            <TriStateFilter
                                                v-model="filters.textGeaendert"
                                                label="Text geändert"
                                                icon="mdi-text-box-edit"
                                            />
                                            <TriStateFilter
                                                v-model="filters.melodieGeaendert"
                                                label="Melodie geändert"
                                                icon="mdi-music-box"
                                            />
                                            <TriStateFilter
                                                v-model="filters.notentext"
                                                label="Notentext"
                                                icon="mdi-file-music"
                                            />
                                        </v-card-text>
                                    </v-card>
                                </v-menu>
                            </v-btn>
                        </div>

                        <!-- Drop down with multi select  -->
                        <v-select
                            :model-value="visible_selected_columns"
                            chips
                            label="Angezeigte Tabellenspalten"
                            :items="possible_columns"
                            multiple
                            @update:model-value="selected_columns = $event"
                        ></v-select>
                    </v-card-text>
                </v-card>
            </v-expand-transition>
        </template>

        <template #[`item.gesangbuch_titel`]="{ item, value }">
            <span v-if="value !== 'null'">
                {{ value }}
            </span>
            <span v-else>
                <!--  <keine Angaben>      -->
                &lt;keine Angaben&gt;
            </span>
            <v-tooltip
                v-if="item.liednummer2026 && item.liednummer2026 !== 'null'"
                text="Liednummer Gesangbuch 2026"
                location="bottom"
            >
                <template #activator="{ props }">
                    <v-chip
                        v-bind="props"
                        size="x-small"
                        color="primary"
                        variant="tonal"
                        class="ml-2"
                    >
                        <v-icon start icon="mdi-book-music-outline" size="x-small" />
                        {{ item.liednummer2026 }}
                    </v-chip>
                </template>
            </v-tooltip>
        </template>
        <template #[`item.text_titel`]="{ item }">
            <v-tooltip v-if="item.titel === item.text_titel" text="Wie Liedtitel" location="bottom">
                <template #activator="{ props }">
                    <v-icon icon="mdi-arrow-left" v-bind="props" />
                </template>
            </v-tooltip>

            <v-tooltip
                v-else-if="undefined === item.text_titel"
                text="Keine Text oder Text-Titel"
                location="bottom"
            >
                <template #activator="{ props }">
                    <v-icon icon="mdi-alert-circle-outline" v-bind="props" color="grey" />
                </template>
            </v-tooltip>

            <span v-else>{{ item.text_titel }}</span>
        </template>
        <template #[`item.text.strophen_connected_short`]="{ item }">
            {{
                item.text.strophen_connected_short
                    ? removeHyphenitionSigns(item.text.strophen_connected_short)
                    : ''
            }}
        </template>
        <template #[`item.melodie_titel`]="{ item }">
            <v-tooltip
                v-if="item.titel === item.melodie_titel"
                text="Wie Liedtitel"
                location="bottom"
            >
                <template #activator="{ props }">
                    <v-icon icon="mdi-arrow-left" v-bind="props" />
                </template>
            </v-tooltip>

            <v-tooltip
                v-else-if="undefined === item.melodie_titel"
                text="Keine Melodie oder Melodie-Titel"
                location="bottom"
            >
                <template #activator="{ props }">
                    <v-icon icon="mdi-alert-circle-outline" v-bind="props" color="grey" />
                </template>
            </v-tooltip>

            <span v-else>{{ item.melodie_titel }}</span>
        </template>

        <template #[`item.text_work_order`]="{ item }">
            <v-tooltip
                :text="item.text_work_order ? 'Text Arbeitsauftrag' : 'Keinen Arbeitsauftrag'"
                location="bottom"
            >
                <template #activator="{ props }">
                    <v-icon
                        v-if="item.text_work_order"
                        :icon="item.text_work_order === 2 ? 'mdi-file-document' : 'mdi-check'"
                        v-bind="props"
                        :color="item.text_work_order ? 'primary' : 'success'"
                    />
                </template>
            </v-tooltip>
        </template>
        <template #[`item.melodie_work_order`]="{ item }">
            <v-tooltip
                :text="item.melodie_work_order ? 'Melodie Arbeitsauftrag' : 'Keinen Arbeitsauftrag'"
                location="bottom"
            >
                <template #activator="{ props }">
                    <v-icon
                        v-if="item.melodie_work_order"
                        :icon="item.melodie_work_order === 2 ? 'mdi-music' : 'mdi-check'"
                        v-bind="props"
                        :color="item.melodie_work_order ? 'primary' : 'success'"
                    />
                </template>
            </v-tooltip>
        </template>
        <template #[`item.bewertung_kleiner_kreis`]="{ item }">
            <BewerungKleinerKreisDatatableEntry :item="item" />
        </template>
    </v-data-table-virtual>

    <v-dialog v-model="song_dialog" width="90vw" max-width="1100" @close="modalClose">
        <GesangbuchLiedComponent
            :selected-song="selected_song"
            @close="song_dialog = false"
            @switch-song="switchSong"
        />
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="3000">
        {{ snackbar_message }}

        <template #actions>
            <v-btn color="pink" variant="text" @click="snackbar = false"> Close </v-btn>
        </template>
    </v-snackbar>
</template>
<script>
import { useAppStore } from '@/store/app';
import { useUserStore } from '@/store/user';

import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';
import _ from 'lodash';
import { gesangbuch_kategorie_name_to_icon, status_mapping } from '@/assets/js/utils';
import BewerungKleinerKreisDatatableEntry from '@/components/BewerungKleinerKreisDatatableEntry.vue';
import TriStateFilter from '@/components/TriStateFilter.vue';

// Standardzustand aller Filter. Tri-State-Filter sind 'an' | 'aus' | 'egal'
// ('egal' = inaktiv), die übrigen null/[] für "kein Filter".
const defaultFilters = () => ({
    strophenSearch: null,
    bewertung: null,
    status: null,
    authors: [],
    copyright: null, // true | false | null
    kategorie: [],
    aenderung: false, // einfache Checkbox im Filter-Block
    suggestions: 'egal',
    remarks: 'egal',
    korrekturlesung1: 'egal',
    korrekturlesung1_alle: 'egal',
    korrekturlesung2: 'egal',
    textGeaendert: 'egal',
    melodieGeaendert: 'egal',
    notentext: 'egal', // 'an' = mit Notentext, 'aus' = ohne
});

export default {
    name: 'SongOverview',
    components: { BewerungKleinerKreisDatatableEntry, GesangbuchLiedComponent, TriStateFilter },
    data: () => ({
        selected_columns: [
            'Titel',
            'Text Titel',
            'Text Auftrag',
            'Melodie Titel',
            'Melodie Auftrag',
            'Strophe',
        ],
        snackbar: false,
        snackbar_message: '',
        search: null,
        filter_expanded: false,
        song_dialog: false,
        selected_song: null,
        store: useAppStore(),
        userStore: useUserStore(),
        sortBy: [],
        filters: defaultFilters(),
    }),
    computed: {
        possible_columns() {
            // „Nr. 2026“ ist für alle Nutzer als optionale, numerisch sortierbare
            // Spalte verfügbar (Issue #41) – die Nummer wird ohnehin schon als Chip
            // neben dem Titel angezeigt.
            let columns = [
                'Nr. 2026',
                'Titel',
                'Text Titel',
                'Text Auftrag',
                'Melodie Titel',
                'Melodie Auftrag',
                'Strophe',
                'Text Autor',
                'Musik Autor',
            ];
            if (this.admin && this.admin_ansicht) {
                columns.push('Bewertung');
            }
            return columns;
        },
        visible_selected_columns() {
            return this.selected_columns.filter((column) => this.possible_columns.includes(column));
        },
        headers() {
            let headers = [];
            if (this.selected_columns.includes('Nr. 2026')) {
                headers.push({
                    title: 'Nr. 2026',
                    align: 'end',
                    key: 'liednummer2026',
                    sort: (a, b) => {
                        const ea = a == null || a === '';
                        const eb = b == null || b === '';
                        if (ea && eb) return 0;
                        if (ea) return 1;
                        if (eb) return -1;
                        return Number(a) - Number(b);
                    },
                });
            }
            if (this.selected_columns.includes('Titel')) {
                headers.push({
                    title: 'Titel',
                    align: 'start',
                    key: 'gesangbuch_titel',
                });
            }

            if (this.selected_columns.includes('Text Titel'))
                headers.push({
                    title: 'Text Titel',
                    align: 'start',
                    key: 'text_titel',
                    sort: (a, b) =>
                        (a === undefined ? '' : a).localeCompare(b === undefined ? '' : b),
                });
            if (this.selected_columns.includes('Text Auftrag'))
                headers.push({
                    title: 'Text Auftrag',
                    align: 'center',
                    key: 'text_work_order',
                });
            if (this.selected_columns.includes('Melodie Titel'))
                headers.push({
                    title: 'Melodie Titel',
                    align: 'start',
                    key: 'melodie_titel',
                    sort: (a, b) =>
                        (a === undefined ? '' : a).localeCompare(b === undefined ? '' : b),
                });
            if (this.selected_columns.includes('Melodie Auftrag'))
                headers.push({
                    title: 'Melodie Auftrag',
                    align: 'center',
                    key: 'melodie_work_order',
                });
            if (this.selected_columns.includes('Strophe'))
                headers.push({
                    title: 'Strophe',
                    align: 'start',
                    key: 'text.strophen_connected_short',
                });

            if (this.selected_columns.includes('Text Autor'))
                headers.push({
                    title: 'Text Autor',
                    align: 'start',
                    key: 'text.author_name',
                });
            if (this.selected_columns.includes('Musik Autor'))
                headers.push({
                    title: 'Musik Autor',
                    align: 'start',
                    key: 'melodie.author_name',
                });

            if (this.admin && this.admin_ansicht && this.selected_columns.includes('Bewertung')) {
                // Berwertung kleiner kreis
                headers.push({
                    title: 'Bewertung',
                    align: 'center',
                    key: 'bewertung_kleiner_kreis',
                    sort: (a, b) => a?.rangfolge - b?.rangfolge,
                });
            }
            return headers;
        },
        gesangbuchlieder() {
            return this.store.gesangbuchlieder;
        },
        authors() {
            return this.store.used_authors;
        },
        status_list() {
            // return unique status from all songs
            return _.uniq(
                _.map(this.gesangbuchlieder, (elem) => status_mapping[elem['status']]).filter(
                    (status) => _.isEmpty(status) === false,
                ),
            );
        },
        bewertungen() {
            const rated = _.uniq(
                _.map(
                    this.gesangbuchlieder,
                    (song) => song?.bewertung_kleiner_kreis?.bezeichner,
                ).filter((b) => !_.isEmpty(b)),
            );
            return [...rated, 'Unbewertet'];
        },
        filtered_gesangbuchlieder() {
            const f = this.filters;
            let list = this.gesangbuchlieder;

            // Tri-State-Helfer: filtert nach 'an'/'aus', ignoriert 'egal'.
            const tri = (state, predicate) => {
                if (state === 'an') list = _.filter(list, predicate);
                else if (state === 'aus') list = _.filter(list, (elem) => !predicate(elem));
            };

            if (f.status) {
                list = _.filter(list, (elem) => status_mapping[elem['status']] === f.status);
            }

            if (f.bewertung) {
                const target = f.bewertung === 'Unbewertet' ? '' : f.bewertung;
                list = _.filter(
                    list,
                    (elem) => elem['bewertung_kleiner_kreis'].bezeichner === target,
                );
            }

            if (f.authors && f.authors.length > 0) {
                list = _.filter(list, (elem) =>
                    _.some(elem.authors, (author) => f.authors.includes(author.autor_id)),
                );
            }

            if (f.aenderung) list = _.filter(list, (elem) => elem.liedHatAenderung);
            tri(f.korrekturlesung1, (elem) => elem.text?.korrekturlesung1 === true);
            tri(
                f.korrekturlesung1_alle,
                (elem) => elem.text?.korrekturlesung1_alle_Strophen === true,
            );
            tri(f.korrekturlesung2, (elem) => elem.text?.korrekturlesung2 === true);
            tri(f.textGeaendert, (elem) => elem.textGeaendert === true);
            tri(f.melodieGeaendert, (elem) => elem.melodieGeaendert === true);
            tri(f.notentext, (elem) => !!elem.notentext);
            tri(f.suggestions, (elem) =>
                _.some(
                    elem?.text?.strophenEinzeln,
                    (obj) =>
                        _.has(obj, 'aenderungsvorschlag') && !_.isEmpty(obj.aenderungsvorschlag),
                ),
            );
            tri(f.remarks, (elem) =>
                _.some(
                    elem?.text?.strophenEinzeln,
                    (obj) => _.has(obj, 'anmerkung') && !_.isEmpty(obj.anmerkung),
                ),
            );

            const selected_kategorie_names = _.map(f.kategorie, 'name');
            if (selected_kategorie_names.length > 0) {
                list = _.filter(list, (elem) =>
                    _.every(selected_kategorie_names, (name) =>
                        _.some(
                            elem?.kategories,
                            (kategorie) => kategorie.kategorie_name.name === name,
                        ),
                    ),
                );
            }

            if (f.strophenSearch) {
                const needle = f.strophenSearch.toLowerCase();
                list = _.filter(list, (elem) => elem.strophen_connected?.includes(needle));
            }

            if (f.copyright !== null) {
                list = _.filter(list, (elem) => elem.autor_oder_copyright_checken === f.copyright);
            }

            return list;
        },
        // Aktive Filter als Chip-Beschreibungen für die Anzeige über der Tabelle.
        active_filters() {
            const f = this.filters;
            const chips = [];

            if (f.strophenSearch)
                chips.push({
                    key: 'strophenSearch',
                    icon: 'mdi-magnify',
                    color: 'blue-grey',
                    text: `Strophen: ${f.strophenSearch}`,
                    remove: () => (this.filters.strophenSearch = null),
                });
            if (f.bewertung)
                chips.push({
                    key: 'bewertung',
                    icon: 'mdi-list-status',
                    color: 'indigo',
                    text: `Bewertung: ${f.bewertung}`,
                    remove: () => (this.filters.bewertung = null),
                });
            if (f.status)
                chips.push({
                    key: 'status',
                    icon: 'mdi-check',
                    color: 'teal',
                    text: `Status: ${f.status}`,
                    remove: () => (this.filters.status = null),
                });
            (f.authors || []).forEach((id) =>
                chips.push({
                    key: `author:${id}`,
                    icon: 'mdi-account',
                    color: 'deep-purple',
                    text: this.authorName(id),
                    remove: () =>
                        (this.filters.authors = this.filters.authors.filter((a) => a !== id)),
                }),
            );
            if (f.copyright !== null)
                chips.push({
                    key: 'copyright',
                    icon: 'mdi-copyright',
                    color: 'brown',
                    text: `Copyright: ${f.copyright ? 'Zu prüfen' : 'Geprüft'}`,
                    remove: () => (this.filters.copyright = null),
                });
            if (f.aenderung)
                chips.push({
                    key: 'aenderung',
                    icon: 'mdi-pencil',
                    color: 'orange',
                    text: 'Hat Änderungen',
                    remove: () => (this.filters.aenderung = false),
                });
            (f.kategorie || []).forEach((k) =>
                chips.push({
                    key: `kat:${k.id ?? k.name}`,
                    icon: 'mdi-tag',
                    color: 'green',
                    text: k.name,
                    remove: () =>
                        (this.filters.kategorie = this.filters.kategorie.filter((x) => x !== k)),
                }),
            );

            const triChips = [
                ['suggestions', 'mdi-text-box-edit', 'Textvorschläge'],
                ['remarks', 'mdi-message', 'Anmerkungen'],
                ['korrekturlesung1', 'mdi-check-circle', 'Korrekturlesung'],
                ['korrekturlesung1_alle', 'mdi-numeric-1-circle', '1. KL alle Strophen'],
                ['korrekturlesung2', 'mdi-numeric-2-circle', '2. KL alle Strophen'],
                ['textGeaendert', 'mdi-text-box-edit', 'Text geändert'],
                ['melodieGeaendert', 'mdi-music-box', 'Melodie geändert'],
                ['notentext', 'mdi-file-music', 'Notentext'],
            ];
            triChips.forEach(([key, icon, label]) => {
                const state = f[key];
                if (state === 'an' || state === 'aus') {
                    chips.push({
                        key,
                        icon,
                        color: state === 'an' ? 'success' : 'error',
                        text: `${label}: ${state === 'an' ? 'An' : 'Aus'}`,
                        remove: () => (this.filters[key] = 'egal'),
                    });
                }
            });

            return chips;
        },
        active_filter_count() {
            return this.active_filters.length;
        },
        // Anzahl gesetzter Tri-State-Filter im "Status & Korrektur"-Popover.
        quick_filter_count() {
            const keys = [
                'suggestions',
                'remarks',
                'korrekturlesung1',
                'korrekturlesung1_alle',
                'korrekturlesung2',
                'textGeaendert',
                'melodieGeaendert',
                'notentext',
            ];
            return keys.filter((k) => this.filters[k] !== 'egal').length;
        },
        admin() {
            return this.userStore.is_kleiner_kreis;
        },
        admin_ansicht() {
            return this.userStore.is_kleiner_kreis_ansicht;
        },
    },
    watch: {
        selected_columns(newValue) {
            localStorage.setItem('selected_columns', JSON.stringify(newValue));
        },
        song_dialog: function (newValue) {
            if (!newValue) {
                this.$router.replace(`/gesangbuchlieder`);
                document.title = 'Gesangbuch 2026';
            }
        },
        gesangbuchlieder(newValue) {
            if (this.$route.params.id && !this.selected_song) {
                const song = _.find(newValue, {
                    id: parseInt(this.$route.params.id),
                });
                if (song) {
                    this.selected_song = song;
                    this.song_dialog = true;
                    if (song?.gesangbuch_titel) {
                        document.title = song.gesangbuch_titel;
                    }
                }
            }
        },
    },
    mounted() {
        const q = this.$route.query;

        if (q.filter_kategorie) this.filters.kategorie = [{ name: q.filter_kategorie }];
        if (q.selected_bewertung !== undefined)
            this.filters.bewertung = q.selected_bewertung || 'Unbewertet';
        if (q.selected_aenderung === 'true') this.filters.aenderung = true;
        if (q.filter_by_korrekturlesung1 === 'true') this.filters.korrekturlesung1 = 'an';
        if (q.filter_by_not_korrekturlesung1 === 'true') this.filters.korrekturlesung1 = 'aus';
        if (q.filter_by_korrekturlesung1_alle_strophen === 'true')
            this.filters.korrekturlesung1_alle = 'an';
        if (q.filter_by_not_korrekturlesung1_alle_strophen === 'true')
            this.filters.korrekturlesung1_alle = 'aus';
        if (q.filter_by_korrekturlesung2 === 'true') this.filters.korrekturlesung2 = 'an';
        if (q.filter_by_not_korrekturlesung2 === 'true') this.filters.korrekturlesung2 = 'aus';
        if (q.filter_by_text_geaendert === 'true') this.filters.textGeaendert = 'an';
        if (q.filter_by_melodie_geaendert === 'true') this.filters.melodieGeaendert = 'an';

        // Block aufklappen, wenn ein Filter über die URL gesetzt wurde.
        const filterQueryKeys = [
            'filter_kategorie',
            'selected_bewertung',
            'selected_aenderung',
            'filter_by_korrekturlesung1',
            'filter_by_not_korrekturlesung1',
            'filter_by_korrekturlesung1_alle_strophen',
            'filter_by_not_korrekturlesung1_alle_strophen',
            'filter_by_korrekturlesung2',
            'filter_by_not_korrekturlesung2',
            'filter_by_text_geaendert',
            'filter_by_melodie_geaendert',
        ];
        if (filterQueryKeys.some((k) => q[k] !== undefined)) this.filter_expanded = true;

        // get selected columns from local storage
        if (localStorage.getItem('selected_columns')) {
            this.selected_columns = JSON.parse(localStorage.getItem('selected_columns'));
        } else {
            // check for admin
            if (this.admin && this.admin_ansicht) {
                this.selected_columns.push('Bewertung');
            }
        }

        if (this.$route.params.id) {
            this.selected_song = _.find(this.gesangbuchlieder, {
                id: parseInt(this.$route.params.id),
            });
            console.log(this.selected_song);
            this.song_dialog = true;
            if (this.selected_song?.gesangbuch_titel) {
                document.title = this.selected_song.gesangbuch_titel;
            }
        }
    },
    methods: {
        removeHyphenitionSigns(text) {
            if (!text) return text;
            return text.replace(/¬/g, '');
        },
        resetFilter() {
            this.filters = defaultFilters();
        },
        authorName(id) {
            const a = _.find(this.authors, { autor_id: id });
            return a ? a.name : String(id);
        },
        copyFilterIntoLink() {
            const f = this.filters;
            const appliedFilter = {};
            if (f.strophenSearch) appliedFilter.strophenSearch = f.strophenSearch;
            if (f.status) appliedFilter.selected_status = f.status;
            if (f.bewertung) appliedFilter.selected_bewertung = f.bewertung;
            if (f.aenderung) appliedFilter.selected_aenderung = true;
            if (f.korrekturlesung1 === 'an') appliedFilter.filter_by_korrekturlesung1 = true;
            else if (f.korrekturlesung1 === 'aus')
                appliedFilter.filter_by_not_korrekturlesung1 = true;
            if (f.korrekturlesung1_alle === 'an')
                appliedFilter.filter_by_korrekturlesung1_alle_strophen = true;
            else if (f.korrekturlesung1_alle === 'aus')
                appliedFilter.filter_by_not_korrekturlesung1_alle_strophen = true;
            if (f.korrekturlesung2 === 'an') appliedFilter.filter_by_korrekturlesung2 = true;
            else if (f.korrekturlesung2 === 'aus')
                appliedFilter.filter_by_not_korrekturlesung2 = true;
            if (f.textGeaendert === 'an') appliedFilter.filter_by_text_geaendert = true;
            if (f.melodieGeaendert === 'an') appliedFilter.filter_by_melodie_geaendert = true;
            if (f.kategorie && f.kategorie.length) appliedFilter.kategorie = f.kategorie;
            if (f.suggestions === 'an') appliedFilter.filter_by_suggestions = true;
            if (f.remarks === 'an') appliedFilter.filter_by_remarks = true;
            if (f.authors && f.authors.length) appliedFilter.selected_author = f.authors;
            if (f.copyright !== null) appliedFilter.check_autor_copyright = f.copyright;
            if (f.notentext === 'an') appliedFilter.notentext_filter = 'has';
            else if (f.notentext === 'aus') appliedFilter.notentext_filter = 'no';

            if (Object.keys(appliedFilter).length === 0) {
                this.snackbar_message = 'Wähle zuerst einen filter an.';
                this.snackbar = true;
                return;
            }

            const jsonString = JSON.stringify(appliedFilter);
            const base64String = btoa(jsonString);
            const url = `${window.location.origin}/korrektur-lesung?filter=${base64String}`;

            navigator.clipboard.writeText(url).then(
                () => {
                    this.snackbar_message = 'Filter wurde kopiert';
                    this.snackbar = true;
                },
                (err) => {
                    this.snackbar_message = `Ein fehler ist beim kopieren des links aufgetreten: ${url}`;
                    this.snackbar = true;
                    console.error(err);
                },
            );
        },
        onSortBy(newSort) {
            const liedEntry = newSort.find((s) => s.key === 'liednummer2026');
            if (liedEntry) {
                const rest = newSort.filter((s) => s.key !== 'liednummer2026');
                this.sortBy = [{ key: '_has_liednummer2026', order: 'desc' }, liedEntry, ...rest];
            } else {
                this.sortBy = newSort;
            }
        },
        rowClick(item, value) {
            this.song_dialog = true;
            this.selected_song = value.item;
            this.$router.replace(`/gesangbuchlieder/${this.selected_song.id}`);
            // set tab title to song title
            document.title = this.selected_song.gesangbuch_titel;
        },
        switchSong(song) {
            if (!song) return;
            this.selected_song = song;
            this.song_dialog = true;
            this.$router.replace(`/gesangbuchlieder/${song.id}`);
            if (song?.gesangbuch_titel) {
                document.title = song.gesangbuch_titel;
            }
        },
        modalClose() {
            this.song_dialog = false;
            this.selected_song = null;
            console.log('modal closed');
            // revert tab title
            document.title = 'Gesangbuch 2026';
        },
        get_icon(item) {
            return gesangbuch_kategorie_name_to_icon(item.titel);
        },
    },
};
</script>

<style>
i.mdi-circle.mdi.v-icon.notranslate.v-theme--light.v-icon--size-default:before {
    color: #9595ff;
}

.v-data-table__tr:hover {
    background-color: rgba(var(--v-theme-on-surface), 0.06);
}

/* Body-Zellen transparent, damit der Row-Hover (.v-data-table__tr:hover)
   durchscheint. Nur auf tbody beschränken: in Vuetify 4 tragen auch die
   Header-<th> die Klasse .v-data-table__td, sonst würde dieses
   `transparent !important` den Hintergrund des fixed-header überschreiben
   (Row-Inhalt scheint dann durch die klebende Kopfzeile). */
.v-data-table tbody .v-data-table__td {
    background-color: transparent !important;
}
</style>
