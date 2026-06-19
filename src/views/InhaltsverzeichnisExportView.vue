<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '@/store/app.js';
import { storeToRefs } from 'pinia';
import { resolveLiednummer2026 } from '@/assets/js/utils';
import { isGenommen } from '@/assets/js/gesangbuchChecks';

// Separater Export des Inhaltsverzeichnisses (Issue #45), das Janosch importieren
// oder einfach kopieren kann. Zwei Varianten:
//   1. alphabetisch nach Lied-Titel
//   2. nach Kategorien, darin wieder nach Lied-Titel
// Hinweis: Es wird voraussichtlich noch ein neues Datenfeld mit reduzierten/
// umbenannten Kategorien geben. Aktuell wird mit den bestehenden Kategorien
// (gesangbuchlied -> kategories) gearbeitet.

const store = useAppStore();
const { gesangbuchlieder } = storeToRefs(store);

// „Bewertet und genommen" = status === 'accepted' (Issue #51). Es wird bewusst
// nach dem Status gefiltert und nicht mehr nach der Kleiner-Kreis-Bewertung
// „Rein".
const only_accepted = ref(true);
const only_with_number = ref(false);

const snackbar = ref(false);
const snackbar_message = ref('');

const OHNE_KATEGORIE = 'Ohne Kategorie';

// id -> liednummer2026 (für die Auflösung über die deutsche Liedfassung).
const liednummer2026_by_id = computed(() => {
    const map = {};
    for (const l of gesangbuchlieder.value) {
        if (l && l.id != null && l.liednummer2026) map[l.id] = l.liednummer2026;
    }
    return map;
});

function nummerOf(lied) {
    return resolveLiednummer2026(lied, liednummer2026_by_id.value);
}

// Kategorienamen eines Liedes (kann mehrere sein). `kategories` ist entweder ein
// Array von Verknüpfungen mit `kategorie_name.name` oder der Platzhalter 'Keine'.
function kategorienOf(lied) {
    const list = Array.isArray(lied?.kategories) ? lied.kategories : [];
    const namen = list.map((k) => k?.kategorie_name?.name).filter(Boolean);
    return namen.length ? [...new Set(namen)] : [];
}

// Grundmenge: nach dem Status-Filter, mit aufgelöster Nummer angereichert.
// Bewusst OHNE den „nur mit Liednummer"-Filter, damit die Kennzahlen (u. a.
// „ohne Liednummer") aussagekräftig bleiben.
const base_songs = computed(() => {
    let list = gesangbuchlieder.value.filter((l) => l && (l.titel || '').trim());
    if (only_accepted.value) {
        list = list.filter((l) => isGenommen(l));
    }
    return list.map((l) => ({
        id: l.id,
        titel: (l.titel || '').trim(),
        nummer: nummerOf(l),
        kategorien: kategorienOf(l),
    }));
});

// Anzeige-/Exportmenge: zusätzlich optional auf Lieder mit Nummer eingeschränkt.
const songs = computed(() => {
    if (!only_with_number.value) return base_songs.value;
    return base_songs.value.filter((s) => s.nummer !== '' && s.nummer != null);
});

function hasNummer(s) {
    return s.nummer !== '' && s.nummer != null;
}

// Differenzierte Kennzahlen für die Kopfzeile (Issue #50): Gesamtzahl, Anzahl
// der Lieder, die sich eine Liednummer 2026 mit mindestens einem anderen Lied
// teilen, höchste vergebene Liednummer und Lieder ohne Liednummer.
const stats = computed(() => {
    const list = base_songs.value;
    const total = list.length;
    const withNummer = list.filter(hasNummer);
    const withoutNummer = total - withNummer.length;

    let maxNummer = 0;
    for (const s of withNummer) {
        const n = leadingNummer(s);
        if (n != null && n > maxNummer) maxNummer = n;
    }

    const countByNummer = {};
    for (const s of withNummer) {
        const key = String(s.nummer);
        countByNummer[key] = (countByNummer[key] || 0) + 1;
    }
    const duplicate = withNummer.filter((s) => countByNummer[String(s.nummer)] > 1).length;

    return { total, withoutNummer, maxNummer: maxNummer || null, duplicate };
});

// Sortierung nach Liednummer 2026. Die Nummern wurden bereits in der
// (gesangbuch-eigenen) alphabetischen Sortierreihenfolge der Titel vergeben –
// nach der Nummer zu sortieren reproduziert daher die korrekte Titel-Sortierung,
// ohne die Sonderregeln (Artikel, Satzzeichen, Umlaute …) nachbauen zu müssen.
// Lieder ohne Nummer landen am Ende, untereinander alphabetisch nach Titel.
const byTitelCompare = (a, b) => a.titel.localeCompare(b.titel, 'de', { sensitivity: 'base' });
function leadingNummer(s) {
    const match = String(s.nummer ?? '').match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}
