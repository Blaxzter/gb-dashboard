<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { bakeSvgString, ensureAllFonts } from '@/assets/js/svgBaker.js';
import {
    prepareOriginalSvgForDom,
    prepareBakedSvgForDom,
    ensureCompareFonts,
    bakeSeverity,
    computeSvgEquality,
} from '@/assets/js/svgCompare.js';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    file: { type: Object, default: null },
    title: { type: String, default: '' },
    // When set, the dialog adds a "Bereits hochgeladen" comparison target —
    // the baked new file is diffed against the SVG currently saved on the Lied.
    existingUrl: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const dialog_open = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v),
});

const loading = ref(false);
const error_message = ref('');
const mode = ref('side'); // 'side' | 'slider' | 'ab'
const slider_position = ref(50);
const ab_view = ref('baked'); // 'original' | 'baked' | 'existing'
const zoom = ref(1);

// Two comparison targets:
//   'bake'     — Original (with font) vs Baked (paths)
//   'existing' — Baked (new upload) vs Bereits hochgeladen (saved on the Lied)
// Defaults to 'existing' when an existingUrl is provided; otherwise 'bake'.
const target = ref(props.existingUrl ? 'existing' : 'bake');

const original_svg = ref(''); // raw SVG string (for download)
const baked_svg = ref(''); // raw SVG string (for download)
const existing_svg = ref(''); // raw SVG string of currently-uploaded file
const original_url = ref(''); // blob URL used as <img> source
const baked_url = ref(''); // blob URL used as <img> source
const existing_url = ref(''); // blob URL used as <img> source for existing
const bake_stats = ref(null);
const existing_error = ref('');
// null | { equal: boolean, reason: string }
const equality = ref(null);

let createdUrls = [];
function disposeUrls() {
    createdUrls.forEach((u) => URL.revokeObjectURL(u));
    createdUrls = [];
    original_url.value = '';
    baked_url.value = '';
    existing_url.value = '';
}
function svgToBlobUrl(svgString) {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    createdUrls.push(url);
    return url;
}

// Refs to scroll containers — used to sync pan/scroll between the two panes
// in side-by-side mode.
const scroll_left = ref(null);
const scroll_right = ref(null);

const is_panning = ref(false);
let pan_start = null;
let pan_active_target = null;
let sync_scroll_lock = false;

let lastBakedSvg = '';

function getSyncTargets(source) {
    // In side-by-side mode pan is mirrored to the other pane. Other modes
    // only have a single scroll surface.
    if (mode.value !== 'side') return [];
    if (source === scroll_left.value && scroll_right.value) return [scroll_right.value];
    if (source === scroll_right.value && scroll_left.value) return [scroll_left.value];
    return [];
}

function onScroll(e) {
    if (sync_scroll_lock) return;
    const targets = getSyncTargets(e.currentTarget);
    if (!targets.length) return;
    sync_scroll_lock = true;
    for (const t of targets) {
        t.scrollLeft = e.currentTarget.scrollLeft;
        t.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
        sync_scroll_lock = false;
    });
}

function onPanStart(e) {
    if (zoom.value <= 1) return;
    is_panning.value = true;
    pan_active_target = e.currentTarget;
    pan_start = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: e.currentTarget.scrollLeft,
        scrollTop: e.currentTarget.scrollTop,
    };
    e.preventDefault();
}

function onPanMove(e) {
    if (!is_panning.value || !pan_active_target) return;
    const dx = e.clientX - pan_start.x;
    const dy = e.clientY - pan_start.y;
    pan_active_target.scrollLeft = pan_start.scrollLeft - dx;
    pan_active_target.scrollTop = pan_start.scrollTop - dy;
}

function onPanEnd() {
    is_panning.value = false;
    pan_active_target = null;
}

// Slider mode: drag the handle along the stack to control the split.
const slider_dragging = ref(false);
const slider_stack = ref(null);
let slider_drag_rect = null;

function updateSliderFromEvent(clientX) {
    if (!slider_drag_rect || slider_drag_rect.width === 0) return;
    const rel = clientX - slider_drag_rect.left;
    const pct = (rel / slider_drag_rect.width) * 100;
    slider_position.value = Math.max(0, Math.min(100, pct));
}

