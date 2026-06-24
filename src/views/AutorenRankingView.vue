<template>
    <v-container fluid>
        <div class="d-flex align-center flex-wrap ga-4 mb-2">
            <div class="text-h4">Autoren-Ranking</div>
            <v-spacer />
            <div style="min-width: 220px">
                <div class="text-caption">
                    Top <span class="font-weight-bold">{{ topN }}</span> Autoren im Diagramm
                </div>
                <v-slider
                    v-model="topN"
                    :min="3"
                    :max="20"
                    :step="1"
                    show-ticks="always"
                    thumb-label
                    hide-details
                    density="compact"
                />
            </div>
        </div>

        <p class="text-medium-emphasis mb-4">
            Verteilung der Autoren im Vergleich Gesangbuch&nbsp;2000 zu Gesangbuch&nbsp;2026 –
            getrennt nach Text und Melodie. Gezählt werden eindeutige Texte bzw. Melodien je Autor
            (mehrfach verwendete Werke zählen einmal). Ein Klick auf einen Autor zeigt die
            zugehörigen Lieder. Die 2000er-Zuordnung ist eine Tendenz und nicht exakt, da der
            Datensatz das Gesangbuch&nbsp;2000 nicht vollständig rekonstruiert.
        </p>

        <v-tabs v-model="activeTab" color="primary" class="mb-4">
            <v-tab value="text">
                <v-icon start>mdi-text-box-outline</v-icon>
                Texte
            </v-tab>
            <v-tab value="melodie">
                <v-icon start>mdi-music-clef-treble</v-icon>
                Melodien
            </v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
            <v-window-item value="text">
                <v-row>
                    <v-col cols="12" md="6">
                        <AutorRankingPanel
                            title="Gesangbuch 2000"
                            work-label="Texte"
                            :ranking="textRanking2000.ranking"
                            :work-count="textRanking2000.workCount"
                            :top-n="topN"
                            @open-author="openAuthor"
                        />
                    </v-col>
                    <v-col cols="12" md="6">
                        <AutorRankingPanel
                            title="Gesangbuch 2026"
                            work-label="Texte"
                            :ranking="textRanking2026.ranking"
                            :work-count="textRanking2026.workCount"
                            :top-n="topN"
                            @open-author="openAuthor"
                        />
                    </v-col>
                </v-row>
            </v-window-item>

            <v-window-item value="melodie">
                <v-row>
                    <v-col cols="12" md="6">
                        <AutorRankingPanel
                            title="Gesangbuch 2000"
                            work-label="Melodien"
                            :ranking="melodieRanking2000.ranking"
                            :work-count="melodieRanking2000.workCount"
                            :top-n="topN"
                            @open-author="openAuthor"
                        />
                    </v-col>
                    <v-col cols="12" md="6">
                        <AutorRankingPanel
                            title="Gesangbuch 2026"
                            work-label="Melodien"
                            :ranking="melodieRanking2026.ranking"
                            :work-count="melodieRanking2026.workCount"
                            :top-n="topN"
                            @open-author="openAuthor"
                        />
                    </v-col>
                </v-row>
            </v-window-item>
        </v-window>
    </v-container>

    <!-- Lieder eines Autors (Klick auf eine Ranking-Zeile) -->
    <v-dialog v-model="authorDialog" width="640" scrollable>
        <v-card v-if="selectedAuthor">
            <v-card-title class="d-flex align-center">
                <v-icon start>mdi-account-music</v-icon>
                <span class="text-truncate">{{ selectedAuthor.name }}</span>
            </v-card-title>
            <v-card-subtitle>
                {{ authorTitle }} · {{ selectedAuthor.count }} {{ authorWorkLabel }} ·
                {{ selectedAuthor.songs.length }} Lieder
            </v-card-subtitle>
            <v-divider />
            <v-card-text class="pa-0" style="max-height: 60vh">
                <v-list lines="one" density="compact">
                    <v-list-item
                        v-for="song in selectedAuthor.songs"
                        :key="song.lied.id"
                        @click="openSong(song.lied)"
                    >
                        <template #prepend>
                            <v-chip
                                size="small"
                                variant="tonal"
                                color="primary"
                                class="mr-3 font-weight-bold lied-nummer-chip"
                            >
                                {{ song.nummer || '–' }}
                            </v-chip>
                        </template>
                        <v-list-item-title>{{ song.titel || '–' }}</v-list-item-title>
                        <template #append>
                            <v-icon size="small" class="text-medium-emphasis">
                                mdi-chevron-right
                            </v-icon>
                        </template>
                    </v-list-item>
                </v-list>
            </v-card-text>
            <v-divider />
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="authorDialog = false">Schließen</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog v-model="songDialog" width="700">
        <GesangbuchLiedComponent
            v-if="selectedSong"
            :selected-song="selectedSong"
            @close="songDialog = false"
        />
    </v-dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';

import { useAppStore } from '@/store/app.js';
import { resolveLiednummer2026 } from '@/assets/js/utils';
import { formatYearRange } from '@/assets/js/authorFormat';
import AutorRankingPanel from '@/components/autor/AutorRankingPanel.vue';
import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';

const { gesangbuchlieder } = storeToRefs(useAppStore());

const activeTab = ref('text');
const topN = ref(10);

const songDialog = ref(false);
const selectedSong = ref(null);

