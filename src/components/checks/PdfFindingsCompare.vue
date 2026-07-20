<script setup>
// A/B-Abgleich: links die Prüf-Befunde, rechts ein virtualisierter PDF-Scroller.
// Jede Seite bekommt einen Slot mit bekannter Höhe (aus pageSizes); gerendert
// wird per Canvas nur, was gerade sichtbar ist (IntersectionObserver). Das
// bereits geladene PDF-Dokument (pdfDoc, vom @loaded-Event) wird wiederverwendet
// – kein erneutes Laden/Parsen der ganzen Datei. Auf jeder Seite liegt ein
// SVG-Overlay mit den Befund-Kästen; eine Linie verbindet den ausgewählten
// Befund mit seinem Kasten.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { diffTokens } from '@/assets/js/textDiff.js';
import { useDruckCheckAcks } from '@/assets/js/druckCheckAcks.js';
import NotenCompareDialog from '@/components/checks/NotenCompareDialog.vue';

const props = defineProps({
    pdfDoc: { type: Object, default: null },
    checks: { type: Array, required: true },
    pageSizes: { type: Object, required: true },
    pageCount: { type: Number, required: true },
});
const emit = defineEmits(['open-song']);

const SEV = {
    error: { color: '#e5393533', stroke: '#e53935', icon: 'mdi-alert-circle', rank: 0 },
    warning: { color: '#fb8c0033', stroke: '#fb8c00', icon: 'mdi-alert', rank: 1 },
    info: { color: '#1e88e533', stroke: '#1e88e5', icon: 'mdi-information', rank: 2 },
    ok: { color: '#43a04733', stroke: '#43a047', icon: 'mdi-check-circle', rank: 3 },
};

const acks = useDruckCheckAcks();
const showInfo = ref(false);
const showAcked = ref(false);

// Vollbild: Der Abgleich lebt vom Platz (links die Befunde, rechts die Seite).
// Escape schließt wieder – die Tastenbindung hängt nur im Vollbild am Fenster.
const fullscreen = ref(false);
function onKeydown(e) {
    if (e.key === 'Escape' && fullscreen.value) fullscreen.value = false;
}
function toggleFullscreen() {
    fullscreen.value = !fullscreen.value;
    // Breite/Maßstab neu messen, sobald das Layout steht (der ResizeObserver auf
    // dem Scroller feuert dann ohnehin, aber der Connector soll sofort sitzen).
    nextTick(scheduleConnector);
}

const findings = computed(() => {
    const out = [];
    for (const c of props.checks) {
        // Items ohne offenen Status trotzdem berücksichtigen, wenn sie bestätigt
        // wurden (damit der „Bestätigt"-Bereich sie zeigen kann).
        for (let idx = 0; idx < c.items.length; idx++) {
            const it = c.items[idx];
            const sev = it.sev || c.status;
            if (sev === 'ok') continue;
            out.push({
                key: `${c.id}:${idx}`,
                fp: it.fp || null,
                checkId: c.id,
                checkTitle: c.title,
                sev,
                title: it.title,
                detail: it.detail,
                pdf: it.pdf ?? null,
                expected: it.expected ?? null,
                nummer: it.nummer,
                id: it.id,
                loc: it.loc || null,
                // Maß-Annotation (Strophen-Abstand): im Overlay ein Doppelpfeil
                // statt eines Kastens, `dim.pt` ist der gemessene Wert.
                dim: it.dim || null,
                // Einzelne Fundstellen (z. B. je abweichendes Notenzeichen) – im
                // Overlay als kleine Kästen, der Verbindungspunkt bleibt `loc`.
                locs: it.locs || null,
                // Dieselben Fundstellen in DB-Koordinaten – fürs Overlay auf der
                // Original-Seite im Vergleichs-Dialog.
                originalLocs: it.originalLocs || null,
                // Datei-Id der DB-Notensatz-PDF für den Vergleichs-Dialog.
                notentextId: it.notentextId || null,
            });
        }
    }
    out.sort((a, b) => {
        const pa = a.loc?.page ?? 1e9;
        const pb = b.loc?.page ?? 1e9;
        if (pa !== pb) return pa - pb;
        return (SEV[a.sev]?.rank ?? 9) - (SEV[b.sev]?.rank ?? 9);
    });
    return out;
});
const shownBySeverity = (f) => showInfo.value || f.sev === 'error' || f.sev === 'warning';
const visibleFindings = computed(() =>
    findings.value.filter((f) => f.loc && shownBySeverity(f) && !acks.isAcked(f.fp)),
);
const ackedFindings = computed(() => findings.value.filter((f) => f.loc && acks.isAcked(f.fp)));
// Findet-Kästen auf den Seiten: offene Befunde plus (falls eingeblendet) bestätigte.
const displayedFindings = computed(() =>
    showAcked.value ? [...visibleFindings.value, ...ackedFindings.value] : visibleFindings.value,
);

