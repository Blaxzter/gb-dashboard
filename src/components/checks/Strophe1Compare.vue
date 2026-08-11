<script setup>
// Gegenüberstellung „Notenbild ↔ Redaktionssystem" für die 1. Strophe
// (Issue #99). Wird von der Abgleich-Ansicht (Bildschirm) und der Druckansicht
// benutzt – dieselbe Darstellung auf Papier und am Schirm, damit eine auf dem
// Ausdruck angestrichene Stelle am Schirm wiederzufinden ist.
//
// Der Strophentext wird in derselben Schrift gesetzt wie der Notensatz (Optima),
// weil sich Wortbilder so direkt vergleichen lassen: Wer „Herze" im Notenbild
// liest, sieht daneben dasselbe Wortbild – ein Unterschied springt ins Auge,
// statt sich hinter zwei verschiedenen Schriften zu verstecken.

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import VuePdfEmbed from 'vue-pdf-embed';
import { notenbildPages, strophe1Lines } from '@/assets/js/strophe1Abgleich.js';
import { inkBounds, isWorthTrimming } from '@/assets/js/notenTrim.js';
import '@/styles/gb-optima.css';

const props = defineProps({
    lied: { type: Object, required: true },
    // Druck-Layout: Notenbild oben, Text darunter, keine Bedienelemente,
    // Zeilenabstand zum Hineinschreiben von Korrekturen.
    print: { type: Boolean, default: false },
    // Fortlaufend statt zeilenweise – so, wie der Text unter den Noten läuft.
    flow: { type: Boolean, default: false },
    lineNumbers: { type: Boolean, default: true },
});
const emit = defineEmits(['rendered']);

const backendUrl = import.meta.env.VITE_BACKEND_URL;
const assetUrl = (id) => `${backendUrl}/assets/${id}`;

const pages = computed(() => notenbildPages(props.lied));
const lines = computed(() => strophe1Lines(props.lied));
const flowText = computed(() => lines.value.join(' '));
const wordCount = computed(() => (flowText.value.match(/\S+/g) || []).length);

// --- Breite des Notenbildes ------------------------------------------------
// Gerendert wird einmal in fester Auflösung; die Anzeigegröße macht danach das
// CSS. Der Zuschnitt (siehe unten) schneidet den leeren Seitenrand weg, sodass
// von diesen 1400 px am Ende meist ~1000 px reines Notenbild übrig bleiben – auf
// 170 mm Papier rund 150 dpi und damit auch in den Silben unter den Noten gut
// lesbar. Höher wäre schöner, aber jede Seite liegt beim Rendern als Canvas im
// Speicher; deshalb diese Breite und die Obergrenze der Blattzahl im Druck.
const SOURCE_WIDTH = 1400;
const pane = ref(null);
const pane_width = ref(0);
const zoom = ref(1);
let observer = null;

// Anzeigebreite am Schirm. Im Druck bestimmt das CSS die Größe (in mm).
const display_width = computed(() => {
    if (props.print || !pane_width.value) return null;
    return Math.round(pane_width.value * zoom.value);
});

