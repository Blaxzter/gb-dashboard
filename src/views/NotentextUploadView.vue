<script setup>
import { ref, computed, watch } from 'vue';
import axios from '@/assets/js/axiossConfig';
import { useAppStore } from '@/store/app.js';
import { bakeSvgString, ensureAllFonts } from '@/assets/js/svgBaker.js';
import { scanSvgBake, computeSvgEquality } from '@/assets/js/svgCompare.js';
import { analyzePdfAlignment } from '@/assets/js/pdfAlign.js';
import { applyCorrections } from '@/assets/js/lyricsAlign.js';
import { fingerprintFromFile } from '@/assets/js/notenFingerprintLoader.js';
import { isRein, isGenommen } from '@/assets/js/gesangbuchChecks.js';
import SvgBakeCompareDialog from '@/components/upload/SvgBakeCompareDialog.vue';
import PdfCompareDialog from '@/components/upload/PdfCompareDialog.vue';
import LyricsAlignDialog from '@/components/upload/LyricsAlignDialog.vue';

const store = useAppStore();

const compare_dialog = ref(false);
const compare_file = ref(null);
const compare_title = ref('');
const compare_existing_url = ref('');

// PDF-Vergleich: ein neu hochgeladenes PDF-Notenbild gegen den bereits auf dem
// Lied gespeicherten Notentext (Seite 1 / Seite 2) stellen.
const pdf_compare_dialog = ref(false);
const pdf_compare_new_file = ref(null);
const pdf_compare_title = ref('');
const pdf_compare_targets = ref([]);
const pdf_compare_initial_key = ref('');

const align_dialog = ref(false);
const align_file = ref(null);
const align_title = ref('');
const align_item = ref(null);
const align_reference_pdf = ref(null);
const align_initial_corrections = ref(null);

const preview_dialog = ref(false);
const preview_url = ref(null);
const preview_title = ref('');

function openPreviewDialog(item) {
    if (item.kind !== 'svg' || !item.previewUrl) return;
    preview_url.value = item.previewUrl;
    preview_title.value = item.name;
    preview_dialog.value = true;
}

function openCompareDialog(item) {
    compare_file.value = item.file;
    compare_title.value = item.name;
    compare_existing_url.value = existingFileUrlFor(item);
    compare_dialog.value = true;
}

// Resolves the URL of the already-uploaded notentext file on the matched Lied,
// for the field this item would write into (Seite 1 / Seite 2 / MXL). Empty
// string when the Lied has no file for that slot yet — no conflict, nothing
// to compare against.
function existingFileIdFor(item) {
    if (!item || !item.liedId) return null;
    const lied = lookupLied(item.liedId);
    if (!lied) return null;
    const { field } = fieldFor(item);
    return lied[field] || null;
}

function existingFileUrlFor(item) {
    if (!item || item.kind !== 'svg') return '';
    const id = existingFileIdFor(item);
    return id ? `${import.meta.env.VITE_BACKEND_URL}/assets/${id}` : '';
}

// Asset-URL für ein bereits hochgeladenes File-Objekt. PDFs bekommen die
// .pdf-Endung (wie getPdfUrl in MediaComponent), damit der Content-Type stimmt.
function assetUrlForFile(file) {
    if (!file?.id) return '';
    const base = `${import.meta.env.VITE_BACKEND_URL}/assets/${file.id}`;
    return file.type === 'application/pdf' ? `${base}.pdf` : base;
}

// Vorhandene Notentext-Dateien (Seite 1 / Seite 2) des gematchten Lieds, gegen
// die ein neu hochgeladenes PDF verglichen werden kann. Leeres Array, wenn das
// Lied noch keinen Notentext hat oder das Item kein PDF ist.
function existingPdfTargetsFor(item) {
    if (!item || item.kind !== 'pdf' || !item.liedId) return [];
    const lied = lookupLied(item.liedId);
    if (!lied) return [];
    const targets = [];
    if (lied.notentext_file) {
        targets.push({
            key: 'seite1',
            label: 'Seite 1',
            url: assetUrlForFile(lied.notentext_file),
            isPdf: lied.notentext_file.type === 'application/pdf',
            name: lied.notentext_file.filename_download || lied.notentext_file.title || '',
        });
    }
    if (lied.notentext_seite2_file) {
        targets.push({
            key: 'seite2',
            label: 'Seite 2',
            url: assetUrlForFile(lied.notentext_seite2_file),
            isPdf: lied.notentext_seite2_file.type === 'application/pdf',
            name:
                lied.notentext_seite2_file.filename_download ||
                lied.notentext_seite2_file.title ||
                '',
        });
    }
    return targets;
}

function canComparePdf(item) {
    return existingPdfTargetsFor(item).length > 0;
}

function openPdfCompareDialog(item) {
    const targets = existingPdfTargetsFor(item);
    if (!targets.length) return;
    pdf_compare_new_file.value = item.file;
    pdf_compare_title.value = item.name;
    pdf_compare_targets.value = targets;
    // Standardmäßig gegen die Seite vergleichen, in die dieses PDF geschrieben
    // würde (Seite 1/2 laut item.page) — sofern dort etwas liegt.
    const preferredKey = item.page === 2 ? 'seite2' : 'seite1';
    pdf_compare_initial_key.value =
        targets.find((t) => t.key === preferredKey)?.key || targets[0].key;
    pdf_compare_dialog.value = true;
}

function openAlignDialog(item) {
    align_file.value = item.file;
    align_title.value = item.name;
    align_item.value = item;
    align_reference_pdf.value = item.referencePdf?.file || null;
    // Pass any already-computed PDF corrections so the dialog can start with
    // them pre-applied without re-running the analysis.
    align_initial_corrections.value = item.pdfAlign?.corrections || null;
    align_dialog.value = true;
}

async function onAlignmentApplied({ svgString }) {
    const item = align_item.value;
    if (!item) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const newName = item.file?.name || 'corrected.svg';
    item.file = new File([blob], newName, { type: 'image/svg+xml' });
    item.locallyModified = true;
    // Trigger re-scan so the chip updates
    if (item.scan) item.scan = { status: 'pending' };
    runScanWorker();
}

let equality_busy = false;
async function runEqualityWorker() {
    if (equality_busy) return;
    equality_busy = true;
    try {
        while (true) {
            const next = queue.value.find(
                (q) =>
                    q.kind === 'svg' &&
                    q.status === 'conflict' &&
                    !q.locallyModified &&
                    existingFileUrlFor(q) &&
                    q.uploadedEquality?.status === 'pending',
            );
            if (!next) break;
            next.uploadedEquality = { status: 'checking' };
            try {
                const text = await next.file.text();
                const baked = await bakeSvgString(text);
                const resp = await fetch(existingFileUrlFor(next));
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const existingText = await resp.text();
                const eq = computeSvgEquality(baked.svgString, existingText);
                next.uploadedEquality = { status: 'done', ...eq };
            } catch (e) {
                console.warn('Equality-Check fehlgeschlagen', e);
                next.uploadedEquality = {
                    status: 'error',
                    error: e?.message || String(e),
                };
            }
        }
    } finally {
        equality_busy = false;
    }
}

function queueEqualityCheck(item) {
    if (item.kind !== 'svg') return;
    if (item.status !== 'conflict') return;
    if (item.locallyModified) return;
    if (!existingFileUrlFor(item)) return;
    item.uploadedEquality = { status: 'pending' };
    runEqualityWorker();
}

let scan_busy = false;
async function runScanWorker() {
    if (scan_busy) return;
    scan_busy = true;
    try {
        while (true) {
            const next = queue.value.find(
                (q) => q.kind === 'svg' && q.scan?.status === 'pending',
            );
            if (!next) break;
            next.scan = { ...next.scan, status: 'scanning' };
            try {
                const result = await scanSvgBake(next.file);
                next.scan = {
                    status: 'done',
                    severity: result.severity,
                    bakedCount: result.bakedCount,
                    totalTexts: result.totalTexts,
                    coverage: result.coverage,
                    alignment: result.alignment,
                };
            } catch (e) {
                console.warn('Bake-Scan fehlgeschlagen', e);
                next.scan = {
                    status: 'error',
                    error: e?.message || String(e),
                };
            }
        }
    } finally {
        scan_busy = false;
    }
}

let pdf_align_busy = false;
async function runPdfAlignWorker() {
    if (pdf_align_busy) return;
    pdf_align_busy = true;
    try {
        while (true) {
            const next = queue.value.find(
                (q) => q.kind === 'svg' && q.referencePdf && q.pdfAlign?.status === 'pending',
            );
            if (!next) break;
            next.pdfAlign = { ...next.pdfAlign, status: 'running' };
            try {
                const [svgText, pdfBuf] = await Promise.all([
                    next.file.text(),
                    next.referencePdf.file.arrayBuffer(),
                ]);
                const { corrections, report } = await analyzePdfAlignment(svgText, pdfBuf);
                next.pdfAlign = {
                    status: 'done',
                    corrections,
                    report,
                };
            } catch (e) {
                console.warn('PDF-Ausrichtung fehlgeschlagen', e);
                next.pdfAlign = {
                    status: 'error',
                    error: e?.message || String(e),
                };
            }
        }
    } finally {
        pdf_align_busy = false;
    }
}

