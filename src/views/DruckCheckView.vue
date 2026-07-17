<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAppStore } from '@/store/app.js';
import VuePdfEmbed from 'vue-pdf-embed';
import CheckCategory from '@/components/checks/CheckCategory.vue';
import PdfFindingsCompare from '@/components/checks/PdfFindingsCompare.vue';
import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';
import {
    extractPdfSongs,
    comparePrintPdf,
    applyAcks,
    makeCheck,
    assignItemFingerprints,
} from '@/assets/js/printPdfCheck.js';
import { checkPrintNotensatz, notensatzChecks } from '@/assets/js/printNotenCheck.js';
import { createFingerprintLoader } from '@/assets/js/notenFingerprintLoader.js';
import { useDruckCheckAcks } from '@/assets/js/druckCheckAcks.js';

const store = useAppStore();
const acks = useDruckCheckAcks();
// Daten sicherstellen (loadData ist idempotent über data_loaded).
store.loadData();
const alle_lieder = computed(() => store.gesangbuchlieder);

// --- Datei-Handling --------------------------------------------------------
const drag_over = ref(false);
const file_input = ref(null);
const file = ref(null);
const source = ref(null); // Object-URL für vue-pdf-embed
const processing = ref(false);
const error = ref('');

const checks = ref(null);
const extracted = ref(null);
const pdf_doc = ref(null); // geladenes PDFDocumentProxy – wird wiederverwendet
const only_problems = ref(false);
// Notensatz-Abgleich: läuft nach der Textprüfung, weil er ggf. Noten-PDFs
// nachladen muss (siehe notenFingerprintLoader).
const noten_progress = ref(null); // { done, total, fetched }
const expandSignal = ref(0);
const collapseSignal = ref(0);
const tab = ref('compare');

function pickFile() {
    file_input.value?.click();
}
function onDrop(e) {
    e.preventDefault();
    drag_over.value = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
}
function onPick(e) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    e.target.value = '';
}
function resetResults() {
    error.value = '';
    checks.value = null;
    extracted.value = null;
    pdf_doc.value = null;
    noten_progress.value = null;
    if (source.value) {
        URL.revokeObjectURL(source.value);
        source.value = null;
    }
}
function setFile(f) {
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
        error.value = 'Bitte eine PDF-Datei ablegen.';
        return;
    }
    resetResults();
    file.value = f;
    source.value = URL.createObjectURL(f);
    processing.value = true;
}

// vue-pdf-embed liefert das PDFDocumentProxy im @loaded-Event – daraus lesen wir
// den Text-Layer aus (getTextContent je Seite) und vergleichen mit der DB.
async function onLoaded(pdf) {
    try {
        if (!store.data_loaded) await store.loadData();
        pdf_doc.value = pdf; // für die Anzeige wiederverwenden (kein Neu-Laden)
        const result = await extractPdfSongs(pdf);
        extracted.value = result;
        checks.value = comparePrintPdf(result, alle_lieder.value);
        // Textprüfung steht – erst jetzt der Notensatz-Abgleich. Er ist der
        // langsamere Teil (ggf. Noten-PDFs nachladen), das Ergebnis der
        // Textprüfung soll darauf nicht warten.
        processing.value = false;
        await runNotensatzCheck(result);
        // Bei Problemen den PDF-Abgleich zeigen, sonst die Prüfliste (mit „alles OK").
        const hasProblems = checks.value.some(
            (c) => c.status === 'error' || c.status === 'warning',
        );
        tab.value = hasProblems ? 'compare' : 'list';
    } catch (e) {
        console.error('Druck-Check fehlgeschlagen', e);
        error.value = 'Fehler beim Auslesen der PDF: ' + (e?.message || e);
    } finally {
        processing.value = false;
        noten_progress.value = null;
    }
}

// Notensatz gegen die Datenbank prüfen. Fehlschläge hier dürfen die Textprüfung
// nicht mitreißen – die steht schon und ist für sich nützlich.
async function runNotensatzCheck(result) {
    try {
        let fetched = 0;
        noten_progress.value = { done: 0, total: 0, fetched: 0 };
        const loadFingerprint = createFingerprintLoader({
            backendUrl: import.meta.env.VITE_BACKEND_URL,
            onFetch: () => {
                fetched++;
            },
        });
        const res = await checkPrintNotensatz(result, alle_lieder.value, {
            loadFingerprint,
            onProgress: (done, total) => {
                noten_progress.value = { done, total, fetched };
            },
        });
        checks.value = [
            ...checks.value,
            ...assignItemFingerprints(notensatzChecks(res, makeCheck)),
        ];
    } catch (e) {
        console.error('Notensatz-Abgleich fehlgeschlagen', e);
        error.value = 'Der Notensatz-Abgleich ist fehlgeschlagen: ' + (e?.message || e);
    } finally {
        noten_progress.value = null;
    }
}
function onLoadError(e) {
    console.error('PDF-Laden fehlgeschlagen', e);
    error.value = 'Die PDF konnte nicht geladen werden.';
    processing.value = false;
}