const byNummer = (a, b) => {
    const na = leadingNummer(a);
    const nb = leadingNummer(b);
    if (na == null && nb == null) return byTitelCompare(a, b);
    if (na == null) return 1;
    if (nb == null) return -1;
    if (na !== nb) return na - nb;
    // Gleiche führende Nummer (z. B. Liedfassungen 12a/12b): nach voller Nummer, dann Titel.
    const fa = String(a.nummer);
    const fb = String(b.nummer);
    return fa.localeCompare(fb, 'de') || byTitelCompare(a, b);
};

// 1. Nach Liednummer 2026 (= alphabetische Titel-Reihenfolge des Gesangbuchs).
const alphabetical = computed(() => [...songs.value].sort(byNummer));

// 2. Nach Kategorien, darin nach Liednummer 2026 (Titel-Reihenfolge). Ein Lied
// erscheint unter jeder seiner Kategorien; Lieder ohne Kategorie unter
// „Ohne Kategorie" (ans Ende sortiert).
const byCategory = computed(() => {
    const groups = {};
    for (const s of songs.value) {
        const kats = s.kategorien.length ? s.kategorien : [OHNE_KATEGORIE];
        for (const kat of kats) {
            (groups[kat] ||= []).push(s);
        }
    }
    return Object.keys(groups)
        .sort((a, b) => {
            if (a === OHNE_KATEGORIE) return 1;
            if (b === OHNE_KATEGORIE) return -1;
            return a.localeCompare(b, 'de', { sensitivity: 'base' });
        })
        .map((kat) => ({ kategorie: kat, songs: [...groups[kat]].sort(byNummer) }));
});

// Gesamtzahl der Einträge (mit Mehrfachzählung: ein Lied pro Kategorie).
const category_song_count = computed(() =>
    byCategory.value.reduce((sum, g) => sum + g.songs.length, 0),
);

// Anzahl eindeutiger Lieder (ohne Mehrfachzählung über Kategorien hinweg).
const category_distinct_count = computed(() => {
    const ids = new Set();
    byCategory.value.forEach((g) => g.songs.forEach((s) => ids.add(s.id)));
    return ids.size;
});

// --- Export-Helfer --------------------------------------------------------
function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function buildCsv(headers, rows) {
    const lines = [headers.join(',')];
    rows.forEach((r) => lines.push(r.map(csvEscape).join(',')));
    return '﻿' + lines.join('\n');
}

function download(filename, content, mime = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        snackbar_message.value = 'In die Zwischenablage kopiert.';
    } catch (e) {
        snackbar_message.value = 'Kopieren fehlgeschlagen.';
    }
    snackbar.value = true;
}

// --- Alphabetisch ---------------------------------------------------------
function downloadAlphabetical() {
    const rows = alphabetical.value.map((s) => [s.nummer, s.titel]);
    download('inhaltsverzeichnis_alphabetisch.csv', buildCsv(['nr_2026', 'titel'], rows));
}
function copyAlphabetical() {
    // Tab-getrennt: lässt sich direkt in Tabellen einfügen.
    const text = alphabetical.value.map((s) => `${s.nummer}\t${s.titel}`).join('\n');
    copyToClipboard(text);
}

// --- Nach Kategorien ------------------------------------------------------
function downloadByCategory() {
    const rows = [];
    byCategory.value.forEach((g) =>
        g.songs.forEach((s) => rows.push([g.kategorie, s.nummer, s.titel])),
    );
    download('inhaltsverzeichnis_kategorien.csv', buildCsv(['kategorie', 'nr_2026', 'titel'], rows));
}
function copyByCategory() {
    // Gut lesbar: Kategorie als Überschrift, darunter die Lieder.
    const text = byCategory.value
        .map((g) => {
            const lines = g.songs.map((s) => `\t${s.nummer}\t${s.titel}`);
            return `${g.kategorie}\n${lines.join('\n')}`;
        })
        .join('\n\n');
    copyToClipboard(text);
}
</script>