ensureAllFonts().catch((e) => {
    console.error('Schriften konnten nicht vorgeladen werden', e);
});

const AUTO_MATCH_THRESHOLD = 0.75;

// Auto-Matching-Pool: nur fertige Lieder fürs Gesangbuch 2026 – Status
// "Bewertet und genommen" (isGenommen) UND Bewertung kleiner Kreis = "Rein"
// (isRein), wie in NotenExport/AutorenMailing usw. So werden Notenbilder nicht
// automatisch Entwürfen, "nicht rein" bewerteten oder noch offenen Liedern
// zugeordnet. Die manuelle Auswahl (Autocomplete) bleibt über alle Lieder offen.
const matchableLieder = computed(() =>
    store.gesangbuchlieder.filter((l) => isGenommen(l) && isRein(l)),
);

const queue = ref([]); // [{ uid, file, name, page, liedId, suggestions, status, conflictChoice, errorMessage, fileId }]
const bake_on_upload = ref(true);
const dropbox_collapsed = ref(false);
const drag_over = ref(false);
const file_input = ref(null);
const uploading_all = ref(false);
const summary_open = ref(false);

const snackbar = ref(false);
const snackbar_message = ref('');

const matching_progress = ref({
    active: false,
    fileIndex: 0,
    fileTotal: 0,
    currentFile: '',
    candidateIndex: 0,
    candidateTotal: 0,
    bestLabel: '',
    bestScore: 0,
});

const matching_progress_percent = computed(() => {
    const p = matching_progress.value;
    if (!p.fileTotal) return 0;
    const filesDone = Math.max(0, p.fileIndex - 1);
    const inFile = p.candidateTotal ? p.candidateIndex / p.candidateTotal : 0;
    return Math.min(100, ((filesDone + inFile) / p.fileTotal) * 100);
});


let uidCounter = 0;
const nextUid = () => ++uidCounter;

function normalize(s) {
    return (s || '')
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function levenshtein(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = dp[j];
            dp[j] = a[i - 1] === b[j - 1]
                ? prev
                : Math.min(prev, dp[j], dp[j - 1]) + 1;
            prev = tmp;
        }
    }
    return dp[b.length];
}

function similarity(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const d = levenshtein(a, b);
    return 1 - d / Math.max(a.length, b.length);
}

// Slides the shorter string over the longer and returns the best window similarity.
// Handles "filename is a prefix/substring of song title" (and vice versa) cleanly.
function partialRatio(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    if (longer.includes(shorter)) return 1;
    const len = shorter.length;
    let best = 0;
    for (let i = 0; i <= longer.length - len; i++) {
        const sim = 1 - levenshtein(shorter, longer.slice(i, i + len)) / len;
        if (sim > best) best = sim;
        if (best === 1) break;
    }
    return best;
}

// Asymmetric token overlap: how much of the smaller token set is covered.
// Handles word reordering and extra trailing words ("Befiehl du deine Wege und was...").
function tokenSetRatio(a, b) {
    const ta = new Set(a.split(' ').filter(Boolean));
    const tb = new Set(b.split(' ').filter(Boolean));
    if (!ta.size || !tb.size) return 0;
    let intersect = 0;
    for (const t of ta) if (tb.has(t)) intersect++;
    return intersect / Math.min(ta.size, tb.size);
}

function hybridScore(candidate, query) {
    if (!candidate || !query) return 0;
    return Math.max(partialRatio(candidate, query), tokenSetRatio(candidate, query));
}

const FIRST_VERSE_FALLBACK_THRESHOLD = 0.6;
const FIRST_VERSE_PENALTY = 0.9;

function firstVerseText(lied) {
    const verse = lied?.text?.strophenEinzeln?.[0]?.strophe;
    if (!verse) return '';
    return verse.replaceAll('¬', '').replace(/\n+/g, ' ');
}

const SVG_EXT_RE = /\.svg$/i;
const MXL_EXT_RE = /\.(mxl|musicxml)$/i;
const PDF_EXT_RE = /\.pdf$/i;
// Finale-Quelldateien: .musx (Finale 2014+) und das ältere .mus.
const FINALE_EXT_RE = /\.(musx|mus)$/i;
// MIDI-Dateien: .mid und .midi.
const MIDI_EXT_RE = /\.midi?$/i;

function detectKind(name) {
    if (SVG_EXT_RE.test(name)) return 'svg';
    if (MXL_EXT_RE.test(name)) return 'mxl';
    if (PDF_EXT_RE.test(name)) return 'pdf';
    if (FINALE_EXT_RE.test(name)) return 'finale';
    if (MIDI_EXT_RE.test(name)) return 'midi';
    return null;
}

// MIDI-Trio-Varianten: Vorspiel / Standard-Strophe / Letzte Strophe.
const MIDI_VARIANTS = ['intro', 'main', 'outro'];
const MIDI_VARIANT_ORDER = { intro: 0, main: 1, outro: 2 };

function midiVariantLabel(v) {
    return { intro: 'Vorspiel', main: 'Strophe', outro: 'Ausleitung' }[v] || v;
}

function parseFilename(name) {
    let base = name
        .replace(SVG_EXT_RE, '')
        .replace(MXL_EXT_RE, '')
        .replace(PDF_EXT_RE, '')
        .replace(FINALE_EXT_RE, '')
        .replace(MIDI_EXT_RE, '');
    // MIDI-Trio: _intro / _main / _outro im Dateinamen wählt den Ziel-Slot.
    let midiVariant = null;
    const midiMatch = base.match(/[\s_\-]+(intro|main|outro)$/i);
    if (midiMatch) {
        midiVariant = midiMatch[1].toLowerCase();
        base = base.slice(0, base.length - midiMatch[0].length);
    }
    let page = 1;
    // Finale convention: ...001 / ...002 page suffix (also _001, -001 etc.)
    const finalePageMatch = base.match(/[\s_\-]?(\d{3})$/);
    if (finalePageMatch) {
        const n = parseInt(finalePageMatch[1], 10);
        if (n === 2) page = 2;
        // For n === 1 we keep page = 1 (default). Strip suffix either way to clean the title.
        if (n === 1 || n === 2) {
            base = base.slice(0, base.length - finalePageMatch[0].length);
        }
    } else {
        // Explicit Seite-2 suffix variants
        const seite2Patterns = [
            /[\s_\-]+seite\s*2$/i,
            /[\s_\-]+s2$/i,
            /[\s_\-]+p2$/i,
            /[\s_\-]+pg?2$/i,
            /[\s_\-]+2$/i,
        ];
        for (const re of seite2Patterns) {
            if (re.test(base)) {
                page = 2;
                base = base.replace(re, '');
                break;
            }
        }
    }
    // strip leading Liednummer
    let liednummer = null;
    const numMatch = base.match(/^\s*(\d{1,4})[\s_\-]+/);
    if (numMatch) {
        liednummer = numMatch[1];
        base = base.slice(numMatch[0].length);
    }
    return { base, normalizedBase: normalize(base), liednummer, page, midiVariant };
}

function scoreLied(lied, parsed, query) {
    let score = 0;
    let reason = [];
    if (parsed.liednummer) {
        if (String(lied.liednummer2026 || '') === parsed.liednummer) {
            score += 0.7;
            reason.push(`Nummer 2026 = ${parsed.liednummer}`);
        } else if (String(lied.liednummer2000 || '') === parsed.liednummer) {
            score += 0.55;
            reason.push(`Nummer 2000 = ${parsed.liednummer}`);
        }
    }
    const titleSim = hybridScore(normalize(lied.titel || ''), query);
    let textSim = titleSim;
    let usedFallback = false;
    if (titleSim < FIRST_VERSE_FALLBACK_THRESHOLD) {
        const verseSim = hybridScore(normalize(firstVerseText(lied)), query) *
            FIRST_VERSE_PENALTY;
        if (verseSim > titleSim) {
            textSim = verseSim;
            usedFallback = true;
        }
    }
    score += textSim * 0.9;
    if (textSim > 0.4) {
        reason.push(
            `${usedFallback ? 'Strophe 1' : 'Titel'} ~ ${(textSim * 100).toFixed(0)}%`,
        );
    }
    return { lied, score, reason: reason.join(', ') };
}

