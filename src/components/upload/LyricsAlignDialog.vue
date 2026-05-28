<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { analyzeLyrics, applyCorrections } from '@/assets/js/lyricsAlign.js';
import { analyzePdfAlignment } from '@/assets/js/pdfAlign.js';
import { bakeSvgString } from '@/assets/js/svgBaker.js';
import { prepareOriginalSvgForDom } from '@/assets/js/svgCompare.js';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    file: { type: Object, default: null },
    title: { type: String, default: '' },
    // Optional reference PDF for auto-alignment. When present, we run the PDF
    // analysis on dialog open and pre-fill the lyric overrides.
    referencePdf: { type: Object, default: null },
    // Pre-computed PDF corrections (Map<lyricId, newX>) from the upload view's
    // background worker. Lets us skip re-running the analysis when the dialog
    // opens and the worker has already finished.
    initialCorrections: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'apply']);

const dialog_open = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v),
});

const loading = ref(false);
const error_message = ref('');

const original_svg = ref('');
const display_svg_edit = ref(''); // baked + edits, interactive
const display_svg_original = ref(''); // baked snapshot, read-only reference
const display_svg_raw = ref(''); // raw Finale SVG with @font-face Optima injected
const view_mode = ref('edit'); // 'edit' | 'original' | 'raw'
const lyrics = ref([]);
const notes = ref([]);

const zoom = ref(1);
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 6;
const is_panning = ref(false);
let pan_start = null;

// Map of lyric id -> currentX (overrides applied during this session). We
// always start populated with the SVG's original x so applying "save" is just
// a diff between this and the original.
const current_x = ref(new Map());
const original_x = ref(new Map());
// Subset of current_x that came from the PDF auto-alignment (vs user edits).
// We render these with a slightly different shade in the marker so users can
// tell "auto-corrected" apart from "I nudged this".
const pdf_x = ref(new Map());
const pdf_align_status = ref('idle'); // 'idle' | 'running' | 'done' | 'error'
const pdf_align_error = ref('');
// Object URL for the reference PDF — created on dialog open so the "PDF" view
// mode can embed it for visual comparison, revoked on close to avoid leaks.
const pdf_object_url = ref('');

const selected_id = ref(null);
const hide_aligned = ref(true);
const show_outlines = ref(true);
const fine_step = ref(0.1); // alt+arrow — sub-pixel nudge
const step = ref(0.5); // arrow — default
const big_step = ref(2.0); // shift+arrow — coarse

const svg_container = ref(null);

const misaligned_count = computed(
    () => lyrics.value.filter((l) => l.misaligned && !l.isPunctuation).length,
);
const misaligned_remaining = computed(
    () =>
        lyrics.value.filter((l) => {
            if (l.isPunctuation || !l.misaligned) return false;
            const cur = current_x.value.get(l.id) ?? l.x;
            return Math.abs(cur - l.expectedX) > 0.5;
        }).length,
);
const currentSvgString = computed(() => {
    if (view_mode.value === 'raw') return display_svg_raw.value;
    if (view_mode.value === 'original') return display_svg_original.value;
    return display_svg_edit.value;
});
const filtered_lyrics = computed(() => {
    const list = lyrics.value.filter((l) => !l.isPunctuation && l.noteId);
    if (!hide_aligned.value) return list;
    return list.filter((l) => l.misaligned);
});

watch(
    () => props.modelValue,
    async (open) => {
        if (open && props.file) await load();
        else cleanup();
    },
);

async function load() {
    loading.value = true;
    error_message.value = '';
    pdf_align_status.value = 'idle';
    pdf_align_error.value = '';
    pdf_x.value = new Map();
    if (props.referencePdf) {
        pdf_object_url.value = URL.createObjectURL(props.referencePdf);
    }
    try {
        original_svg.value = await props.file.text();
        const analysis = await analyzeLyrics(original_svg.value);
        lyrics.value = analysis.lyrics;
        notes.value = analysis.notes;
        const startX = new Map(analysis.lyrics.map((l) => [l.id, l.x]));
        original_x.value = new Map(startX);
        selected_id.value = null;

        // PDF-driven auto-alignment. If the upload view already produced a
        // corrections Map, prefer that (no extra work). Otherwise, if a PDF
        // is attached, compute it now.
        let pdfCorrections = null;
        if (props.initialCorrections && props.initialCorrections.size > 0) {
            pdfCorrections = props.initialCorrections;
            pdf_align_status.value = 'done';
        } else if (props.referencePdf) {
            pdf_align_status.value = 'running';
            try {
                const pdfBuf = await props.referencePdf.arrayBuffer();
                const result = await analyzePdfAlignment(original_svg.value, pdfBuf);
                pdfCorrections = result.corrections;
                pdf_align_status.value = 'done';
            } catch (e) {
                console.warn('PDF-Ausrichtung fehlgeschlagen', e);
                pdf_align_status.value = 'error';
                pdf_align_error.value = e?.message || String(e);
            }
        }
        if (pdfCorrections && pdfCorrections.size > 0) {
            for (const [id, x] of pdfCorrections.entries()) {
                startX.set(id, x);
                pdf_x.value.set(id, x);
            }
        }
        current_x.value = new Map(startX);

        // Bake once. We render the same baked SVG both as the interactive
        // "edit" view (with lyric tags, drag/key targets) and as a read-only
        // "original" view (no tags, no edits applied). The original view is
        // there so users can compare positions before/after.
        const baked = await bakeSvgString(original_svg.value);
        display_svg_original.value = baked.svgString;
        display_svg_edit.value = tagBakedLyrics(baked.svgString, analysis.lyrics);
        display_svg_raw.value = await prepareOriginalSvgForDom(original_svg.value);
    } catch (e) {
        console.error(e);
        error_message.value = e?.message || String(e);
    } finally {
        loading.value = false;
    }
    // The scroll/SVG container is behind v-else (only rendered once loading is
    // false). Wire interactions AFTER the DOM updates so svg_container.value
    // actually points at the rendered div.
    if (!error_message.value) {
        await nextTick();
        wireSvgInteractions();
    }
}

