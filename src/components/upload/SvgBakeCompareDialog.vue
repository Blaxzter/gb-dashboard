<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { bakeSvgString, ensureAllFonts } from '@/assets/js/svgBaker.js';
import {
    prepareOriginalSvgForDom,
    prepareBakedSvgForDom,
    ensureCompareFonts,
    bakeSeverity,
} from '@/assets/js/svgCompare.js';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    file: { type: Object, default: null },
    title: { type: String, default: '' },
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
const ab_view = ref('baked'); // 'original' | 'baked'
const zoom = ref(1);

const original_svg = ref('');
const baked_svg = ref('');
const bake_stats = ref(null);

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
    original_svg.value = '';
    baked_svg.value = '';
    try {
        await Promise.all([ensureAllFonts(), ensureCompareFonts()]);
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
    } catch (e) {
        console.error(e);
        error_message.value = e?.message || String(e);
    } finally {
        loading.value = false;
    }
}

function toggleAbView() {
    ab_view.value = ab_view.value === 'baked' ? 'original' : 'baked';
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
    () => [props.modelValue, props.file],
    ([open, file]) => {
        if (open && file) runComparison();
        if (!open) {
            original_svg.value = '';
            baked_svg.value = '';
        }
    },
);

onBeforeUnmount(() => {
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
                        <span class="text-caption text-medium-emphasis">
                            Beide SVGs werden nativ vom Browser gerendert — keine Pixel-Konvertierung.
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
                                <v-btn value="original" size="small">Original</v-btn>
                                <v-btn value="baked" size="small">Gebacken</v-btn>
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
                                <div class="compare-pane__label">Original (mit Schrift)</div>
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
                                            <div class="zoom-svg" v-html="original_svg" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="compare-pane">
                                <div class="compare-pane__label">Gebackene Version (Pfade)</div>
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
                                            <div class="zoom-svg" v-html="baked_svg" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>

                        <template v-else-if="mode === 'slider'">
                            <div class="compare-slider">
                                <div class="compare-slider__labels">
                                    <span class="compare-slider__label">Original</span>
                                    <span class="compare-slider__label">Gebacken</span>
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
                                                <div
                                                    class="compare-slider__svg"
                                                    v-html="baked_svg"
                                                />
                                                <div
                                                    class="compare-slider__svg compare-slider__svg--overlay"
                                                    :style="{
                                                        clipPath: `inset(0 ${100 - slider_position}% 0 0)`,
                                                    }"
                                                    v-html="original_svg"
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
                                <div class="compare-pane__label">
                                    {{ ab_view === 'original' ? 'Original (mit Schrift)' : 'Gebackene Version (Pfade)' }}
                                </div>
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
                                            <div
                                                v-show="ab_view === 'baked'"
                                                class="zoom-svg zoom-svg--ab"
                                                v-html="baked_svg"
                                            />
                                            <div
                                                v-show="ab_view === 'original'"
                                                class="zoom-svg zoom-svg--ab"
                                                v-html="original_svg"
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
                    v-if="!loading && !error_message"
                    variant="text"
                    prepend-icon="mdi-download"
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
.zoom-svg {
    width: 100%;
    height: 100%;
    user-select: none;
    -webkit-user-drag: none;
    line-height: 0;
}
.zoom-svg--ab {
    position: relative;
}
.zoom-svg :deep(svg) {
    display: block;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    pointer-events: none;
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
.compare-slider__svg {
    position: absolute;
    inset: 0;
    line-height: 0;
}
.compare-slider__svg :deep(svg) {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
}
.compare-slider__svg--overlay {
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
