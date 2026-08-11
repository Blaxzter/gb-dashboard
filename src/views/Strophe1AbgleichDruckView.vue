<script setup>
// Druckansicht des Strophe-1-Abgleichs (Issue #99).
//
// Korrektur gelesen wird auf Papier – hier entsteht der Bogen dazu: je Lied ein
// Blatt, oben das Notenbild, darunter die 1. Strophe aus dem Redaktionssystem,
// mit weitem Zeilenabstand, damit Korrekturen zwischen die Zeilen passen. Die
// Liedauswahl kommt aus der Abgleich-Ansicht (`?ids=`), damit auf Papier genau
// der Stapel landet, den man dort gefiltert hat.

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/store/app.js';
import { resolveLiednummer2026 } from '@/assets/js/utils.js';
import { useStrophe1Ocr } from '@/assets/js/strophe1Ocr.js';
import Strophe1Compare from '@/components/checks/Strophe1Compare.vue';
import Strophe1OcrPanel from '@/components/checks/Strophe1OcrPanel.vue';
import LoaderComponent from '@/components/util/LoaderComponent.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const ocr = useStrophe1Ocr();

const loading = ref(true);
const load_error = ref('');
const flow = ref(false);
const line_numbers = ref(true);
// Maschinelle Befunde mit aufs Blatt: Sie sagen der Person mit dem Rotstift, wo
// die Texterkennung einen Unterschied vermutet. Abschaltbar, weil ein Bogen auch
// ohne Vorbelegung sinnvoll ist – wer unvoreingenommen lesen soll, bekommt ihn
// ohne.
const with_ocr = ref(true);