const openSong = (lied) => {
    selectedSong.value = lied;
    songDialog.value = true;
};

// Autor-Dialog: zeigt die Lieder/Melodien, an denen ein Autor beteiligt ist.
const authorDialog = ref(false);
const selectedAuthor = ref(null);
const authorTitle = ref('');
const authorWorkLabel = ref('');

const openAuthor = ({ author, title, workLabel }) => {
    selectedAuthor.value = author;
    authorTitle.value = title;
    authorWorkLabel.value = workLabel;
    authorDialog.value = true;
};

// id -> liednummer2026, um die 2026er-Nummer auch über die deutsche Liedfassung
// auflösen zu können (analog Noten-/Inhaltsverzeichnis-Export).
const liednummer2026ById = computed(() => {
    const map = {};
    for (const lied of gesangbuchlieder.value) {
        if (lied?.id != null && lied.liednummer2026) map[lied.id] = lied.liednummer2026;
    }
    return map;
});

// Gesangbuch 2000: Lieder mit einer 2000er-Liednummer (bestmögliche Annäherung an
// den damaligen Bestand – siehe Hinweis im Issue, eine exakte Rekonstruktion ist
// aus dem Datensatz nicht möglich).
const songs2000 = computed(() =>
    gesangbuchlieder.value.filter((lied) => lied.liednummer2000 != null),
);

// Gesangbuch 2026: Lieder mit aufgelöster 2026er-Liednummer (eigene oder die der
// deutschen Liedfassung). liednummer2000 ist hierfür bewusst nicht relevant.
const songs2026 = computed(() =>
    gesangbuchlieder.value.filter(
        (lied) => resolveLiednummer2026(lied, liednummer2026ById.value) !== '',
    ),
);

// Anzeigename eines Autors: „Vorname Nachname (Jahre)". Nutzt dieselbe
// Jahres-Formatierung wie der Rest der App (Issue #18).
const authorDisplayName = (author) => {
    const fullName = [author.vorname, author.nachname].filter(Boolean).join(' ').trim();
    const years = formatYearRange(author.geburtsjahr, author.sterbejahr);
    return [fullName || 'Unbekannt', years].filter(Boolean).join(' ');
};

// Liednummer im Kontext der jeweiligen Ausgabe (für die Liedliste im Autor-Dialog).
const liedNummer = (lied, version) =>
    version === '2000'
        ? lied.liednummer2000
        : resolveLiednummer2026(lied, liednummer2026ById.value);

// Lieder eines Autors nach Liednummer (numerisch) und dann Titel sortieren.
const sortSongs = (songs) =>
    [...songs].sort((a, b) => {
        const na = parseInt(a.nummer, 10);
        const nb = parseInt(b.nummer, 10);
        const va = Number.isNaN(na) ? Infinity : na;
        const vb = Number.isNaN(nb) ? Infinity : nb;
        return va - vb || (a.titel || '').localeCompare(b.titel || '');
    });

// Rangliste der Autoren für eine Lied-Auswahl, Dimension ('text'|'melodie') und
// Ausgabe ('2000'|'2026'). Gezählt wird die Anzahl EINDEUTIGER Werke (Text-/Melodie-
// Id) je Autor – ein mehrfach verwendetes Werk bzw. ein doppelt eingetragener Autor
// zählt nur einmal. Pro Autor werden zusätzlich die beteiligten Lieder gesammelt,
// damit die Detailansicht beim Aufklappen die Lieder/Melodien anzeigen kann.
const buildRanking = (songs, dimension, version) => {
    const byAuthor = new Map(); // autorId -> { autorId, name, works:Set, songs:[] }
    const allWorks = new Set(); // alle eindeutigen Werk-Ids (für den Untertitel)

    for (const lied of songs) {
        const work = dimension === 'text' ? lied.text : lied.melodie;
        if (!work || work.id == null) continue;
        allWorks.add(work.id);

        const seenAuthors = new Set(); // Dedupe doppelter Autoren am selben Werk
        for (const author of work.authors || []) {
            const autorId = author?.autor_id;
            if (autorId == null || seenAuthors.has(autorId)) continue;
            seenAuthors.add(autorId);

            let entry = byAuthor.get(autorId);
            if (!entry) {
                entry = {
                    autorId,
                    name: authorDisplayName(author),
                    works: new Set(),
                    songIds: new Set(),
                    songs: [],
                };
                byAuthor.set(autorId, entry);
            }
            entry.works.add(work.id);
            // Ein Lied nur einmal je Autor auflisten.
            if (!entry.songIds.has(lied.id)) {
                entry.songIds.add(lied.id);
                entry.songs.push({ lied, nummer: liedNummer(lied, version), titel: lied.titel });
            }
        }
    }

    const ranking = [...byAuthor.values()]
        .map((e) => ({
            autorId: e.autorId,
            name: e.name,
            count: e.works.size,
            songs: sortSongs(e.songs),
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return { ranking, workCount: allWorks.size };
};

const textRanking2000 = computed(() => buildRanking(songs2000.value, 'text', '2000'));
const textRanking2026 = computed(() => buildRanking(songs2026.value, 'text', '2026'));
const melodieRanking2000 = computed(() => buildRanking(songs2000.value, 'melodie', '2000'));
const melodieRanking2026 = computed(() => buildRanking(songs2026.value, 'melodie', '2026'));
</script>