async function rankLiederAsync(parsed, onProgress) {
    const all = matchableLieder.value;
    const query = parsed.normalizedBase;
    const scored = [];
    const CHUNK = 25;
    let best = { score: 0, lied: null };
    for (let i = 0; i < all.length; i++) {
        const result = scoreLied(all[i], parsed, query);
        scored.push(result);
        if (result.score > best.score) best = { score: result.score, lied: result.lied };
        if ((i + 1) % CHUNK === 0 || i === all.length - 1) {
            onProgress?.(i + 1, best);
            await new Promise((r) => setTimeout(r, 0));
        }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
}

function pdfPoolKey(parsed) {
    return `${parsed.normalizedBase}|${parsed.page}`;
}

// Verknüpft jede SVG mit einem gleichnamigen PDF aus der Queue, damit die SVG
// optional (auf Knopfdruck) am PDF-Layout ausgerichtet werden kann (Issue #19).
// Die Ausrichtung läuft nicht mehr automatisch beim Hinzufügen.
function pairSvgWithPdf() {
    const pdfByKey = new Map();
    queue.value.forEach((q) => {
        if (q.kind === 'pdf') pdfByKey.set(pdfPoolKey(q.parsed), q);
    });
    queue.value.forEach((q) => {
        if (q.kind !== 'svg' || q.referencePdf) return;
        const pdf = pdfByKey.get(pdfPoolKey(q.parsed));
        if (pdf) {
            q.referencePdf = { file: pdf.file, name: pdf.file.name, parsed: pdf.parsed };
        }
    });
}

// Startet die PDF-Ausrichtung einer SVG auf Knopfdruck (Issue #19). Der Status
// wird über die bestehenden Chips angezeigt; ist die Analyse fertig, lässt sich
// das Ergebnis im Dialog öffnen.
function triggerPdfAlign(item) {
    if (item.kind !== 'svg' || !item.referencePdf) return;
    if (item.pdfAlign?.status === 'running') return;
    item.pdfAlign = { status: 'pending' };
    runPdfAlignWorker();
}

async function addFiles(files) {
    const arr = Array.from(files)
        .map((f) => ({ file: f, kind: detectKind(f.name) }))
        .filter((x) => x.kind);
    if (arr.length === 0) return;
    // SVG, PDF und MXL werden allesamt eigenständige Queue-Items (Issue #19 –
    // PDFs sind nicht mehr nur Layout-Referenz, sondern das Notenbild selbst).
    const candidateTotal = matchableLieder.value.length;
    console.log('[matching] starting', { files: arr.length, candidates: candidateTotal });
    matching_progress.value = {
        active: true,
        fileIndex: 0,
        fileTotal: arr.length,
        currentFile: '',
        candidateIndex: 0,
        candidateTotal,
        bestLabel: '',
        bestScore: 0,
    };
    try {
        for (let i = 0; i < arr.length; i++) {
            const { file, kind } = arr[i];
            matching_progress.value.fileIndex = i + 1;
            matching_progress.value.currentFile = file.name;
            matching_progress.value.candidateIndex = 0;
            matching_progress.value.bestLabel = '';
            matching_progress.value.bestScore = 0;
            const parsed = parseFilename(file.name);
            console.log('[matching] START', {
                fileIndex: matching_progress.value.fileIndex,
                fileTotal: matching_progress.value.fileTotal,
                candidateIndex: matching_progress.value.candidateIndex,
                candidateTotal: matching_progress.value.candidateTotal,
                percent: matching_progress_percent.value,
                file: file.name,
            });
            const suggestions = await rankLiederAsync(parsed, (n, best) => {
                matching_progress.value.candidateIndex = n;
                matching_progress.value.bestLabel = best?.lied?.titel || '';
                matching_progress.value.bestScore = best?.score || 0;
            });
            console.log('[matching] END', {
                fileIndex: matching_progress.value.fileIndex,
                fileTotal: matching_progress.value.fileTotal,
                candidateIndex: matching_progress.value.candidateIndex,
                candidateTotal: matching_progress.value.candidateTotal,
                percent: matching_progress_percent.value,
                file: file.name,
                top: suggestions[0] && {
                    titel: suggestions[0].lied.titel,
                    score: +suggestions[0].score.toFixed(3),
                },
            });
            const top = suggestions[0];
            const autoMatch = top && top.score >= AUTO_MATCH_THRESHOLD ? top.lied : null;
            const previewUrl = kind === 'svg' ? URL.createObjectURL(file) : null;
            const item = {
                uid: nextUid(),
                kind,
                file,
                name: file.name,
                previewUrl,
                parsed,
                // Seite betrifft nur das PDF-Notenbild; SVG/MXL/Finale/MIDI haben eigene Felder.
                page: kind === 'mxl' || kind === 'finale' || kind === 'midi' ? null : parsed.page,
                // MIDI-Trio-Slot (Vorspiel/Strophe/Ausleitung); ohne Suffix -> Strophe.
                midiVariant: kind === 'midi' ? parsed.midiVariant || 'main' : null,
                liedId: autoMatch?.id || null,
                suggestions,
                status: 'unmatched',
                conflictChoice: null,
                errorMessage: '',
                uploadedFileId: null,
                scan: kind === 'svg' ? { status: 'pending' } : null,
            };
            queue.value.push(item);
            if (autoMatch) refreshItemStatus(item);
        }
    } finally {
        matching_progress.value.active = false;
    }
    // SVG <-> PDF paaren, damit die SVG optional am PDF ausgerichtet werden kann.
    pairSvgWithPdf();
    sortQueue();
    if (queue.value.length > 0) dropbox_collapsed.value = true;
    runScanWorker();
}

function refreshItemStatus(item) {
    if (['uploading', 'done', 'skipped', 'error'].includes(item.status)) return;
    if (!item.liedId) {
        item.status = 'unmatched';
        return;
    }
    const lied = lookupLied(item.liedId);
    const wasConflict = item.status === 'conflict';
    if (lied && liedHasField(lied, item) && !item.conflictChoice) {
        item.status = 'conflict';
        if (!wasConflict || !item.uploadedEquality) queueEqualityCheck(item);
    } else {
        item.status = 'matched';
        item.uploadedEquality = null;
    }
}

function refreshAllStatuses() {
    queue.value.forEach(refreshItemStatus);
}

function sortQueue() {
    queue.value.sort((a, b) => {
        // Same lied: SVGs (by page) before MXL
        const aLied = a.liedId || -1;
        const bLied = b.liedId || -1;
        if (aLied !== bLied) {
            if (a.liedId && b.liedId) return aLied - bLied;
            if (a.liedId) return -1;
            if (b.liedId) return 1;
        }
        if (a.kind !== b.kind) return a.kind === 'svg' ? -1 : 1;
        if (a.kind === 'svg') return (a.page || 0) - (b.page || 0);
        return 0;
    });
}

function onDrop(e) {
    e.preventDefault();
    drag_over.value = false;
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
}

function onPickFiles(e) {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
}

function removeQueueItem(uid) {
    const item = queue.value.find((q) => q.uid === uid);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    queue.value = queue.value.filter((q) => q.uid !== uid);
    if (queue.value.length === 0) dropbox_collapsed.value = false;
}

function setLied(item, lied) {
    item.liedId = lied?.id || null;
    item.conflictChoice = null;
    refreshItemStatus(item);
    sortQueue();
}

function togglePage(item) {
    // Seite 1/2 betrifft nur das PDF-Notenbild (notentext / notentext_seite2).
    if (item.kind !== 'pdf') return;
    if (['uploading', 'done'].includes(item.status)) return;
    item.page = item.page === 1 ? 2 : 1;
    item.conflictChoice = null;
    refreshItemStatus(item);
}

function setMidiVariant(item, variant) {
    // Intro/Main/Outro betrifft nur MIDI (midi_intro / midi_main / midi_outro).
    if (item.kind !== 'midi' || !MIDI_VARIANTS.includes(variant)) return;
    if (['uploading', 'done'].includes(item.status)) return;
    if (item.midiVariant === variant) return;
    item.midiVariant = variant;
    item.conflictChoice = null;
    refreshItemStatus(item);
}

function applyConflictChoice(item, choice) {
    item.conflictChoice = choice;
    if (choice === 'swap') {
        if (item.kind !== 'pdf') return;
        item.page = item.page === 1 ? 2 : 1;
        item.conflictChoice = null;
        refreshItemStatus(item);
    } else if (choice === 'skip') {
        item.status = 'skipped';
    } else if (choice === 'overwrite') {
        item.status = 'matched';
    }
}

function applyConflictChoiceToAll(choice) {
    queue.value.forEach((item) => {
        if (item.status === 'conflict') applyConflictChoice(item, choice);
    });
}

function lookupLied(id) {
    return store.gesangbuchlieder.find((l) => l.id === id);
}

function liedHasField(lied, item) {
    if (!lied) return false;
    if (item.kind === 'mxl') return !!lied.notentext_mxml;
    if (item.kind === 'finale') return !!lied.finale_file;
    if (item.kind === 'midi') return !!lied[`midi_${item.midiVariant || 'main'}`];
    // SVG -> eigenes Feld (Issue #19); PDF -> notentext / notentext_seite2
    if (item.kind === 'svg') return !!lied.notentext_svg;
    return item.page === 2 ? !!lied.notentext_seite2 : !!lied.notentext;
}

function fieldFor(item) {
    if (item.kind === 'mxl') {
        return { field: 'notentext_mxml', fileField: 'notentext_mxml_file' };
    }
    // Finale-Quelldatei (.musx/.mus) landet in finale_file.
    if (item.kind === 'finale') {
        return { field: 'finale_file', fileField: 'finale_file_file' };
    }
    // MIDI-Trio: je nach Variante in midi_intro / midi_main / midi_outro.
    if (item.kind === 'midi') {
        const v = item.midiVariant || 'main';
        return { field: `midi_${v}`, fileField: `midi_${v}_file` };
    }
    // Die gebackene SVG landet in notentext_svg, das PDF-Notenbild in
    // notentext / notentext_seite2 (Issue #19).
    if (item.kind === 'svg') {
        return { field: 'notentext_svg', fileField: 'notentext_svg_file' };
    }
    return item.page === 2
        ? { field: 'notentext_seite2', fileField: 'notentext_seite2_file' }
        : { field: 'notentext', fileField: 'notentext_file' };
}

function liedAutocompleteItems() {
    return store.gesangbuchlieder.map((l) => ({
        id: l.id,
        title: `${l.liednummer2026 || l.liednummer2000 || ''} ${l.titel || ''}`.trim(),
        subtitle: `Status: ${l.status || '–'}`,
    }));
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsText(file);
    });
}