// Befunde eines Liedes gehören zusammen: ein falsch gesetzter Satz erzeugt oft
// mehrere Befunde (Strophentext + Strophen-Vollständigkeit + Fußzeile). Sie
// werden deshalb als ein Block gezeigt und lassen sich gemeinsam bestätigen.
// Befunde ohne Lied (leere Seiten, Reihenfolge …) landen in einer eigenen Gruppe.
const groups = computed(() => {
    const map = new Map();
    for (const f of visibleFindings.value) {
        const key = f.id != null ? `id:${f.id}` : f.nummer != null ? `nr:${f.nummer}` : 'ohne';
        let g = map.get(key);
        if (!g) {
            g = {
                key,
                id: f.id,
                nummer: f.nummer,
                title: '',
                findings: [],
                page: Infinity,
                sev: f.sev,
            };
            map.set(key, g);
        }
        g.findings.push(f);
        // Liedtitel steht in den Befunden, die nicht auf eine Strophe zeigen
        // („Lied 24 · Strophe 3" ist kein Titel).
        if (!g.title && f.title && !/^Lied\s+\S+\s+·/.test(f.title)) g.title = f.title;
        if ((SEV[f.sev]?.rank ?? 9) < (SEV[g.sev]?.rank ?? 9)) g.sev = f.sev;
        g.page = Math.min(g.page, f.loc?.page ?? Infinity);
    }
    return [...map.values()].sort(
        (a, b) => a.page - b.page || (SEV[a.sev]?.rank ?? 9) - (SEV[b.sev]?.rank ?? 9),
    );
});

const collapsed = ref(new Set());
function toggleGroup(g) {
    const next = new Set(collapsed.value);
    if (next.has(g.key)) next.delete(g.key);
    else next.add(g.key);
    collapsed.value = next;
    nextTick(scheduleConnector);
}
function ackGroup(g) {
    acks.setAcked(
        g.findings.map((f) => f.fp),
        true,
    );
    if (g.findings.some((f) => f.key === selectedKey.value)) selectedKey.value = null;
    nextTick(scheduleConnector);
}

function isCompare(f) {
    return f && (f.pdf != null || f.expected != null);
}
function diffOf(f) {
    return diffTokens(f.pdf || '', f.expected || '');
}
function rowDetail(f) {
    if (isCompare(f)) return (f.pdf || '').replace(/\s+/g, ' ').trim();
    return f.detail ? f.detail.split(' | ')[0] : '';
}
function fullDetail(f) {
    return (f.detail || '').split(' | ').join('\n');
}

function ackFinding(f) {
    // Vor dem Ausblenden den nächsten offenen Befund merken, um dorthin zu springen.
    const list = visibleFindings.value;
    const i = list.findIndex((x) => x.key === f.key);
    const next = list[i + 1] || list[i - 1] || null;
    acks.toggle(f.fp);
    if (selectedKey.value === f.key) {
        if (next) select(next);
        else selectedKey.value = null;
    }
    nextTick(scheduleConnector);
}
function unackFinding(f) {
    acks.toggle(f.fp);
    nextTick(scheduleConnector);
}

const selectedKey = ref(null);
const selectedFinding = computed(
    () => findings.value.find((f) => f.key === selectedKey.value) || null,
);