/**
 * Walk the baked SVG and the original SVG side-by-side in document order. For
 * each baked <g> that replaced an Optima lyric <text>, write a data-lyric-id
 * attribute on it.
 */
function tagBakedLyrics(bakedSvgString, lyricList) {
    const parser = new DOMParser();
    const origDoc = parser.parseFromString(original_svg.value, 'image/svg+xml');
    const bakedDoc = parser.parseFromString(bakedSvgString, 'image/svg+xml');

    const origTexts = Array.from(origDoc.querySelectorAll('text'));
    // The baker replaces <text> with <g>, but preserves document order. We
    // can't query baked nodes by what they USED to be, so instead we match by
    // transform string — the baker copies the text's transform to the g.
    const bakedGs = Array.from(bakedDoc.querySelectorAll('g'));

    const byId = new Map(lyricList.map((l) => [l.id, l]));

    // Walk in document order assigning IDs the same way analyzeLyrics does
    // (one counter for both notes and lyrics so IDs match exactly).
    const NOTEHEAD_RE = /[\uE0A0-\uE0A4]/;
    let counter = 0;
    const idForText = new Map(); // text-el → assigned id
    for (const t of origTexts) {
        const family = t.getAttribute('font-family') || '';
        const text = (t.textContent || '').trim();
        if (!text) continue;
        if (/finale|maestro/i.test(family)) {
            if (text.length === 1 && NOTEHEAD_RE.test(text)) {
                idForText.set(t, `n${counter++}`);
            }
        } else if (/optima/i.test(family)) {
            idForText.set(t, `l${counter++}`);
        }
    }

    // Now walk origTexts and bakedGs in parallel: the baker creates one <g>
    // per <text>. Some texts may not bake (unknown family) and remain as
    // <text> in the output; we need to skip those.
    const bakedGroupsByTransform = new Map(); // transform string -> list of gs (in order)
    for (const g of bakedGs) {
        const t = g.getAttribute('transform');
        if (!t) continue;
        if (!bakedGroupsByTransform.has(t)) bakedGroupsByTransform.set(t, []);
        bakedGroupsByTransform.get(t).push(g);
    }

    for (const t of origTexts) {
        const id = idForText.get(t);
        if (!id || !id.startsWith('l')) continue;
        const lyric = byId.get(id);
        if (!lyric) continue;
        const transform = t.getAttribute('transform');
        const candidates = bakedGroupsByTransform.get(transform);
        if (candidates && candidates.length) {
            const g = candidates.shift();
            g.setAttribute('data-lyric-id', id);
            g.setAttribute('class', (g.getAttribute('class') || '') + ' lyric-target');
            if (lyric.misaligned) g.setAttribute('data-misaligned', '1');
        }
    }

    return new XMLSerializer().serializeToString(bakedDoc);
}

function wireSvgInteractions() {
    if (!svg_container.value) return;
    const svgEl = svg_container.value.querySelector('svg');
    if (!svgEl) return;
    // CSS (.zoom-wrapper :deep(svg)) already pins the SVG to 100%/100% of its
    // wrapper. Add preserveAspectRatio so the viewBox content stays centered.
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    if (view_mode.value !== 'edit') return;

    const targets = svgEl.querySelectorAll('[data-lyric-id]');
    targets.forEach((g) => {
        const id = g.getAttribute('data-lyric-id');
        // Re-apply any pending edits to this freshly-rendered <g> (toggling
        // edit/original via v-html recreates the DOM and loses inline mutations).
        const cur = current_x.value.get(id);
        const orig = original_x.value.get(id);
        if (cur !== undefined && orig !== undefined && Math.abs(cur - orig) > 0.001) {
            const t = g.getAttribute('transform') || '';
            const m = t.match(/translate\s*\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*\)/);
            if (m) g.setAttribute('transform', `translate(${cur.toFixed(3)},${m[2]})`);
        }
        g.style.cursor = 'pointer';
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            selected_id.value = id;
            applyHighlights();
            focusKbd();
        });
    });
    applyHighlights();
}