async function bakeFileToBlob(file, options = {}) {
    let svgText = await readFileAsText(file);
    if (options.pdfCorrections && options.pdfCorrections.size > 0) {
        svgText = await applyCorrections(svgText, options.pdfCorrections);
    }
    const { svgString, bakedCount, totalTexts } = await bakeSvgString(svgText);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    return { blob, bakedCount, totalTexts };
}

// Directus folder these uploads land in. When unset, files go to the instance
// default (root) — keeps local dev working against a Directus without this folder.
const NOTENTEXT_FOLDER_ID = import.meta.env.VITE_NOTENTEXT_FOLDER_ID;
// Finale-Quelldateien (.musx/.mus) bekommen einen eigenen Ordner, getrennt von
// den Notenbildern (SVG/PDF/MXL). Per Env überschreibbar, sonst fester Ordner.
const FINALE_FOLDER_ID =
    import.meta.env.VITE_FINALE_FOLDER_ID || 'b3a03c46-937e-4560-8233-3badf8dac706';
// MIDI-Dateien (.mid/.midi) bekommen ebenfalls einen eigenen Ordner.
const MIDI_FOLDER_ID =
    import.meta.env.VITE_MIDI_FOLDER_ID || 'd0d76c68-87fe-4c23-a799-753d38f584c5';

function folderForItem(item) {
    if (item.kind === 'finale') return FINALE_FOLDER_ID;
    if (item.kind === 'midi') return MIDI_FOLDER_ID;
    return NOTENTEXT_FOLDER_ID;
}

async function uploadBlob(blob, filename, displayName, folderId) {
    const formData = new FormData();
    formData.append('title', displayName);
    // Metadata fields must precede `file` so Directus applies them to the upload.
    if (folderId) formData.append('folder', folderId);
    formData.append('file', blob, filename);
    const resp = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/files`, formData);
    return resp.data.data;
}

async function patchLiedField(liedId, field, fileId, extraFields = null) {
    const payload = { [field]: fileId };
    // Optionale Zusatzfelder (z. B. notentext_uploaded_at für Issue #22).
    if (extraFields && typeof extraFields === 'object') Object.assign(payload, extraFields);
    const resp = await axios.patch(
        `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied/${liedId}`,
        payload,
    );
    return resp.data.data;
}

async function processItem(item) {
    if (!item.liedId) {
        item.status = 'unmatched';
        item.errorMessage = 'Kein Lied zugeordnet';
        return;
    }
    const lied = lookupLied(item.liedId);
    if (!lied) {
        item.status = 'error';
        item.errorMessage = 'Lied nicht gefunden';
        return;
    }
    if (item.conflictChoice === 'skip') {
        item.status = 'skipped';
        return;
    }
    if (liedHasField(lied, item) && item.conflictChoice !== 'overwrite') {
        item.status = 'conflict';
        return;
    }

    item.status = 'uploading';
    item.errorMessage = '';
    try {
        let uploaded;
        if (item.kind === 'svg' && bake_on_upload.value) {
            // If the dialog has produced edited corrections (locallyModified)
            // we trust item.file as-is. Otherwise apply the PDF auto-align
            // corrections (if any) before baking.
            const corrections =
                !item.locallyModified && item.pdfAlign?.status === 'done'
                    ? item.pdfAlign.corrections
                    : null;
            const { blob, bakedCount, totalTexts } = await bakeFileToBlob(item.file, {
                pdfCorrections: corrections,
            });
            item.bakedCount = bakedCount;
            item.totalTexts = totalTexts;
            uploaded = await uploadBlob(blob, item.file.name, item.name, folderForItem(item));
        } else {
            uploaded = await uploadBlob(
                item.file,
                item.file.name,
                item.name,
                folderForItem(item),
            );
        }
        item.uploadedFileId = uploaded.id;
        const { field, fileField } = fieldFor(item);
        // Beim Hochladen eines PDF-Notenbilds (Seite 1/2) den Upload-Zeitpunkt
        // mitschreiben, damit der Notentext-Export erkennt, welche Lieder seit
        // dem letzten Export neue Noten erhalten haben (Issue #22). SVG ->
        // notentext_svg bumpt notentext_uploaded_at NICHT.
        const notesUploadedAt = item.kind === 'pdf' ? new Date().toISOString() : null;
        const extra = notesUploadedAt ? { notentext_uploaded_at: notesUploadedAt } : {};

        // Fingerabdruck der Noten-Glyphen mitschreiben: Damit prüft der
        // Druck-Check, ob im Satz wirklich dieser Notensatz steht – und ob er
        // vollständig gedruckt wurde (printNotenCheck.js). Ohne ihn müsste er
        // die Noten-PDF jedes Liedes einzeln nachladen.
        //
        // Nur für `notentext`: Der Wert gehört zu genau dieser Datei (er trägt
        // ihre Id) und wird zusammen mit ihr gesetzt – so kann er nicht
        // veralten. Schlägt es fehl, ist das kein Grund, den Upload scheitern zu
        // lassen: Der Check lädt die PDF dann eben nach.
        if (field === 'notentext') {
            try {
                extra.notentext_fingerprint = await fingerprintFromFile(item.file, uploaded.id);
            } catch (e) {
                console.warn('Notensatz-Fingerabdruck konnte nicht berechnet werden', e);
            }
        }

        await patchLiedField(item.liedId, field, uploaded.id, extra);
        // sync local store
        store.file.push(uploaded);
        const idx = store.gesangbuchlied.findIndex((l) => l.id === item.liedId);
        if (idx !== -1) {
            store.gesangbuchlied[idx][field] = uploaded.id;
            store.gesangbuchlied[idx][fileField] = uploaded;
            if (notesUploadedAt) {
                store.gesangbuchlied[idx].notentext_uploaded_at = notesUploadedAt;
            }
            if (extra.notentext_fingerprint) {
                store.gesangbuchlied[idx].notentext_fingerprint = extra.notentext_fingerprint;
            }
        }
        item.status = 'done';
    } catch (e) {
        item.status = 'error';
        item.errorMessage = e?.response?.data?.errors?.[0]?.message || e.message || String(e);
    }
}

async function uploadAll() {
    uploading_all.value = true;
    for (const item of queue.value) {
        if (item.status === 'done' || item.status === 'skipped') continue;
        if (!item.liedId) continue;
        if (item.status === 'conflict' && !item.conflictChoice) continue;
        await processItem(item);
    }
    uploading_all.value = false;
    if (queue.value.every((q) => q.status === 'done' || q.status === 'skipped')) {
        summary_open.value = true;
    }
}

const stats = computed(() => {
    const total = queue.value.length;
    const done = queue.value.filter((q) => q.status === 'done').length;
    const skipped = queue.value.filter((q) => q.status === 'skipped').length;
    const error = queue.value.filter((q) => q.status === 'error').length;
    const conflict = queue.value.filter((q) => q.status === 'conflict').length;
    const unmatched = queue.value.filter((q) => q.status === 'unmatched').length;
    const matched = queue.value.filter((q) => q.status === 'matched').length;
    const bake_warn = queue.value.filter((q) => q.scan?.severity?.level === 'warn').length;
    const bake_fail = queue.value.filter((q) => q.scan?.severity?.level === 'fail').length;
    const bake_scanning = queue.value.filter(
        (q) => q.scan?.status === 'pending' || q.scan?.status === 'scanning',
    ).length;
    const ready = matched;
    return {
        total,
        done,
        skipped,
        error,
        conflict,
        unmatched,
        ready,
        bake_warn,
        bake_fail,
        bake_scanning,
    };
});


const GROUP_COLORS = [
    '#1976D2', // blue
    '#7B1FA2', // purple
    '#388E3C', // green
    '#F57C00', // orange
    '#C2185B', // pink
    '#0097A7', // teal
    '#5D4037', // brown
];

function groupColor(liedId) {
    if (!liedId) return null;
    return GROUP_COLORS[liedId % GROUP_COLORS.length];
}

function sortItemsForGroup(items) {
    return [...items].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'svg' ? -1 : 1;
        if (a.kind === 'svg') return (a.page || 0) - (b.page || 0) || a.uid - b.uid;
        if (a.kind === 'midi') {
            const oa = MIDI_VARIANT_ORDER[a.midiVariant] ?? 9;
            const ob = MIDI_VARIANT_ORDER[b.midiVariant] ?? 9;
            return oa - ob || a.uid - b.uid;
        }
        return a.uid - b.uid;
    });
}

const groups = computed(() => {
    const byLied = new Map();
    const unmatched = [];
    for (const item of queue.value) {
        if (item.liedId) {
            if (!byLied.has(item.liedId)) byLied.set(item.liedId, []);
            byLied.get(item.liedId).push(item);
        } else {
            unmatched.push(item);
        }
    }
    const result = [];
    const liedIds = Array.from(byLied.keys()).sort((a, b) => {
        const la = lookupLied(a);
        const lb = lookupLied(b);
        const na = parseInt(la?.liednummer2026 || la?.liednummer2000 || '0', 10);
        const nb = parseInt(lb?.liednummer2026 || lb?.liednummer2000 || '0', 10);
        if (na && nb && na !== nb) return na - nb;
        return a - b;
    });
    for (const liedId of liedIds) {
        const items = sortItemsForGroup(byLied.get(liedId));
        result.push({
            key: `lied-${liedId}`,
            kind: 'matched',
            liedId,
            lied: lookupLied(liedId),
            items,
        });
    }
    for (const item of unmatched) {
        result.push({ key: `unmatched-${item.uid}`, kind: 'unmatched', items: [item] });
    }
    return result;
});

const editing_group_key = ref(null);

function startEditLied(group) {
    editing_group_key.value = group.key;
}

function cancelEditLied() {
    editing_group_key.value = null;
}

function setGroupLied(group, lied) {
    const newId = lied?.id || null;
    for (const item of group.items) {
        if (['uploading', 'done'].includes(item.status)) continue;
        item.liedId = newId;
        item.conflictChoice = null;
        refreshItemStatus(item);
    }
    editing_group_key.value = null;
    sortQueue();
}

function detachItem(item) {
    if (['uploading', 'done'].includes(item.status)) return;
    item.liedId = null;
    item.conflictChoice = null;
    refreshItemStatus(item);
    sortQueue();
}

function showPageToggle(item, group) {
    // Seite 1/2 betrifft nur das PDF-Notenbild (notentext / notentext_seite2).
    if (item.kind !== 'pdf') return false;
    if (item.page === 2) return true;
    if (item.parsed?.page === 2) return true;
    const pdfCount = group?.items?.filter((i) => i.kind === 'pdf').length ?? 0;
    if (pdfCount > 1) return true;
    return false;
}

const can_upload_any = computed(
    () =>
        !uploading_all.value &&
        queue.value.some((q) => q.status === 'matched' || (q.status === 'conflict' && q.conflictChoice)),
);

watch(queue, () => {
    if (queue.value.length === 0) summary_open.value = false;
}, { deep: true });

watch(
    () => queue.value.map((q) => `${q.liedId}|${q.page}|${q.midiVariant}`).join(','),
    () => refreshAllStatuses(),
);

function statusColor(status) {
    return {
        matched: 'success',
        unmatched: 'warning',
        conflict: 'error',
        uploading: 'info',
        done: 'success',
        error: 'error',
        skipped: 'grey',
    }[status] || 'grey';
}

function statusLabel(status) {
    return {
        matched: 'Bereit',
        unmatched: 'Lied wählen',
        conflict: 'Konflikt',
        uploading: 'Lade hoch…',
        done: 'Fertig',
        error: 'Fehler',
        skipped: 'Übersprungen',
    }[status] || status;
}

function clearDone() {
    queue.value = queue.value.filter((q) => q.status !== 'done' && q.status !== 'skipped');
}

function clearAll() {
    queue.value.forEach((q) => q.previewUrl && URL.revokeObjectURL(q.previewUrl));
    queue.value = [];
    summary_open.value = false;
    dropbox_collapsed.value = false;
}

function buildSummaryText() {
    const lines = [];
    lines.push(`Notentext-Upload — ${new Date().toLocaleString('de-DE')}`);
    lines.push('');
    const done = queue.value.filter((q) => q.status === 'done');
    if (done.length) {
        lines.push(`Hochgeladen (${done.length}):`);
        done.forEach((q) => {
            const lied = lookupLied(q.liedId);
            const kindLabel =
                q.kind === 'mxl'
                    ? 'MusicXML'
                    : q.kind === 'svg'
                        ? 'SVG'
                        : q.kind === 'finale'
                            ? 'Finale'
                            : q.kind === 'midi'
                                ? `MIDI ${midiVariantLabel(q.midiVariant)}`
                                : `Seite ${q.page}`;
            lines.push(
                `  • Lied ${lied?.liednummer2026 || lied?.liednummer2000 || '–'} „${lied?.titel || ''}" – ${kindLabel} (${q.name})`,
            );
        });
        lines.push('');
    }
    const errs = queue.value.filter((q) => q.status === 'error');
    if (errs.length) {
        lines.push(`Fehler (${errs.length}):`);
        errs.forEach((q) =>
            lines.push(`  • ${q.name}: ${q.errorMessage}`),
        );
    }
    const skipped = queue.value.filter((q) => q.status === 'skipped');
    if (skipped.length) {
        lines.push(`Übersprungen (${skipped.length}):`);
        skipped.forEach((q) => lines.push(`  • ${q.name}`));
    }
    return lines.join('\n');
}