// --- Seiten / Maßstab ------------------------------------------------------
const pages = computed(() => Array.from({ length: props.pageCount }, (_, i) => i + 1));
function pageSize(p) {
    return props.pageSizes[p] || { width: 311.811, height: 481.89 };
}
const refWidth = computed(() => {
    let m = 0;
    for (const p of pages.value) m = Math.max(m, pageSize(p).width);
    return m || 311.811;
});
const paneWidth = ref(600);
const scale = computed(() => Math.max(0.2, (paneWidth.value - 28) / refWidth.value));
// Kästen einer Seite: hat ein Befund Einzel-Fundstellen (`locs`), werden die
// gezeigt (z. B. je abweichendes Notenzeichen ein Kasten) – sonst der eine
// `loc`-Kasten. So markiert das Overlay die genauen Stellen statt eines großen
// Rahmens; die Verbindungslinie hängt weiter an `loc`.
function boxesForPage(p) {
    const out = [];
    for (const f of displayedFindings.value) {
        if (f.locs && f.locs.length) {
            for (let i = 0; i < f.locs.length; i++) {
                const l = f.locs[i];
                if (l.page === p) out.push({ boxKey: `${f.key}#${i}`, f, rect: l.rect });
            }
        } else if (f.loc && f.loc.page === p && !f.dim) {
            out.push({ boxKey: `${f.key}#loc`, f, rect: f.loc.rect });
        }
    }
    return out;
}

// Maß-Annotationen (Strophen-Abstand): statt eines Kastens ein senkrechter
// Doppelpfeil (↕) im Zwischenraum, mit Grenzlinien (Unter-/Oberkante der beiden
// Strophen) und dem gemessenen Wert beschriftet.
const AH = 1.5; // halbe Pfeilspitzen-Größe (pt)
function dimsForPage(p) {
    const out = [];
    for (const f of displayedFindings.value) {
        if (f.dim && f.loc && f.loc.page === p) {
            out.push({ boxKey: `${f.key}#dim`, f, rect: f.loc.rect, pt: f.dim.pt });
        }
    }
    return out;
}
// x-Position der Maßlinie: leicht vom linken Rand der Strophe eingerückt.
function dimX(rect) {
    return rect.x + Math.min(10, rect.w * 0.2);
}
// Pfeilspitze nach oben (Scheitel bei y) bzw. nach unten – als Polygon-Punkte.
function arrowUp(x, y) {
    return `${x},${y} ${x - AH},${y + AH * 1.6} ${x + AH},${y + AH * 1.6}`;
}
function arrowDown(x, y) {
    return `${x},${y} ${x - AH},${y - AH * 1.6} ${x + AH},${y - AH * 1.6}`;
}
function fmtDim(pt) {
    return `${pt.toFixed(1).replace('.', ',')} pt`;
}

const backendUrl = import.meta.env.VITE_BACKEND_URL;
// Vergleichs-Dialog: Druck-Seite und Original-Notensatz nebeneinander, beide mit
// den markierten Fundstellen.
const compareOpen = ref(false);
const compareFinding = ref(null);
function openOriginal(f) {
    if (!f.notentextId) return;
    compareFinding.value = f;
    compareOpen.value = true;
}

// --- DOM-Refs & Rendering --------------------------------------------------
const compareEl = ref(null);
const findingsEl = ref(null);
const scrollEl = ref(null);
const slotEls = new Map();
const canvasEls = new Map();
function setSlot(el, p) {
    if (el) {
        el.dataset.page = String(p);
        slotEls.set(p, el);
        io?.observe(el);
    } else {
        slotEls.delete(p);
    }
}
function setCanvas(el, p) {
    if (el) canvasEls.set(p, el);
    else canvasEls.delete(p);
}

const rendered = new Set();
const renderTasks = new Map();
const renderToken = new Map();
const intersecting = new Set();
let io = null;
let ro = null;
let rafId = null;

async function renderPage(p) {
    if (rendered.has(p) || !props.pdfDoc) return;
    const canvas = canvasEls.get(p);
    if (!canvas) return;
    const token = {};
    renderToken.set(p, token);
    let page;
    try {
        page = await props.pdfDoc.getPage(p);
    } catch {
        return;
    }
    if (renderToken.get(p) !== token) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vp = page.getViewport({ scale: scale.value * dpr });
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
    renderTasks.set(p, task);
    try {
        await task.promise;
    } catch {
        return; // abgebrochen
    }
    if (renderToken.get(p) !== token) return;
    renderTasks.delete(p);
    rendered.add(p);
}
function clearPage(p) {
    const t = renderTasks.get(p);
    if (t) {
        try {
            t.cancel();
        } catch {
            /* ignore */
        }
        renderTasks.delete(p);
    }
    renderToken.delete(p);
    rendered.delete(p);
    const c = canvasEls.get(p);
    if (c) {
        c.width = 0;
        c.height = 0;
    }
}