function setZoomAtCursor(newZoom, cursorClientX, cursorClientY) {
    const c = svg_container.value;
    if (!c) {
        zoom.value = newZoom;
        return;
    }
    const rect = c.getBoundingClientRect();
    // Position of the cursor INSIDE the scroll container content (in current
    // zoom coords): how far from the top-left of the scrolled content we are.
    const px = c.scrollLeft + (cursorClientX - rect.left);
    const py = c.scrollTop + (cursorClientY - rect.top);
    const ratio = newZoom / zoom.value;
    zoom.value = newZoom;
    // After the wrapper resizes, scroll so the same logical point sits under
    // the cursor. We have to wait one frame for the DOM to reflect the new
    // wrapper size before scrollLeft/scrollTop can land on the new values.
    requestAnimationFrame(() => {
        c.scrollLeft = px * ratio - (cursorClientX - rect.left);
        c.scrollTop = py * ratio - (cursorClientY - rect.top);
    });
}

function onWheel(e) {
    if (!e.ctrlKey && !e.metaKey) return; // require modifier so page-scroll still works
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const target = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom.value * factor));
    if (target === zoom.value) return;
    setZoomAtCursor(target, e.clientX, e.clientY);
}

function onPanStart(e) {
    // Only pan with the middle button or when zoomed in and clicking empty space.
    const isLyric = e.target.closest && e.target.closest('[data-lyric-id]');
    if (isLyric) return;
    if (zoom.value <= 1 && e.button === 0) return;
    is_panning.value = true;
    pan_start = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: svg_container.value.scrollLeft,
        scrollTop: svg_container.value.scrollTop,
    };
    e.preventDefault();
}
function onPanMove(e) {
    if (!is_panning.value || !pan_start || !svg_container.value) return;
    svg_container.value.scrollLeft = pan_start.scrollLeft - (e.clientX - pan_start.x);
    svg_container.value.scrollTop = pan_start.scrollTop - (e.clientY - pan_start.y);
}
function onPanEnd() {
    is_panning.value = false;
    pan_start = null;
}

function zoomIn() {
    zoom.value = Math.min(ZOOM_MAX, zoom.value * 1.25);
}
function zoomOut() {
    zoom.value = Math.max(ZOOM_MIN, zoom.value / 1.25);
}
function zoomReset() {
    zoom.value = 1;
}

const VIEW_MODES = ['edit', 'original', 'raw'];
function toggleViewMode() {
    const i = VIEW_MODES.indexOf(view_mode.value);
    view_mode.value = VIEW_MODES[(i + 1) % VIEW_MODES.length];
}
// Independent of the view modes (which render the SVG in different ways), the
// user can pop the reference PDF into a side panel next to the SVG. We keep
// these separate because the PDF renders at its own page scale (not the SVG
// viewBox), so it isn't a clean drop-in replacement — but it's invaluable for
// visual cross-check.
const show_pdf_side = ref(false);

function onDialogKeydown(e) {
    if (!dialog_open.value) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 't' || e.key === 'T' || e.key === ' ') {
        e.preventDefault();
        toggleViewMode();
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDialogKeydown);
}

watch(view_mode, async () => {
    if (loading.value) return;
    await nextTick();
    wireSvgInteractions();
});
watch(show_outlines, () => applyHighlights());

function focusKbd() {
    if (svg_container.value) svg_container.value.focus();
}

// Classify a changed lyric by what positioned it at its current x: PDF auto-
// alignment, the analyzer's note-center heuristic, or the user. Detection is
// purely by value match against pdf_x / lyric.expectedX, so the source
// remains correct even after re-applies and round-trips.
const SOURCE_COLORS = {
    pdf: '#1976d2', // blue — engraver intent
    note: '#2e7d32', // green — algorithmic
    manual: '#ef6c00', // orange — user touch
};
function correctionSource(id, cur) {
    if (pdf_x.value.has(id) && Math.abs(pdf_x.value.get(id) - cur) < 0.001) return 'pdf';
    const l = lyrics.value.find((x) => x.id === id);
    if (l && Math.abs(l.expectedX - cur) < 0.001) return 'note';
    return 'manual';
}

