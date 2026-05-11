<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import _ from 'lodash';
import axios from '@/assets/js/axiossConfig';
import { useAppStore } from '@/store/app.js';
import * as opentype from 'opentype.js';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import JSZip from 'jszip';
import finaleMaestroUrl from '@/assets/font/FinaleMaestro.otf?url';
import optimaRomanUrl from '@/assets/font/lte500190.ttf?url';
import optimaBoldUrl from '@/assets/font/lte500210.ttf?url';
import optimaItalicUrl from '@/assets/font/lte524010.ttf?url';
import optimaBoldItalicUrl from '@/assets/font/lte543790.ttf?url';

const HISTORY_KEY = 'notenexport_history';
const MAX_HISTORY = 20;

const store = useAppStore();

const search = ref('');
const filter_status = ref('set'); // 'set' | 'empty' | 'all'
const hide_already_exported = ref(false);
const only_rein = ref(true);
const trim_whitespace = ref(false);
const trim_padding = ref(8);

const isRein = (bezeichner) => !!bezeichner && bezeichner.toLowerCase().includes('rein');

const exporting = ref(false);
const progress = ref({ done: 0, total: 0, current: '' });
const error_msg = ref('');
const snackbar = ref(false);
const snackbar_message = ref('');

const history = ref([]);
const fontCache = {};

const FONTS = [
    { key: 'finale', family: /finale|maestro/i, url: finaleMaestroUrl },
    { key: 'optima', family: /optima/i, weight: 'normal', italic: false, url: optimaRomanUrl },
    { key: 'optima_bold', family: /optima/i, weight: 'bold', italic: false, url: optimaBoldUrl },
    { key: 'optima_italic', family: /optima/i, weight: 'normal', italic: true, url: optimaItalicUrl },
    { key: 'optima_bold_italic', family: /optima/i, weight: 'bold', italic: true, url: optimaBoldItalicUrl },
];

onMounted(() => {
    try {
        const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (Array.isArray(stored)) history.value = stored;
    } catch {
        history.value = [];
    }
});

watch(history, (v) => localStorage.setItem(HISTORY_KEY, JSON.stringify(v)), { deep: true });

const previously_exported_ids = computed(() => {
    const set = new Set();
    history.value.forEach((entry) => (entry.songIds || []).forEach((id) => set.add(id)));
    return set;
});

const all_lieder = computed(() => store.gesangbuchlieder);