<template>
    <div class="d-flex align-center flex-wrap ga-2 mb-2">
        <h1 class="me-4">Inhaltsverzeichnis-Export</h1>
        <v-tooltip text="Lieder insgesamt (Bewertet und genommen)" location="bottom">
            <template #activator="{ props }">
                <v-chip
                    v-bind="props"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-music"
                >
                    {{ stats.total }} Lieder
                </v-chip>
            </template>
        </v-tooltip>
        <v-tooltip
            text="Lieder, die sich eine Liednummer 2026 mit mindestens einem anderen Lied teilen"
            location="bottom"
        >
            <template #activator="{ props }">
                <v-chip
                    v-bind="props"
                    :color="stats.duplicate ? 'warning' : undefined"
                    variant="tonal"
                    prepend-icon="mdi-content-duplicate"
                >
                    {{ stats.duplicate }} gleiche Nr.
                </v-chip>
            </template>
        </v-tooltip>
        <v-tooltip text="Höchste vergebene Liednummer 2026" location="bottom">
            <template #activator="{ props }">
                <v-chip
                    v-bind="props"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-pound"
                >
                    Höchste Nr.: {{ stats.maxNummer ?? '–' }}
                </v-chip>
            </template>
        </v-tooltip>
        <v-tooltip text="Lieder ohne Liednummer 2026" location="bottom">
            <template #activator="{ props }">
                <v-chip
                    v-bind="props"
                    :color="stats.withoutNummer ? 'warning' : undefined"
                    variant="tonal"
                    prepend-icon="mdi-help-circle-outline"
                >
                    {{ stats.withoutNummer }} ohne Nr.
                </v-chip>
            </template>
        </v-tooltip>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-4" style="max-width: 820px">
        Separater Export des Inhaltsverzeichnisses zum Importieren oder Kopieren – einmal
        alphabetisch nach Titel und einmal nach Kategorien gruppiert. Die CSV-Datei eignet sich zum
        Import, die Schaltfläche „In Zwischenablage kopieren“ liefert eine direkt einfügbare
        (Tabulator-getrennte) Fassung.
    </p>

    <v-card class="mb-4">
        <v-card-text class="d-flex flex-wrap align-center ga-4">
            <v-checkbox
                v-model="only_accepted"
                label='Nur "Bewertet und genommen"'
                color="success"
                hide-details
                density="comfortable"
            />
            <v-checkbox
                v-model="only_with_number"
                label="Nur mit Liednummer 2026"
                hide-details
                density="comfortable"
            />
        </v-card-text>
    </v-card>

    <v-row>
        <!-- 1. Alphabetisch nach Titel -->
        <v-col cols="12" md="6">
            <v-card class="h-100">
                <v-card-title class="d-flex align-center ga-2">
                    <v-icon>mdi-sort-alphabetical-ascending</v-icon>
                    Alphabetisch nach Titel
                    <v-chip size="small" variant="tonal" class="ms-1">
                        {{ alphabetical.length }}
                    </v-chip>
                </v-card-title>
                <v-card-text>
                    <div class="d-flex flex-wrap ga-2 mb-3">
                        <v-btn
                            color="primary"
                            prepend-icon="mdi-download"
                            :disabled="alphabetical.length === 0"
                            @click="downloadAlphabetical"
                        >
                            CSV herunterladen
                        </v-btn>
                        <v-btn
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="alphabetical.length === 0"
                            @click="copyAlphabetical"
                        >
                            In Zwischenablage kopieren
                        </v-btn>
                    </div>
                    <div class="toc-preview">
                        <v-table density="compact" hover>
                            <thead>
                                <tr>
                                    <th style="width: 90px">Nr. 2026</th>
                                    <th>Titel</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="s in alphabetical" :key="s.id">
                                    <td class="text-medium-emphasis">{{ s.nummer || '–' }}</td>
                                    <td>{{ s.titel }}</td>
                                </tr>
                                <tr v-if="alphabetical.length === 0">
                                    <td colspan="2" class="text-center text-medium-emphasis py-4">
                                        Keine Lieder im aktuellen Filter.
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </div>
                </v-card-text>
            </v-card>
        </v-col>

        <!-- 2. Nach Kategorien -->
        <v-col cols="12" md="6">
            <v-card class="h-100">
                <v-card-title class="d-flex align-center ga-2">
                    <v-icon>mdi-tag-multiple</v-icon>
                    Nach Kategorien
                    <v-chip size="small" variant="tonal" class="ms-1">
                        {{ byCategory.length }} Kategorien · {{ category_distinct_count }} Lieder ·
                        {{ category_song_count }} Einträge
                    </v-chip>
                </v-card-title>
                <v-card-text>
                    <div class="d-flex flex-wrap ga-2 mb-3">
                        <v-btn
                            color="primary"
                            prepend-icon="mdi-download"
                            :disabled="byCategory.length === 0"
                            @click="downloadByCategory"
                        >
                            CSV herunterladen
                        </v-btn>
                        <v-btn
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="byCategory.length === 0"
                            @click="copyByCategory"
                        >
                            In Zwischenablage kopieren
                        </v-btn>
                    </div>
                    <p class="text-caption text-medium-emphasis mb-2">
                        Ein Lied mit mehreren Kategorien erscheint unter jeder davon.
                    </p>
                    <div class="toc-preview">
                        <template v-if="byCategory.length">
                            <div v-for="g in byCategory" :key="g.kategorie" class="mb-3">
                                <div class="text-subtitle-2 font-weight-bold mb-1">
                                    {{ g.kategorie }}
                                    <span class="text-medium-emphasis">({{ g.songs.length }})</span>
                                </div>
                                <v-table density="compact">
                                    <tbody>
                                        <tr v-for="s in g.songs" :key="g.kategorie + '-' + s.id">
                                            <td style="width: 90px" class="text-medium-emphasis">
                                                {{ s.nummer || '–' }}
                                            </td>
                                            <td>{{ s.titel }}</td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </div>
                        </template>
                        <div v-else class="text-center text-medium-emphasis py-4">
                            Keine Lieder im aktuellen Filter.
                        </div>
                    </div>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>

    <v-snackbar v-model="snackbar" :timeout="3000">
        {{ snackbar_message }}
        <template #actions>
            <v-btn variant="text" @click="snackbar = false">OK</v-btn>
        </template>
    </v-snackbar>
</template>

<style scoped>
.toc-preview {
    max-height: 60vh;
    overflow-y: auto;
}
</style>