function applyHighlights() {
    if (view_mode.value !== 'edit') return;
    if (!svg_container.value) return;
    const svgEl = svg_container.value.querySelector('svg');
    if (!svgEl) return;
    svgEl.querySelectorAll('[data-lyric-id]').forEach((g) => {
        const id = g.getAttribute('data-lyric-id');
        const isSelected = id === selected_id.value;
        const isMis = g.getAttribute('data-misaligned') === '1';
        const cur = current_x.value.get(id);
        const orig = original_x.value.get(id);
        const isChanged = cur !== undefined && orig !== undefined && Math.abs(cur - orig) > 0.001;
        const source = isChanged ? correctionSource(id, cur) : null;
        // Strip prior overlay + marker so we can recompute them cleanly.
        g.querySelectorAll('.lyric-overlay, .lyric-shift-marker').forEach((n) => n.remove());
        // Transparent rect that *catches clicks* covering the whole syllable
        // bbox plus some margin — without this the hit area is just the glyph
        // ink, which is fiddly (especially for hyphens). The margin makes the
        // 1-px hyphen graspable too.
        const ns = 'http://www.w3.org/2000/svg';
        const overlay = document.createElementNS(ns, 'rect');
        overlay.setAttribute('class', 'lyric-overlay');
        const bb = g.getBBox();
        const PAD = 1.5;
        overlay.setAttribute('x', bb.x - PAD);
        overlay.setAttribute('y', bb.y - PAD);
        overlay.setAttribute('width', bb.width + PAD * 2);
        overlay.setAttribute('height', bb.height + PAD * 2);
        overlay.setAttribute('fill', 'transparent');
        overlay.setAttribute('pointer-events', 'all');
        // Selection always shows so the user knows what's focused; misaligned/
        // changed outlines respect the toggle.
        if (isSelected) {
            overlay.setAttribute('stroke', '#1976d2');
            overlay.setAttribute('stroke-width', '0.5');
        } else if (show_outlines.value && isChanged) {
            overlay.setAttribute('stroke', SOURCE_COLORS[source]);
            overlay.setAttribute('stroke-width', '0.4');
        } else if (show_outlines.value && isMis) {
            overlay.setAttribute('stroke', '#fb8c00');
            overlay.setAttribute('stroke-width', '0.4');
            overlay.setAttribute('stroke-dasharray', '1 0.5');
        }
        g.appendChild(overlay);

        // Old-position marker: a small tick at the original x position plus a
        // thin connector pointing to the current position. The marker lives
        // inside the <g>, so its local origin (0,0) sits at the current
        // translate — and the original position is at local x = orig - cur.
        // Direction of the arrow tells you which way the syllable moved
        // (left vs right). Color follows the source palette.
        if (show_outlines.value && isChanged) {
            const dxLocal = orig - cur;
            const marker = document.createElementNS(ns, 'g');
            marker.setAttribute('class', 'lyric-shift-marker');
            marker.setAttribute('pointer-events', 'none');
            const color = SOURCE_COLORS[source];
            // Vertical tick at the original position spanning roughly the
            // text x-height — visible at every reasonable zoom level.
            const tick = document.createElementNS(ns, 'line');
            tick.setAttribute('x1', dxLocal);
            tick.setAttribute('x2', dxLocal);
            tick.setAttribute('y1', bb.y);
            tick.setAttribute('y2', bb.y + bb.height);
            tick.setAttribute('stroke', color);
            tick.setAttribute('stroke-width', '0.35');
            marker.appendChild(tick);
            // Horizontal connector at the baseline from original → current.
            const arrow = document.createElementNS(ns, 'line');
            arrow.setAttribute('x1', dxLocal);
            arrow.setAttribute('x2', 0);
            arrow.setAttribute('y1', bb.y + bb.height + 0.6);
            arrow.setAttribute('y2', bb.y + bb.height + 0.6);
            arrow.setAttribute('stroke', color);
            arrow.setAttribute('stroke-width', '0.35');
            marker.appendChild(arrow);
            // Tiny arrowhead pointing at the current position. We approximate
            // it with a 2-segment chevron so we don't need a <defs><marker>.
            const headSize = 0.8;
            const dir = dxLocal >= 0 ? -1 : 1; // arrow head points from orig → current
            const ax = 0;
            const ay = bb.y + bb.height + 0.6;
            const head = document.createElementNS(ns, 'polyline');
            head.setAttribute(
                'points',
                `${ax - dir * headSize},${ay - headSize * 0.7} ${ax},${ay} ${ax - dir * headSize},${ay + headSize * 0.7}`,
            );
            head.setAttribute('fill', 'none');
            head.setAttribute('stroke', color);
            head.setAttribute('stroke-width', '0.35');
            marker.appendChild(head);
            g.appendChild(marker);
        }
    });
}

function moveSelected(delta) {
    const id = selected_id.value;
    if (!id) return;
    const cur = current_x.value.get(id) ?? 0;
    const next = cur + delta;
    current_x.value.set(id, next);
    // Reactively replace the map so Vue picks up the change (Map mutations
    // aren't reactive in Vue 3 without explicit replacement).
    current_x.value = new Map(current_x.value);
    // Update the SVG <g>'s transform to reflect the new x
    if (svg_container.value) {
        const g = svg_container.value.querySelector(`[data-lyric-id="${id}"]`);
        if (g) {
            const t = g.getAttribute('transform') || '';
            const m = t.match(/translate\s*\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*\)/);
            if (m) {
                g.setAttribute('transform', `translate(${next.toFixed(3)},${m[2]})`);
            }
        }
    }
    applyHighlights();
}

function onKeydown(e) {
    if (view_mode.value !== 'edit') return;
    if (!selected_id.value) return;
    // Alt = finer, Shift = coarser, neither = default. Alt wins over Shift if
    // both pressed.
    const amount = e.altKey ? fine_step.value : e.shiftKey ? big_step.value : step.value;
    if (e.key === 'ArrowLeft') {
        moveSelected(-amount);
        e.preventDefault();
    } else if (e.key === 'ArrowRight') {
        moveSelected(amount);
        e.preventDefault();
    } else if (e.key === 'Escape') {
        selected_id.value = null;
        applyHighlights();
        e.preventDefault();
    }
}

function selectLyric(id) {
    selected_id.value = id;
    applyHighlights();
    focusKbd();
}