function updatePaneWidth() {
    if (scrollEl.value) paneWidth.value = scrollEl.value.clientWidth;
}

// --- Auswahl / Scrollen / Verbindungslinie ---------------------------------
const connector = ref(null);
const connectorPath = computed(() => {
    const c = connector.value;
    if (!c) return '';
    const dx = Math.max(24, (c.x2 - c.x1) / 2);
    return `M ${c.x1} ${c.y1} C ${c.x1 + dx} ${c.y1}, ${c.x2 - dx} ${c.y2}, ${c.x2} ${c.y2}`;
});
function recomputeConnector() {
    const f = selectedFinding.value;
    if (!f || !f.loc || !compareEl.value || !scrollEl.value) {
        connector.value = null;
        return;
    }
    const slot = slotEls.get(f.loc.page);
    const rowEl = compareEl.value.querySelector('.finding-row.selected');
    if (!slot || !rowEl) {
        connector.value = null;
        return;
    }
    const cRect = compareEl.value.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const scRect = scrollEl.value.getBoundingClientRect();
    const s = scale.value;
    const r = f.loc.rect;
    const boxCenterY = slotRect.top + (r.y + r.h / 2) * s;
    if (boxCenterY < scRect.top - 4 || boxCenterY > scRect.bottom + 4) {
        connector.value = null; // Kasten außerhalb des sichtbaren Bereichs
        return;
    }
    connector.value = {
        x1: rowRect.right - cRect.left,
        y1: rowRect.top + rowRect.height / 2 - cRect.top,
        x2: slotRect.left + r.x * s - cRect.left,
        y2: boxCenterY - cRect.top,
    };
}
function scheduleConnector() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
        rafId = null;
        recomputeConnector();
    });
}