async function shareSummary() {
    const text = buildSummaryText();
    try {
        await navigator.clipboard.writeText(text);
        snackbar_message.value = 'Zusammenfassung in Zwischenablage kopiert';
        snackbar.value = true;
    } catch {
        snackbar_message.value = 'Kopieren fehlgeschlagen';
        snackbar.value = true;
    }
}
</script>

<template>
    <div class="d-flex align-center flex-wrap ga-2 mb-3">
        <h1 class="me-4">Notentext-Hochladen</h1>
        <v-chip v-if="queue.length" color="primary" variant="tonal">
            In Queue: {{ stats.total }}
        </v-chip>
        <v-chip v-if="stats.done" color="success" variant="tonal">Fertig: {{ stats.done }}</v-chip>
        <v-chip v-if="stats.conflict" color="error" variant="tonal">Konflikte: {{ stats.conflict }}</v-chip>
        <v-chip v-if="stats.unmatched" color="warning" variant="tonal">Ohne Match: {{ stats.unmatched }}</v-chip>
        <v-chip v-if="stats.error" color="error" variant="tonal">Fehler: {{ stats.error }}</v-chip>
        <v-chip
            v-if="stats.bake_scanning"
            color="info"
            variant="tonal"
            prepend-icon="mdi-progress-clock"
        >
            Prüfe Bake: {{ stats.bake_scanning }}
        </v-chip>
        <v-chip
            v-if="stats.bake_warn"
            color="warning"
            variant="tonal"
            prepend-icon="mdi-alert-outline"
        >
            Texte teilweise gebacken: {{ stats.bake_warn }}
        </v-chip>
        <v-chip
            v-if="stats.bake_fail"
            color="error"
            variant="tonal"
            prepend-icon="mdi-alert"
        >
            Bake-Fehler: {{ stats.bake_fail }}
        </v-chip>
    </div>

    <v-card class="mb-3">
        <v-card-text class="py-2">
            <div v-if="!dropbox_collapsed">
                <div
                    class="drop-zone"
                    :class="{ 'drop-zone--active': drag_over }"
                    @drop="onDrop"
                    @dragover.prevent="drag_over = true"
                    @dragleave.prevent="drag_over = false"
                    @dragend.prevent="drag_over = false"
                    @click="file_input?.click()"
                >
                    <v-icon size="40" color="primary">mdi-cloud-upload-outline</v-icon>
                    <div class="text-subtitle-1 mt-2">
                        SVG-, PDF-, MXL-, Finale- (.musx/.mus) und MIDI-Dateien (.mid) hier ablegen
                        oder klicken zum Auswählen
                    </div>
                    <div class="text-caption text-medium-emphasis">
                        Mehrere Dateien auf einmal möglich. Liednummer und „_seite2"/„_2" im
                        Dateinamen werden erkannt. Das PDF-Notenbild wird als Notentext
                        gespeichert (Seite 1/2), die SVG zusätzlich gebacken als
                        Bearbeitungs-Vorlage. Liegen SVG und PDF zum selben Lied vor, kann die SVG
                        auf Knopfdruck am PDF-Layout ausgerichtet werden. Bei MIDI-Dateien wählt
                        „_intro"/„_main"/„_outro" den Slot (Vorspiel/Strophe/Ausleitung).
                    </div>
                </div>
            </div>
            <div v-else class="d-flex align-center ga-2">
                <v-btn
                    prepend-icon="mdi-cloud-upload-outline"
                    variant="tonal"
                    color="primary"
                    @click="file_input?.click()"
                >
                    Weitere Dateien hinzufügen
                </v-btn>
                <v-btn
                    variant="text"
                    size="small"
                    prepend-icon="mdi-chevron-up"
                    @click="dropbox_collapsed = false"
                >
                    Drop-Bereich anzeigen
                </v-btn>
                <v-spacer />
                <v-btn
                    v-if="queue.some((q) => q.status === 'done' || q.status === 'skipped')"
                    size="small"
                    variant="text"
                    @click="clearDone"
                >
                    Fertige entfernen
                </v-btn>
                <v-btn size="small" variant="text" color="error" @click="clearAll">
                    Alle entfernen
                </v-btn>
            </div>
            <input
                ref="file_input"
                type="file"
                accept=".svg,image/svg+xml,.mxl,.musicxml,.pdf,application/pdf,.musx,.mus,.mid,.midi,audio/midi,audio/x-midi"
                multiple
                style="display: none"
                @change="onPickFiles"
            />
        </v-card-text>
    </v-card>

    <div v-if="queue.length === 0" class="text-medium-emphasis text-center pa-8">
        Noch keine Dateien in der Queue.
    </div>

    <div v-else class="d-flex flex-column ga-3">
        <v-card
            v-for="group in groups"
            :key="group.key"
            variant="outlined"
            :style="{
                borderLeft: group.kind === 'matched'
                    ? `5px solid ${groupColor(group.liedId)}`
                    : '5px solid rgb(var(--v-theme-warning))',
            }"
        >
            <!-- Group header -->
            <div
                class="d-flex align-center ga-2 flex-wrap pa-3"
                :style="{
                    background: group.kind === 'matched'
                        ? 'rgba(0,0,0,0.02)'
                        : 'rgba(var(--v-theme-warning), 0.06)',
                }"
            >
                <template v-if="group.kind === 'matched' && editing_group_key !== group.key">
                    <v-chip
                        size="small"
                        variant="flat"
                        :style="{ backgroundColor: groupColor(group.liedId), color: 'white' }"
                    >
                        Lied {{ group.lied?.liednummer2026 || group.lied?.liednummer2000 || '–' }}
                    </v-chip>
                    <span class="text-subtitle-1 font-weight-medium">
                        {{ group.lied?.titel || 'Unbekanntes Lied' }}
                    </span>
                    <v-chip size="x-small" variant="tonal">
                        {{ group.lied?.status_mapped || group.lied?.status || '–' }}
                    </v-chip>
                    <v-chip size="x-small" variant="tonal" prepend-icon="mdi-file-multiple-outline">
                        {{ group.items.length }} Datei{{ group.items.length === 1 ? '' : 'en' }}
                    </v-chip>
                    <v-spacer />
                    <v-tooltip text="Lied wechseln" location="top">
                        <template #activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon="mdi-pencil-outline"
                                variant="text"
                                size="small"
                                @click="startEditLied(group)"
                            />
                        </template>
                    </v-tooltip>
                    <v-tooltip text="Lied öffnen" location="top">
                        <template #activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon="mdi-open-in-new"
                                variant="text"
                                size="small"
                                :to="`/lied/${group.liedId}`"
                            />
                        </template>
                    </v-tooltip>
                </template>
                <template v-else-if="group.kind === 'matched' && editing_group_key === group.key">
                    <v-autocomplete
                        :model-value="group.liedId"
                        :items="liedAutocompleteItems()"
                        item-title="title"
                        item-value="id"
                        density="compact"
                        hide-details
                        clearable
                        label="Lied wechseln"
                        style="min-width: 320px; max-width: 480px"
                        autofocus
                        @update:model-value="(v) => setGroupLied(group, v ? lookupLied(v) : null)"
                    />
                    <v-btn
                        size="small"
                        variant="text"
                        prepend-icon="mdi-close"
                        @click="cancelEditLied"
                    >
                        Abbrechen
                    </v-btn>
                    <template v-if="group.items[0].suggestions?.length">
                        <span class="text-caption text-medium-emphasis">Vorschläge:</span>
                        <v-chip
                            v-for="s in group.items[0].suggestions.slice(0, 3).filter((s) => s.score > 0.2 && s.lied.id !== group.liedId)"
                            :key="s.lied.id"
                            size="x-small"
                            variant="tonal"
                            color="primary"
                            class="cursor-pointer"
                            @click="setGroupLied(group, s.lied)"
                        >
                            {{ s.lied.liednummer2026 || s.lied.liednummer2000 || '?' }} ·
                            {{ s.lied.titel }}
                            ({{ (s.score * 100).toFixed(0) }}%)
                        </v-chip>
                    </template>
                </template>
                <template v-else>
                    <v-icon color="warning">mdi-alert-outline</v-icon>
                    <v-autocomplete
                        :model-value="group.items[0].liedId"
                        :items="liedAutocompleteItems()"
                        item-title="title"
                        item-value="id"
                        density="compact"
                        hide-details
                        clearable
                        label="Lied wählen"
                        style="min-width: 320px; max-width: 480px"
                        :disabled="['uploading', 'done'].includes(group.items[0].status)"
                        @update:model-value="
                            (v) => setLied(group.items[0], v ? lookupLied(v) : null)
                        "
                    />
                    <template v-if="group.items[0].suggestions?.length">
                        <span class="text-caption text-medium-emphasis">Vorschläge:</span>
                        <v-chip
                            v-for="s in group.items[0].suggestions.slice(0, 3).filter((s) => s.score > 0.2)"
                            :key="s.lied.id"
                            size="x-small"
                            variant="tonal"
                            color="primary"
                            class="cursor-pointer"
                            @click="setLied(group.items[0], s.lied)"
                        >
                            {{ s.lied.liednummer2026 || s.lied.liednummer2000 || '?' }} ·
                            {{ s.lied.titel }}
                            ({{ (s.score * 100).toFixed(0) }}%)
                        </v-chip>
                    </template>
                </template>
            </div>

            <v-divider />

            <!-- File rows -->
            <div
                v-for="(item, idx) in group.items"
                :key="item.uid"
                class="d-flex align-stretch ga-3 pa-3"
                :class="{ 'item-row-separator': idx > 0 }"
            >
                <div
                    class="item-thumb"
                    :class="{
                        'item-thumb--clickable': item.kind === 'svg' && item.previewUrl,
                        'item-thumb--sheet': item.kind === 'svg' && item.previewUrl,
                    }"
                    :title="item.kind === 'svg' && item.previewUrl ? 'Vorschau vergrößern' : ''"
                    @click="openPreviewDialog(item)"
                >
                    <img
                        v-if="item.kind === 'svg' && item.previewUrl"
                        :src="item.previewUrl"
                        alt="SVG-Vorschau"
                        style="max-width: 100%; max-height: 100%; object-fit: contain"
                    />
                    <template v-else-if="item.kind === 'mxl'">
                        <v-icon size="40" color="primary">mdi-music-box-multiple-outline</v-icon>
                        <div class="text-caption text-medium-emphasis mt-1">MusicXML</div>
                    </template>
                    <template v-else-if="item.kind === 'pdf'">
                        <v-icon size="40" color="error">mdi-file-pdf-box</v-icon>
                        <div class="text-caption text-medium-emphasis mt-1">PDF</div>
                    </template>
                    <template v-else-if="item.kind === 'finale'">
                        <v-icon size="40" color="purple">mdi-file-music-outline</v-icon>
                        <div class="text-caption text-medium-emphasis mt-1">Finale</div>
                    </template>
                    <template v-else-if="item.kind === 'midi'">
                        <v-icon size="40" color="teal">mdi-piano</v-icon>
                        <div class="text-caption text-medium-emphasis mt-1">
                            MIDI · {{ midiVariantLabel(item.midiVariant) }}
                        </div>
                    </template>
                </div>

                <div class="d-flex flex-column ga-1 flex-grow-1" style="min-width: 0;">
                    <div class="d-flex align-center ga-2 flex-wrap">
                        <v-chip
                            size="x-small"
                            :color="statusColor(item.status)"
                            variant="tonal"
                        >
                            {{ statusLabel(item.status) }}
                        </v-chip>
                        <span class="text-body-2 font-weight-medium text-truncate">
                            {{ item.name }}
                        </span>
                        <v-chip
                            v-if="item.kind === 'mxl'"
                            size="x-small"
                            variant="tonal"
                            color="primary"
                            prepend-icon="mdi-music-box-outline"
                        >
                            MusicXML
                        </v-chip>
                        <v-chip
                            v-else-if="item.kind === 'svg'"
                            size="x-small"
                            variant="tonal"
                            color="primary"
                            prepend-icon="mdi-svg"
                        >
                            SVG
                        </v-chip>
                        <v-chip
                            v-else-if="item.kind === 'finale'"
                            size="x-small"
                            variant="tonal"
                            color="purple"
                            prepend-icon="mdi-file-music-outline"
                        >
                            Finale
                        </v-chip>
                        <template v-else-if="item.kind === 'midi'">
                            <v-chip
                                size="x-small"
                                variant="tonal"
                                color="teal"
                                prepend-icon="mdi-piano"
                            >
                                MIDI
                            </v-chip>
                            <v-btn-toggle
                                :model-value="item.midiVariant"
                                mandatory
                                density="compact"
                                variant="outlined"
                                :disabled="['uploading', 'done'].includes(item.status)"
                                @update:model-value="(v) => v && setMidiVariant(item, v)"
                            >
                                <v-btn value="intro" size="x-small">Vorspiel</v-btn>
                                <v-btn value="main" size="x-small">Strophe</v-btn>
                                <v-btn value="outro" size="x-small">Ausleitung</v-btn>
                            </v-btn-toggle>
                        </template>
                        <template v-else>
                            <v-chip
                                v-if="!showPageToggle(item, group)"
                                size="x-small"
                                variant="tonal"
                            >
                                Seite 1
                            </v-chip>
                            <v-btn-toggle
                                v-else
                                :model-value="item.page"
                                mandatory
                                density="compact"
                                variant="outlined"
                                :disabled="['uploading', 'done'].includes(item.status)"
                                @update:model-value="(v) => v !== item.page && togglePage(item)"
                            >
                                <v-btn :value="1" size="x-small">Seite 1</v-btn>
                                <v-btn :value="2" size="x-small">Seite 2</v-btn>
                            </v-btn-toggle>
                        </template>

                        <v-chip
                            v-if="item.scan?.status === 'pending' || item.scan?.status === 'scanning'"
                            size="x-small"
                            variant="tonal"
                            color="info"
                            prepend-icon="mdi-progress-clock"
                        >
                            Prüfe Bake…
                        </v-chip>
                        <v-tooltip
                            v-else-if="item.scan?.status === 'done'"
                            :text="`${item.scan.bakedCount} von ${item.scan.totalTexts} Texten erfolgreich gebacken. Klicken für Detailvergleich.`"
                            location="top"
                            max-width="320"
                        >
                            <template #activator="{ props }">
                                <v-chip
                                    v-bind="props"
                                    size="x-small"
                                    variant="tonal"
                                    :color="item.scan.severity.color"
                                    :prepend-icon="
                                        item.scan.severity.level === 'ok'
                                            ? 'mdi-check-circle-outline'
                                            : item.scan.severity.level === 'warn'
                                                ? 'mdi-alert-outline'
                                                : 'mdi-alert'
                                    "
                                    class="cursor-pointer"
                                    @click="openCompareDialog(item)"
                                >
                                    Bake: {{ item.scan.bakedCount }} / {{ item.scan.totalTexts }}
                                </v-chip>
                            </template>
                        </v-tooltip>
                        <v-tooltip
                            v-else-if="item.scan?.status === 'error'"
                            :text="item.scan.error || 'Bake-Prüfung fehlgeschlagen'"
                            location="top"
                        >
                            <template #activator="{ props }">
                                <v-chip
                                    v-bind="props"
                                    size="x-small"
                                    variant="tonal"
                                    color="grey"
                                    prepend-icon="mdi-help-circle-outline"
                                >
                                    Bake-Prüfung ?
                                </v-chip>
                            </template>
                        </v-tooltip>

                        <v-tooltip
                            v-if="item.scan?.status === 'done' && item.scan.alignment?.misalignedCount > 0"
                            :text="`${item.scan.alignment.misalignedCount} Silben sitzen nicht zentriert unter ihrer Note. Klicken zum Korrigieren.`"
                            location="top"
                            max-width="320"
                        >
                            <template #activator="{ props }">
                                <v-chip
                                    v-bind="props"
                                    size="x-small"
                                    variant="tonal"
                                    color="warning"
                                    prepend-icon="mdi-vector-arrange-below"
                                    class="cursor-pointer"
                                    @click="openAlignDialog(item)"
                                >
                                    {{ item.scan.alignment.misalignedCount }} verschoben
                                </v-chip>
                            </template>
                        </v-tooltip>

                        <v-tooltip
                            v-if="item.kind === 'svg' && item.pdfAlign?.status === 'running'"
                            text="PDF-Referenz wird analysiert…"
                            location="top"
                        >
                            <template #activator="{ props }">
                                <v-chip
                                    v-bind="props"
                                    size="x-small"
                                    variant="tonal"
                                    color="info"
                                    prepend-icon="mdi-progress-clock"
                                >
                                    PDF-Ausrichtung…
                                </v-chip>
                            </template>
                        </v-tooltip>
                        <v-tooltip
                            v-else-if="item.kind === 'svg' && item.pdfAlign?.status === 'done'"
                            :text="`${item.pdfAlign.report.changedCount} Silben automatisch am PDF ausgerichtet (max. Verschiebung ${item.pdfAlign.report.maxAbsDelta.toFixed(2)}). Klicken zum Anzeigen.`"
                            location="top"
                            max-width="340"
                        >
                            <template #activator="{ props }">
                                <v-chip
                                    v-bind="props"
                                    size="x-small"
                                    variant="tonal"
                                    color="success"
                                    prepend-icon="mdi-file-pdf-box"
                                    class="cursor-pointer"
                                    @click="openAlignDialog(item)"
                                >
                                    PDF: {{ item.pdfAlign.report.changedCount }} ausgerichtet
                                </v-chip>
                            </template>
                        </v-tooltip>
                        <v-tooltip
                            v-else-if="item.kind === 'svg' && item.pdfAlign?.status === 'error'"
                            :text="item.pdfAlign.error || 'PDF-Ausrichtung fehlgeschlagen'"
                            location="top"
                            max-width="340"
                        >
                            <template #activator="{ props }">
                                <v-chip
                                    v-bind="props"
                                    size="x-small"
                                    variant="tonal"
                                    color="error"
                                    prepend-icon="mdi-alert"
                                >
                                    PDF-Ausrichtung fehlgeschlagen
                                </v-chip>
                            </template>
                        </v-tooltip>
                        <v-tooltip
                            v-else-if="item.kind === 'svg' && item.referencePdf"
                            text="SVG am PDF-Layout ausrichten (Analyse auf Knopfdruck)"
                            location="top"
                        >
                            <template #activator="{ props }">
                                <v-chip
                                    v-bind="props"
                                    size="x-small"
                                    variant="tonal"
                                    color="primary"
                                    prepend-icon="mdi-file-pdf-box"
                                    class="cursor-pointer"
                                    @click="triggerPdfAlign(item)"
                                >
                                    PDF ausrichten
                                </v-chip>
                            </template>
                        </v-tooltip>
                    </div>

                    <div
                        v-if="item.status === 'conflict'"
                        class="d-flex align-center ga-2 flex-wrap mt-1"
                    >
                        <v-icon size="small" color="error">mdi-alert</v-icon>
                        <span class="text-caption">
                            <template v-if="item.kind === 'mxl'">
                                Lied hat bereits eine MusicXML-Datei. Was tun?
                            </template>
                            <template v-else-if="item.kind === 'svg'">
                                Lied hat bereits eine SVG-Notentext-Datei. Was tun?
                            </template>
                            <template v-else-if="item.kind === 'finale'">
                                Lied hat bereits eine Finale-Datei. Was tun?
                            </template>
                            <template v-else-if="item.kind === 'midi'">
                                Lied hat bereits eine MIDI-Datei für
                                {{ midiVariantLabel(item.midiVariant) }}. Was tun?
                            </template>
                            <template v-else>
                                Lied hat bereits einen Notentext für Seite {{ item.page }}. Was tun?
                            </template>
                        </span>
                        <template
                            v-if="
                                !item.locallyModified &&
                                item.uploadedEquality?.status === 'done' &&
                                item.uploadedEquality.equal
                            "
                        >
                            <v-btn
                                v-if="item.kind === 'svg' && existingFileUrlFor(item)"
                                size="x-small"
                                variant="tonal"
                                color="success"
                                prepend-icon="mdi-equal"
                                @click="openCompareDialog(item)"
                            >
                                Gleich mit hochgeladener Version
                            </v-btn>
                            <v-btn
                                v-if="item.kind === 'pdf'"
                                size="x-small"
                                variant="tonal"
                                @click="applyConflictChoice(item, 'swap')"
                            >
                                Als Seite {{ item.page === 1 ? 2 : 1 }} nehmen
                            </v-btn>
                            <v-btn
                                size="x-small"
                                color="primary"
                                variant="flat"
                                @click="applyConflictChoice(item, 'skip')"
                            >
                                Überspringen
                            </v-btn>
                        </template>
                        <template v-else>
                            <v-btn
                                v-if="item.kind === 'svg' && existingFileUrlFor(item)"
                                size="x-small"
                                variant="tonal"
                                color="primary"
                                prepend-icon="mdi-vector-difference-ab"
                                :loading="item.uploadedEquality?.status === 'checking'"
                                @click="openCompareDialog(item)"
                            >
                                Mit hochgeladener Version vergleichen
                            </v-btn>
                            <v-btn
                                v-if="item.kind === 'pdf' && canComparePdf(item)"
                                size="x-small"
                                variant="tonal"
                                color="primary"
                                prepend-icon="mdi-file-compare"
                                @click="openPdfCompareDialog(item)"
                            >
                                Mit vorhandenem vergleichen
                            </v-btn>
                            <v-btn
                                size="x-small"
                                color="error"
                                variant="tonal"
                                @click="applyConflictChoice(item, 'overwrite')"
                            >
                                Überschreiben
                            </v-btn>
                            <v-btn
                                v-if="item.kind === 'pdf'"
                                size="x-small"
                                variant="tonal"
                                @click="applyConflictChoice(item, 'swap')"
                            >
                                Als Seite {{ item.page === 1 ? 2 : 1 }} nehmen
                            </v-btn>
                            <v-btn
                                size="x-small"
                                variant="tonal"
                                @click="applyConflictChoice(item, 'skip')"
                            >
                                Überspringen
                            </v-btn>
                        </template>
                    </div>

                    <div v-if="item.errorMessage" class="text-caption text-error mt-1">
                        {{ item.errorMessage }}
                    </div>
                </div>

                <div class="d-flex align-center ga-1">
                    <v-tooltip
                        v-if="item.kind === 'svg'"
                        text="Bake-Vergleich: Original vs. gebackene Version mit Pixel-Diff"
                        location="top"
                    >
                        <template #activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon="mdi-vector-difference-ab"
                                variant="text"
                                size="small"
                                :disabled="item.status === 'uploading'"
                                @click="openCompareDialog(item)"
                            />
                        </template>
                    </v-tooltip>
                    <v-tooltip
                        v-if="item.kind === 'pdf' && canComparePdf(item)"
                        text="Mit vorhandenem Notentext (Seite 1/2) vergleichen"
                        location="top"
                    >
                        <template #activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon="mdi-file-compare"
                                variant="text"
                                size="small"
                                :disabled="item.status === 'uploading'"
                                @click="openPdfCompareDialog(item)"
                            />
                        </template>
                    </v-tooltip>
                    <v-tooltip
                        v-if="group.kind === 'matched' && group.items.length > 1"
                        text="Aus dieser Gruppe lösen (Lied entfernen)"
                        location="top"
                    >
                        <template #activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon="mdi-link-variant-off"
                                variant="text"
                                size="small"
                                :disabled="['uploading', 'done'].includes(item.status)"
                                @click="detachItem(item)"
                            />
                        </template>
                    </v-tooltip>
                    <v-tooltip text="Aus Queue entfernen" location="top">
                        <template #activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon="mdi-close"
                                variant="text"
                                size="small"
                                :disabled="item.status === 'uploading'"
                                @click="removeQueueItem(item.uid)"
                            />
                        </template>
                    </v-tooltip>
                </div>
            </div>
        </v-card>
    </div>

    <div v-if="queue.length" class="d-flex align-center ga-2 mt-4 flex-wrap">
        <template v-if="stats.conflict > 0">
            <span class="text-caption">
                {{ stats.conflict }} Konflikt{{ stats.conflict === 1 ? '' : 'e' }}:
            </span>
            <v-btn
                size="small"
                color="error"
                variant="tonal"
                prepend-icon="mdi-content-save-edit"
                @click="applyConflictChoiceToAll('overwrite')"
            >
                Alle überschreiben
            </v-btn>
            <v-btn
                size="small"
                variant="tonal"
                prepend-icon="mdi-skip-next"
                @click="applyConflictChoiceToAll('skip')"
            >
                Alle überspringen
            </v-btn>
        </template>
        <v-spacer />
        <v-tooltip
            text="Wenn aktiviert: Schriften (Finale Maestro / Optima LT) werden vor dem Upload zu Pfaden gewandelt. Empfohlen — das hochgeladene SVG sieht überall identisch aus, unabhängig davon, ob die Schriften installiert sind."
            location="top"
            max-width="320"
        >
            <template #activator="{ props }">
                <v-checkbox
                    v-bind="props"
                    v-model="bake_on_upload"
                    label="Schriften zu Pfaden backen"
                    hide-details
                    density="comfortable"
                    :disabled="uploading_all"
                />
            </template>
        </v-tooltip>
        <v-btn
            color="primary"
            :disabled="!can_upload_any"
            :loading="uploading_all"
            prepend-icon="mdi-upload"
            @click="uploadAll"
        >
            Alle hochladen
        </v-btn>
    </div>

    <v-dialog v-model="summary_open" max-width="640">
        <v-card>
            <v-card-title class="d-flex align-center ga-2">
                <v-icon color="success">mdi-check-circle</v-icon>
                Zusammenfassung
            </v-card-title>
            <v-card-text>
                <div class="mb-3">
                    <v-chip size="small" color="success" variant="tonal" class="me-1">
                        Hochgeladen: {{ stats.done }}
                    </v-chip>
                    <v-chip
                        v-if="stats.skipped"
                        size="small"
                        color="grey"
                        variant="tonal"
                        class="me-1"
                    >
                        Übersprungen: {{ stats.skipped }}
                    </v-chip>
                    <v-chip v-if="stats.error" size="small" color="error" variant="tonal">
                        Fehler: {{ stats.error }}
                    </v-chip>
                </div>
                <pre class="summary-pre">{{ buildSummaryText() }}</pre>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="text" @click="summary_open = false">Schließen</v-btn>
                <v-spacer />
                <v-btn prepend-icon="mdi-share-variant" color="primary" @click="shareSummary">
                    Zusammenfassung kopieren
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <SvgBakeCompareDialog
        v-model="compare_dialog"
        :file="compare_file"
        :title="compare_title"
        :existing-url="compare_existing_url"
    />

    <PdfCompareDialog
        v-model="pdf_compare_dialog"
        :new-file="pdf_compare_new_file"
        :title="pdf_compare_title"
        :targets="pdf_compare_targets"
        :initial-key="pdf_compare_initial_key"
    />

    <LyricsAlignDialog
        v-model="align_dialog"
        :file="align_file"
        :title="align_title"
        :reference-pdf="align_reference_pdf"
        :initial-corrections="align_initial_corrections"
        @apply="onAlignmentApplied"
    />

    <v-dialog v-model="preview_dialog" max-width="1200" scrollable>
        <v-card>
            <v-card-title class="d-flex align-center ga-2">
                <v-icon>mdi-file-image-outline</v-icon>
                <span class="text-truncate">{{ preview_title }}</span>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" @click="preview_dialog = false" />
            </v-card-title>
            <v-divider />
            <v-card-text class="preview-dialog-body">
                <img
                    v-if="preview_url"
                    :src="preview_url"
                    alt="SVG-Vorschau"
                    class="preview-dialog-img"
                />
            </v-card-text>
        </v-card>
    </v-dialog>

    <v-dialog :model-value="matching_progress.active" max-width="520" persistent>
        <v-card>
            <v-card-title class="d-flex align-center ga-2">
                <v-icon color="primary">mdi-magnify-scan</v-icon>
                Lieder werden gesucht
            </v-card-title>
            <v-card-text>
                <div class="text-body-2 mb-1">
                    Datei {{ matching_progress.fileIndex }} / {{ matching_progress.fileTotal }}
                </div>
                <div class="text-truncate text-medium-emphasis mb-3" :title="matching_progress.currentFile">
                    {{ matching_progress.currentFile }}
                </div>
                <div class="plain-progress">
                    <div
                        class="plain-progress__bar"
                        :style="{ width: matching_progress_percent + '%' }"
                    />
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                    Gesamt: {{ matching_progress_percent.toFixed(0) }}% –
                    {{ matching_progress.candidateIndex }} / {{ matching_progress.candidateTotal }}
                    Lieder in dieser Datei geprüft
                </div>
                <v-divider class="my-3" />
                <div class="text-body-2">
                    Bester Treffer:
                    <span v-if="matching_progress.bestLabel" class="font-weight-medium">
                        {{ matching_progress.bestLabel }}
                        ({{ (matching_progress.bestScore * 100).toFixed(0) }}%)
                    </span>
                    <span v-else class="text-medium-emphasis">–</span>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="2500">
        {{ snackbar_message }}
        <template #actions>
            <v-btn variant="text" @click="snackbar = false">OK</v-btn>
        </template>
    </v-snackbar>