function centerSelected() {
    const id = selected_id.value;
    if (!id) return;
    const l = lyrics.value.find((x) => x.id === id);
    if (!l) return;
    const cur = current_x.value.get(id) ?? 0;
    const delta = l.expectedX - cur;
    moveSelected(delta);
}

function resetLyric(l) {
    if (!l) return;
    const orig = original_x.value.get(l.id);
    if (orig === undefined) return;
    setLyricX(l, orig);
    current_x.value = new Map(current_x.value);
    applyHighlights();
}

function resetSelected() {
    const id = selected_id.value;
    if (!id) return;
    const l = lyrics.value.find((x) => x.id === id);
    resetLyric(l);
}

function resetAll() {
    for (const l of lyrics.value) {
        const orig = original_x.value.get(l.id);
        const cur = current_x.value.get(l.id);
        if (orig === undefined || cur === undefined) continue;
        if (Math.abs(cur - orig) <= 0.001) continue;
        setLyricX(l, orig);
    }
    current_x.value = new Map(current_x.value);
    applyHighlights();
}

const has_changes = computed(() => {
    for (const [id, x] of current_x.value.entries()) {
        const orig = original_x.value.get(id);
        if (orig === undefined) continue;
        if (Math.abs(x - orig) > 0.001) return true;
    }
    return false;
});

function setLyricX(l, newX) {
    current_x.value.set(l.id, newX);
    if (!svg_container.value) return;
    const g = svg_container.value.querySelector(`[data-lyric-id="${l.id}"]`);
    if (!g) return;
    const t = g.getAttribute('transform') || '';
    const m = t.match(/translate\s*\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*\)/);
    if (m) g.setAttribute('transform', `translate(${newX.toFixed(3)},${m[2]})`);
}

/**
 * After moving syllables, hyphens between them likely don't sit between word
 * halves any more. For each hyphen, find the nearest non-punct lyric to its
 * left and right on the same y-line (using *current* x positions), and put
 * the hyphen at the midpoint between left's right edge and right's left edge.
 */
function recenterHyphens() {
    // Snapshot lyrics with current x.
    const positioned = lyrics.value.map((l) => {
        const x = current_x.value.get(l.id) ?? l.x;
        return { ref: l, x, right: x + l.advance, y: l.y };
    });
    // Group by y (rounded so floating-point noise doesn't fragment lines).
    const lines = new Map();
    for (const p of positioned) {
        const key = Math.round(p.y * 10);
        if (!lines.has(key)) lines.set(key, []);
        lines.get(key).push(p);
    }
    for (const group of lines.values()) {
        group.sort((a, b) => a.x - b.x);
        for (let i = 0; i < group.length; i++) {
            const p = group[i];
            if (!p.ref.isPunctuation) continue;
            let left = null, right = null;
            for (let j = i - 1; j >= 0; j--) {
                if (!group[j].ref.isPunctuation) { left = group[j]; break; }
            }
            for (let j = i + 1; j < group.length; j++) {
                if (!group[j].ref.isPunctuation) { right = group[j]; break; }
            }
            if (!left || !right) continue;
            const mid = (left.right + right.x) / 2;
            const newX = mid - p.ref.advance / 2;
            // Skip near-no-op moves: avoids falsely flagging hyphens as
            // "geändert" when the recalc only shifts them by floating-point
            // dust (e.g. when surrounding syllables didn't actually move).
            const cur = current_x.value.get(p.ref.id) ?? p.ref.x;
            if (Math.abs(newX - cur) > 0.2) {
                setLyricX(p.ref, newX);
            }
        }
    }
}

function autoCorrectAll() {
    // Scope follows the visible list: when "nur verschobene anzeigen" is on we
    // only touch the initially-flagged ones; when it's off we recenter every
    // syllable that has a note (the user is asking for a full sweep).
    let moved = 0;
    for (const l of lyrics.value) {
        if (l.isPunctuation || !l.noteId) continue;
        if (hide_aligned.value && !l.misaligned) continue;
        setLyricX(l, l.expectedX);
        moved++;
    }
    recenterHyphens();
    current_x.value = new Map(current_x.value);
    applyHighlights();
    return moved;
}

function applyPdfToSelected() {
    const id = selected_id.value;
    if (!id || !pdf_x.value.has(id)) return;
    const l = lyrics.value.find((x) => x.id === id);
    if (!l) return;
    setLyricX(l, pdf_x.value.get(id));
    current_x.value = new Map(current_x.value);
    applyHighlights();
}

function applyPdfToAll() {
    if (pdf_x.value.size === 0) return;
    for (const [id, x] of pdf_x.value.entries()) {
        const l = lyrics.value.find((y) => y.id === id);
        if (!l) continue;
        if (Math.abs((current_x.value.get(id) ?? l.x) - x) < 0.001) continue;
        setLyricX(l, x);
    }
    current_x.value = new Map(current_x.value);
    applyHighlights();
}

const can_auto_correct = computed(() =>
    lyrics.value.some((l) => {
        if (l.isPunctuation || !l.noteId) return false;
        if (hide_aligned.value && !l.misaligned) return false;
        const cur = current_x.value.get(l.id) ?? l.x;
        return Math.abs(cur - l.expectedX) > 0.001;
    }),
);