onMounted(() => {
    if (props.print || !pane.value) return;
    pane_width.value = Math.round(pane.value.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    observer = new ResizeObserver((entries) => {
        pane_width.value = Math.round(entries[0].contentRect.width);
    });
    observer.observe(pane.value);
});
onBeforeUnmount(() => observer?.disconnect());

function zoomBy(step) {
    zoom.value = Math.min(3, Math.max(0.5, Math.round((zoom.value + step) * 100) / 100));
}
// Beim Liedwechsel wieder auf Spaltenbreite – ein Zoom vom vorigen Lied passt
// zum nächsten Notenbild selten.
watch(
    () => props.lied?.id,
    () => {
        zoom.value = 1;
    },
);

// --- Laden des Notenbildes -------------------------------------------------
// id -> { status: 'loading' | 'rendering' | 'done' | 'error', bytes, message }
const state = ref({});
function setState(id, patch) {
    state.value = { ...state.value, [id]: { ...(state.value[id] || {}), ...patch } };
}

// Fertig-Meldung für die Druckansicht: genau eine je Komponente, wenn ALLE
// Seiten stehen (oder es keine gibt). So kann die Druckansicht die Blätter der
// Reihe nach aufbauen, statt vierzig Notenbilder gleichzeitig zu rendern.
const done_pages = ref(new Set());
let reported = false;
function reportIfComplete() {
    if (reported) return;
    if (done_pages.value.size < pages.value.length) return;
    reported = true;
    emit('rendered');
}
function finish(id) {
    if (done_pages.value.has(id)) return;
    done_pages.value = new Set(done_pages.value).add(id);
    reportIfComplete();
}

function fail(id, message) {
    setState(id, { status: 'error', message, bytes: null });
    finish(id);
}

// Die PDF-Bytes werden selbst geholt, statt pdf.js die URL zu überlassen. Zwei
// Gründe, beide aus der Praxis: pdf.js holt sonst über die Herkunftsgrenze
// hinweg selbst (siehe NotenCompareDialog) – und scheitert das Laden, meldet
// vue-pdf-embed nur „ging nicht" und hinterlässt eine leere Fläche. Mit eigenem
// fetch steht der Grund da: 404, kein Zugriff, keine PDF.
async function loadPages() {
    state.value = {};
    done_pages.value = new Set();
    reported = false;
    // Ein Lied ohne Notenbild ist sofort fertig – sonst wartete die Druckansicht
    // auf eine Meldung, die nie kommt.
    if (!pages.value.length) {
        reportIfComplete();
        return;
    }
    for (const page of pages.value) {
        if (page.kind !== 'pdf') continue;
        setState(page.id, { status: 'loading' });
        try {
            const resp = await fetch(assetUrl(page.id));
            if (!resp.ok) {
                fail(page.id, `Die Datei ist nicht abrufbar (HTTP ${resp.status}).`);
                continue;
            }
            const bytes = new Uint8Array(await resp.arrayBuffer());
            setState(page.id, { status: 'rendering', bytes });
        } catch (e) {
            console.error('Notenbild konnte nicht geladen werden', page, e);
            fail(page.id, `Die Datei konnte nicht geladen werden: ${e?.message || e}`);
        }
    }
}

watch(pages, loadPages, { immediate: true });

function onRenderFailed(page, e) {
    console.error('Notenbild konnte nicht dargestellt werden', page, e);
    fail(
        page.id,
        'Die Datei ließ sich nicht als PDF darstellen – vermutlich ist sie beschädigt oder gar keine PDF.',
    );
}

// --- Zuschnitt --------------------------------------------------------------
// Gerendert wird abseits der Seite; sichtbar wird erst der Zuschnitt. Der liegt
// in einem eigenen Canvas, das nur den bedruckten Bereich enthält – damit greifen
// die CSS-Grenzen (max-width/max-height) auf dem Notenbild statt auf dem leeren
// Seitenrand, und das Seitenverhältnis bleibt das des Notenbildes.
const hosts = {}; // id -> Element, in dem vue-pdf-embed rendert
const targets = {}; // id -> Element, das den Zuschnitt aufnimmt
function setHost(id, el) {
    hosts[id] = el;
}
function setTarget(id, el) {
    targets[id] = el;
}

function cropCanvas(src, box) {
    const out = document.createElement('canvas');
    out.width = box.w;
    out.height = box.h;
    out.getContext('2d').drawImage(src, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    return out;
}

function trimmed(src, page) {
    try {
        const ctx = src.getContext('2d', { willReadFrequently: true });
        const box = inkBounds(ctx.getImageData(0, 0, src.width, src.height), src.width, src.height);
        if (isWorthTrimming(box, src.width, src.height)) return cropCanvas(src, box);
    } catch (e) {
        // Leere Seite, blockiertes getImageData – dann eben ungeschnitten.
        console.warn('Notenbild konnte nicht zugeschnitten werden', page, e);
    }
    return cropCanvas(src, { x: 0, y: 0, w: src.width, h: src.height });
}

async function onPageRendered(page) {
    await nextTick();
    // Alle Seiten der Datei, nicht nur die erste: Entgegen der Konvention liegt in
    // `notentext` gelegentlich ein mehrseitiger Satz, und die zweite Seite darf
    // beim Abgleich nicht verschwinden.
    const sources = Array.from(hosts[page.id]?.querySelectorAll('canvas') || []);
    const target = targets[page.id];
    if (!sources.length || !target) {
        finish(page.id);
        return;
    }
    target.replaceChildren(...sources.map((src) => trimmed(src, page)));
    // Die Quellen werden gleich abgeräumt; ihre Fläche vorher freigeben, damit im
    // Stapeldruck nicht vierzig Seiten-Canvas auf den Einsammler warten.
    for (const src of sources) {
        src.width = 0;
        src.height = 0;
    }
    setState(page.id, { status: 'done', bytes: null });
    finish(page.id);
}
</script>

<template>
    <div class="s1" :class="{ 's1--print': print }">
        <!-- Notenbild: das, was gedruckt wird. -->
        <div ref="pane" class="s1-pane s1-pane--noten">
            <div v-if="!print" class="s1-pane-head">
                <v-icon size="small" color="primary">mdi-music-clef-treble</v-icon>
                <span>Notenbild</span>
                <v-spacer />
                <v-btn
                    icon="mdi-magnify-minus-outline"
                    variant="text"
                    size="x-small"
                    title="Verkleinern"
                    :disabled="zoom <= 0.5"
                    @click="zoomBy(-0.25)"
                />
                <span class="s1-zoom">{{ Math.round(zoom * 100) }} %</span>
                <v-btn
                    icon="mdi-magnify-plus-outline"
                    variant="text"
                    size="x-small"
                    title="Vergrößern"
                    :disabled="zoom >= 3"
                    @click="zoomBy(0.25)"
                />
                <v-btn
                    v-if="pages.length"
                    icon="mdi-open-in-new"
                    variant="text"
                    size="x-small"
                    title="Notenbild in neuem Tab öffnen"
                    :href="`${assetUrl(pages[0].id)}${pages[0].kind === 'pdf' ? '.pdf' : ''}`"
                    target="_blank"
                />
            </div>

            <div v-if="!pages.length" class="s1-missing">
                <v-icon size="32" class="mb-2">mdi-music-note-off-outline</v-icon>
                <div>Für dieses Lied ist noch kein Notenbild hinterlegt.</div>
            </div>

            <div v-else class="s1-noten-scroll">
                <div v-for="page in pages" :key="page.id" class="s1-noten-page">
                    <img
                        v-if="page.kind !== 'pdf'"
                        :src="assetUrl(page.id)"
                        :alt="page.label"
                        class="s1-noten-svg"
                        @load="finish(page.id)"
                        @error="fail(page.id, 'Das Bild konnte nicht geladen werden.')"
                    />
                    <!-- Nichts ist schlimmer als eine leere Fläche: Scheitert das
                         Laden, steht hier, woran es lag, samt Datei und Link. -->
                    <div v-else-if="state[page.id]?.status === 'error'" class="s1-noten-error">
                        <v-alert type="error" variant="tonal" density="compact">
                            <div>{{ state[page.id].message }}</div>
                            <div v-if="page.name" class="text-caption mt-1">{{ page.name }}</div>
                            <a
                                class="text-caption"
                                :href="assetUrl(page.id)"
                                target="_blank"
                                rel="noopener"
                            >
                                Datei direkt öffnen
                            </a>
                        </v-alert>
                    </div>
                    <template v-else>
                        <div
                            v-if="state[page.id]?.status !== 'done'"
                            class="s1-noten-loading text-medium-emphasis"
                        >
                            <v-progress-circular indeterminate size="22" class="me-2" />
                            Notenbild wird aufbereitet …
                        </div>
                        <!-- Hier landet der Zuschnitt (imperativ eingehängt). -->
                        <div
                            :ref="(el) => setTarget(page.id, el)"
                            class="s1-crop"
                            :style="display_width ? { width: display_width + 'px' } : null"
                        />
                        <!-- Quelle: rendert abseits der Seite und verschwindet,
                             sobald der Zuschnitt steht. -->
                        <div
                            v-if="state[page.id]?.status === 'rendering'"
                            :ref="(el) => setHost(page.id, el)"
                            class="s1-src"
                        >
                            <VuePdfEmbed
                                :source="state[page.id].bytes"
                                :width="SOURCE_WIDTH"
                                @rendered="onPageRendered(page)"
                                @loading-failed="onRenderFailed(page, $event)"
                                @rendering-failed="onRenderFailed(page, $event)"
                            />
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- 1. Strophe, wie sie im Redaktionssystem steht. -->
        <div class="s1-pane s1-pane--text">
            <div v-if="!print" class="s1-pane-head">
                <v-icon size="small" color="primary">mdi-database</v-icon>
                <span>Strophe 1 · Redaktionssystem</span>
                <v-spacer />
                <span class="s1-zoom">{{ wordCount }} Wörter</span>
            </div>
            <div v-else class="s1-print-head">Strophe 1 · Redaktionssystem</div>

            <div v-if="!lines.length" class="s1-missing">
                <v-icon size="32" class="mb-2">mdi-text-box-remove-outline</v-icon>
                <div>Im Redaktionssystem ist keine 1. Strophe erfasst.</div>
            </div>

            <p v-else-if="flow" class="s1-text s1-text--flow">{{ flowText }}</p>

            <ol v-else class="s1-text s1-text--lines" :class="{ 's1-text--nonum': !lineNumbers }">
                <li v-for="(line, i) in lines" :key="i">{{ line }}</li>
            </ol>
        </div>
    </div>
</template>

<style scoped>
/* Die Schrift des Notensatzes auch für den Datenbank-Text – siehe Kopfkommentar.
   Das @font-face steht in styles/gb-optima.css, weil auch der Befund-Kasten sie
   benutzt. */
.s1 {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}
@media (max-width: 1100px) {
    .s1 {
        grid-template-columns: minmax(0, 1fr);
    }
}

.s1-pane {
    min-width: 0;
}
.s1-pane-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.7);
    margin-bottom: 6px;
    min-height: 28px;
}
.s1-zoom {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

.s1-noten-scroll {
    overflow: auto;
    max-height: 78vh;
    border: 1px solid rgba(var(--v-border-color), 0.35);
    border-radius: 4px;
}
/* Notenbild bleibt weiß – auch im Dark Mode. Gedruckt wird es schließlich auf
   Papier, und ein invertierter Notensatz ist unlesbar. */
.s1-noten-page {
    background: #fff;
    line-height: 0;
}
.s1-noten-page + .s1-noten-page {
    border-top: 1px solid rgba(0, 0, 0, 0.15);
}
/* Der Zuschnitt: das Canvas füllt die Breite, die die Ansicht ihm gibt, und
   behält dabei sein Seitenverhältnis (height: auto) – nichts wird gestaucht. */
.s1-crop {
    max-width: 100%;
}
.s1-crop :deep(canvas) {
    display: block;
    width: 100%;
    height: auto;
}
/* Die Quelle rendert abseits der Seite: Ein kurz aufblitzendes, ungeschnittenes
   Notenbild wäre unruhiger als ein Ladehinweis. */
.s1-src {
    position: absolute;
    left: -99999px;
    top: 0;
    width: 1px;
    height: 1px;
    overflow: hidden;
}
.s1-noten-svg {
    display: block;
    width: 100%;
}
/* Meldungen liegen auf der weißen Notenbild-Fläche – daher feste dunkle Schrift
   und ein zurückgesetzter Zeilenabstand (der Container stellt für Canvas/Bild
   line-height: 0). */
.s1-noten-error,
.s1-noten-loading {
    padding: 16px;
    line-height: 1.5;
    color: #333;
}
.s1-noten-loading {
    display: flex;
    align-items: center;
    justify-content: center;
}

.s1-missing {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 28px 16px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    border: 1px dashed rgba(var(--v-border-color), 0.4);
    border-radius: 4px;
}

.s1-text {
    font-family: 'GbOptima', Optima, Candara, 'Gill Sans', 'Trebuchet MS', sans-serif;
    font-size: 1.35rem;
    line-height: 1.9;
    margin: 0;
    hyphens: none;
}
.s1-text--lines {
    list-style: decimal outside;
    padding-left: 2.2em;
}
.s1-text--lines li::marker {
    font-family: inherit;
    font-size: 0.62em;
    color: rgba(var(--v-theme-on-surface), 0.45);
}
.s1-text--nonum {
    list-style: none;
    padding-left: 0;
}

/* --- Druck-Layout ------------------------------------------------------- */
.s1--print {
    grid-template-columns: minmax(0, 1fr);
    gap: 8mm;
}
.s1--print .s1-noten-scroll {
    overflow: visible;
    max-height: none;
    border: none;
}
/* Feste Obergrenzen statt fester Größe: Das Notenbild nimmt sich die Breite, die
   es kriegen kann, und stößt erst bei einem hohen Satz an die Höhengrenze – der
   Text darunter behält seinen Platz. Die Grenzen greifen jetzt auf dem
   zugeschnittenen Notenbild, nicht mehr auf dem leeren Seitenrand.
   `width/height: auto` lässt das Seitenverhältnis unangetastet. */
.s1--print .s1-crop {
    width: auto;
}
.s1--print .s1-crop :deep(canvas),
.s1--print .s1-noten-svg {
    max-width: 174mm;
    max-height: 120mm;
    width: auto;
    height: auto;
    margin: 0 auto;
}
.s1-print-head {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #555;
    border-bottom: 1px solid #bbb;
    padding-bottom: 2px;
    margin-bottom: 6mm;
}
/* Auf Papier weiter Zeilenabstand: Korrekturen werden zwischen die Zeilen
   geschrieben. */
.s1--print .s1-text {
    font-size: 15pt;
    line-height: 2.6;
    color: #000;
}
</style>