const filtered_lieder = computed(() => {
    const q = search.value.trim().toLowerCase();
    return all_lieder.value
        .filter((lied) => {
            const has = !!lied.notentext;
            if (filter_status.value === 'set' && !has) return false;
            if (filter_status.value === 'empty' && has) return false;
            if (only_rein.value && !isRein(lied.bewertung_kleiner_kreis?.bezeichner))
                return false;
            if (hide_already_exported.value && previously_exported_ids.value.has(lied.id))
                return false;
            if (q) {
                const hay = `${lied.titel || ''} ${lied.liednummer2000 || ''} ${
                    lied.liednummer2026 || ''
                }`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const an = parseInt(a.liednummer2026 || a.liednummer2000) || 99999;
            const bn = parseInt(b.liednummer2026 || b.liednummer2000) || 99999;
            if (an !== bn) return an - bn;
            return (a.titel || '').localeCompare(b.titel || '');
        });
});

const stats = computed(() => {
    const total = all_lieder.value.length;
    const with_notentext = all_lieder.value.filter((l) => !!l.notentext).length;
    const without = total - with_notentext;
    return { total, with_notentext, without };
});

const exportable_count = computed(
    () => filtered_lieder.value.filter((l) => !!l.notentext).length,
);

async function loadFont(key, url) {
    if (fontCache[key]) return fontCache[key];
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Schriftart "${key}" konnte nicht geladen werden (${resp.status})`);
    const buf = await resp.arrayBuffer();
    fontCache[key] = opentype.parse(buf);
    return fontCache[key];
}

async function ensureAllFonts() {
    await Promise.all(FONTS.map((f) => loadFont(f.key, f.url)));
}

function isBoldWeight(weight) {
    if (!weight) return false;
    const s = String(weight).toLowerCase();
    if (/bold|heavy|black/.test(s)) return true;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 600;
}

function pickFont(family, weight, style) {
    const bold = isBoldWeight(weight);
    const italic = /italic|oblique/i.test(style || '');
    // exact match by family + weight + italic
    let match = FONTS.find(
        (f) =>
            f.family.test(family || '') &&
            f.weight !== undefined &&
            (f.weight === 'bold') === bold &&
            (f.italic ?? false) === italic,
    );
    if (match) return fontCache[match.key];
    // fallback: any match by family
    match = FONTS.find((f) => f.family.test(family || ''));
    return match ? fontCache[match.key] : null;
}

function safeFilename(s) {
    return (s || 'lied').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80);
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function buildCsv(rows) {
    const headers = [
        'id',
        'liednummer2000',
        'liednummer2026',
        'titel',
        'status',
        'bewertung',
        'notentext_file_id',
        'notentext_seite2_file_id',
        'seiten',
        'pdf_filename',
        'export_status',
        'fehler',
    ];
    const lines = [headers.join(',')];
    rows.forEach((r) => {
        lines.push(headers.map((h) => csvEscape(r[h])).join(','));
    });
    return '﻿' + lines.join('\n');
}

function isKnownFamily(family) {
    if (!family) return false;
    return FONTS.some((f) => f.family.test(family));
}

function readStyleProp(styleStr, prop) {
    if (!styleStr) return null;
    const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
    const m = styleStr.match(re);
    return m ? m[1].trim() : null;
}

function getInheritedAttr(el, attr) {
    let cur = el;
    while (cur && cur.nodeType === 1) {
        if (cur.getAttribute) {
            const v = cur.getAttribute(attr);
            if (v) return v;
            const fromStyle = readStyleProp(cur.getAttribute('style'), attr);
            if (fromStyle) return fromStyle;
        }
        cur = cur.parentNode;
    }
    return null;
}

function bakeTextElement(textEl, svgDoc) {
    const family = getInheritedAttr(textEl, 'font-family');
    if (!isKnownFamily(family)) return false;
    const weight = getInheritedAttr(textEl, 'font-weight');
    const style = getInheritedAttr(textEl, 'font-style');
    const font = pickFont(family, weight, style);
    if (!font) return false;

    const fontSizeRaw = getInheritedAttr(textEl, 'font-size') || '16';
    const fontSize = parseFloat(fontSizeRaw) || 16;
    const fill = getInheritedAttr(textEl, 'fill') || '#000';
    const anchor = getInheritedAttr(textEl, 'text-anchor') || 'start';

    const ns = 'http://www.w3.org/2000/svg';
    const replacement = svgDoc.createElementNS(ns, 'g');

    const transform = textEl.getAttribute('transform');
    if (transform) replacement.setAttribute('transform', transform);

    // tspan children with their own x/y, or plain text
    const tspans = textEl.querySelectorAll('tspan');
    const segments = [];
    if (tspans.length > 0) {
        tspans.forEach((ts) => {
            segments.push({
                text: ts.textContent || '',
                x: parseFloat(ts.getAttribute('x') ?? textEl.getAttribute('x') ?? '0') || 0,
                y: parseFloat(ts.getAttribute('y') ?? textEl.getAttribute('y') ?? '0') || 0,
            });
        });
    } else {
        segments.push({
            text: textEl.textContent || '',
            x: parseFloat(textEl.getAttribute('x') || '0') || 0,
            y: parseFloat(textEl.getAttribute('y') || '0') || 0,
        });
    }

    segments.forEach((seg) => {
        if (!seg.text) return;
        let drawX = seg.x;
        if (anchor === 'middle' || anchor === 'end') {
            const advance = font.getAdvanceWidth(seg.text, fontSize);
            drawX = anchor === 'middle' ? seg.x - advance / 2 : seg.x - advance;
        }
        const path = font.getPath(seg.text, drawX, seg.y, fontSize);
        const d = path.toPathData(3);
        if (!d) return;
        const pathEl = svgDoc.createElementNS(ns, 'path');
        pathEl.setAttribute('d', d);
        pathEl.setAttribute('fill', fill);
        replacement.appendChild(pathEl);
    });

    textEl.parentNode.replaceChild(replacement, textEl);
    return true;
}

function bakeSvg(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) throw new Error('SVG konnte nicht geparst werden');

    const svg = doc.documentElement;
    const texts = Array.from(svg.querySelectorAll('text'));
    let baked = 0;
    texts.forEach((t) => {
        try {
            if (bakeTextElement(t, doc)) baked++;
        } catch (e) {
            console.warn('Text element konnte nicht umgewandelt werden', e);
        }
    });

    return { svg, bakedCount: baked, totalTexts: texts.length };
}

function isWhiteFill(fill) {
    if (!fill) return false;
    const v = fill.trim().toLowerCase().replace(/\s+/g, '');
    return (
        v === '#fff' ||
        v === '#ffffff' ||
        v === 'white' ||
        v === 'rgb(255,255,255)' ||
        v === 'rgba(255,255,255,1)'
    );
}

function removeFullCanvasBackgrounds(svgEl) {
    // Determine canvas extent from viewBox or width/height
    const vb = svgEl.getAttribute('viewBox');
    let cx = 0, cy = 0, cw = 0, ch = 0;
    if (vb) {
        const p = vb.split(/[\s,]+/).map(parseFloat);
        if (p.length === 4) [cx, cy, cw, ch] = p;
    }
    if (!cw || !ch) {
        cw = parseFloat(svgEl.getAttribute('width')) || 0;
        ch = parseFloat(svgEl.getAttribute('height')) || 0;
    }
    if (!cw || !ch) return 0;

    const tol = 1.5; // px tolerance
    const rects = Array.from(svgEl.querySelectorAll('rect'));
    let removed = 0;
    rects.forEach((r) => {
        const fill = r.getAttribute('fill') || readStyleProp(r.getAttribute('style'), 'fill');
        if (!isWhiteFill(fill)) return;
        const x = parseFloat(r.getAttribute('x') || '0');
        const y = parseFloat(r.getAttribute('y') || '0');
        const w = parseFloat(r.getAttribute('width') || '0');
        const h = parseFloat(r.getAttribute('height') || '0');
        if (
            Math.abs(x - cx) <= tol &&
            Math.abs(y - cy) <= tol &&
            Math.abs(w - cw) <= tol &&
            Math.abs(h - ch) <= tol
        ) {
            r.parentNode.removeChild(r);
            removed++;
        }
    });
    return removed;
}

function trimSvgToContent(svgEl, padding) {
    removeFullCanvasBackgrounds(svgEl);
    // svgEl must already be attached to the DOM for getBBox to work
    let bbox;
    try {
        bbox = svgEl.getBBox();
    } catch {
        return false;
    }
    if (!bbox || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height)) return false;
    if (bbox.width <= 0 || bbox.height <= 0) return false;

    const pad = Math.max(0, padding || 0);
    const x = bbox.x - pad;
    const y = bbox.y - pad;
    const w = bbox.width + pad * 2;
    const h = bbox.height + pad * 2;

    svgEl.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    svgEl.setAttribute('width', String(w));
    svgEl.setAttribute('height', String(h));
    return true;
}

function getSvgDimensions(svgEl) {
    const w = parseFloat(svgEl.getAttribute('width'));
    const h = parseFloat(svgEl.getAttribute('height'));
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { width: w, height: h };
    const vb = svgEl.getAttribute('viewBox');
    if (vb) {
        const parts = vb.split(/[\s,]+/).map(parseFloat);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            return { width: parts[2], height: parts[3] };
        }
    }
    return { width: 595, height: 842 }; // A4 fallback in pt
}

async function svgsToPdfBlob(svgEls) {
    if (!svgEls.length) throw new Error('Keine SVGs zum Konvertieren');
    const dims0 = getSvgDimensions(svgEls[0]);
    const pdf = new jsPDF({
        unit: 'pt',
        format: [dims0.width, dims0.height],
        orientation: dims0.width > dims0.height ? 'landscape' : 'portrait',
        compress: true,
    });
    // svg2pdf.js attaches itself to jsPDF prototype as `.svg(...)`
    await pdf.svg(svgEls[0], { x: 0, y: 0, width: dims0.width, height: dims0.height });
    for (let i = 1; i < svgEls.length; i++) {
        const d = getSvgDimensions(svgEls[i]);
        pdf.addPage([d.width, d.height], d.width > d.height ? 'landscape' : 'portrait');
        await pdf.svg(svgEls[i], { x: 0, y: 0, width: d.width, height: d.height });
    }
    return pdf.output('blob');
}

async function fetchSvgText(fileId) {
    const url = `${import.meta.env.VITE_BACKEND_URL}/assets/${fileId}`;
    const resp = await axios.get(url, { responseType: 'text' });
    return resp.data;
}

async function runExport() {
    error_msg.value = '';
    const candidates = filtered_lieder.value.filter((l) => !!l.notentext);
    if (candidates.length === 0) {
        error_msg.value = 'Keine Lieder mit notentext im aktuellen Filter.';
        return;
    }

    exporting.value = true;
    progress.value = { done: 0, total: candidates.length, current: '' };

    const zip = new JSZip();
    const pdfFolder = zip.folder('pdf');
    const csvRows = [];
    const exportedIds = [];

    try {
        await ensureAllFonts();
    } catch (e) {
        error_msg.value = e.message || 'Schriftarten konnten nicht geladen werden';
        exporting.value = false;
        return;
    }

    for (const lied of candidates) {
        progress.value.current = lied.titel || `#${lied.id}`;
        const filenameBase = `${lied.liednummer2026 || lied.liednummer2000 || lied.id}_${safeFilename(lied.titel)}`;
        const pdfFilename = `${filenameBase}.pdf`;
        const pageFileIds = [lied.notentext];
        if (lied.notentext_seite2) pageFileIds.push(lied.notentext_seite2);

        const row = {
            id: lied.id,
            liednummer2000: lied.liednummer2000 || '',
            liednummer2026: lied.liednummer2026 || '',
            titel: lied.titel || '',
            status: lied.status || '',
            bewertung: lied.bewertung_kleiner_kreis?.bezeichner || '',
            notentext_file_id: lied.notentext,
            notentext_seite2_file_id: lied.notentext_seite2 || '',
            seiten: pageFileIds.length,
            pdf_filename: pdfFilename,
            export_status: 'ok',
            fehler: '',
        };

        const hosts = [];
        try {
            const svgs = [];
            for (const fileId of pageFileIds) {
                const svgText = await fetchSvgText(fileId);
                const { svg } = bakeSvg(svgText);
                const host = document.createElement('div');
                host.style.cssText =
                    'position:absolute;left:-99999px;top:-99999px;visibility:hidden;';
                host.appendChild(svg);
                document.body.appendChild(host);
                hosts.push(host);
                if (trim_whitespace.value) {
                    trimSvgToContent(svg, trim_padding.value);
                }
                svgs.push(svg);
            }
            const blob = await svgsToPdfBlob(svgs);
            pdfFolder.file(pdfFilename, blob);
            exportedIds.push(lied.id);
        } catch (e) {
            console.error('Export-Fehler', lied.id, e);
            row.export_status = 'fehler';
            row.fehler = (e && e.message) || String(e);
        } finally {
            hosts.forEach((h) => {
                if (h.parentNode) h.parentNode.removeChild(h);
            });
        }

        csvRows.push(row);
        progress.value.done += 1;
    }

    // Add not-exported (empty notentext) summary rows for full filter set if user chose 'all'
    if (filter_status.value !== 'set') {
        filtered_lieder.value
            .filter((l) => !l.notentext)
            .forEach((lied) => {
                csvRows.push({
                    id: lied.id,
                    liednummer2000: lied.liednummer2000 || '',
                    liednummer2026: lied.liednummer2026 || '',
                    titel: lied.titel || '',
                    status: lied.status || '',
                    bewertung: lied.bewertung_kleiner_kreis?.bezeichner || '',
                    notentext_file_id: '',
                    notentext_seite2_file_id: '',
                    seiten: 0,
                    pdf_filename: '',
                    export_status: 'kein_notentext',
                    fehler: '',
                });
            });
    }

    zip.file('export.csv', buildCsv(csvRows));

    const meta = {
        exported_at: new Date().toISOString(),
        filter: {
            status: filter_status.value,
            search: search.value,
            only_rein: only_rein.value,
            hide_already_exported: hide_already_exported.value,
        },
        options: {
            trim_whitespace: trim_whitespace.value,
            trim_padding: trim_padding.value,
        },
        counts: {
            total_in_filter: filtered_lieder.value.length,
            attempted: candidates.length,
            successful: exportedIds.length,
            failed: candidates.length - exportedIds.length,
        },
    };
    zip.file('export.json', JSON.stringify(meta, null, 2));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = `notentext-export_${ts}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);

    history.value = [
        {
            timestamp: new Date().toISOString(),
            filter: meta.filter,
            songCount: exportedIds.length,
            failedCount: meta.counts.failed,
            songIds: exportedIds,
        },
        ...history.value,
    ].slice(0, MAX_HISTORY);

    snackbar_message.value = `Export fertig: ${exportedIds.length} PDF(s), ${meta.counts.failed} Fehler`;
    snackbar.value = true;
    exporting.value = false;
}

function clearHistory() {
    history.value = [];
}

function removeHistoryEntry(idx) {
    history.value.splice(idx, 1);
}

function formatDate(iso) {
    try {
        return new Date(iso).toLocaleString('de-DE');
    } catch {
        return iso;
    }
}
</script>

<template>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
        <h1 class="me-4">Notentext-Export</h1>
        <v-chip color="primary" variant="tonal">Gesamt: {{ stats.total }}</v-chip>
        <v-chip color="success" variant="tonal">Mit notentext: {{ stats.with_notentext }}</v-chip>
        <v-chip color="warning" variant="tonal">Ohne: {{ stats.without }}</v-chip>
    </div>

    <v-card class="mb-4">
        <v-card-text>
            <div class="d-flex flex-wrap align-center ga-4">
                <v-text-field
                    v-model="search"
                    prepend-inner-icon="mdi-magnify"
                    label="Lied suchen (Titel / Liednummer)"
                    hide-details
                    clearable
                    density="comfortable"
                    style="min-width: 280px; flex: 1"
                />
                <v-btn-toggle v-model="filter_status" mandatory variant="tonal" density="comfortable">
                    <v-btn value="set">
                        <v-icon class="me-1">mdi-check-circle</v-icon>notentext gesetzt
                    </v-btn>
                    <v-btn value="empty">
                        <v-icon class="me-1">mdi-close-circle</v-icon>fehlt
                    </v-btn>
                    <v-btn value="all">
                        <v-icon class="me-1">mdi-format-list-bulleted</v-icon>alle
                    </v-btn>
                </v-btn-toggle>
                <v-checkbox
                    v-model="only_rein"
                    label="Nur Rein"
                    color="success"
                    hide-details
                    density="comfortable"
                />
                <v-checkbox
                    v-model="hide_already_exported"
                    label="Bereits exportierte ausblenden"
                    hide-details
                    density="comfortable"
                />
                <v-divider vertical class="mx-2" />
                <v-checkbox
                    v-model="trim_whitespace"
                    label="Weißen Rand trimmen"
                    hide-details
                    density="comfortable"
                />
                <v-text-field
                    v-model.number="trim_padding"
                    label="Padding (pt)"
                    type="number"
                    min="0"
                    :disabled="!trim_whitespace"
                    hide-details
                    density="comfortable"
                    style="max-width: 130px"
                />
            </div>
        </v-card-text>
    </v-card>

    <v-card class="mb-4">
        <v-card-text>
            <div class="d-flex align-center flex-wrap ga-4">
                <div>
                    <div class="text-subtitle-2">Im Filter: {{ filtered_lieder.length }}</div>
                    <div class="text-caption text-medium-emphasis">
                        Davon exportierbar (mit notentext): {{ exportable_count }}
                    </div>
                </div>
                <v-spacer />
                <v-btn
                    color="primary"
                    :loading="exporting"
                    :disabled="exporting || exportable_count === 0"
                    prepend-icon="mdi-download"
                    @click="runExport"
                >
                    {{ exportable_count }} PDF(s) + CSV als ZIP exportieren
                </v-btn>
            </div>
            <v-alert v-if="error_msg" class="mt-3" type="error" variant="tonal" density="compact">
                {{ error_msg }}
            </v-alert>
            <div v-if="exporting" class="mt-3">
                <v-progress-linear
                    :model-value="(progress.done / Math.max(progress.total, 1)) * 100"
                    color="primary"
                    height="20"
                >
                    <template #default>
                        <span class="text-caption">
                            {{ progress.done }} / {{ progress.total }}
                            <span v-if="progress.current">— {{ progress.current }}</span>
                        </span>
                    </template>
                </v-progress-linear>
            </div>
        </v-card-text>
    </v-card>

    <v-expansion-panels class="mb-4">
        <v-expansion-panel>
            <v-expansion-panel-title>
                <div class="d-flex align-center ga-2">
                    <v-icon>mdi-history</v-icon>
                    <span>Eigene Export-Historie ({{ history.length }})</span>
                </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
                <div v-if="history.length === 0" class="text-medium-emphasis">
                    Noch keine Exporte in diesem Browser.
                </div>
                <div v-else>
                    <v-list density="compact">
                        <v-list-item v-for="(h, idx) in history" :key="idx">
                            <template #prepend>
                                <v-icon size="small">mdi-folder-zip</v-icon>
                            </template>
                            <v-list-item-title>
                                {{ formatDate(h.timestamp) }} — {{ h.songCount }} PDF(s)
                                <span v-if="h.failedCount" class="text-error">
                                    ({{ h.failedCount }} Fehler)
                                </span>
                            </v-list-item-title>
                            <v-list-item-subtitle>
                                Filter: {{ h.filter?.status || '–' }}
                                <span v-if="h.filter?.search">, „{{ h.filter.search }}"</span>
                            </v-list-item-subtitle>
                            <template #append>
                                <v-btn
                                    icon="mdi-close"
                                    size="small"
                                    variant="text"
                                    @click="removeHistoryEntry(idx)"
                                />
                            </template>
                        </v-list-item>
                    </v-list>
                    <div class="d-flex">
                        <v-spacer />
                        <v-btn
                            size="small"
                            variant="text"
                            color="error"
                            prepend-icon="mdi-delete"
                            @click="clearHistory"
                        >
                            Historie löschen
                        </v-btn>
                    </div>
                </div>
            </v-expansion-panel-text>
        </v-expansion-panel>
    </v-expansion-panels>

    <v-card>
        <v-card-text class="pa-0">
            <v-table density="compact" hover>
                <thead>
                    <tr>
                        <th style="width: 80px">Nr.</th>
                        <th>Titel</th>
                        <th style="width: 140px">notentext</th>
                        <th style="width: 100px">vorher</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="lied in filtered_lieder" :key="lied.id">
                        <td>{{ lied.liednummer2026 || lied.liednummer2000 || '–' }}</td>
                        <td>{{ lied.titel }}</td>
                        <td>
                            <v-chip
                                v-if="lied.notentext"
                                size="x-small"
                                color="success"
                                variant="tonal"
                                prepend-icon="mdi-check"
                            >
                                gesetzt
                            </v-chip>
                            <v-chip
                                v-else
                                size="x-small"
                                color="grey"
                                variant="tonal"
                                prepend-icon="mdi-close"
                            >
                                fehlt
                            </v-chip>
                            <v-chip
                                v-if="lied.notentext_seite2"
                                size="x-small"
                                color="info"
                                variant="tonal"
                                prepend-icon="mdi-numeric-2-box"
                                class="ms-1"
                            >
                                2 Seiten
                            </v-chip>
                        </td>
                        <td>
                            <v-chip
                                v-if="previously_exported_ids.has(lied.id)"
                                size="x-small"
                                color="info"
                                variant="tonal"
                                prepend-icon="mdi-history"
                            >
                                exportiert
                            </v-chip>
                        </td>
                    </tr>
                    <tr v-if="filtered_lieder.length === 0">
                        <td colspan="4" class="text-center text-medium-emphasis py-4">
                            Keine Lieder im aktuellen Filter.
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card-text>
    </v-card>

    <v-snackbar v-model="snackbar" :timeout="3500">
        {{ snackbar_message }}
        <template #actions>
            <v-btn variant="text" @click="snackbar = false">OK</v-btn>
        </template>
    </v-snackbar>
</template>