</template>

<style scoped>
.drop-zone {
    border: 2px dashed rgba(var(--v-theme-primary), 0.4);
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
    transition: background-color 0.2s, border-color 0.2s;
}
.drop-zone--active {
    background-color: rgba(var(--v-theme-primary), 0.08);
    border-color: rgb(var(--v-theme-primary));
}
.drop-zone:hover {
    background-color: rgba(var(--v-theme-primary), 0.04);
}
.item-thumb {
    width: 96px;
    height: 128px;
    flex-shrink: 0;
    /* Theme-abhängige, leicht abgesetzte Fläche (statt fixem Weiß) – so wirkt
       das Kästchen hinter dem PDF-/MXL-/Finale-/MIDI-Icon im Dark Mode nicht
       wie ein grell leuchtender weißer Block. */
    background: rgb(var(--v-theme-surface-light));
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}
/* SVG-Vorschau zeigt schwarze Noten auf transparentem Grund – die brauchen
   auch im Dark Mode einen hellen Hintergrund (wie das Noten-Canvas). */
.item-thumb--sheet {
    background: #fafafa;
    border-color: #eee;
}
.item-thumb--clickable {
    cursor: zoom-in;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.item-thumb--clickable:hover {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.15);
}
.preview-dialog-body {
    background: #fafafa;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    max-height: 85vh;
}
.preview-dialog-img {
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
    background: white;
    border: 1px solid #eee;
}
.item-row-separator {
    border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.12);
}
.summary-pre {
    white-space: pre-wrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8rem;
    background-color: rgba(var(--v-theme-on-surface), 0.05);
    color: rgb(var(--v-theme-on-surface));
    padding: 12px;
    border-radius: 4px;
    margin: 0;
    max-height: 320px;
    overflow: auto;
}
.plain-progress {
    width: 100%;
    height: 10px;
    background: rgba(var(--v-theme-on-surface), 0.12);
    border-radius: 5px;
    overflow: hidden;
}
.plain-progress__bar {
    height: 100%;
    background: rgb(var(--v-theme-primary));
    border-radius: 5px;
}
</style>