function scrollToFinding(f) {
    if (!f?.loc || !scrollEl.value) return;
    const slot = slotEls.get(f.loc.page);
    if (!slot) return;
    const top = slot.offsetTop + f.loc.rect.y * scale.value - 90;
    scrollEl.value.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
function select(f) {
    selectedKey.value = f.key;
    scrollToFinding(f);
    nextTick(scheduleConnector);
}
function autoSelectFirst() {
    const first = visibleFindings.value[0];
    if (first) select(first);
}

watch(scale, () => {
    for (const p of [...rendered]) clearPage(p);
    for (const p of intersecting) renderPage(p);
    scheduleConnector();
});
watch(visibleFindings, () => {
    if (!selectedFinding.value) autoSelectFirst();
});

onMounted(() => {
    updatePaneWidth();
    io = new IntersectionObserver(
        (entries) => {
            for (const e of entries) {
                const p = Number(e.target.dataset.page);
                if (e.isIntersecting) {
                    intersecting.add(p);
                    renderPage(p);
                } else {
                    intersecting.delete(p);
                    clearPage(p);
                }
            }
        },
        { root: scrollEl.value, rootMargin: '700px 0px', threshold: 0 },
    );
    for (const el of slotEls.values()) io.observe(el);

    ro = new ResizeObserver(() => {
        updatePaneWidth();
        scheduleConnector();
    });
    if (scrollEl.value) ro.observe(scrollEl.value);
    scrollEl.value?.addEventListener('scroll', scheduleConnector, { passive: true });
    findingsEl.value?.addEventListener('scroll', scheduleConnector, { passive: true });
    window.addEventListener('resize', scheduleConnector);
    window.addEventListener('keydown', onKeydown);

    nextTick(() => {
        updatePaneWidth();
        autoSelectFirst();
    });
});
onBeforeUnmount(() => {
    io?.disconnect();
    ro?.disconnect();
    for (const t of renderTasks.values()) {
        try {
            t.cancel();
        } catch {
            /* ignore */
        }
    }
    scrollEl.value?.removeEventListener('scroll', scheduleConnector);
    findingsEl.value?.removeEventListener('scroll', scheduleConnector);
    window.removeEventListener('resize', scheduleConnector);
    window.removeEventListener('keydown', onKeydown);
    if (rafId) cancelAnimationFrame(rafId);
});
</script>

<template>
    <div ref="compareEl" class="compare" :class="{ 'compare--fullscreen': fullscreen }">
        <!-- Linke Spalte: Befunde -->
        <div ref="findingsEl" class="findings">
            <div class="findings-toolbar">
                <v-switch
                    v-model="showInfo"
                    label="Hinweise/Übersicht anzeigen"
                    color="primary"
                    hide-details
                    density="compact"
                />
                <v-spacer />
                <v-btn
                    :icon="fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
                    size="small"
                    variant="text"
                    :title="fullscreen ? 'Vollbild verlassen (Esc)' : 'Vollbild'"
                    @click="toggleFullscreen"
                />
            </div>
            <div v-for="g in groups" :key="g.key" class="finding-group">
                <!-- Kopfzeile eines Liedes: alle seine Befunde auf einen Blick,
                     mit „alles bestätigen" für den ganzen Block. -->
                <div class="group-header" @click="toggleGroup(g)">
                    <v-icon size="small">
                        {{ collapsed.has(g.key) ? 'mdi-chevron-right' : 'mdi-chevron-down' }}
                    </v-icon>
                    <v-icon size="small" :color="SEV[g.sev]?.stroke">{{ SEV[g.sev]?.icon }}</v-icon>
                    <v-chip v-if="g.nummer" size="x-small" color="primary" variant="tonal">
                        {{ g.nummer }}
                    </v-chip>
                    <span class="group-title">{{ g.title || 'Ohne Lied' }}</span>
                    <span class="group-count">
                        {{ g.findings.length }}
                        {{ g.findings.length === 1 ? 'Befund' : 'Befunde' }} · Seite {{ g.page }}
                    </span>
                    <v-btn
                        icon="mdi-check-all"
                        size="x-small"
                        variant="text"
                        :title="
                            g.findings.length === 1
                                ? 'Befund bestätigen und ausblenden'
                                : 'Alle Befunde dieses Liedes bestätigen und ausblenden'
                        "
                        @click.stop="ackGroup(g)"
                    />
                    <v-btn
                        v-if="g.id != null"
                        icon="mdi-open-in-app"
                        size="x-small"
                        variant="text"
                        title="Lied öffnen"
                        @click.stop="emit('open-song', g.id)"
                    />
                </div>

                <template v-if="!collapsed.has(g.key)">
                    <div
                        v-for="f in g.findings"
                        :key="f.key"
                        class="finding-row"
                        :class="{ selected: f.key === selectedKey }"
                        :style="{ '--sev': SEV[f.sev]?.stroke }"
                        @click="select(f)"
                    >
                        <v-icon size="small" :color="SEV[f.sev]?.stroke">{{
                            SEV[f.sev]?.icon
                        }}</v-icon>
                        <div class="finding-body">
                            <div class="finding-title">{{ f.checkTitle }}</div>
                            <div class="finding-sub">{{ f.title }}</div>

                            <!-- Vergleichs-Befund (Fußzeile / Strophe): PDF vs. Erwartet als
                         Blöcke mit farbig markierten Wort-Unterschieden. -->
                            <template v-if="f.key === selectedKey && isCompare(f)">
                                <div class="diff-block">
                                    <div class="diff-label">PDF (aus Druck)</div>
                                    <div class="diff-text">
                                        <span
                                            v-for="(seg, i) in diffOf(f).left"
                                            :key="i"
                                            :class="{ 'diff-del': seg.changed && seg.text.trim() }"
                                            >{{ seg.text }}</span
                                        >
                                    </div>
                                </div>
                                <div class="diff-block">
                                    <div class="diff-label">Erwartet (aus DB)</div>
                                    <div class="diff-text">
                                        <span
                                            v-for="(seg, i) in diffOf(f).right"
                                            :key="i"
                                            :class="{ 'diff-add': seg.changed && seg.text.trim() }"
                                            >{{ seg.text }}</span
                                        >
                                    </div>
                                </div>
                            </template>
                            <div
                                v-else-if="f.detail"
                                class="finding-detail"
                                :class="{ 'finding-detail--full': f.key === selectedKey }"
                            >
                                {{ f.key === selectedKey ? fullDetail(f) : rowDetail(f) }}
                            </div>

                            <div class="finding-meta">
                                <span v-if="f.loc">Seite {{ f.loc.page }}</span>
                            </div>
                        </div>
                        <div class="finding-actions">
                            <!-- Lied öffnen sitzt in der Gruppen-Kopfzeile. -->
                            <v-btn
                                v-if="f.notentextId"
                                icon="mdi-compare"
                                size="x-small"
                                variant="text"
                                title="Vergleich öffnen: Druck und Original nebeneinander"
                                @click.stop="openOriginal(f)"
                            />
                            <v-btn
                                icon="mdi-check-circle-outline"
                                size="x-small"
                                variant="text"
                                title="Nur diesen Befund bestätigen und ausblenden"
                                @click.stop="ackFinding(f)"
                            />
                        </div>
                    </div>
                </template>
            </div>
            <div v-if="!visibleFindings.length" class="pa-4 text-medium-emphasis text-center">
                Keine offenen Befunde in dieser Ansicht.
            </div>

            <!-- Bestätigte (ausgeblendete) Befunde -->
            <div v-if="ackedFindings.length" class="acked-section">
                <div class="acked-header" @click="showAcked = !showAcked">
                    <v-icon size="small">
                        {{ showAcked ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                    </v-icon>
                    <v-icon size="small" color="success">mdi-check-circle</v-icon>
                    <span>Bestätigt / ausgeblendet ({{ ackedFindings.length }})</span>
                </div>
                <template v-if="showAcked">
                    <div
                        v-for="f in ackedFindings"
                        :key="f.key"
                        class="finding-row acked"
                        :class="{ selected: f.key === selectedKey }"
                        @click="select(f)"
                    >
                        <v-icon size="small" color="success">mdi-check-circle</v-icon>
                        <div class="finding-body">
                            <div class="finding-title">
                                <v-chip
                                    v-if="f.nummer"
                                    size="x-small"
                                    color="primary"
                                    variant="tonal"
                                >
                                    {{ f.nummer }}
                                </v-chip>
                                {{ f.checkTitle }}
                            </div>
                            <div class="finding-sub">{{ f.title }}</div>
                            <div class="finding-meta">
                                <span v-if="f.loc">Seite {{ f.loc.page }}</span>
                            </div>
                        </div>
                        <v-btn
                            icon="mdi-restore"
                            size="x-small"
                            variant="text"
                            title="Bestätigung zurücknehmen"
                            @click.stop="unackFinding(f)"
                        />
                    </div>
                </template>
            </div>
        </div>

        <!-- Rechte Spalte: virtualisierter PDF-Scroller -->
        <div ref="scrollEl" class="pdf-scroll">
            <div
                v-for="p in pages"
                :key="p"
                :ref="(el) => setSlot(el, p)"
                class="page-slot"
                :style="{
                    width: pageSize(p).width * scale + 'px',
                    height: pageSize(p).height * scale + 'px',
                }"
            >
                <canvas :ref="(el) => setCanvas(el, p)" class="page-canvas" />
                <svg
                    class="box-overlay"
                    :viewBox="`0 0 ${pageSize(p).width} ${pageSize(p).height}`"
                    preserveAspectRatio="none"
                >
                    <rect
                        v-for="b in boxesForPage(p)"
                        :key="b.boxKey"
                        :x="b.rect.x"
                        :y="b.rect.y"
                        :width="b.rect.w"
                        :height="b.rect.h"
                        :fill="b.f.key === selectedKey ? SEV[b.f.sev]?.color : 'transparent'"
                        :stroke="SEV[b.f.sev]?.stroke"
                        :stroke-width="b.f.key === selectedKey ? 1.6 : 0.7"
                        :stroke-dasharray="b.f.key === selectedKey ? '0' : '2 2'"
                        :opacity="b.f.key === selectedKey ? 1 : 0.5"
                        rx="1.5"
                    />
                    <!-- Strophen-Abstand: Doppelpfeil im Zwischenraum statt Kasten. -->
                    <g
                        v-for="d in dimsForPage(p)"
                        :key="d.boxKey"
                        :opacity="d.f.key === selectedKey ? 1 : 0.7"
                    >
                        <rect
                            v-if="d.f.key === selectedKey"
                            :x="d.rect.x"
                            :y="d.rect.y"
                            :width="d.rect.w"
                            :height="d.rect.h"
                            :fill="SEV[d.f.sev]?.color"
                            rx="1"
                        />
                        <!-- Grenzlinien: Unterkante obere Strophe, Oberkante untere Strophe. -->
                        <line
                            :x1="d.rect.x"
                            :y1="d.rect.y"
                            :x2="d.rect.x + d.rect.w"
                            :y2="d.rect.y"
                            :stroke="SEV[d.f.sev]?.stroke"
                            stroke-width="0.35"
                            stroke-dasharray="2 1.5"
                        />
                        <line
                            :x1="d.rect.x"
                            :y1="d.rect.y + d.rect.h"
                            :x2="d.rect.x + d.rect.w"
                            :y2="d.rect.y + d.rect.h"
                            :stroke="SEV[d.f.sev]?.stroke"
                            stroke-width="0.35"
                            stroke-dasharray="2 1.5"
                        />
                        <!-- Maßlinie mit Doppelpfeil (↕). -->
                        <line
                            :x1="dimX(d.rect)"
                            :y1="d.rect.y"
                            :x2="dimX(d.rect)"
                            :y2="d.rect.y + d.rect.h"
                            :stroke="SEV[d.f.sev]?.stroke"
                            :stroke-width="d.f.key === selectedKey ? 0.8 : 0.5"
                        />
                        <polygon
                            :points="arrowUp(dimX(d.rect), d.rect.y)"
                            :fill="SEV[d.f.sev]?.stroke"
                        />
                        <polygon
                            :points="arrowDown(dimX(d.rect), d.rect.y + d.rect.h)"
                            :fill="SEV[d.f.sev]?.stroke"
                        />
                        <text
                            :x="dimX(d.rect) + 3"
                            :y="d.rect.y + d.rect.h / 2"
                            :fill="SEV[d.f.sev]?.stroke"
                            font-size="6"
                            dominant-baseline="middle"
                            paint-order="stroke"
                            stroke="#fff"
                            stroke-width="1"
                            style="font-weight: 700"
                        >
                            {{ fmtDim(d.pt) }}
                        </text>
                    </g>
                </svg>
                <div class="page-label">{{ p }}</div>
            </div>
        </div>

        <!-- Verbindungslinie -->
        <svg v-if="connector" class="connector">
            <path
                :d="connectorPath"
                fill="none"
                :stroke="SEV[selectedFinding?.sev]?.stroke || '#888'"
                stroke-width="2"
            />
            <circle
                :cx="connector.x1"
                :cy="connector.y1"
                r="3.5"
                :fill="SEV[selectedFinding?.sev]?.stroke"
            />
            <circle
                :cx="connector.x2"
                :cy="connector.y2"
                r="3.5"
                :fill="SEV[selectedFinding?.sev]?.stroke"
            />
        </svg>

        <NotenCompareDialog
            v-model="compareOpen"
            :finding="compareFinding"
            :print-doc="pdfDoc"
            :backend-url="backendUrl"
        />
    </div>
</template>

<style scoped>
.compare {
    position: relative;
    display: flex;
    gap: 12px;
    height: 80vh;
    min-height: 480px;
}
/* Vollbild: unter den Vuetify-Dialogen (2400), über dem Rest der Seite. */
.compare--fullscreen {
    position: fixed;
    inset: 0;
    z-index: 2000;
    height: 100vh;
    min-height: 0;
    padding: 12px;
    background: rgb(var(--v-theme-background));
}
.compare--fullscreen .findings {
    max-width: 560px;
}
.findings {
    flex: 0 0 40%;
    max-width: 460px;
    overflow-y: auto;
    border: 1px solid rgba(var(--v-border-color), 0.3);
    border-radius: 8px;
    background: rgb(var(--v-theme-surface));
}
.findings-toolbar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: rgb(var(--v-theme-surface));
    border-bottom: 1px solid rgba(var(--v-border-color), 0.3);
}
/* Ein Lied = ein Block: Kopfzeile mit Nummer/Titel, darunter seine Befunde. */
.finding-group {
    border-bottom: 1px solid rgba(var(--v-border-color), 0.35);
}
.group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(var(--v-theme-on-surface), 0.04);
    cursor: pointer;
    user-select: none;
}
.group-header:hover {
    background: rgba(var(--v-theme-primary), 0.07);
}
/* Die Liednummer darf nicht schrumpfen – sonst läuft sie aus ihrem Chip heraus.
   Gekürzt wird stattdessen der Titel (er ist das einzige elastische Element). */
