<script setup>
// Vergleichs-Dialog: links die gedruckte Notensatz-Seite, rechts die zugehörige
// Notensatz-PDF aus der Datenbank – beide mit denselben rot markierten
// Fundstellen. So sieht man Seite an Seite, was im Druck vom Original abweicht,
// statt zwischen zwei Tabs zu springen.
//
// Die Druck-Seite wird aus dem bereits geladenen Dokument (pdfDoc) auf ein
// Canvas gerendert – kein erneutes Parsen der großen Druck-PDF. Die Original-PDF
// rendert vue-pdf-embed (dessen pdf.js läuft in dieser App zuverlässig); die
// Bytes werden vorab geholt, damit pdf.js sie nicht selbst über CORS holen muss.
import { computed, nextTick, ref, watch } from 'vue';
import VuePdfEmbed from 'vue-pdf-embed';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    // Der ausgewählte Befund: liefert Titel, Seite, Datei-Id und die Kästen.
    finding: { type: Object, default: null },
    // Das bereits geladene Druck-PDF (aus dem @loaded-Event) – nicht neu laden.
    printDoc: { type: Object, default: null },
    backendUrl: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

// Basishöhe der Seiten – beide Spalten gleich hoch, damit die Systeme auf einer
// Linie liegen. Der Zoom skaliert sie; beide Seiten werden bei jeder Stufe neu
// gerendert (scharf statt CSS-hochskaliert).
const BASE_PAGE_HEIGHT = 620;
const ZOOM_MIN = 0.75;
const ZOOM_MAX = 3;
const zoom = ref(1);
const pageHeight = computed(() => Math.round(BASE_PAGE_HEIGHT * zoom.value));
function zoomBy(step) {
    zoom.value = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Math.round((zoom.value + step) * 100) / 100),
    );
}

// Die Markierungen lassen sich ausblenden – dann sieht man die Noten selbst
// ohne die roten Kästen darüber.
const showBoxes = ref(true);

const printCanvas = ref(null);
const origSource = ref(null);
const printSize = ref(null);
const origSize = ref(null);
const loading = ref(false);
const error = ref('');

const printBoxes = ref([]);
const origBoxes = ref([]);

async function renderPrint() {
    const doc = props.printDoc;
    const pageNum = props.finding?.loc?.page;
    if (!doc || !pageNum || !printCanvas.value) return;
    const page = await doc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vp = page.getViewport({ scale: (pageHeight.value / base.height) * dpr });
    const canvas = printCanvas.value;
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    printSize.value = { width: base.width, height: base.height };
}

async function build() {
    error.value = '';
    loading.value = true;
    origSource.value = null;
    printSize.value = null;
    origSize.value = null;
    const f = props.finding;
    printBoxes.value = (f?.locs || (f?.loc ? [f.loc] : [])).map((l) => l.rect);
    origBoxes.value = (f?.originalLocs || []).map((l) => l.rect);
    try {
        await nextTick();
        await renderPrint();
        if (f?.notentextId) {
            const resp = await fetch(`${props.backendUrl}/assets/${f.notentextId}`);
            if (!resp.ok) throw new Error(`Status ${resp.status}`);
            origSource.value = new Uint8Array(await resp.arrayBuffer());
        }
    } catch (e) {
        console.error('Original-Notensatz konnte nicht geladen werden', e);
        error.value = 'Der Original-Notensatz konnte nicht geladen werden.';
    } finally {
        loading.value = false;
    }
}

// vue-pdf-embed liefert im @loaded das PDFDocumentProxy – daraus die echte
// Seitengröße (Punkte) für den viewBox des Overlays.
async function onOrigLoaded(doc) {
    const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
    origSize.value = { width: vp.width, height: vp.height };
}

watch(
    () => props.modelValue,
    (open) => {
        if (open) {
            zoom.value = 1;
            build();
        }
    },
);

// Beim Zoomen die Druck-Seite neu rendern (VuePdfEmbed rendert über :height
// selbst neu). nextTick, damit das Canvas seine neue Größe schon hat.
watch(zoom, () => nextTick(renderPrint));

function close() {
    emit('update:modelValue', false);
}
</script>