function onHandleMouseDown(e) {
    if (!slider_stack.value) return;
    slider_drag_rect = slider_stack.value.getBoundingClientRect();
    slider_dragging.value = true;
    e.preventDefault();
    window.addEventListener('mousemove', onSliderMove);
    window.addEventListener('mouseup', onSliderEnd);
}

function onSliderMove(e) {
    if (!slider_dragging.value) return;
    updateSliderFromEvent(e.clientX);
}

function onSliderEnd() {
    slider_dragging.value = false;
    slider_drag_rect = null;
    window.removeEventListener('mousemove', onSliderMove);
    window.removeEventListener('mouseup', onSliderEnd);
}

async function runComparison() {
    if (!props.file) return;
    loading.value = true;
    error_message.value = '';
    existing_error.value = '';
    equality.value = null;
    disposeUrls();
    original_svg.value = '';
    baked_svg.value = '';
    existing_svg.value = '';
    try {
        await ensureAllFonts();
        const text = await props.file.text();
        const baked = await bakeSvgString(text);
        lastBakedSvg = baked.svgString;
        bake_stats.value = {
            bakedCount: baked.bakedCount,
            totalTexts: baked.totalTexts,
            severity: bakeSeverity(baked.bakedCount, baked.totalTexts),
        };
        original_svg.value = await prepareOriginalSvgForDom(text);
        baked_svg.value = prepareBakedSvgForDom(baked.svgString);
        original_url.value = svgToBlobUrl(original_svg.value);
        baked_url.value = svgToBlobUrl(baked_svg.value);

        if (props.existingUrl) {
            try {
                const resp = await fetch(props.existingUrl);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const existingText = await resp.text();
                existing_svg.value = existingText;
                existing_url.value = svgToBlobUrl(existingText);
                equality.value = computeSvgEquality(baked.svgString, existingText);
            } catch (e) {
                console.warn('Bereits hochgeladene Datei konnte nicht geladen werden', e);
                existing_error.value = e?.message || String(e);
            }
        }
    } catch (e) {
        console.error(e);
        error_message.value = e?.message || String(e);
    } finally {
        loading.value = false;
    }
}

function onDialogKeydown(e) {
    if (!dialog_open.value) return;
    if (mode.value !== 'ab') return;
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

watch(
    () => [props.modelValue, props.file, props.existingUrl],
    ([open, file]) => {
        if (open && file) {
            // Reset the target if the existing-URL availability changed since
            // the dialog was last closed.
            target.value = props.existingUrl ? 'existing' : 'bake';
            if (ab_view.value === 'existing' && !props.existingUrl) {
                ab_view.value = 'baked';
            }
            runComparison();
        }
        if (!open) {
            disposeUrls();
            original_svg.value = '';
            baked_svg.value = '';
            existing_svg.value = '';
            equality.value = null;
        }
    },
);

onBeforeUnmount(() => {
    disposeUrls();
    if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onDialogKeydown);
    }
});