.group-header .v-chip {
    flex: 0 0 auto;
}
.group-title {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.86rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.group-count {
    flex: 0 0 auto;
    font-size: 0.7rem;
    color: rgba(var(--v-theme-on-surface), 0.5);
    white-space: nowrap;
}
.finding-group .finding-row {
    padding-left: 22px;
}
.finding-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 12px;
    border-left: 3px solid transparent;
    border-bottom: 1px solid rgba(var(--v-border-color), 0.2);
    cursor: pointer;
}
.finding-row:hover {
    background: rgba(var(--v-theme-primary), 0.05);
}
.finding-row.selected {
    background: rgba(var(--v-theme-primary), 0.09);
    border-left-color: var(--sev);
}
.finding-body {
    flex: 1;
    min-width: 0;
}
.finding-title {
    font-size: 0.86rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}
.finding-title .v-chip {
    flex: 0 0 auto;
}
.finding-sub {
    font-size: 0.8rem;
    color: rgba(var(--v-theme-on-surface), 0.85);
    margin-top: 1px;
}
.finding-detail {
    font-size: 0.74rem;
    color: rgba(var(--v-theme-on-surface), 0.6);
    margin-top: 2px;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.finding-detail--full {
    display: block;
    overflow: visible;
    white-space: pre-line;
    color: rgba(var(--v-theme-on-surface), 0.82);
    -webkit-line-clamp: unset;
    line-clamp: unset;
    margin-top: 4px;
}
.finding-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}
/* Diff-Blöcke: PDF- und Erwartet-Text mehrzeilig als „Code-Block", geänderte
   Wörter farbig hervorgehoben. */
