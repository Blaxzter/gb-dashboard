<script setup>
// Strophe-1-Abgleich (Issue #99)
//
// Bisher gibt es keinen Weg, die 1. Strophe im Redaktionssystem gegen die von
// Jens gesetzte und von Janosch übernommene Fassung im Notenbild zu halten. Der
// Druck-Check kann das nicht: In der Druck-PDF ist die 1. Strophe kein Text,
// sondern Teil des Notensatzes (siehe notenFingerprint.js). Bleibt der Abgleich
// von Hand – diese Ansicht macht ihn erträglich: links die Liste der Lieder,
// rechts Notenbild und Datenbanktext nebeneinander, dazu eine Markierung, was
// schon angesehen wurde. Für die Korrektur auf Papier führt der „Drucken"-Knopf
// zur Druckansicht derselben Gegenüberstellung.
//
// Die Markierung liegt im Browser (strophe1Marks.js), nicht in der Datenbank:
// Sie ist Arbeitsstand einer Person, kein Datum des Liedes.

import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/store/app.js';
import { isGenommen } from '@/assets/js/gesangbuchChecks.js';
import { resolveLiednummer2026 } from '@/assets/js/utils.js';
import {
    abgleichKey,
    hasNotenbild,
    hasStrophe1,
    strophe1Flow,
} from '@/assets/js/strophe1Abgleich.js';
import { useStrophe1Marks } from '@/assets/js/strophe1Marks.js';
import { ocrFileUrl, useStrophe1Ocr, verdictMeta, VERDICT_ORDER } from '@/assets/js/strophe1Ocr.js';
import Strophe1Compare from '@/components/checks/Strophe1Compare.vue';
import Strophe1OcrPanel from '@/components/checks/Strophe1OcrPanel.vue';
import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const marks = useStrophe1Marks();
const ocr = useStrophe1Ocr();

store.loadData();
// Die maschinellen Befunde sind Beiwerk: Sind sie nicht hinterlegt, bleibt die
// Ansicht ohne sie voll benutzbar (siehe strophe1Ocr.js).
ocr.loadOnce();
const alle_lieder = computed(() => store.gesangbuchlieder);