function downloadBakedSvg() {
    if (!lastBakedSvg) return;
    const blob = new Blob([lastBakedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = (props.file?.name || 'svg').replace(/\.svg$/i, '');
    a.download = `${baseName}.baked.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setZoom(z) {
    zoom.value = Math.max(0.25, Math.min(4, z));
}

// Pane sources / labels depending on `target`:
//   'bake'     — left = Original (font),   right = Gebacken (paths)
//   'existing' — left = Gebacken (neu),    right = Bereits hochgeladen
const left_label = computed(() =>
    target.value === 'existing' ? 'Gebackene Version (neu)' : 'Original (mit Schrift)',
);
const right_label = computed(() =>
    target.value === 'existing' ? 'Bereits hochgeladen' : 'Gebackene Version (Pfade)',
);
const left_url = computed(() =>
    target.value === 'existing' ? baked_url.value : original_url.value,
);
const right_url = computed(() =>
    target.value === 'existing' ? existing_url.value : baked_url.value,
);

// A/B mode resolves the currently-shown image:
//   bake-target: ab_view ∈ {original, baked}
//   existing-target: ab_view ∈ {baked, existing} (we reuse 'baked' as the
//   "new" side and 'existing' as the saved version).
const ab_label = computed(() => {
    if (target.value === 'existing') {
        return ab_view.value === 'existing' ? 'Bereits hochgeladen' : 'Gebackene Version (neu)';
    }
    return ab_view.value === 'original' ? 'Original (mit Schrift)' : 'Gebackene Version (Pfade)';
});
const ab_url = computed(() => {
    if (target.value === 'existing') {
        return ab_view.value === 'existing' ? existing_url.value : baked_url.value;
    }
    return ab_view.value === 'original' ? original_url.value : baked_url.value;
});
const ab_options = computed(() => {
    if (target.value === 'existing') {
        return [
            { value: 'baked', label: 'Neu (Gebacken)' },
            { value: 'existing', label: 'Bereits hochgeladen' },
        ];
    }
    return [
        { value: 'original', label: 'Original' },
        { value: 'baked', label: 'Gebacken' },
    ];
});

watch(target, (t) => {
    // Keep A/B view valid when the target switches.
    if (t === 'existing') {
        if (ab_view.value === 'original') ab_view.value = 'baked';
    } else {
        if (ab_view.value === 'existing') ab_view.value = 'baked';
    }
});

function toggleAbView() {
    if (target.value === 'existing') {
        ab_view.value = ab_view.value === 'existing' ? 'baked' : 'existing';
    } else {
        ab_view.value = ab_view.value === 'baked' ? 'original' : 'baked';
    }
}
</script>

<template>
    <v-dialog v-model="dialog_open" max-width="1400" scrollable>
        <v-card>
            <v-card-title class="d-flex align-center ga-2 flex-wrap">
                <v-icon color="primary">mdi-vector-difference-ab</v-icon>
                <span>SVG-Bake-Vergleich</span>
                <span v-if="title" class="text-body-2 text-medium-emphasis">— {{ title }}</span>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" @click="dialog_open = false" />
            </v-card-title>

            <v-divider />

            <v-card-text>
                <div v-if="loading" class="d-flex flex-column align-center pa-6 ga-2">
                    <v-progress-circular indeterminate color="primary" />
                    <div class="text-caption text-medium-emphasis">
                        Bereite Original und gebackene Version vor…
                    </div>
                </div>

                <v-alert v-else-if="error_message" type="error" variant="tonal">
                    {{ error_message }}
                </v-alert>

                <template v-else>
                    <div class="d-flex align-center ga-3 flex-wrap mb-3">
                        <v-chip
                            v-if="bake_stats"
                            :color="bake_stats.severity.color"
                            variant="tonal"
                            size="small"
                            :prepend-icon="
                                bake_stats.severity.level === 'ok'
                                    ? 'mdi-check-circle-outline'
                                    : bake_stats.severity.level === 'warn'
                                        ? 'mdi-alert-outline'
                                        : 'mdi-alert'
                            "
                        >
                            {{ bake_stats.bakedCount }} / {{ bake_stats.totalTexts }} Texte gebacken
                            <span v-if="bake_stats.severity.level !== 'ok'" class="ms-1">
                                — {{ bake_stats.severity.label }}
                            </span>
                        </v-chip>
                        <v-chip
                            v-if="existingUrl && equality"
                            :color="equality.equal ? 'success' : 'warning'"
                            variant="tonal"
                            size="small"
                            :prepend-icon="
                                equality.equal
                                    ? 'mdi-equal'
                                    : 'mdi-not-equal-variant'
                            "
                        >
                            {{ equality.equal ? 'Identisch zur hochgeladenen Datei' : 'Unterscheidet sich von der hochgeladenen Datei' }}
                            <span class="ms-1 text-caption">— {{ equality.reason }}</span>
                        </v-chip>
                        <v-chip
                            v-if="existingUrl && existing_error"
                            color="error"
                            variant="tonal"
                            size="small"
                            prepend-icon="mdi-alert"
                        >
                            Bereits hochgeladene Datei konnte nicht geladen werden: {{ existing_error }}
                        </v-chip>
                        <span class="text-caption text-medium-emphasis">
                            Beide SVGs werden nativ vom Browser gerendert — keine Pixel-Konvertierung.
                        </span>
                    </div>

                    <div v-if="existingUrl" class="d-flex align-center ga-3 flex-wrap mb-2">
                        <span class="text-caption text-medium-emphasis">Vergleich:</span>
                        <v-btn-toggle
                            v-model="target"
                            mandatory
                            density="compact"
                            color="primary"
                            variant="outlined"
                        >
                            <v-btn value="existing" size="small" prepend-icon="mdi-cloud-check-outline">
                                Neu (Gebacken) vs. Bereits hochgeladen
                            </v-btn>
                            <v-btn value="bake" size="small" prepend-icon="mdi-format-text-variant-outline">
                                Original vs. Gebacken
                            </v-btn>
                        </v-btn-toggle>
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
                            <v-btn value="slider" prepend-icon="mdi-arrow-split-vertical" size="small">
                                Schieberegler
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
                            <v-btn
                                v-if="zoom !== 1"
                                size="x-small"
                                variant="text"
                                @click="setZoom(1)"
                            >
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
                        <template v-if="mode === 'side'">
                            <div class="compare-pane">
                                <div class="compare-pane__label">{{ left_label }}</div>
                                <div class="zoom-outer">
                                    <div
                                        ref="scroll_left"
                                        class="zoom-scroll"
                                        :class="{
                                            'is-zoomed': zoom > 1,
                                            'is-panning': is_panning,
                                        }"
                                        @scroll="onScroll"
                                        @mousedown="onPanStart"
                                        @mousemove="onPanMove"
                                        @mouseup="onPanEnd"
                                        @mouseleave="onPanEnd"
                                    >
                                        <div
                                            class="zoom-wrapper"
                                            :style="{
                                                width: `${zoom * 100}%`,
                                                height: `${zoom * 100}%`,
                                            }"
                                        >
                                            <img
                                                v-if="left_url"
                                                :src="left_url"
                                                class="zoom-img"
                                                :alt="left_label"
                                                draggable="false"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="compare-pane">
                                <div class="compare-pane__label">{{ right_label }}</div>
                                <div class="zoom-outer">
                                    <div
                                        ref="scroll_right"
                                        class="zoom-scroll"
                                        :class="{
                                            'is-zoomed': zoom > 1,
                                            'is-panning': is_panning,
                                        }"
                                        @scroll="onScroll"
                                        @mousedown="onPanStart"
                                        @mousemove="onPanMove"
                                        @mouseup="onPanEnd"
                                        @mouseleave="onPanEnd"
                                    >
                                        <div
                                            class="zoom-wrapper"
                                            :style="{
                                                width: `${zoom * 100}%`,
                                                height: `${zoom * 100}%`,
                                            }"
                                        >
                                            <img
                                                v-if="right_url"
                                                :src="right_url"
                                                class="zoom-img"
                                                :alt="right_label"
                                                draggable="false"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>

                        <template v-else-if="mode === 'slider'">
                            <div class="compare-slider">
                                <div class="compare-slider__labels">
                                    <span class="compare-slider__label">{{ left_label }}</span>
                                    <span class="compare-slider__label">{{ right_label }}</span>
                                </div>
                                <div class="zoom-outer compare-slider__outer">
                                    <div
                                        class="zoom-scroll"
                                        :class="{
                                            'is-zoomed': zoom > 1,
                                            'is-panning': is_panning,
                                        }"
                                        @mousedown="onPanStart"
                                        @mousemove="onPanMove"
                                        @mouseup="onPanEnd"
                                        @mouseleave="onPanEnd"
                                    >
                                        <div
                                            class="zoom-wrapper"
                                            :style="{
                                                width: `${zoom * 100}%`,
                                                height: `${zoom * 100}%`,
                                            }"
                                        >
                                            <div
                                                ref="slider_stack"
                                                class="compare-slider__stack"
                                                :class="{ 'is-dragging': slider_dragging }"
                                            >
                                                <img
                                                    v-if="right_url"
                                                    :src="right_url"
                                                    class="compare-slider__img"
                                                    :alt="right_label"
                                                    draggable="false"
                                                />
                                                <img
                                                    v-if="left_url"
                                                    :src="left_url"
                                                    class="compare-slider__img compare-slider__img--overlay"
                                                    :style="{
                                                        clipPath: `inset(0 ${100 - slider_position}% 0 0)`,
                                                    }"
                                                    :alt="left_label"
                                                    draggable="false"
                                                />
                                                <div
                                                    class="compare-slider__handle"
                                                    :style="{ left: slider_position + '%' }"
                                                    @mousedown.stop="onHandleMouseDown"
                                                >
                                                    <div class="compare-slider__handle-hit" />
                                                    <div class="compare-slider__handle-grip">
                                                        <v-icon size="14" color="white">mdi-arrow-split-vertical</v-icon>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <v-slider
                                    v-model="slider_position"
                                    :min="0"
                                    :max="100"
                                    :step="0.5"
                                    hide-details
                                    density="compact"
                                    color="primary"
                                    class="mt-2"
                                />
                            </div>
                        </template>

                        <template v-else>
                            <div class="compare-pane compare-pane--full">
                                <div class="compare-pane__label">{{ ab_label }}</div>
                                <div class="zoom-outer">
                                    <div
                                        class="zoom-scroll"
                                        :class="{
                                            'is-zoomed': zoom > 1,
                                            'is-panning': is_panning,
                                        }"
                                        @mousedown="onPanStart"
                                        @mousemove="onPanMove"
                                        @mouseup="onPanEnd"
                                        @mouseleave="onPanEnd"
                                    >
                                        <div
                                            class="zoom-wrapper"
                                            :style="{
                                                width: `${zoom * 100}%`,
                                                height: `${zoom * 100}%`,
                                            }"
                                        >
                                            <img
                                                v-if="ab_url"
                                                :src="ab_url"
                                                class="zoom-img zoom-img--ab"
                                                :alt="ab_label"
                                                draggable="false"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </template>
            </v-card-text>

            <v-divider />

            <v-card-actions>
                <v-btn
                    variant="text"
                    prepend-icon="mdi-refresh"
                    :disabled="loading || !file"
                    @click="runComparison"
                >
                    Neu vorbereiten
                </v-btn>
                <v-btn
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-download"
                    :disabled="loading || !!error_message || !baked_svg"
                    @click="downloadBakedSvg"
                >
                    Gebacktes SVG speichern
                </v-btn>
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
    padding: 6px 10px;
    font-size: 0.8rem;
    font-weight: 500;
    background: rgba(0, 0, 0, 0.03);
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

/* zoom-outer / zoom-scroll / zoom-wrapper — same pattern as NotenCarousel.
 * The outer is the fixed-size visible area; the scroll fills it with overflow;
 * the wrapper grows past 100% when zoomed in, triggering scrollbars. */
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
.zoom-img--ab {
    position: absolute;
    inset: 0;
}

.compare-slider {
    width: 100%;
}
.compare-slider__outer {
    /* slightly taller because we have only one pane plus the slider track */
    height: 65vh;
}
.compare-slider__stack {
    position: relative;
    width: 100%;
    height: 100%;
    line-height: 0;
}
.compare-slider__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
}
.compare-slider__img--overlay {
    pointer-events: none;
}
.compare-slider__handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 2px dashed rgba(var(--v-theme-primary), 0.9);
    transform: translateX(-1px);
    z-index: 3;
    cursor: ew-resize;
}
/* Invisible hit area around the handle line so it's easy to grab. */
.compare-slider__handle-hit {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -8px;
    width: 18px;
}
.compare-slider__handle-grip {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translate(-50%, -50%);
    background: rgb(var(--v-theme-primary));
    color: #fff;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    cursor: ew-resize;
}
.compare-slider__stack.is-dragging .compare-slider__handle,
.compare-slider__stack.is-dragging .compare-slider__handle-grip {
    cursor: grabbing;
}
.compare-slider__labels {
    display: flex;
    justify-content: space-between;
    padding: 0 4px 6px;
}
.compare-slider__label {
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
</style>
