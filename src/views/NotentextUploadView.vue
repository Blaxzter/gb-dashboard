<script setup>
import { ref, computed, watch } from 'vue';
import axios from '@/assets/js/axiossConfig';
import { useAppStore } from '@/store/app.js';

const store = useAppStore();

const AUTO_MATCH_THRESHOLD = 0.75;

const queue = ref([]); // [{ uid, file, name, page, liedId, suggestions, status, conflictChoice, errorMessage, fileId }]
const dropbox_collapsed = ref(false);
const drag_over = ref(false);
const file_input = ref(null);
const uploading_all = ref(false);
const summary_open = ref(false);

const snackbar = ref(false);
const snackbar_message = ref('');

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

function parseFilename(name) {
    let base = name.replace(/\.svg$/i, '');
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
    return { base, normalizedBase: normalize(base), liednummer, page };
}

function rankLieder(parsed) {
    const all = store.gesangbuchlieder;
    const scored = all.map((lied) => {
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
        const sim = similarity(normalize(lied.titel || ''), parsed.normalizedBase);
        score += sim * 0.9;
        if (sim > 0.4) reason.push(`Titel ~ ${(sim * 100).toFixed(0)}%`);
        return { lied, score, reason: reason.join(', ') };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
}

async function addFiles(files) {
    const arr = Array.from(files).filter((f) => /\.svg$/i.test(f.name));
    for (const file of arr) {
        const parsed = parseFilename(file.name);
        const suggestions = rankLieder(parsed);
        const top = suggestions[0];
        const autoMatch = top && top.score >= AUTO_MATCH_THRESHOLD ? top.lied : null;
        const previewUrl = URL.createObjectURL(file);
        const item = {
            uid: nextUid(),
            file,
            name: file.name,
            previewUrl,
            parsed,
            page: parsed.page,
            liedId: autoMatch?.id || null,
            suggestions,
            status: 'unmatched',
            conflictChoice: null,
            errorMessage: '',
            uploadedFileId: null,
        };
        queue.value.push(item);
        if (autoMatch) refreshItemStatus(item);
    }
    sortQueue();
    if (queue.value.length > 0) dropbox_collapsed.value = true;
}

function refreshItemStatus(item) {
    if (['uploading', 'done', 'skipped', 'error'].includes(item.status)) return;
    if (!item.liedId) {
        item.status = 'unmatched';
        return;
    }
    const lied = lookupLied(item.liedId);
    if (lied && liedHasField(lied, item.page) && !item.conflictChoice) {
        item.status = 'conflict';
    } else {
        item.status = 'matched';
    }
}

function refreshAllStatuses() {
    queue.value.forEach(refreshItemStatus);
}

function sortQueue() {
    queue.value.sort((a, b) => {
        // Seite 1 before Seite 2 for the same lied
        const aLied = a.liedId || -1;
        const bLied = b.liedId || -1;
        if (aLied !== bLied) {
            if (a.liedId && b.liedId) return aLied - bLied;
            if (a.liedId) return -1;
            if (b.liedId) return 1;
        }
        return a.page - b.page;
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
    if (['uploading', 'done'].includes(item.status)) return;
    item.page = item.page === 1 ? 2 : 1;
    item.conflictChoice = null;
    refreshItemStatus(item);
}

function applyConflictChoice(item, choice) {
    item.conflictChoice = choice;
    if (choice === 'swap') {
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

function liedHasField(lied, page) {
    if (!lied) return false;
    return page === 2 ? !!lied.notentext_seite2 : !!lied.notentext;
}

function liedAutocompleteItems() {
    return store.gesangbuchlieder.map((l) => ({
        id: l.id,
        title: `${l.liednummer2026 || l.liednummer2000 || ''} ${l.titel || ''}`.trim(),
        subtitle: `Status: ${l.status || '–'}`,
    }));
}

async function uploadFile(file, displayName) {
    const formData = new FormData();
    formData.append('title', displayName);
    formData.append('file', file, file.name);
    const resp = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/files`, formData);
    return resp.data.data;
}

async function patchLiedField(liedId, page, fileId) {
    const field = page === 2 ? 'notentext_seite2' : 'notentext';
    const resp = await axios.patch(
        `${import.meta.env.VITE_BACKEND_URL}/items/gesangbuchlied/${liedId}`,
        { [field]: fileId },
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
    if (liedHasField(lied, item.page) && item.conflictChoice !== 'overwrite') {
        item.status = 'conflict';
        return;
    }

    item.status = 'uploading';
    item.errorMessage = '';
    try {
        const uploaded = await uploadFile(item.file, item.name);
        item.uploadedFileId = uploaded.id;
        await patchLiedField(item.liedId, item.page, uploaded.id);
        // sync local store
        store.file.push(uploaded);
        const field = item.page === 2 ? 'notentext_seite2' : 'notentext';
        const fieldFile = item.page === 2 ? 'notentext_seite2_file' : 'notentext_file';
        const idx = store.gesangbuchlied.findIndex((l) => l.id === item.liedId);
        if (idx !== -1) {
            store.gesangbuchlied[idx][field] = uploaded.id;
            store.gesangbuchlied[idx][fieldFile] = uploaded;
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
    const ready = matched;
    return { total, done, skipped, error, conflict, unmatched, ready };
});

const queue_lied_counts = computed(() => {
    const counts = {};
    queue.value.forEach((q) => {
        if (q.liedId) counts[q.liedId] = (counts[q.liedId] || 0) + 1;
    });
    return counts;
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

function groupPosition(item) {
    if (!item.liedId) return null;
    const siblings = queue.value.filter((q) => q.liedId === item.liedId);
    if (siblings.length < 2) return null;
    siblings.sort((a, b) => a.page - b.page || a.uid - b.uid);
    const idx = siblings.findIndex((s) => s.uid === item.uid);
    return { index: idx + 1, total: siblings.length };
}

function showPageToggle(item) {
    if (item.page === 2) return true;
    if (item.parsed?.page === 2) return true;
    if (item.liedId && queue_lied_counts.value[item.liedId] > 1) return true;
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
    () => queue.value.map((q) => `${q.liedId}|${q.page}`).join(','),
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
            lines.push(
                `  • Lied ${lied?.liednummer2026 || lied?.liednummer2000 || '–'} „${lied?.titel || ''}" – Seite ${q.page} (${q.name})`,
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
                        SVG-Dateien hier ablegen oder klicken zum Auswählen
                    </div>
                    <div class="text-caption text-medium-emphasis">
                        Mehrere Dateien auf einmal möglich. Liednummer und „_seite2"/„_2" im
                        Dateinamen werden erkannt.
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
                    Weitere SVGs hinzufügen
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
                accept=".svg,image/svg+xml"
                multiple
                style="display: none"
                @change="onPickFiles"
            />
        </v-card-text>
    </v-card>

    <div v-if="queue.length === 0" class="text-medium-emphasis text-center pa-8">
        Noch keine Dateien in der Queue.
    </div>

    <v-list v-else density="comfortable">
        <v-list-item
            v-for="item in queue"
            :key="item.uid"
            class="mb-2"
            :style="{
                border: `1px solid rgba(0,0,0,0.1)`,
                borderLeft: groupPosition(item)
                    ? `5px solid ${groupColor(item.liedId)}`
                    : `1px solid rgba(0,0,0,0.1)`,
                borderRadius: '6px',
            }"
        >
            <template #prepend>
                <div
                    style="
                        width: 120px;
                        height: 160px;
                        background: #fafafa;
                        border: 1px solid #eee;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                        margin-right: 16px;
                    "
                >
                    <img
                        v-if="item.previewUrl"
                        :src="item.previewUrl"
                        alt="SVG-Vorschau"
                        style="max-width: 100%; max-height: 100%; object-fit: contain"
                    />
                </div>
            </template>

            <div class="d-flex flex-column ga-1">
                <div class="d-flex align-center ga-2 flex-wrap">
                    <v-chip
                        size="x-small"
                        :color="statusColor(item.status)"
                        variant="tonal"
                    >
                        {{ statusLabel(item.status) }}
                    </v-chip>
                    <span class="text-body-2 font-weight-medium">{{ item.name }}</span>
                    <v-chip
                        v-if="!showPageToggle(item)"
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
                    <v-chip
                        v-if="groupPosition(item)"
                        size="x-small"
                        variant="flat"
                        :style="{
                            backgroundColor: groupColor(item.liedId),
                            color: 'white',
                        }"
                        prepend-icon="mdi-link-variant"
                    >
                        Teil {{ groupPosition(item).index }} von
                        {{ groupPosition(item).total }}
                    </v-chip>
                </div>

                <div class="d-flex align-center ga-2 flex-wrap">
                    <v-autocomplete
                        :model-value="item.liedId"
                        :items="liedAutocompleteItems()"
                        item-title="title"
                        item-value="id"
                        density="compact"
                        hide-details
                        clearable
                        label="Lied"
                        style="min-width: 320px; max-width: 480px"
                        :disabled="['uploading', 'done'].includes(item.status)"
                        @update:model-value="
                            (v) => setLied(item, v ? lookupLied(v) : null)
                        "
                    />
                    <template v-if="!item.liedId && item.suggestions?.length">
                        <span class="text-caption text-medium-emphasis">Vorschläge:</span>
                        <v-chip
                            v-for="s in item.suggestions.slice(0, 3).filter((s) => s.score > 0.2)"
                            :key="s.lied.id"
                            size="x-small"
                            variant="tonal"
                            color="primary"
                            class="cursor-pointer"
                            @click="setLied(item, s.lied)"
                        >
                            {{ s.lied.liednummer2026 || s.lied.liednummer2000 || '?' }} ·
                            {{ s.lied.titel }}
                            ({{ (s.score * 100).toFixed(0) }}%)
                        </v-chip>
                    </template>
                </div>

                <div v-if="item.status === 'conflict'" class="d-flex align-center ga-2 flex-wrap mt-1">
                    <v-icon size="small" color="error">mdi-alert</v-icon>
                    <span class="text-caption">
                        Lied hat bereits einen Notentext für Seite {{ item.page }}. Was tun?
                    </span>
                    <v-btn size="x-small" color="error" variant="tonal" @click="applyConflictChoice(item, 'overwrite')">
                        Überschreiben
                    </v-btn>
                    <v-btn size="x-small" variant="tonal" @click="applyConflictChoice(item, 'swap')">
                        Als Seite {{ item.page === 1 ? 2 : 1 }} nehmen
                    </v-btn>
                    <v-btn size="x-small" variant="tonal" @click="applyConflictChoice(item, 'skip')">
                        Überspringen
                    </v-btn>
                </div>

                <div v-if="item.errorMessage" class="text-caption text-error mt-1">
                    {{ item.errorMessage }}
                </div>
            </div>

            <template #append>
                <v-btn
                    v-if="item.status === 'done'"
                    icon="mdi-open-in-new"
                    variant="text"
                    size="small"
                    :to="`/lied/${item.liedId}`"
                />
                <v-btn
                    icon="mdi-close"
                    variant="text"
                    size="small"
                    :disabled="item.status === 'uploading'"
                    @click="removeQueueItem(item.uid)"
                />
            </template>
        </v-list-item>
    </v-list>

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
.summary-pre {
    white-space: pre-wrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8rem;
    background-color: #f7f7f7;
    padding: 12px;
    border-radius: 4px;
    margin: 0;
    max-height: 320px;
    overflow: auto;
}
</style>