const ids = computed(() =>
    String(route.query.ids || '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
);

const liednummer2026_by_id = computed(() => {
    const map = {};
    for (const l of store.gesangbuchlieder) {
        if (l && l.id != null && l.liednummer2026) map[l.id] = l.liednummer2026;
    }
    return map;
});
function nummerOf(lied) {
    return resolveLiednummer2026(lied, liednummer2026_by_id.value);
}

// Reihenfolge wie übergeben – die Abgleich-Ansicht sortiert bereits nach
// Liednummer, und ein Stapel soll so liegen, wie er zusammengestellt wurde.
const songs = computed(() => {
    if (loading.value) return [];
    const byId = new Map(store.gesangbuchlieder.map((l) => [l.id, l]));
    return ids.value.map((id) => byId.get(id)).filter(Boolean);
});

// --- Portionen -------------------------------------------------------------
// Ein Stapel von mehreren hundert Liedern lässt sich nicht in einem Rutsch
// drucken: Jedes Notenbild muss dafür gerendert werden und liegt dabei als Bild
// im Speicher. Also portionsweise – mit Blätterung, damit man den nächsten
// Schwung tatsächlich erreicht, und einstellbarer Portionsgröße, weil ein
// kräftiger Rechner mehr auf einmal schafft als ein Notebook.
const PER_PAGE_OPTIONS = [10, 20, 40, 60];
const DEFAULT_PER_PAGE = 20;

function queryInt(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
const per_page = ref(
    PER_PAGE_OPTIONS.includes(queryInt(route.query.pro, 0))
        ? queryInt(route.query.pro, DEFAULT_PER_PAGE)
        : DEFAULT_PER_PAGE,
);
const page = ref(queryInt(route.query.seite, 1));

const page_count = computed(() => Math.max(1, Math.ceil(songs.value.length / per_page.value)));
// Die Portion wird beschnitten, falls die URL auf eine Seite jenseits des Endes
// zeigt (etwa nach einem Wechsel der Portionsgröße).
const offset = computed(() => (Math.min(page.value, page_count.value) - 1) * per_page.value);
const batch = computed(() => songs.value.slice(offset.value, offset.value + per_page.value));

// Portionsgröße ändern, ohne die Stelle im Stapel zu verlieren.
function setPerPage(size) {
    const first = offset.value;
    per_page.value = size;
    page.value = Math.floor(first / size) + 1;
}
function stepPage(delta) {
    page.value = Math.min(page_count.value, Math.max(1, page.value + delta));
}

// Stelle im Stapel in der URL halten – ein Neuladen soll nicht wieder bei
// Blatt 1 anfangen.
watch([page, per_page], () => {
    router.replace({
        query: { ...route.query, seite: String(page.value), pro: String(per_page.value) },
    });
});

// Erst drucken, wenn alle Notenbilder der Portion gezeichnet sind – ein zu früh
// ausgelöster Druck liefert leere Kästen statt Noten. Innerhalb der Portion
// entstehen die Blätter der Reihe nach: `LOOKAHEAD` hält ein paar in Arbeit, das
// nächste kommt, sobald das vorige steht.
const LOOKAHEAD = 3;
const done_renders = ref(0);
const expected_renders = computed(() => batch.value.length);
const all_rendered = computed(() => !loading.value && done_renders.value >= expected_renders.value);
const visible_songs = computed(() => batch.value.slice(0, done_renders.value + LOOKAHEAD));

// Neue Portion – der Zähler beginnt von vorn.
watch(batch, () => {
    done_renders.value = 0;
    window.scrollTo({ top: 0 });
});

// Aus der Abgleich-Ansicht heraus ist der Speicher längst gefüllt und loadData()
// kehrt sofort zurück. Nur beim direkten Aufruf dieser URL wird wirklich geladen
// – und das kann scheitern (kein Zugriff aufs Backend). Dann hier eine Meldung
// statt eines abgebrochenen mounted-Hooks und einer weißen Seite.
onMounted(async () => {
    // Beim direkten Aufruf dieser URL sind die Befunde noch nicht geladen; aus
    // der Abgleich-Ansicht heraus liegen sie schon vor (Modul-Zustand).
    ocr.loadOnce();
    try {
        await store.loadData();
    } catch (e) {
        console.error('Daten konnten nicht geladen werden', e);
        load_error.value = e?.message || String(e);
    } finally {
        loading.value = false;
    }
});

function printPage() {
    window.print();
}
function goBack() {
    router.back();
}
</script>

<template>
    <div class="druck-view">
        <div class="control-panel no-print">
            <div class="d-flex align-center flex-wrap ga-3 pa-4">
                <h2 class="me-2">Strophe-1-Abgleich · Korrekturbögen</h2>

                <!-- Blätterung durch den Stapel. Gedruckt wird immer die
                     angezeigte Portion. -->
                <template v-if="songs.length">
                    <v-btn
                        icon="mdi-chevron-left"
                        variant="text"
                        size="small"
                        title="Vorige Portion"
                        :disabled="page <= 1"
                        @click="stepPage(-1)"
                    />
                    <span class="text-body-2 text-no-wrap">
                        Blatt {{ offset + 1 }}–{{ offset + batch.length }} von {{ songs.length }}
                    </span>
                    <v-btn
                        icon="mdi-chevron-right"
                        variant="text"
                        size="small"
                        title="Nächste Portion"
                        :disabled="page >= page_count"
                        @click="stepPage(1)"
                    />
                    <v-select
                        :model-value="per_page"
                        :items="PER_PAGE_OPTIONS"
                        label="je Portion"
                        density="compact"
                        variant="outlined"
                        hide-details
                        style="max-width: 120px"
                        @update:model-value="setPerPage"
                    />
                </template>

                <v-chip
                    v-if="expected_renders && !all_rendered"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-music-clef-treble"
                >
                    <v-progress-circular indeterminate size="14" width="2" class="me-2" />
                    Blätter {{ done_renders }} / {{ expected_renders }}
                </v-chip>
                <v-spacer />
                <v-btn
                    variant="text"
                    size="small"
                    :color="flow ? 'primary' : undefined"
                    prepend-icon="mdi-format-text-wrapping-overflow"
                    title="Strophentext fortlaufend drucken – so, wie er unter den Noten läuft"
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
                    v-if="ocr.status.value === 'ready'"
                    variant="text"
                    size="small"
                    :color="with_ocr ? 'primary' : undefined"
                    prepend-icon="mdi-text-recognition"
                    title="Maschinelle Befunde mit auf den Bogen drucken"
                    @click="with_ocr = !with_ocr"
                >
                    Befunde
                </v-btn>
                <v-btn
                    color="primary"
                    prepend-icon="mdi-printer"
                    :disabled="!batch.length || !all_rendered"
                    :title="
                        page_count > 1
                            ? `Druckt diese Portion (Blatt ${offset + 1}–${offset + batch.length}); die übrigen danach weiterblättern`
                            : 'Alle Blätter drucken'
                    "
                    @click="printPage"
                >
                    Drucken ({{ batch.length }})
                </v-btn>
                <v-btn variant="text" @click="goBack">Zurück</v-btn>
            </div>
        </div>

        <div v-if="loading" class="pa-12 d-flex justify-center no-print">
            <LoaderComponent />
        </div>

        <div v-else-if="load_error" class="pa-8 no-print">
            <v-alert type="error" title="Daten konnten nicht geladen werden">
                <div>{{ load_error }}</div>
                <div class="mt-2">
                    Diese Ansicht wird normalerweise aus dem Strophe-1-Abgleich heraus geöffnet und
                    braucht dann nichts nachzuladen. Beim direkten Aufruf der URL muss der gesamte
                    Datenbestand geholt werden – das setzt eine erreichbare Verbindung zum Backend
                    voraus.
                </div>
            </v-alert>
        </div>

        <div v-else-if="!songs.length" class="pa-8 no-print">
            <v-alert type="info" title="Keine Lieder ausgewählt">
                Diese Ansicht wird aus dem Strophe-1-Abgleich heraus geöffnet – dort bestimmt der
                Filter, welche Lieder auf Papier landen.
            </v-alert>
        </div>

        <div v-else class="sheets">
            <section v-for="lied in visible_songs" :key="lied.id" class="sheet">
                <header class="sheet-head">
                    <span class="sheet-nummer">{{ nummerOf(lied) || '–' }}</span>
                    <span class="sheet-titel">{{ lied.titel }}</span>
                    <span class="sheet-label">Abgleich 1. Strophe</span>
                </header>

                <Strophe1Compare
                    :lied="lied"
                    print
                    :flow="flow"
                    :line-numbers="line_numbers"
                    @rendered="done_renders++"
                />

                <Strophe1OcrPanel
                    v-if="with_ocr && ocr.findingFor(lied)"
                    :finding="ocr.findingFor(lied)"
                    print
                    class="sheet-ocr"
                />

                <footer class="sheet-foot">
                    <span>Abweichungen bitte direkt im Text eintragen.</span>
                    <span class="sheet-sign">geprüft von: ______________________</span>
                    <span class="sheet-sign">Datum: ____________</span>
                </footer>
            </section>
        </div>
    </div>
</template>

<style scoped>
.druck-view {
    background: #fff;
    color: #000;
    min-height: 100vh;
}
/* Die Druckansicht bleibt hell – wie die übrigen Druck-/Noten-Ansichten. Feste
   Farben statt Theme-Variablen, weil diese Route außerhalb des v-app-Wurzel-
   elements läuft. */
.control-panel {
    border-bottom: 1px solid #ddd;
    position: sticky;
    top: 0;
    background: #fafafa;
    color: #000;
    z-index: 5;
}

.sheets {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 16px 0;
    background: #e9e9e9;
}
.sheet {
    width: 210mm;
    min-height: 297mm;
    padding: 14mm 18mm;
    background: #fff;
    color: #000;
    box-shadow: 0 1px 8px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    page-break-after: always;
    break-after: page;
}
.sheet:last-child {
    page-break-after: auto;
    break-after: auto;
}

.sheet-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    border-bottom: 2px solid #000;
    padding-bottom: 4mm;
    margin-bottom: 6mm;
}
.sheet-nummer {
    font-size: 20pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.sheet-titel {
    font-size: 14pt;
    font-weight: 600;
    flex: 1 1 auto;
}
.sheet-label {
    font-size: 8pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #666;
}

/* Der Befund sitzt unter dem Strophentext, aber über dem Fuß – und schiebt sich
   nicht in den Raum, den der Text zum Hineinschreiben braucht. */
.sheet-ocr {
    margin-top: 8mm;
}
.sheet-foot {
    margin-top: auto;
    padding-top: 6mm;
    border-top: 1px solid #bbb;
    display: flex;
    flex-wrap: wrap;
    gap: 8mm;
    font-size: 8.5pt;
    color: #444;
}
.sheet-sign {
    margin-left: auto;
}

@media print {
    .no-print {
        display: none !important;
    }
    .druck-view,
    .sheets {
        background: #fff;
        padding: 0;
        gap: 0;
    }
    .sheet {
        width: auto;
        min-height: 0;
        padding: 0;
        box-shadow: none;
    }
}
</style>

<!-- @page lässt sich nicht scopen. Bewusst schmal gehalten und auf den Druckfall
     beschränkt; die Route wird ohnehin in einem eigenen Tab geöffnet. -->
<style>
@media print {
    @page {
        size: A4 portrait;
        margin: 14mm 16mm;
    }
}
</style>
