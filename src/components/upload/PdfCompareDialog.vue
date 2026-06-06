<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import VuePdfEmbed from 'vue-pdf-embed';

// PDF-Vergleichsdialog: stellt ein neu hochgeladenes PDF-Notenbild dem bereits
// auf dem Lied gespeicherten Notentext gegenüber. Es kann gegen Seite 1
// (notentext) oder Seite 2 (notentext_seite2) verglichen werden — je nachdem,
// was vorhanden ist. Gerendert wird PDF nativ über vue-pdf-embed (wie im Rest
// der App), ältere Bild-Notentexte über <img>.
const props = defineProps({
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
    // Das neu in die Queue gelegte PDF (File/Blob).
    newFile: { type: Object, default: null },
    newLabel: { type: String, default: 'Neu (Upload)' },
    // Vorhandene Vergleichsziele:
    //   [{ key, label, url, isPdf, name }]
    targets: { type: Array, default: () => [] },
    // Welches Ziel beim Öffnen vorausgewählt ist (key).
    initialKey: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const dialog_open = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v),
});

const mode = ref('side'); // 'side' | 'ab'
const ab_view = ref('new'); // 'new' | 'existing'
const zoom = ref(1);

// Welches vorhandene Notentext-Feld wird verglichen (Seite 1 / Seite 2).
const selected_key = ref('');
const selected_target = computed(
    () => props.targets.find((t) => t.key === selected_key.value) || props.targets[0] || null,
);

// Object-URL für das neu hochgeladene File. Wird beim Schließen freigegeben.
const new_url = ref('');
let new_obj_url = '';
function buildNewUrl() {
    disposeNewUrl();
    if (props.newFile) {
        new_obj_url = URL.createObjectURL(props.newFile);
        new_url.value = new_obj_url;
    }
}
function disposeNewUrl() {
    if (new_obj_url) {
        URL.revokeObjectURL(new_obj_url);
        new_obj_url = '';
    }
    new_url.value = '';
}

// Seitenzahl / Fehler je Seite (PDFs können mehrseitig sein).
const new_page = ref(1);
const existing_page = ref(1);
const new_num_pages = ref(0);
const existing_num_pages = ref(0);
const new_error = ref('');
const existing_error = ref('');

function pageFor(side) {
    return side === 'new' ? new_page.value : existing_page.value;
}
function numPagesFor(side) {
    return side === 'new' ? new_num_pages.value : existing_num_pages.value;
}
function errorFor(side) {
    return side === 'new' ? new_error.value : existing_error.value;
}
function stepPage(side, delta) {
    const total = numPagesFor(side) || 1;
    const next = Math.min(Math.max(1, pageFor(side) + delta), total);
    if (side === 'new') new_page.value = next;
    else existing_page.value = next;
}
function onLoaded(side, pdf) {
    const total = pdf?.numPages || 1;
    if (side === 'new') {
        new_num_pages.value = total;
        new_error.value = '';
        if (new_page.value > total) new_page.value = 1;
    } else {
        existing_num_pages.value = total;
        existing_error.value = '';
        if (existing_page.value > total) existing_page.value = 1;
    }
}
function onFailed(side, e) {
    const msg = e?.message || 'PDF konnte nicht geladen werden';
    if (side === 'new') new_error.value = msg;
    else existing_error.value = msg;
}

// Eine PDF-Seite wird mit fester Pixelbreite gerendert (scharf); Zoom erhöht die
// Renderbreite. Bilder nutzen stattdessen den prozentualen Zoom-Wrapper.
const render_width = computed(() => Math.round((mode.value === 'ab' ? 1000 : 560) * zoom.value));

// Sichtbare Panes: nebeneinander zwei, im A/B-Modus genau eines.
const panes = computed(() => {
    const newPane = { side: 'new', label: props.newLabel, kind: 'pdf', url: new_url.value };
    const t = selected_target.value;
    const existingPane = t
        ? { side: 'existing', label: t.label, kind: t.isPdf ? 'pdf' : 'image', url: t.url }
        : { side: 'existing', label: '—', kind: 'pdf', url: '' };
    if (mode.value === 'ab') {
        return [ab_view.value === 'existing' ? existingPane : newPane];
    }
    return [newPane, existingPane];
});

const ab_options = computed(() => [
    { value: 'new', label: props.newLabel },
    { value: 'existing', label: selected_target.value?.label || 'Vorhanden' },
]);

function toggleAbView() {
    ab_view.value = ab_view.value === 'existing' ? 'new' : 'existing';
}

function setZoom(z) {
    zoom.value = Math.max(0.25, Math.min(4, z));
}

// --- Scroll-Synchronisierung zwischen beiden Panes (nur Seite-an-Seite) -------
const scroll_els = ref([]);
function setScrollRef(i, el) {
    scroll_els.value[i] = el;
}
let sync_lock = false;
function onScroll(e, i) {
    if (mode.value !== 'side' || sync_lock) return;
    const other = scroll_els.value[i === 0 ? 1 : 0];
    if (!other) return;
    sync_lock = true;
    other.scrollLeft = e.currentTarget.scrollLeft;
    other.scrollTop = e.currentTarget.scrollTop;
    requestAnimationFrame(() => {
        sync_lock = false;
    });
}