const can_apply_pdf_all = computed(() => {
    if (pdf_x.value.size === 0) return false;
    for (const [id, x] of pdf_x.value.entries()) {
        const cur = current_x.value.get(id);
        if (cur === undefined) continue;
        if (Math.abs(cur - x) > 0.001) return true;
    }
    return false;
});
const can_apply_pdf_selected = computed(() => {
    const id = selected_id.value;
    if (!id || !pdf_x.value.has(id)) return false;
    const cur = current_x.value.get(id);
    return cur !== undefined && Math.abs(cur - pdf_x.value.get(id)) > 0.001;
});

function buildCorrectionsMap() {
    const out = new Map();
    for (const [id, x] of current_x.value.entries()) {
        const orig = original_x.value.get(id);
        if (orig === undefined) continue;
        if (Math.abs(x - orig) > 0.001) out.set(id, x);
    }
    return out;
}

async function save() {
    const corrections = buildCorrectionsMap();
    if (corrections.size === 0) {
        dialog_open.value = false;
        return;
    }
    const corrected = await applyCorrections(original_svg.value, corrections);
    emit('apply', { svgString: corrected, correctionCount: corrections.size });
    dialog_open.value = false;
}

function cancel() {
    dialog_open.value = false;
}

function cleanup() {
    original_svg.value = '';
    display_svg_edit.value = '';
    display_svg_original.value = '';
    display_svg_raw.value = '';
    lyrics.value = [];
    notes.value = [];
    current_x.value = new Map();
    original_x.value = new Map();
    pdf_x.value = new Map();
    pdf_align_status.value = 'idle';
    pdf_align_error.value = '';
    if (pdf_object_url.value) {
        URL.revokeObjectURL(pdf_object_url.value);
        pdf_object_url.value = '';
    }
    selected_id.value = null;
    zoom.value = 1;
}

onBeforeUnmount(() => {
    cleanup();
    if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onDialogKeydown);
    }
});

function devForLyric(l) {
    const cur = current_x.value.get(l.id) ?? l.x;
    return cur - l.expectedX;
}
function isChanged(l) {
    const cur = current_x.value.get(l.id);
    const orig = original_x.value.get(l.id);
    return cur !== undefined && orig !== undefined && Math.abs(cur - orig) > 0.001;
}
function sourceForLyric(l) {
    if (!isChanged(l)) return null;
    return correctionSource(l.id, current_x.value.get(l.id));
}
const SOURCE_LABELS = { pdf: 'PDF', note: 'Note', manual: 'Manuell' };
const SOURCE_CHIP_COLORS = { pdf: 'primary', note: 'success', manual: 'warning' };
</script>

