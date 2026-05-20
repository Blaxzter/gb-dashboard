<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import _ from 'lodash';
import axios from '@/assets/js/axiossConfig';
import { useAppStore } from '@/store/app.js';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import JSZip from 'jszip';

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

const selected_ids = ref(new Set());
const last_clicked_id = ref(null);

const exportable_filtered_ids = computed(
    () => filtered_lieder.value.filter((l) => !!l.notentext).map((l) => l.id),
);

const selected_count = computed(
    () => exportable_filtered_ids.value.filter((id) => selected_ids.value.has(id)).length,
);

const all_filtered_selected = computed(
    () =>
        exportable_filtered_ids.value.length > 0 &&
        selected_count.value === exportable_filtered_ids.value.length,
);

const some_filtered_selected = computed(
    () => selected_count.value > 0 && !all_filtered_selected.value,
);

function isSelected(id) {
    return selected_ids.value.has(id);
}

function toggleSelected(id) {
    const next = new Set(selected_ids.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected_ids.value = next;
}

function onRowCheckboxClick(id, event) {
    const lied = all_lieder.value.find((l) => l.id === id);
    if (!lied || !lied.notentext) return;

    const visibleIds = filtered_lieder.value
        .filter((l) => !!l.notentext)
        .map((l) => l.id);

    if (
        event.shiftKey &&
        last_clicked_id.value != null &&
        last_clicked_id.value !== id &&
        visibleIds.includes(last_clicked_id.value)
    ) {
        // Range select between last clicked and current within currently-visible rows.
        // The target state is the inverse of the clicked row's current state.
        const a = visibleIds.indexOf(last_clicked_id.value);
        const b = visibleIds.indexOf(id);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const targetState = !selected_ids.value.has(id);
        const next = new Set(selected_ids.value);
        for (let i = lo; i <= hi; i++) {
            if (targetState) next.add(visibleIds[i]);
            else next.delete(visibleIds[i]);
        }
        selected_ids.value = next;
        // Avoid the browser's shift-click text selection.
        window.getSelection?.()?.removeAllRanges?.();
    } else {
        toggleSelected(id);
    }
    last_clicked_id.value = id;
}

function toggleSelectAll() {
    const next = new Set(selected_ids.value);
    if (all_filtered_selected.value) {
        exportable_filtered_ids.value.forEach((id) => next.delete(id));
    } else {
        exportable_filtered_ids.value.forEach((id) => next.add(id));
    }
    selected_ids.value = next;
}

let selection_initialized = false;
watch(
    () => all_lieder.value.length,
    () => {
        if (selection_initialized) return;
        const exportable = all_lieder.value.filter((l) => !!l.notentext).map((l) => l.id);
        if (exportable.length === 0) return;
        selected_ids.value = new Set(exportable);
        selection_initialized = true;
    },
    { immediate: true },
);

function safeFilename(s) {
    return (s || 'lied').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80);
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

const CSV_HEADERS = [
    'liednummer2026',
    'strophen',
    'text_autoren',
    'melodie_autoren',
    'pdf-path_1',
    'pdf-path_2',
];

function buildCsv(rows) {
    const lines = [CSV_HEADERS.join(',')];
    rows.forEach((r) => {
        lines.push(CSV_HEADERS.map((h) => csvEscape(r[h])).join(','));
    });
    return '﻿' + lines.join('\n');
}

function formatYearRange(geburtsjahr, sterbejahr) {
    if (!geburtsjahr && !sterbejahr) return '';
    return `${geburtsjahr || ''}–${sterbejahr || ''}`;
}

function formatAuthorEntry(author) {
    if (!author) return '';
    const parts = [];
    if (author.autorPrefix) parts.push(author.autorPrefix);
    const name = [author.vorname, author.nachname].filter(Boolean).join(' ');
    if (name) parts.push(name);
    const years = formatYearRange(author.geburtsjahr, author.sterbejahr);
    if (years) parts.push(years);
    if (author.autorSuffix) parts.push(author.autorSuffix);

    const u = author.ursprungsAutorObj;
    if (u && typeof u === 'object') {
        const uName = [u.vorname, u.nachname].filter(Boolean).join(' ');
        if (uName) parts.push(uName);
        const uYears = formatYearRange(u.geburtsjahr, u.sterbejahr);
        if (uYears) parts.push(uYears);
    }
    return parts.join(' ');
}

function formatAuthors(authors, ...copyrights) {
    const authorStrings = (authors || []).map(formatAuthorEntry).filter(Boolean);
    const copyrightStrings = copyrights
        .filter((c) => c && String(c).trim())
        .map((c) => `© ${String(c).trim()}`);
    return [authorStrings.join(', '), ...copyrightStrings].filter(Boolean).join('\n');
}

function formatStrophen(strophenEinzeln) {
    if (!Array.isArray(strophenEinzeln) || strophenEinzeln.length <= 1) return '';
    return strophenEinzeln
        .slice(1)
        .map((s) => (s?.strophe || '').replaceAll('¬', '').replace(/\r?\n/g, ' '))
        .join(' ')
        .replace(/[\p{Zs}\s]+/gu, ' ')
        .trim();
}

function resolveLiednummer2026(lied, liednummer2026ById) {
    if (lied.liednummer2026) return lied.liednummer2026;
    const dlf = lied.deutscheLiedfassung;
    const dlfId = dlf && typeof dlf === 'object' ? dlf.id : dlf;
    if (dlfId != null && liednummer2026ById[dlfId]) return liednummer2026ById[dlfId];
    return '';
}

function readStyleProp(styleStr, prop) {
    if (!styleStr) return null;
    const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
    const m = styleStr.match(re);
    return m ? m[1].trim() : null;
}

function parseSvgString(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) throw new Error('SVG konnte nicht geparst werden');
    return doc.documentElement;
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
    const candidates = filtered_lieder.value.filter(
        (l) => !!l.notentext && selected_ids.value.has(l.id),
    );
    if (candidates.length === 0) {
        error_msg.value = 'Keine Lieder ausgewählt.';
        return;
    }

    exporting.value = true;
    progress.value = { done: 0, total: candidates.length, current: '' };

    const liednummer2026ById = {};
    all_lieder.value.forEach((l) => {
        if (l && l.id != null && l.liednummer2026) {
            liednummer2026ById[l.id] = l.liednummer2026;
        }
    });

    const zip = new JSZip();
    const pdfFolder = zip.folder('pdf');
    const csvRows = [];
    const exportedIds = [];

    for (const lied of candidates) {
        progress.value.current = lied.titel || `#${lied.id}`;
        const liednummer2026 = resolveLiednummer2026(lied, liednummer2026ById);
        const filenameBase = `${liednummer2026 || lied.liednummer2000 || lied.id}_${safeFilename(lied.titel)}`;
        const pdfFilename = `${filenameBase}.pdf`;
        const pageFileIds = [lied.notentext];
        if (lied.notentext_seite2) pageFileIds.push(lied.notentext_seite2);

        const row = {
            liednummer2026,
            strophen: formatStrophen(lied.text?.strophenEinzeln),
            text_autoren: formatAuthors(lied.text?.authors, lied.text?.copyright),
            melodie_autoren: formatAuthors(
                lied.melodie?.authors,
                lied.melodie?.copyright,
                lied.copyright,
            ),
            'pdf-path_1': pdfFilename,
            'pdf-path_2': lied.notentext_seite2 ? pdfFilename : '',
        };

        const hosts = [];
        try {
            const svgs = [];
            for (const fileId of pageFileIds) {
                const svgText = await fetchSvgText(fileId);
                const svg = parseSvgString(svgText);
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
            csvRows.push(row);
        } catch (e) {
            console.error('Export-Fehler', lied.id, e);
        } finally {
            hosts.forEach((h) => {
                if (h.parentNode) h.parentNode.removeChild(h);
            });
        }

        progress.value.done += 1;
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
                        Davon exportierbar (mit notentext): {{ exportable_count }} —
                        ausgewählt: {{ selected_count }}
                    </div>
                </div>
                <v-spacer />
                <v-btn
                    color="primary"
                    :loading="exporting"
                    :disabled="exporting || selected_count === 0"
                    prepend-icon="mdi-download"
                    @click="runExport"
                >
                    {{ selected_count }} PDF(s) + CSV als ZIP exportieren
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
                        <th style="width: 56px">
                            <v-checkbox
                                :model-value="all_filtered_selected"
                                :indeterminate="some_filtered_selected"
                                :disabled="exportable_filtered_ids.length === 0"
                                hide-details
                                density="compact"
                                @update:model-value="toggleSelectAll"
                            />
                        </th>
                        <th style="width: 80px">Nr.</th>
                        <th>Titel</th>
                        <th style="width: 140px">notentext</th>
                        <th style="width: 100px">vorher</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="lied in filtered_lieder" :key="lied.id">
                        <td
                            class="select-cell"
                            :class="{ 'select-cell--disabled': !lied.notentext }"
                            @click="onRowCheckboxClick(lied.id, $event)"
                            @mousedown.prevent
                        >
                            <v-checkbox
                                :model-value="isSelected(lied.id)"
                                :disabled="!lied.notentext"
                                readonly
                                hide-details
                                density="compact"
                                tabindex="-1"
                            />
                        </td>
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
                        <td colspan="5" class="text-center text-medium-emphasis py-4">
                            Keine Lieder im aktuellen Filter.
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card-text>
    </v-card>

    <div class="text-caption text-medium-emphasis mt-1">
        Tipp: Shift + Klick wählt einen Bereich aus.
    </div>

    <v-snackbar v-model="snackbar" :timeout="3500">
        {{ snackbar_message }}
        <template #actions>
            <v-btn variant="text" @click="snackbar = false">OK</v-btn>
        </template>
    </v-snackbar>
</template>

<style scoped>
.select-cell {
    cursor: pointer;
    user-select: none;
}
.select-cell--disabled {
    cursor: not-allowed;
}
</style>