// --- Ergebnis-Ansicht (analog GesangbuchChecksView) ------------------------
// Bestätigte (abgehakte) Befunde ausblenden und Status neu berechnen. Wirkt auf
// Zusammenfassung, „alles OK"-Banner und die Prüfliste. Der PDF-Abgleich bekommt
// die Roh-Checks und blendet dort selbst aus (mit „Bestätigt"-Bereich).
const effectiveChecks = computed(() =>
    checks.value ? applyAcks(checks.value, acks.isAcked) : null,
);
const summary = computed(() => {
    const counts = { ok: 0, info: 0, warning: 0, error: 0 };
    (effectiveChecks.value || []).forEach((r) => {
        counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
});
const all_good = computed(
    () => checks.value && summary.value.error === 0 && summary.value.warning === 0,
);
const categories = computed(() => {
    const list = effectiveChecks.value || [];
    const visible = only_problems.value ? list.filter((r) => r.status !== 'ok') : list;
    const order = [];
    const map = {};
    visible.forEach((r) => {
        if (!map[r.category]) {
            map[r.category] = [];
            order.push(r.category);
        }
        map[r.category].push(r);
    });
    return order.map((name) => ({
        name,
        checks: map[name],
        problems: map[name].filter((c) => c.status !== 'ok').length,
    }));
});
function expandAll() {
    expandSignal.value++;
}
function collapseAll() {
    collapseSignal.value++;
}

// Bestätigte („abgehakte") Befunde: Anzahl im Kopf zeigen und zurücknehmen
// können – sonst bleiben sie unsichtbar im localStorage liegen und man rätselt,
// warum ein bekannter Befund nicht mehr auftaucht.
const acked_count = computed(() =>
    (effectiveChecks.value || []).reduce((n, c) => n + (c.ackedItems?.length || 0), 0),
);
const reset_dialog = ref(false);
function resetAcks() {
    acks.clear();
    reset_dialog.value = false;
}

// Vollbild für die ganze Ergebnis-Ansicht (Reiter + Inhalt).
const view_fullscreen = ref(false);
function onKeydown(e) {
    if (e.key === 'Escape' && view_fullscreen.value) view_fullscreen.value = false;
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

// Lied-Dialog beim Klick auf einen Treffer.
const song_dialog = ref(false);
const selected_song = ref(null);
function openSong(id) {
    if (id == null) return;
    const lied = alle_lieder.value.find((l) => l.id === id);
    if (!lied) return;
    selected_song.value = lied;
    song_dialog.value = true;
}
</script>

<template>
    <!-- Im Vollbild liegt die ganze Ansicht über der Seite – der Titelzeile samt
         Vollbild-Knopf muss also mit hinein, sonst läge sie darunter. -->
    <div :class="{ 'view--fullscreen': view_fullscreen }">
        <div class="d-flex align-center flex-wrap ga-2 mb-4">
            <h1 class="me-4">Druck-PDF Prüfung</h1>
            <v-chip color="primary" variant="tonal" prepend-icon="mdi-database">
                Lieder in DB: {{ alle_lieder.length }}
            </v-chip>
            <v-spacer />
            <v-btn
                v-if="checks"
                :prepend-icon="view_fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
                variant="text"
                size="small"
                :title="view_fullscreen ? 'Vollbild verlassen (Esc)' : 'Vollbild'"
                @click="view_fullscreen = !view_fullscreen"
            >
                {{ view_fullscreen ? 'Vollbild verlassen' : 'Vollbild' }}
            </v-btn>
        </div>

        <!-- Ablegen/Auswählen nur, solange es noch kein Ergebnis gibt: Sobald der
         Abgleich steht, ist der Platz für ihn da (der Vergleich braucht Höhe). -->
        <v-card v-if="!checks" class="mb-4">
            <v-card-text>
                <div class="text-medium-emphasis mb-3">
                    Sicherheitsnetz vor dem Druck: Die fertige Druck-PDF wird gegen die aktuellen
                    „Bewertet und genommen“-Lieder geprüft – Liednummern, Reihenfolge, fehlende/
                    zusätzliche Lieder, Strophentexte (2..n) und Fußzeilen. Zusätzlich wird der
                    <strong>Notensatz</strong>
                    mit der Notensatz-Datei aus der Datenbank abgeglichen: ob die richtige Fassung
                    platziert wurde (deutsch statt fremdsprachig) und ob sie vollständig gedruckt
                    ist. Der
                    <strong>Text der 1. Strophe</strong>
                    steht als Bild unter den Noten und lässt sich nicht Wort für Wort prüfen.
                    Zusätzliche Vorspann-/Leerseiten werden automatisch übersprungen.
                </div>

                <div
                    class="drop-zone"
                    :class="{ 'drop-zone--active': drag_over }"
                    @drop="onDrop"
                    @dragover.prevent="drag_over = true"
                    @dragleave.prevent="drag_over = false"
                    @dragend.prevent="drag_over = false"
                    @click="pickFile"
                >
                    <v-icon size="42" class="mb-2">mdi-file-pdf-box</v-icon>
                    <div class="text-body-1">Druck-PDF hier ablegen oder klicken zum Auswählen</div>
                    <div v-if="file" class="text-caption text-medium-emphasis mt-1">
                        {{ file.name }}
                    </div>
                </div>

                <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">
                    {{ error }}
                </v-alert>

                <div v-if="processing" class="d-flex align-center ga-3 mt-4 text-medium-emphasis">
                    <v-progress-circular indeterminate size="24" />
                    PDF wird ausgelesen und geprüft …
                </div>
            </v-card-text>
        </v-card>

        <!-- Datei-Auswahl und Lade-Instanz bleiben immer gemountet: Letztere hält das
         PDFDocumentProxy am Leben, das der Abgleich weiterverwendet (kein zweites
         Parsen). Nach dem Auslesen wandert sie offscreen. -->
        <input
            ref="file_input"
            type="file"
            accept=".pdf,application/pdf"
            style="display: none"
            @change="onPick"
        />
        <div v-if="source" :class="extracted || checks ? 'doc-holder' : 'pdf-preview mb-4'">
            <VuePdfEmbed
                :source="source"
                :page="1"
                @loaded="onLoaded"
                @loading-failed="onLoadError"
                @rendering-failed="onLoadError"
            />
        </div>

        <template v-if="checks">
            <div class="d-flex align-center flex-wrap ga-2 mb-4">
                <v-chip variant="tonal" prepend-icon="mdi-file-pdf-box" :title="file?.name">
                    {{ file?.name }} · {{ extracted?.pageCount }} Seiten
                </v-chip>
                <v-btn
                    variant="text"
                    size="small"
                    prepend-icon="mdi-file-replace-outline"
                    @click="pickFile"
                >
                    Andere PDF
                </v-btn>
                <v-divider vertical class="mx-1" />
                <v-chip color="success" variant="tonal" prepend-icon="mdi-check-circle">
                    OK: {{ summary.ok }}
                </v-chip>
                <v-chip
                    v-if="summary.warning"
                    color="warning"
                    variant="tonal"
                    prepend-icon="mdi-alert"
                >
                    Warnungen: {{ summary.warning }}
                </v-chip>
                <v-chip
                    v-if="summary.error"
                    color="error"
                    variant="tonal"
                    prepend-icon="mdi-alert-circle"
                >
                    Fehler: {{ summary.error }}
                </v-chip>
                <v-chip
                    v-if="summary.info"
                    color="info"
                    variant="tonal"
                    prepend-icon="mdi-information"
                >
                    Hinweise: {{ summary.info }}
                </v-chip>

                <!-- Der Notensatz-Abgleich läuft nach der Textprüfung weiter. Ohne
                 diesen Hinweis sähe das Ergebnis fertig aus, obwohl noch Befunde
                 dazukommen können. -->
                <v-chip
                    v-if="noten_progress"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-music-clef-treble"
                >
                    <v-progress-circular indeterminate size="14" width="2" class="me-2" />
                    Notensatz-Abgleich
                    {{
                        noten_progress.total ? `${noten_progress.done}/${noten_progress.total}` : ''
                    }}
                    <template v-if="noten_progress.fetched">
                        · {{ noten_progress.fetched }} Notensätze werden nachgeladen
                    </template>
                </v-chip>

                <!-- Bestätigte Befunde sind ausgeblendet – sie müssen trotzdem sichtbar
                 bleiben, sonst wundert man sich über „fehlende" Befunde. -->
                <v-spacer />
                <v-chip
                    v-if="acked_count"
                    color="success"
                    variant="flat"
                    prepend-icon="mdi-check-all"
                    :title="`${acked_count} bestätigte Befund(e) sind ausgeblendet`"
                >
                    Bestätigt &amp; ausgeblendet: {{ acked_count }}
                </v-chip>
                <v-btn
                    v-if="acked_count"
                    variant="text"
                    size="small"
                    color="error"
                    prepend-icon="mdi-restore"
                    @click="reset_dialog = true"
                >
                    Alle zurücksetzen
                </v-btn>
            </div>

            <v-tabs v-model="tab" class="mb-4" color="primary">
                <v-tab value="compare" prepend-icon="mdi-compare">PDF-Abgleich</v-tab>
                <v-tab value="list" prepend-icon="mdi-format-list-checks">Prüfliste</v-tab>
            </v-tabs>

            <!-- Im Vollbild wächst dieser Bereich auf die Resthöhe (siehe CSS) – so
             bekommt der Abgleich den Platz, nicht der Rand. -->
            <div class="tab-content">
                <!-- v-if (kein v-window): eine ausgeblendete (display:none) Seite bremst
                 das Canvas-Rendern. So ist der Scroller beim Anzeigen voll im Layout. -->
                <div v-if="tab === 'compare'">
                    <PdfFindingsCompare
                        v-if="pdf_doc && extracted"
                        :pdf-doc="pdf_doc"
                        :checks="checks"
                        :page-sizes="extracted.pageSizes"
                        :page-count="extracted.pageCount"
                        @open-song="openSong"
                    />
                </div>

                <div v-if="tab === 'list'">
                    <div class="d-flex align-center flex-wrap ga-2 mb-4">
                        <v-alert
                            v-if="all_good"
                            type="success"
                            variant="tonal"
                            density="compact"
                            prepend-icon="mdi-party-popper"
                            class="flex-grow-1"
                        >
                            Keine Fehler oder Warnungen – die Druck-PDF stimmt mit der Datenbank
                            überein.
                        </v-alert>
                        <v-spacer />
                        <v-switch
                            v-model="only_problems"
                            label="Nur Probleme anzeigen"
                            color="primary"
                            hide-details
                            density="comfortable"
                        />
                        <v-btn
                            variant="text"
                            size="small"
                            prepend-icon="mdi-unfold-more-horizontal"
                            @click="expandAll"
                        >
                            Alle aufklappen
                        </v-btn>
                        <v-btn
                            variant="text"
                            size="small"
                            prepend-icon="mdi-unfold-less-horizontal"
                            @click="collapseAll"
                        >
                            Alle zuklappen
                        </v-btn>
                    </div>

                    <CheckCategory
                        v-for="category in categories"
                        :key="category.name"
                        :category="category"
                        :expand-signal="expandSignal"
                        :collapse-signal="collapseSignal"
                        allow-ack
                        @open-song="openSong"
                    />
                </div>
            </div>
        </template>
    </div>

    <v-dialog v-model="song_dialog" width="700">
        <GesangbuchLiedComponent
            v-if="selected_song"
            :selected-song="selected_song"
            @close="song_dialog = false"
        />
    </v-dialog>

    <v-dialog v-model="reset_dialog" width="460">
        <v-card>
            <v-card-title>Bestätigungen zurücksetzen?</v-card-title>
            <v-card-text>
                Alle {{ acked_count }} bestätigten Befunde werden wieder als offen angezeigt. Die
                Bestätigungen sind lokal in diesem Browser gespeichert und gehen dabei verloren.
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="reset_dialog = false">Abbrechen</v-btn>
                <v-btn color="error" variant="flat" @click="resetAcks">Zurücksetzen</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px 16px;
    border: 2px dashed rgba(var(--v-border-color), 0.4);
    border-radius: 8px;
    cursor: pointer;
    transition:
        border-color 0.15s,
        background-color 0.15s;
}
.drop-zone:hover,
.drop-zone--active {
    border-color: rgb(var(--v-theme-primary));
    background-color: rgba(var(--v-theme-primary), 0.06);
}
.pdf-preview {
    width: 160px;
    min-width: 160px;
    border: 1px solid rgba(var(--v-border-color), 0.4);
    border-radius: 4px;
    overflow: hidden;
}
/* Vollbild: unter den Vuetify-Dialogen (2400), über der Seite. Als Spalte
   gelayoutet, damit der Inhalt (Abgleich bzw. Prüfliste) genau die Resthöhe
   bekommt – ohne pixelgenaue Annahmen über die Höhe von Titel, Chips und Reitern.
   :deep, weil .compare in der Kind-Komponente liegt. */
.view--fullscreen {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    overflow: hidden;
    background: rgb(var(--v-theme-background));
}
.view--fullscreen .tab-content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
}
.view--fullscreen .tab-content :deep(.compare) {
    height: 100%;
    min-height: 0;
}

/* Lade-Instanz bleibt gemountet (hält das PDFDocument), aber offscreen. */
.doc-holder {
    position: absolute;
    left: -99999px;
    top: 0;
    width: 200px;
    height: 260px;
    overflow: hidden;
}
</style>