.diff-block {
    margin-top: 6px;
}
.diff-label {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(var(--v-theme-on-surface), 0.55);
    margin-bottom: 2px;
}
.diff-text {
    font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    background: rgba(var(--v-border-color), 0.08);
    border: 1px solid rgba(var(--v-border-color), 0.25);
    border-radius: 6px;
    padding: 6px 8px;
}
.diff-del {
    background: rgba(229, 57, 53, 0.22);
    border-radius: 3px;
    box-shadow: 0 0 0 1px rgba(229, 57, 53, 0.35);
    font-weight: 600;
}
.diff-add {
    background: rgba(67, 160, 71, 0.24);
    border-radius: 3px;
    box-shadow: 0 0 0 1px rgba(67, 160, 71, 0.4);
    font-weight: 600;
}
.finding-meta {
    font-size: 0.7rem;
    color: rgba(var(--v-theme-on-surface), 0.5);
    margin-top: 2px;
}
.acked-section {
    border-top: 1px solid rgba(var(--v-border-color), 0.3);
    margin-top: 4px;
}
.acked-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
    font-size: 0.8rem;
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.acked-header:hover {
    background: rgba(var(--v-theme-primary), 0.05);
}
.finding-row.acked {
    opacity: 0.7;
}
.pdf-scroll {
    flex: 1;
    overflow-y: auto;
    background: rgba(var(--v-border-color), 0.06);
    border: 1px solid rgba(var(--v-border-color), 0.3);
    border-radius: 8px;
    padding: 14px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
}
.page-slot {
    position: relative;
    flex: 0 0 auto;
    background: #fff;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.22);
}
.page-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}
.box-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}
.page-label {
    position: absolute;
    top: 2px;
    left: 4px;
    font-size: 10px;
    color: rgba(0, 0, 0, 0.35);
    pointer-events: none;
}
.connector {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 5;
    overflow: visible;
}
</style>