// --- Nummern ---------------------------------------------------------------
// 2026er Liednummer wie in den Export-Ansichten auflösen: eigene Nummer, sonst
// die der deutschen Liedfassung.
const liednummer2026_by_id = computed(() => {
    const map = {};
    for (const l of alle_lieder.value) {
        if (l && l.id != null && l.liednummer2026) map[l.id] = l.liednummer2026;
    }
    return map;
});
function nummerOf(lied) {
    return resolveLiednummer2026(lied, liednummer2026_by_id.value);
}
function sortNummer(lied) {
    const n = parseInt(nummerOf(lied), 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

// --- Filter ----------------------------------------------------------------
// Die Filter stehen in der URL. Das kostet nichts und bringt zweierlei: Der Weg
// zurück aus der Druckansicht führt auf denselben Stapel, und ein Link auf eine
// Auswahl („alle ohne Notenbild") lässt sich weitergeben.
const NOTENBILD_OPTIONS = [
    { value: 'has', title: 'mit Notenbild' },
    { value: 'none', title: 'ohne Notenbild' },
    { value: 'all', title: 'alle' },
];

// Filter über den maschinellen Befund. Nur sichtbar, wenn Befunde geladen sind.
const BEFUND_OPTIONS = computed(() => [
    { value: 'all', title: 'alle' },
    { value: 'problems', title: 'nur Befunde' },
    ...VERDICT_ORDER.map((key) => ({ value: key, title: verdictMeta(key).label })),
]);

const search = ref(String(route.query.q || ''));
const only_genommen = ref(route.query.genommen !== '0');
const notenbild_filter = ref(
    NOTENBILD_OPTIONS.some((o) => o.value === route.query.noten) ? route.query.noten : 'has',
);
const only_open = ref(route.query.offen === '1');
const befund_filter = ref(String(route.query.befund || 'all'));

// Sortierung: nach Liednummer (der Stapel, wie er im Buch liegt) oder nach
// Befund (das Auffälligste zuerst) – letzteres, um die acht stark abweichenden
// Lieder zu finden, ohne durch 560 zu blättern.
const sort_by_befund = ref(route.query.sort === 'befund');

function verdictOf(lied) {
    return ocr.findingFor(lied)?.bewertung || '';
}

// Ohne den Befund-Filter – daraus wird die Befund-Verteilung gerechnet. Sonst
// zeigte die Verteilung nach einem Klick nur noch die angeklickte Bewertung, und
// der Weg zurück zu den anderen wäre verschwunden.
const liste_ohne_befund = computed(() => {
    // `clearable` setzt das Suchfeld auf null, nicht auf ''.
    const q = (search.value || '').trim().toLowerCase();
    return alle_lieder.value.filter((lied) => {
        if (only_genommen.value && !isGenommen(lied)) return false;
        const noten = hasNotenbild(lied);
        if (notenbild_filter.value === 'has' && !noten) return false;
        if (notenbild_filter.value === 'none' && noten) return false;
        if (only_open.value && marks.isMarked(abgleichKey(lied))) return false;
        if (q) {
            const hay = `${lied.titel || ''} ${nummerOf(lied)} ${strophe1Flow(lied)}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
});

const liste = computed(() => {
    const list = liste_ohne_befund.value.filter((lied) => {
        if (befund_filter.value === 'all') return true;
        const verdict = verdictOf(lied);
        if (befund_filter.value === 'problems') return !!verdict && verdictMeta(verdict).problem;
        return verdict === befund_filter.value;
    });
    const byNummer = (a, b) =>
        sortNummer(a) - sortNummer(b) || (a.titel || '').localeCompare(b.titel || '');
    if (!sort_by_befund.value) return list.sort(byNummer);
    // Lieder ohne Befund hinten – sie sagen nichts über Dringlichkeit aus.
    const rank = (lied) => (verdictOf(lied) ? verdictMeta(verdictOf(lied)).rank : 98);
    return list.sort((a, b) => rank(a) - rank(b) || byNummer(a, b));
});

// Kennzahlen beziehen sich auf die gefilterte Liste – das ist der Stapel, den
// man gerade abarbeitet.
const stats = computed(() => {
    let marked = 0;
    let ohne_noten = 0;
    let ohne_strophe = 0;
    for (const lied of liste.value) {
        if (marks.isMarked(abgleichKey(lied))) marked++;
        if (!hasNotenbild(lied)) ohne_noten++;
        if (!hasStrophe1(lied)) ohne_strophe++;
    }
    return { total: liste.value.length, marked, ohne_noten, ohne_strophe };
});

// Befund-Verteilung über die gefilterte Liste (nicht die Zusammenfassung aus der
// Datei): Sie soll den Stapel beschreiben, den man vor sich hat.
const befund_stats = computed(() => {
    if (ocr.status.value !== 'ready') return [];
    const counts = {};
    for (const lied of liste_ohne_befund.value) {
        const verdict = verdictOf(lied);
        if (verdict) counts[verdict] = (counts[verdict] || 0) + 1;
    }
    return VERDICT_ORDER.filter((key) => counts[key]).map((key) => ({
        key,
        count: counts[key],
        ...verdictMeta(key),
    }));
});

// --- Auswahl ---------------------------------------------------------------
const selected_id = ref(route.params.id ? Number(route.params.id) : null);
const selected = computed(() => alle_lieder.value.find((l) => l.id === selected_id.value) || null);
const selected_key = computed(() => (selected.value ? abgleichKey(selected.value) : ''));
const selected_index = computed(() => liste.value.findIndex((l) => l.id === selected_id.value));

// Nur die vom Standard abweichenden Filter in die URL – so bleibt sie lesbar.
const filter_query = computed(() => {
    const q = {};
    if ((search.value || '').trim()) q.q = search.value.trim();
    if (notenbild_filter.value !== 'has') q.noten = notenbild_filter.value;
    if (!only_genommen.value) q.genommen = '0';
    if (only_open.value) q.offen = '1';
    if (befund_filter.value !== 'all') q.befund = befund_filter.value;
    if (sort_by_befund.value) q.sort = 'befund';
    return q;
});

function syncUrl() {
    router.replace({
        name: 'Strophe1Abgleich',
        params: selected_id.value ? { id: String(selected_id.value) } : {},
        query: filter_query.value,
    });
}
watch(filter_query, syncUrl);

function select(lied) {
    selected_id.value = lied?.id ?? null;
    syncUrl();
}
function step(delta) {
    // Steht das gezeigte Lied nicht (mehr) in der Liste – etwa aus einem
    // geteilten Link heraus –, führt „weiter" an ihren Anfang.
    if (selected_index.value < 0) {
        if (liste.value.length) select(liste.value[0]);
        return;
    }
    const next = liste.value[selected_index.value + delta];
    if (next) select(next);
}

// Sobald Daten da sind: das erste Lied zeigen, statt eine leere rechte Hälfte.
// Ein per Link geöffnetes Lied bleibt dabei stehen, auch wenn der Filter es aus
// der Liste nimmt – wer einen Link bekommt, will genau dieses Lied sehen.
watch(
    liste,
    (list) => {
        if (!selected.value && list.length) select(list[0]);
    },
    { immediate: true },
);

// --- Markieren -------------------------------------------------------------
function toggleMark() {
    marks.set(selected_key.value, !marks.isMarked(selected_key.value));
}
// Abhaken und gleich weiter – der übliche Griff beim Durchgehen eines Stapels.
function markAndNext() {
    marks.set(selected_key.value, true);
    step(1);
}
const reset_dialog = ref(false);
function resetMarks() {
    marks.clear();
    reset_dialog.value = false;
}

// --- Darstellung -----------------------------------------------------------
const flow = ref(false);
const line_numbers = ref(true);
const show_ocr_text = ref(false);
const selected_finding = computed(() => (selected.value ? ocr.findingFor(selected.value) : null));

// Befund-Datei von Hand einlesen, wenn sie nicht ausgeliefert wird.
const ocr_input = ref(null);
function pickOcrFile() {
    ocr_input.value?.click();
}
function onOcrFile(e) {
    const file = e.target.files?.[0];
    if (file) ocr.loadFromFile(file);
    e.target.value = '';
}

// --- Druckansicht ----------------------------------------------------------
// Der ganze gefilterte Stapel wandert hinüber; in welchen Portionen daraus
// Papier wird, entscheidet die Druckansicht (sie muss jedes Notenbild rendern
// und kann das nicht für hunderte Blätter auf einmal).
//
// Bewusst im selben Tab: Ein neuer Tab startet die App von vorn und lädt den
// gesamten Datenbestand noch einmal (16 Abfragen über alle Lieder), nur um ein
// paar Blätter zu drucken. So ist der Speicher schon gefüllt, die Druckansicht
// steht sofort – und „Zurück" führt über die URL-Filter auf denselben Stapel.
const print_ids = computed(() => liste.value.map((l) => l.id));
const print_route = computed(() => ({
    name: 'Strophe1AbgleichDruck',
    query: { ids: print_ids.value.join(',') },
}));

// --- Lied-Dialog -----------------------------------------------------------
const song_dialog = ref(false);
</script>

<template>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
        <h1 class="me-2">Strophe-1-Abgleich</h1>
        <v-chip color="primary" variant="tonal" prepend-icon="mdi-music">
            {{ stats.total }} Lied(er)
        </v-chip>
        <v-chip v-if="stats.marked" color="success" variant="tonal" prepend-icon="mdi-check-all">
            abgeglichen: {{ stats.marked }}
        </v-chip>
        <v-chip
            v-if="stats.ohne_noten"
            color="warning"
            variant="tonal"
            prepend-icon="mdi-music-note-off-outline"
        >
            ohne Notenbild: {{ stats.ohne_noten }}
        </v-chip>
        <v-chip
            v-if="stats.ohne_strophe"
            color="error"
            variant="tonal"
            prepend-icon="mdi-text-box-remove-outline"
        >
            ohne 1. Strophe: {{ stats.ohne_strophe }}
        </v-chip>
        <v-spacer />
        <!-- Maschinelle Befunde: vorhanden, nicht hinterlegt oder kaputt. -->
        <v-chip
            v-if="ocr.status.value === 'ready'"
            variant="tonal"
            prepend-icon="mdi-text-recognition"
            link
            :href="ocrFileUrl()"
            target="_blank"
            :title="`OCR-Abgleich vom ${ocr.data.value.erzeugt} · ${ocr.data.value.engine} @ ${ocr.data.value.dpi} dpi · ${ocr.data.value.count} Lieder · Befunddatei öffnen`"
        >
            OCR-Befunde: {{ ocr.data.value.erzeugt }}
        </v-chip>
        <v-btn
            v-else-if="ocr.status.value === 'missing' || ocr.status.value === 'error'"
            variant="text"
            size="small"
            prepend-icon="mdi-text-recognition"
            :color="ocr.status.value === 'error' ? 'error' : undefined"
            :title="
                ocr.status.value === 'error'
                    ? `${ocr.error.value} – eine Befunddatei lässt sich hier von Hand einlesen.`
                    : 'Es liegen keine maschinellen Befunde vor – eine Datei aus dem OCR-Abgleich (gb-scripts) lässt sich hier einlesen.'
            "
            @click="pickOcrFile"
        >
            OCR-Befunde laden
        </v-btn>
        <input
            ref="ocr_input"
            type="file"
            accept="application/json,.json"
            style="display: none"
            @change="onOcrFile"
        />
        <v-btn
            v-if="marks.count()"
            variant="text"
            size="small"
            color="error"
            prepend-icon="mdi-restore"
            @click="reset_dialog = true"
        >
            Markierungen zurücksetzen
        </v-btn>
        <v-btn
            :to="print_route"
            color="primary"
            variant="tonal"
            size="small"
            prepend-icon="mdi-printer"
            :disabled="!print_ids.length"
            title="Diese Liste als Korrekturbögen drucken – dort blätterweise in Portionen"
        >
            Drucken ({{ print_ids.length }})
        </v-btn>
    </div>

    <div class="text-medium-emphasis mb-4">
        Die 1. Strophe steht doppelt: im gesetzten Notenbild und im Redaktionssystem – abgeglichen
        wurden die beiden nie. Der Druck-Check kann das nicht nachholen, weil die 1. Strophe in der
        Druck-PDF zum Notensatz gehört und dort kein Text ist. Hier stehen beide Fassungen
        nebeneinander; abgehakte Lieder merkt sich dieser Browser.
        <template v-if="ocr.status.value === 'ready'">
            Zusätzlich ist der Notensatz maschinell gelesen worden – die Bewertung daneben sagt, wo
            sich das Hinsehen am ehesten lohnt. Sie ersetzt den Blick nicht: Silbentrennung und
            Notenlinien führen die Texterkennung regelmäßig aufs Glatteis.
        </template>
    </div>

    <!-- Verteilung der Befunde über den gefilterten Stapel; ein Klick filtert. -->
    <div v-if="befund_stats.length" class="d-flex align-center flex-wrap ga-2 mb-4">
        <v-chip
            v-for="b in befund_stats"
            :key="b.key"
            :color="b.color"
            :variant="befund_filter === b.key ? 'flat' : 'tonal'"
            :prepend-icon="b.icon"
            size="small"
            link
            :title="`Nur ${b.label} zeigen`"
            @click="befund_filter = befund_filter === b.key ? 'all' : b.key"
        >
            {{ b.label }}: {{ b.count }}
        </v-chip>
    </div>

    <div class="abgleich">
        <!-- Liste -->
        <v-card class="abgleich-list">
            <v-card-text class="pb-2">
                <v-text-field
                    v-model="search"
                    label="Suche (Titel, Nummer, Strophentext)"
                    prepend-inner-icon="mdi-magnify"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    class="mb-3"
                />
                <v-select
                    v-model="notenbild_filter"
                    :items="NOTENBILD_OPTIONS"
                    label="Notenbild"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="mb-2"
                />
                <v-select
                    v-if="ocr.status.value === 'ready'"
                    v-model="befund_filter"
                    :items="BEFUND_OPTIONS"
                    label="Maschineller Befund"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="mb-2"
                />
                <v-switch
                    v-model="only_genommen"
                    label="Nur bewertet und genommen"
                    color="primary"
                    density="compact"
                    hide-details
                />
                <v-switch
                    v-model="only_open"
                    label="Nur offene"
                    color="primary"
                    density="compact"
                    hide-details
                />
                <v-switch
                    v-if="ocr.status.value === 'ready'"
                    v-model="sort_by_befund"
                    label="Auffälligste zuerst"
                    color="primary"
                    density="compact"
                    hide-details
                />
            </v-card-text>
            <v-divider />
            <v-virtual-scroll :items="liste" height="calc(100vh - 420px)" item-height="56">
                <template #default="{ item }">
                    <v-list-item
                        :active="item.id === selected_id"
                        color="primary"
                        density="compact"
                        @click="select(item)"
                    >
                        <template #prepend>
                            <v-icon
                                v-if="marks.isMarked(abgleichKey(item))"
                                color="success"
                                size="small"
                            >
                                mdi-check-circle
                            </v-icon>
                            <v-icon v-else size="small" class="text-disabled">
                                mdi-circle-outline
                            </v-icon>
                        </template>
                        <v-list-item-title class="text-body-2">
                            <span class="font-weight-bold me-1">{{ nummerOf(item) || '–' }}</span>
                            {{ item.titel }}
                        </v-list-item-title>
                        <!-- Maschineller Befund als Punkt am rechten Rand: sichtbar
                             beim Durchblättern, ohne die Zeile zu überladen. -->
                        <template v-if="verdictOf(item)" #append>
                            <v-icon
                                :color="verdictMeta(verdictOf(item)).color"
                                size="x-small"
                                :title="verdictMeta(verdictOf(item)).label"
                            >
                                {{ verdictMeta(verdictOf(item)).icon }}
                            </v-icon>
                        </template>
                        <v-list-item-subtitle class="text-caption">
                            <v-icon
                                v-if="!hasNotenbild(item)"
                                size="x-small"
                                color="warning"
                                class="me-1"
                            >
                                mdi-music-note-off-outline
                            </v-icon>
                            <v-icon
                                v-if="!hasStrophe1(item)"
                                size="x-small"
                                color="error"
                                class="me-1"
                            >
                                mdi-text-box-remove-outline
                            </v-icon>
                            {{ strophe1Flow(item).slice(0, 60) || 'keine 1. Strophe' }}
                        </v-list-item-subtitle>
                    </v-list-item>
                </template>
            </v-virtual-scroll>
            <v-divider />
            <div v-if="!liste.length" class="pa-4 text-center text-medium-emphasis">
                Kein Lied passt zu diesen Filtern.
            </div>
        </v-card>

        <!-- Gegenüberstellung -->
        <v-card v-if="selected" class="abgleich-detail">
            <v-card-title class="d-flex align-center flex-wrap ga-2">
                <span class="text-h6">
                    <span class="text-primary">{{ nummerOf(selected) || '–' }}</span>
                    · {{ selected.titel }}
                </span>
                <v-chip
                    v-if="marks.isMarked(selected_key)"
                    color="success"
                    variant="tonal"
                    size="small"
                    prepend-icon="mdi-check-all"
                    :title="marks.markedAtLabel(selected_key)"
                >
                    abgeglichen
                </v-chip>
                <v-spacer />
                <v-btn
                    icon="mdi-chevron-left"
                    variant="text"
                    size="small"
                    title="Vorheriges Lied"
                    :disabled="selected_index <= 0"
                    @click="step(-1)"
                />
                <span class="text-caption text-medium-emphasis">
                    <template v-if="selected_index >= 0">
                        {{ selected_index + 1 }} / {{ liste.length }}
                    </template>
                    <template v-else>nicht in der Liste</template>
                </span>
                <v-btn
                    icon="mdi-chevron-right"
                    variant="text"
                    size="small"
                    title="Nächstes Lied"
                    :disabled="selected_index >= liste.length - 1"
                    @click="step(1)"
                />
            </v-card-title>

            <v-card-text>
                <div class="d-flex align-center flex-wrap ga-2 mb-4">
                    <v-btn
                        :color="marks.isMarked(selected_key) ? 'success' : 'primary'"
                        :variant="marks.isMarked(selected_key) ? 'tonal' : 'flat'"
                        size="small"
                        :prepend-icon="marks.isMarked(selected_key) ? 'mdi-check-all' : 'mdi-check'"
                        @click="toggleMark"
                    >
                        {{
                            marks.isMarked(selected_key)
                                ? 'Abgleich zurücknehmen'
                                : 'Als abgeglichen markieren'
                        }}
                    </v-btn>
                    <v-btn
                        v-if="selected_index < liste.length - 1"
                        variant="text"
                        size="small"
                        prepend-icon="mdi-check-all"
                        @click="markAndNext"
                    >
                        Abhaken &amp; weiter
                    </v-btn>
                    <v-divider vertical class="mx-1" />
                    <v-btn
                        variant="text"
                        size="small"
                        :color="flow ? 'primary' : undefined"
                        prepend-icon="mdi-format-text-wrapping-overflow"
                        title="Strophentext fortlaufend zeigen – so, wie er unter den Noten läuft"
                        @click="flow = !flow"
                    >
                        {{ flow ? 'Zeilenweise' : 'Fortlaufend' }}
                    </v-btn>
                    <v-btn
                        v-if="!flow"
                        variant="text"
                        size="small"
                        :color="line_numbers ? 'primary' : undefined"
                        prepend-icon="mdi-format-list-numbered"
                        @click="line_numbers = !line_numbers"
                    >
                        Zeilennummern
                    </v-btn>
                    <v-btn
                        v-if="selected_finding"
                        variant="text"
                        size="small"
                        :color="show_ocr_text ? 'primary' : undefined"
                        prepend-icon="mdi-text-recognition"
                        title="Den Text zeigen, den die Texterkennung aus dem Notenbild gelesen hat"
                        @click="show_ocr_text = !show_ocr_text"
                    >
                        Gelesener Text
                    </v-btn>
                    <v-spacer />
                    <v-btn
                        variant="text"
                        size="small"
                        prepend-icon="mdi-information-outline"
                        @click="song_dialog = true"
                    >
                        Lied öffnen
                    </v-btn>
                </div>

                <!-- Der maschinelle Befund steht ÜBER der Gegenüberstellung: Er
                     sagt, worauf beim Vergleich zu achten ist – danach schaut man
                     selbst nach. -->
                <Strophe1OcrPanel
                    v-if="selected_finding"
                    :finding="selected_finding"
                    :show-ocr-text="show_ocr_text"
                    class="mb-4"
                />

                <Strophe1Compare
                    :key="selected.id"
                    :lied="selected"
                    :flow="flow"
                    :line-numbers="line_numbers"
                />
            </v-card-text>
        </v-card>

        <v-card v-else class="abgleich-detail">
            <v-card-text class="text-medium-emphasis text-center py-12">
                Kein Lied ausgewählt.
            </v-card-text>
        </v-card>
    </div>

    <v-dialog v-model="song_dialog" width="700">
        <GesangbuchLiedComponent
            v-if="selected"
            :selected-song="selected"
            @close="song_dialog = false"
        />
    </v-dialog>

    <v-dialog v-model="reset_dialog" width="460">
        <v-card>
            <v-card-title>Markierungen zurücksetzen?</v-card-title>
            <v-card-text>
                Alle {{ marks.count() }} als abgeglichen markierten Lieder gelten wieder als offen.
                Die Markierungen sind lokal in diesem Browser gespeichert und gehen dabei verloren.
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="reset_dialog = false">Abbrechen</v-btn>
                <v-btn color="error" variant="flat" @click="resetMarks">Zurücksetzen</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.abgleich {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}
@media (max-width: 960px) {
    .abgleich {
        grid-template-columns: minmax(0, 1fr);
    }
}
.abgleich-list {
    position: sticky;
    top: 12px;
}
.abgleich-detail {
    min-width: 0;
}
</style>