<template>
    <v-dialog
        :model-value="modelValue"
        max-width="1280"
        scrollable
        @update:model-value="emit('update:modelValue', $event)"
    >
        <v-card>
            <v-card-title class="d-flex align-center ga-2">
                <v-icon color="error" size="small">mdi-music-clef-treble</v-icon>
                <span class="text-truncate">
                    Notensatz-Vergleich
                    <template v-if="finding?.nummer">· Lied {{ finding.nummer }}</template>
                </span>
                <v-spacer />
                <v-btn
                    icon="mdi-magnify-minus-outline"
                    variant="text"
                    size="small"
                    title="Verkleinern"
                    :disabled="zoom <= 0.75"
                    @click="zoomBy(-0.25)"
                />
                <span class="zoom-label">{{ Math.round(zoom * 100) }} %</span>
                <v-btn
                    icon="mdi-magnify-plus-outline"
                    variant="text"
                    size="small"
                    title="Vergrößern"
                    :disabled="zoom >= 3"
                    @click="zoomBy(0.25)"
                />
                <v-divider vertical class="mx-1" />
                <v-btn
                    variant="text"
                    size="small"
                    :prepend-icon="showBoxes ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                    @click="showBoxes = !showBoxes"
                >
                    {{ showBoxes ? 'Markierungen aus' : 'Markierungen ein' }}
                </v-btn>
                <v-btn
                    v-if="finding?.notentextId"
                    variant="text"
                    size="small"
                    prepend-icon="mdi-open-in-new"
                    :href="`${backendUrl}/assets/${finding.notentextId}.pdf`"
                    target="_blank"
                >
                    Original als PDF
                </v-btn>
                <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
            </v-card-title>

            <v-card-text>
                <div v-if="finding?.title" class="text-medium-emphasis mb-3">
                    {{ finding.title }}
                </div>

                <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">
                    {{ error }}
                </v-alert>

                <div class="panes-scroll">
                    <div class="panes">
                        <div class="pane">
                            <div class="pane-label">
                                <v-icon size="small" color="error">mdi-printer</v-icon>
                                Druck · Seite {{ finding?.loc?.page }}
                            </div>
                            <div class="page-holder" :style="{ height: pageHeight + 'px' }">
                                <canvas ref="printCanvas" class="page-canvas" />
                                <svg
                                    v-if="printSize && showBoxes"
                                    class="overlay"
                                    :viewBox="`0 0 ${printSize.width} ${printSize.height}`"
                                    preserveAspectRatio="none"
                                >
                                    <rect
                                        v-for="(r, i) in printBoxes"
                                        :key="i"
                                        :x="r.x"
                                        :y="r.y"
                                        :width="r.w"
                                        :height="r.h"
                                        fill="#e5393522"
                                        stroke="#e53935"
                                        stroke-width="1.4"
                                        rx="1.5"
                                    />
                                </svg>
                            </div>
                        </div>

                        <div class="pane">
                            <div class="pane-label">
                                <v-icon size="small" color="success">mdi-database</v-icon>
                                Original (Datenbank)
                            </div>
                            <div class="page-holder" :style="{ height: pageHeight + 'px' }">
                                <VuePdfEmbed
                                    v-if="origSource"
                                    :source="origSource"
                                    :page="1"
                                    :height="pageHeight"
                                    @loaded="onOrigLoaded"
                                />
                                <svg
                                    v-if="origSize && showBoxes"
                                    class="overlay"
                                    :viewBox="`0 0 ${origSize.width} ${origSize.height}`"
                                    preserveAspectRatio="none"
                                >
                                    <rect
                                        v-for="(r, i) in origBoxes"
                                        :key="i"
                                        :x="r.x"
                                        :y="r.y"
                                        :width="r.w"
                                        :height="r.h"
                                        fill="#e5393522"
                                        stroke="#e53935"
                                        stroke-width="1.4"
                                        rx="1.5"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="loading" class="d-flex align-center ga-3 mt-4 text-medium-emphasis">
                    <v-progress-circular indeterminate size="22" />
                    Original-Notensatz wird geladen …
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.zoom-label {
    min-width: 46px;
    text-align: center;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    color: rgba(var(--v-theme-on-surface), 0.7);
}
/* Beim Vergrößern wachsen die Seiten über den Dialog hinaus – hier darf gescrollt
   werden (waagerecht und senkrecht), statt dass der Inhalt abgeschnitten wird.
   `safe center` zentriert, solange es passt, und rückt sonst an den Anfang, damit
   auch die linke Kante erreichbar bleibt. */
.panes-scroll {
    overflow: auto;
    max-height: 76vh;
}
.panes {
    display: flex;
    gap: 16px;
    flex-wrap: nowrap;
    justify-content: safe center;
    min-width: min-content;
    padding: 2px;
}
.pane {
    display: flex;
    flex-direction: column;
    align-items: center;
}
.pane-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.7);
    margin-bottom: 6px;
}
.page-holder {
    position: relative;
    display: inline-block;
    background: #fff;
    box-shadow: 0 1px 8px rgba(0, 0, 0, 0.25);
    line-height: 0;
}
.page-canvas {
    display: block;
    height: 100%;
    width: auto;
}
.overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}
</style>