<template>
    <v-dialog v-model="dialog_open" :max-width="show_pdf_side ? 1800 : 1200" width="95vw" scrollable>
        <v-card>
            <v-card-title class="d-flex align-center ga-3">
                <v-icon>mdi-vector-arrange-below</v-icon>
                <span class="text-truncate">Lyrics ausrichten – {{ title }}</span>
                <v-spacer />
                <v-tooltip
                    v-if="pdf_align_status === 'running'"
                    text="PDF-Referenz wird analysiert…"
                    location="bottom"
                >
                    <template #activator="{ props }">
                        <v-chip v-bind="props" size="small" color="info" variant="tonal" prepend-icon="mdi-progress-clock">
                            PDF…
                        </v-chip>
                    </template>
                </v-tooltip>
                <v-tooltip
                    v-else-if="pdf_align_status === 'done' && pdf_x.size > 0"
                    :text="`${pdf_x.size} Silben wurden anhand des PDF-Layouts automatisch ausgerichtet (blaue Markierung).`"
                    location="bottom"
                    max-width="340"
                >
                    <template #activator="{ props }">
                        <v-chip
                            v-bind="props"
                            size="small"
                            color="primary"
                            variant="tonal"
                            prepend-icon="mdi-file-pdf-box"
                        >
                            PDF: {{ pdf_x.size }} angewendet
                        </v-chip>
                    </template>
                </v-tooltip>
                <v-tooltip
                    v-else-if="pdf_align_status === 'error'"
                    :text="pdf_align_error || 'PDF-Ausrichtung fehlgeschlagen'"
                    location="bottom"
                    max-width="340"
                >
                    <template #activator="{ props }">
                        <v-chip v-bind="props" size="small" color="error" variant="tonal" prepend-icon="mdi-alert">
                            PDF-Fehler
                        </v-chip>
                    </template>
                </v-tooltip>
                <v-chip
                    v-if="!loading && lyrics.length"
                    size="small"
                    :color="misaligned_remaining > 0 ? 'warning' : 'success'"
                    variant="tonal"
                >
                    {{ misaligned_remaining }} / {{ misaligned_count }} verschoben
                </v-chip>
                <v-btn icon="mdi-close" variant="text" @click="cancel" />
            </v-card-title>
            <v-divider />

            <v-card-text class="pa-0">
                <div v-if="loading" class="d-flex justify-center align-center pa-8">
                    <v-progress-circular indeterminate color="primary" />
                </div>
                <div v-else-if="error_message" class="pa-4">
                    <v-alert type="error" variant="tonal">{{ error_message }}</v-alert>
                </div>
                <div v-else class="d-flex" style="overflow: hidden">
                    <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
                        <div class="d-flex align-center ga-2 pa-2 bg-grey-lighten-3" style="flex-shrink: 0">
                            <v-tooltip text="T oder Leertaste zum Umschalten" location="bottom">
                                <template #activator="{ props }">
                                    <v-btn-toggle
                                        v-bind="props"
                                        v-model="view_mode"
                                        density="compact"
                                        mandatory
                                        divided
                                        color="primary"
                                    >
                                        <v-btn value="edit" size="small">Bearbeiten</v-btn>
                                        <v-btn value="original" size="small">Original</v-btn>
                                        <v-btn value="raw" size="small">Roh</v-btn>
                                    </v-btn-toggle>
                                </template>
                            </v-tooltip>
                            <v-tooltip text="Ansicht wechseln (T oder Leertaste)" location="bottom">
                                <template #activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon="mdi-swap-horizontal"
                                        size="small"
                                        variant="text"
                                        @click="toggleViewMode"
                                    />
                                </template>
                            </v-tooltip>
                            <v-spacer />
                            <v-btn
                                icon="mdi-magnify-minus-outline"
                                size="small"
                                variant="text"
                                :disabled="zoom <= ZOOM_MIN"
                                @click="zoomOut"
                            />
                            <span class="text-caption" style="min-width: 48px; text-align: center">
                                {{ Math.round(zoom * 100) }}%
                            </span>
                            <v-btn
                                icon="mdi-magnify-plus-outline"
                                size="small"
                                variant="text"
                                :disabled="zoom >= ZOOM_MAX"
                                @click="zoomIn"
                            />
                            <v-btn
                                icon="mdi-magnify-close"
                                size="small"
                                variant="text"
                                :disabled="zoom === 1"
                                @click="zoomReset"
                            />
                            <v-tooltip :text="show_outlines ? 'Markierungen ausblenden' : 'Markierungen einblenden'" location="bottom">
                                <template #activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        :icon="show_outlines ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                                        size="small"
                                        variant="text"
                                        @click="show_outlines = !show_outlines"
                                    />
                                </template>
                            </v-tooltip>
                            <v-tooltip
                                v-if="pdf_object_url"
                                :text="show_pdf_side ? 'PDF-Referenz ausblenden' : 'PDF-Referenz neben dem SVG einblenden'"
                                location="bottom"
                            >
                                <template #activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        :color="show_pdf_side ? 'primary' : undefined"
                                        prepend-icon="mdi-file-pdf-box"
                                        size="small"
                                        variant="text"
                                        @click="show_pdf_side = !show_pdf_side"
                                    >
                                        PDF
                                    </v-btn>
                                </template>
                            </v-tooltip>
                            <v-tooltip text="Strg/⌘ + Mausrad zum Zoomen, Mittelklick oder Drag (bei Zoom > 1) zum Verschieben" location="bottom">
                                <template #activator="{ props }">
                                    <v-icon v-bind="props" size="small">mdi-help-circle-outline</v-icon>
                                </template>
                            </v-tooltip>
                        </div>
                        <div class="zoom-outer">
                            <div
                                ref="svg_container"
                                tabindex="0"
                                class="zoom-scroll outline-none"
                                :class="{
                                    'is-zoomed': zoom > 1,
                                    'is-panning': is_panning,
                                }"
                                @keydown="onKeydown"
                                @wheel="onWheel"
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
                                    v-html="currentSvgString"
                                ></div>
                            </div>
                        </div>
                    </div>
                    <template v-if="show_pdf_side && pdf_object_url">
                        <v-divider vertical />
                        <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
                            <div class="d-flex align-center ga-2 pa-2 bg-grey-lighten-3" style="flex-shrink: 0">
                                <v-icon size="small">mdi-file-pdf-box</v-icon>
                                <span class="text-caption font-weight-medium">PDF-Referenz</span>
                                <v-spacer />
                                <v-tooltip text="PDF-Bereich schließen" location="bottom">
                                    <template #activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            icon="mdi-close"
                                            size="x-small"
                                            variant="text"
                                            @click="show_pdf_side = false"
                                        />
                                    </template>
                                </v-tooltip>
                            </div>
                            <div class="pdf-side-render">
                                <!-- Native PDF viewer with its own zoom +
                                     scroll. FitH starts the page at full
                                     width; the browser's PDF toolbar (kept
                                     enabled) gives the user zoom in/out and
                                     pan. We only hide the sidebar / navpanes
                                     since they're useless for a single page. -->
                                <embed
                                    :src="`${pdf_object_url}#view=FitH&navpanes=0`"
                                    type="application/pdf"
                                />
                            </div>
                        </div>
                    </template>
                    <v-divider vertical />
                    <div
                        class="d-flex flex-column"
                        style="width: 360px; flex-shrink: 0; max-height: 80vh; overflow: hidden"
                    >
                        <div class="pa-3 d-flex flex-column ga-2">
                            <v-btn
                                v-if="pdf_x.size > 0"
                                color="primary"
                                size="small"
                                prepend-icon="mdi-file-pdf-box"
                                :disabled="!can_apply_pdf_all"
                                @click="applyPdfToAll"
                            >
                                Alle auf PDF-Position setzen
                            </v-btn>
                            <v-btn
                                :color="pdf_x.size > 0 ? undefined : 'primary'"
                                :variant="pdf_x.size > 0 ? 'tonal' : 'elevated'"
                                size="small"
                                prepend-icon="mdi-auto-fix"
                                :disabled="!can_auto_correct"
                                @click="autoCorrectAll"
                            >
                                Alle automatisch zentrieren
                            </v-btn>
                            <v-btn
                                size="small"
                                variant="tonal"
                                prepend-icon="mdi-restore"
                                :disabled="!has_changes"
                                @click="resetAll"
                            >
                                Alle Änderungen zurücksetzen
                            </v-btn>
                            <v-switch
                                v-model="hide_aligned"
                                density="compact"
                                hide-details
                                label="Nur verschobene anzeigen"
                            />
                            <div class="text-caption text-medium-emphasis">
                                Silbe anklicken, dann ← → (Shift = grob, Alt = fein)
                            </div>
                        </div>
                        <v-divider />
                        <div class="overflow-auto flex-grow-1">
                            <v-list density="compact" lines="two">
                                <v-list-item
                                    v-for="l in filtered_lyrics"
                                    :key="l.id"
                                    :active="selected_id === l.id"
                                    @click="selectLyric(l.id)"
                                >
                                    <v-list-item-title class="text-body-2">
                                        {{ l.text }}
                                        <v-chip
                                            v-if="sourceForLyric(l)"
                                            size="x-small"
                                            :color="SOURCE_CHIP_COLORS[sourceForLyric(l)]"
                                            variant="tonal"
                                            class="ml-2"
                                        >
                                            {{ SOURCE_LABELS[sourceForLyric(l)] }}
                                        </v-chip>
                                    </v-list-item-title>
                                    <v-list-item-subtitle class="text-caption">
                                        Abweichung: {{ devForLyric(l).toFixed(2) }}
                                    </v-list-item-subtitle>
                                    <template #append>
                                        <v-tooltip text="Auf Original zurücksetzen" location="left">
                                            <template #activator="{ props }">
                                                <v-btn
                                                    v-bind="props"
                                                    icon="mdi-restore"
                                                    size="x-small"
                                                    variant="text"
                                                    :disabled="!isChanged(l)"
                                                    @click.stop="resetLyric(l)"
                                                />
                                            </template>
                                        </v-tooltip>
                                    </template>
                                </v-list-item>
                                <v-list-item v-if="filtered_lyrics.length === 0">
                                    <v-list-item-title class="text-body-2 text-medium-emphasis">
                                        Keine Einträge.
                                    </v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </div>
                        <v-divider />
                        <div v-if="selected_id" class="pa-3 d-flex ga-2 flex-wrap">
                            <v-btn
                                v-if="pdf_x.has(selected_id)"
                                size="x-small"
                                color="primary"
                                variant="tonal"
                                prepend-icon="mdi-file-pdf-box"
                                :disabled="!can_apply_pdf_selected"
                                @click="applyPdfToSelected"
                            >
                                Auf PDF setzen
                            </v-btn>
                            <v-btn
                                size="x-small"
                                variant="tonal"
                                prepend-icon="mdi-target"
                                @click="centerSelected"
                            >
                                Auf Note zentrieren
                            </v-btn>
                            <v-btn
                                size="x-small"
                                variant="tonal"
                                prepend-icon="mdi-restore"
                                @click="resetSelected"
                            >
                                Zurücksetzen
                            </v-btn>
                        </div>
                    </div>
                </div>
            </v-card-text>
            <v-divider />
            <v-card-actions>
                <v-spacer />
                <v-btn @click="cancel">Abbrechen</v-btn>
                <v-btn
                    color="primary"
                    :disabled="loading || buildCorrectionsMap().size === 0"
                    @click="save"
                >
                    Korrigiertes SVG übernehmen
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.outline-none:focus {
    outline: 2px solid #1976d2;
    outline-offset: -2px;
}

/* Same zoom pattern as SvgBakeCompareDialog: fixed-size outer with
 * absolutely-positioned scroll inside. The wrapper grows past 100% on zoom,
 * triggering native scrollbars — and because outer is fixed-size, the dialog
 * layout can't shift when zoomed. */
.zoom-outer {
    position: relative;
    width: 100%;
    height: 70vh;
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
    padding: 8px;
    box-sizing: border-box;
}
.zoom-wrapper :deep(svg) {
    display: block;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
}
/* PDF-Referenz side panel — sized to the same 70vh as zoom-outer so the SVG
 * and PDF columns line up visually. The native PDF viewer fills it. */
.pdf-side-render {
    position: relative;
    flex: 1 1 auto;
    width: 100%;
    height: 70vh;
    background: #fff;
}
.pdf-side-render embed {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
}
</style>