// --- Pan (ziehen zum Verschieben, wenn hineingezoomt) -------------------------
const is_panning = ref(false);
let pan_start = null;
let pan_el = null;
function onPanStart(e) {
    if (zoom.value <= 1) return;
    is_panning.value = true;
    pan_el = e.currentTarget;
    pan_start = {
        x: e.clientX,
        y: e.clientY,
        sl: e.currentTarget.scrollLeft,
        st: e.currentTarget.scrollTop,
    };
    e.preventDefault();
}
function onPanMove(e) {
    if (!is_panning.value || !pan_el) return;
    pan_el.scrollLeft = pan_start.sl - (e.clientX - pan_start.x);
    pan_el.scrollTop = pan_start.st - (e.clientY - pan_start.y);
}
function onPanEnd() {
    is_panning.value = false;
    pan_el = null;
}

function onDialogKeydown(e) {
    if (!dialog_open.value || mode.value !== 'ab') return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 't' || e.key === 'T' || e.key === ' ') {
        e.preventDefault();
        toggleAbView();
    }
}
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDialogKeydown);
}

watch(selected_key, () => {
    existing_page.value = 1;
    existing_num_pages.value = 0;
    existing_error.value = '';
});

watch(mode, () => {
    // Die v-for-Refs neu aufbauen lassen, damit keine veralteten Elemente
    // zwischen den Modi hängen bleiben.
    scroll_els.value = [];
});

watch(
    () => [props.modelValue, props.newFile, props.targets],
    ([open]) => {
        if (open) {
            selected_key.value = props.initialKey || props.targets[0]?.key || '';
            ab_view.value = 'new';
            new_page.value = 1;
            existing_page.value = 1;
            new_num_pages.value = 0;
            existing_num_pages.value = 0;
            new_error.value = '';
            existing_error.value = '';
            buildNewUrl();
        } else {
            disposeNewUrl();
        }
    },
);

onBeforeUnmount(() => {
    disposeNewUrl();
    if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onDialogKeydown);
    }
});
</script>

<template>
    <v-dialog v-model="dialog_open" max-width="1400" scrollable>
        <v-card>
            <v-card-title class="d-flex align-center ga-2 flex-wrap">
                <v-icon color="primary">mdi-file-compare</v-icon>
                <span>PDF-Vergleich</span>
                <span v-if="title" class="text-body-2 text-medium-emphasis">— {{ title }}</span>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" @click="dialog_open = false" />
            </v-card-title>

            <v-divider />

            <v-card-text>
                <div class="d-flex align-center ga-3 flex-wrap mb-2">
                    <span class="text-caption text-medium-emphasis">Vergleichen mit:</span>
                    <v-btn-toggle
                        v-if="targets.length > 1"
                        v-model="selected_key"
                        mandatory
                        density="compact"
                        color="primary"
                        variant="outlined"
                    >
                        <v-btn
                            v-for="t in targets"
                            :key="t.key"
                            :value="t.key"
                            size="small"
                            prepend-icon="mdi-file-pdf-box"
                        >
                            {{ t.label }}
                        </v-btn>
                    </v-btn-toggle>
                    <v-chip
                        v-else-if="targets.length === 1"
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-file-pdf-box"
                    >
                        {{ targets[0].label }}
                    </v-chip>
                    <span
                        v-if="selected_target?.name"
                        class="text-caption text-medium-emphasis text-truncate"
                        style="max-width: 360px"
                        :title="selected_target.name"
                    >
                        {{ selected_target.name }}
                    </span>
                </div>

                <div class="d-flex align-center ga-3 flex-wrap mb-2">
                    <v-btn-toggle
                        v-model="mode"
                        mandatory
                        density="compact"
                        color="primary"
                        variant="outlined"
                    >
                        <v-btn value="side" prepend-icon="mdi-view-split-vertical" size="small">
                            Seite an Seite
                        </v-btn>
                        <v-btn value="ab" prepend-icon="mdi-swap-horizontal" size="small">
                            A/B-Umschalter
                        </v-btn>
                    </v-btn-toggle>

                    <div class="d-flex align-center ga-1">
                        <v-btn
                            icon="mdi-magnify-minus-outline"
                            variant="text"
                            size="small"
                            @click="setZoom(zoom / 1.25)"
                        />
                        <span class="text-caption" style="min-width: 48px; text-align: center">
                            {{ Math.round(zoom * 100) }}%
                        </span>
                        <v-btn
                            icon="mdi-magnify-plus-outline"
                            variant="text"
                            size="small"
                            @click="setZoom(zoom * 1.25)"
                        />
                        <v-btn v-if="zoom !== 1" size="x-small" variant="text" @click="setZoom(1)">
                            100 %
                        </v-btn>
                    </div>

                    <v-spacer />

                    <template v-if="mode === 'ab'">
                        <v-btn-toggle
                            v-model="ab_view"
                            mandatory
                            density="compact"
                            color="primary"
                            variant="outlined"
                        >
                            <v-btn
                                v-for="opt in ab_options"
                                :key="opt.value"
                                :value="opt.value"
                                size="small"
                            >
                                {{ opt.label }}
                            </v-btn>
                        </v-btn-toggle>
                        <v-btn
                            size="small"
                            variant="tonal"
                            prepend-icon="mdi-swap-horizontal"
                            @click="toggleAbView"
                        >
                            Umschalten (T / Leertaste)
                        </v-btn>
                    </template>
                </div>

                <div class="compare-stage" :class="`mode-${mode}`">
                    <div
                        v-for="(pane, i) in panes"
                        :key="pane.side"
                        class="compare-pane"
                        :class="{ 'compare-pane--full': mode === 'ab' }"
                    >
                        <div class="compare-pane__label d-flex align-center ga-2">
                            <span>{{ pane.label }}</span>
                            <v-spacer />
                            <template v-if="numPagesFor(pane.side) > 1">
                                <v-btn
                                    icon="mdi-chevron-left"
                                    size="x-small"
                                    variant="text"
                                    :disabled="pageFor(pane.side) <= 1"
                                    @click="stepPage(pane.side, -1)"
                                />
                                <span class="text-caption">
                                    Seite {{ pageFor(pane.side) }} / {{ numPagesFor(pane.side) }}
                                </span>
                                <v-btn
                                    icon="mdi-chevron-right"
                                    size="x-small"
                                    variant="text"
                                    :disabled="pageFor(pane.side) >= numPagesFor(pane.side)"
                                    @click="stepPage(pane.side, 1)"
                                />
                            </template>
                        </div>
                        <div class="zoom-outer">
                            <div
                                :ref="(el) => setScrollRef(i, el)"
                                class="zoom-scroll"
                                :class="{ 'is-zoomed': zoom > 1, 'is-panning': is_panning }"
                                @scroll="onScroll($event, i)"
                                @mousedown="onPanStart"
                                @mousemove="onPanMove"
                                @mouseup="onPanEnd"
                                @mouseleave="onPanEnd"
                            >
                                <v-alert
                                    v-if="errorFor(pane.side)"
                                    type="error"
                                    variant="tonal"
                                    density="compact"
                                    class="ma-2"
                                >
                                    {{ errorFor(pane.side) }}
                                </v-alert>
                                <div
                                    v-else-if="pane.kind === 'pdf' && pane.url"
                                    class="pdf-holder"
                                >
                                    <vue-pdf-embed
                                        :source="pane.url"
                                        :page="pageFor(pane.side)"
                                        :width="render_width"
                                        @loaded="(p) => onLoaded(pane.side, p)"
                                        @loading-failed="(e) => onFailed(pane.side, e)"
                                        @rendering-failed="(e) => onFailed(pane.side, e)"
                                    />
                                </div>
                                <div
                                    v-else-if="pane.kind === 'image' && pane.url"
                                    class="zoom-wrapper"
                                    :style="{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }"
                                >
                                    <img :src="pane.url" class="zoom-img" :alt="pane.label" draggable="false" />
                                </div>
                                <div
                                    v-else
                                    class="d-flex align-center justify-center text-medium-emphasis"
                                    style="height: 100%"
                                >
                                    Kein Inhalt
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </v-card-text>

            <v-divider />

            <v-card-actions>
                <v-spacer />
                <v-btn variant="tonal" color="primary" @click="dialog_open = false">
                    Schließen
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.compare-stage {
    background: repeating-conic-gradient(#f5f5f5 0% 25%, #ffffff 0% 50%) 50% / 16px 16px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 6px;
    padding: 8px;
}
.mode-side {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.compare-pane {
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    overflow: hidden;
    min-width: 0;
}
.compare-pane--full {
    grid-column: 1 / -1;
}
.compare-pane__label {
    padding: 4px 10px;
    font-size: 0.8rem;
    font-weight: 500;
    background: rgba(0, 0, 0, 0.03);
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    min-height: 36px;
}
.zoom-outer {
    position: relative;
    width: 100%;
    height: 65vh;
    overflow: hidden;
    background: #fff;
}
.zoom-scroll {
    position: absolute;
    inset: 0;
    overflow: auto;
}
.zoom-scroll.is-zoomed {
    cursor: grab;
}
.zoom-scroll.is-panning {
    cursor: grabbing;
}
/* PDFs werden mit fester Pixelbreite gerendert und zentriert; Overflow scrollt. */
.pdf-holder {
    display: flex;
    justify-content: center;
    padding: 8px;
    min-width: 100%;
    box-sizing: border-box;
}
/* Bilder nutzen denselben prozentualen Zoom-Wrapper wie der SVG-Vergleich. */
.zoom-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 100%;
    min-height: 100%;
    transition:
        width 0.15s ease,
        height 0.15s ease;
    padding: 8px;
    box-sizing: border-box;
}
.zoom-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
}
</style>
