<script setup>
import { reactive, ref } from 'vue';
import axios from '@/assets/js/axiossConfig';
import { planLiednummern, planChoralbuchNummern } from '@/assets/js/nummerngenerierung';

// Superadmin-Werkzeug (Issue #54): portiert die bisher manuell laufenden Skripte
// 11 (Choralbuchnummer) und 12 (Liednummer 2026) aus gb-scripts in die App,
// damit Daniel sie selbst ausführen kann. Gefiltert wird – anders als in den
// Skripten – ausschließlich nach status === 'accepted' ("Bewertet und
// genommen"), nicht mehr zusätzlich nach der Kleiner-Kreis-Bewertung "Rein".
//
// Ablauf je Werkzeug: 1. Vorschau berechnen (nur lesen) → geplante Nummerierung
// anzeigen, 2. nach Bestätigung in Directus schreiben (nur die geänderten und
// die obsolet gewordenen Nummern).

const base = import.meta.env.VITE_BACKEND_URL;

const snackbar = ref(false);
const snackbar_message = ref('');

function errMsg(e) {
    return (
        e?.response?.data?.errors?.[0]?.message ||
        e?.message ||
        (typeof e === 'string' ? e : 'Unbekannter Fehler')
    );
}

// --- Datenzugriff ---------------------------------------------------------
async function fetchAcceptedSongs(fields) {
    const resp = await axios.get(`${base}/items/gesangbuchlied`, {
        params: {
            filter: JSON.stringify({ status: { _eq: 'accepted' } }),
            fields,
            limit: -1,
        },
    });
    return resp.data.data;
}

async function planLiednummerData() {
    const [accepted, numbered] = await Promise.all([
        fetchAcceptedSongs('id,titel,liednummer2026,deutscheLiedfassung'),
        axios
            .get(`${base}/items/gesangbuchlied`, {
                params: {
                    filter: JSON.stringify({ liednummer2026: { _nnull: true } }),
                    fields: 'id,titel,liednummer2026',
                    limit: -1,
                },
            })
            .then((r) => r.data.data),
    ]);
    return planLiednummern(accepted, numbered);
}

async function planChoralbuchData() {
    const [acceptedRaw, numbered] = await Promise.all([
        fetchAcceptedSongs('id,melodieId.id,melodieId.titel,melodieId.choralbuchNummer'),
        axios
            .get(`${base}/items/melodie`, {
                params: {
                    filter: JSON.stringify({ choralbuchNummer: { _nnull: true } }),
                    fields: 'id,titel,choralbuchNummer',
                    limit: -1,
                },
            })
            .then((r) => r.data.data),
    ]);
    const accepted = acceptedRaw.map((s) => ({ id: s.id, melodie: s.melodieId }));
    return planChoralbuchNummern(accepted, numbered);
}

// Schreibvorgänge mit begrenzter Parallelität, damit Directus nicht mit
// hunderten gleichzeitigen Requests überrannt wird.
async function runPool(items, worker, concurrency, onProgress) {
    let index = 0;
    let done = 0;
    const failures = [];
    async function next() {
        while (index < items.length) {
            const i = index++;
            try {
                await worker(items[i]);
            } catch (e) {
                failures.push({ item: items[i], error: errMsg(e) });
            }
            done += 1;
            if (onProgress) onProgress(done, items.length);
        }
    }
    const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, () => next());
    await Promise.all(runners);
    return failures;
}

async function writePlan(plan, onProgress) {
    const ops = [
        ...plan.changed.map((n) => ({ id: n.id, value: n.next })),
        ...plan.toClear.map((c) => ({ id: c.id, value: null })),
    ];
    const failures = await runPool(
        ops,
        (op) => axios.patch(`${base}/items/${plan.collection}/${op.id}`, { [plan.field]: op.value }),
        6,
        onProgress,
    );
    return { total: ops.length, failures };
}

// --- Werkzeug-Definitionen ------------------------------------------------
const tools = reactive([
    {
        key: 'liednummer',
        title: 'Liednummer 2026',
        icon: 'mdi-format-list-numbered',
        unit: 'Lieder',
        description:
            'Vergibt fortlaufende Liednummern (2026) an alle „Bewertet und genommen"-Lieder, sortiert nach Titel. Fremdsprachige Fassungen übernehmen die Nummer ihrer deutschen Liedfassung. Lieder, die nicht mehr genommen sind, verlieren ihre Nummer.',
        fetch: planLiednummerData,
        loading: false,
        writing: false,
        error: '',
        plan: null,
        progress: { done: 0, total: 0 },
        result: null,
        expanded: {},
    },
    {
        key: 'choralbuch',
        title: 'Choralbuchnummer',
        icon: 'mdi-music-clef-treble',
        unit: 'Melodien',
        description:
            'Vergibt fortlaufende Choralbuchnummern an alle Melodien, die von mindestens einem „Bewertet und genommen"-Lied verwendet werden, sortiert nach Melodie-Titel. Melodien, die nicht mehr verwendet werden, verlieren ihre Nummer.',
        fetch: planChoralbuchData,
        loading: false,
        writing: false,
        error: '',
        plan: null,
        progress: { done: 0, total: 0 },
        result: null,
        expanded: {},
    },
]);

// Anzeige-Zeilen der durchgehenden Nummerierung (geänderte UND unveränderte in
// Nummern-Reihenfolge, eine Tabelle). Zusammenhängende Läufe unveränderter Einträge
// werden – an ihrer richtigen Position – zu einer aufklappbaren Platzhalterzeile
// zusammengefasst (wie bei einem Diff), statt ans Ende verschoben zu werden.
function displayRows(plan, tool) {
    if (!plan) return [];
    const seq = plan.numbered; // bereits nach neuer Nummer sortiert
    const out = [];
    let i = 0;
    while (i < seq.length) {
        const n = seq[i];
        if (n.changed) {
            out.push({
                type: 'row',
                key: `r-${n.id}`,
                current: n.current,
                next: n.next,
                titel: n.titel,
                changed: true,
            });
            i += 1;
            continue;
        }
        // Lauf aufeinanderfolgender unveränderter Einträge einsammeln.
        let j = i;
        while (j < seq.length && !seq[j].changed) j += 1;
        const run = seq.slice(i, j);
        const runKey = `${run[0].id}_${run[run.length - 1].id}`;
        if (tool.expanded[runKey]) {
            for (const u of run) {
                out.push({
                    type: 'row',
                    key: `r-${u.id}`,
                    current: u.current,
                    next: u.next,
                    titel: u.titel,
                    changed: false,
                });
            }
        } else {
            out.push({
                type: 'collapser',
                key: `co-${runKey}`,
                runKey,
                count: run.length,
                from: run[0].next,
                to: run[run.length - 1].next,
            });
        }
        i = j;
    }
    return out;
}

// Zu löschende Nummern (Einträge, die ihre Nummer verlieren) – separat, da sie
// nicht Teil der laufenden Nummerierung sind.
function clearedRows(plan) {
    if (!plan) return [];
    return plan.toClear.map((c) => ({ key: `x-${c.id}`, current: c.current, titel: c.titel }));
}

function expandRun(tool, runKey) {
    tool.expanded[runKey] = true;
}

function collapseAllUnchanged(tool) {
    tool.expanded = {};
}

function anyExpanded(tool) {
    return Object.keys(tool.expanded).length > 0;
}

async function preview(tool) {
    tool.loading = true;
    tool.error = '';
    tool.result = null;
    try {
        tool.plan = await tool.fetch();
    } catch (e) {
        tool.error = errMsg(e);
        tool.plan = null;
    } finally {
        tool.loading = false;
    }
}

// --- Schreiben (mit Bestätigung) ------------------------------------------
const confirm_open = ref(false);
const confirm_tool = ref(null);

function askWrite(tool) {
    confirm_tool.value = tool;
    confirm_open.value = true;
}

async function doWrite() {
    const tool = confirm_tool.value;
    confirm_open.value = false;
    if (!tool || !tool.plan) return;

    tool.writing = true;
    tool.error = '';
    tool.result = null;
    tool.progress = { done: 0, total: tool.plan.changed.length + tool.plan.toClear.length };
    try {
        const { total, failures } = await writePlan(tool.plan, (done, t) => {
            tool.progress = { done, total: t };
        });
        tool.result = { ok: total - failures.length, failed: failures.length, failures };
        snackbar_message.value =
            failures.length === 0
                ? `${tool.title}: ${total} Nummern aktualisiert.`
                : `${tool.title}: ${total - failures.length} aktualisiert, ${failures.length} fehlgeschlagen.`;
        snackbar.value = true;
        // Frische Vorschau ziehen – danach sollte nichts mehr „geändert" sein.
        tool.plan = await tool.fetch();
    } catch (e) {
        tool.error = errMsg(e);
    } finally {
        tool.writing = false;
    }
}

function hasWork(plan) {
    return !!plan && (plan.counts.changed > 0 || plan.counts.clear > 0);
}
</script>

<template>
    <div class="d-flex align-center flex-wrap ga-2 mb-2">
        <v-icon class="me-1">mdi-shield-crown</v-icon>
        <h1>Nummerngenerierung</h1>
        <v-chip color="error" variant="tonal" size="small" prepend-icon="mdi-account-key">
            Nur Superadmin
        </v-chip>
    </div>
    <v-alert
        type="warning"
        variant="tonal"
        density="comfortable"
        class="mb-4"
        icon="mdi-alert"
        style="max-width: 900px"
    >
        Diese Werkzeuge schreiben direkt in Directus. Berechne zuerst die Vorschau und prüfe die
        geplanten Änderungen, bevor du schreibst. Grundlage sind ausschließlich Lieder mit Status
        <strong>„Bewertet und genommen"</strong>.
    </v-alert>

    <v-row>
        <v-col v-for="tool in tools" :key="tool.key" cols="12" lg="6">
            <v-card class="h-100">
                <v-card-title class="d-flex align-center ga-2">
                    <v-icon>{{ tool.icon }}</v-icon>
                    {{ tool.title }}
                </v-card-title>
                <v-card-text>
                    <p class="text-body-2 text-medium-emphasis mb-3">{{ tool.description }}</p>

                    <div class="d-flex flex-wrap ga-2 mb-3">
                        <v-btn
                            color="primary"
                            variant="tonal"
                            prepend-icon="mdi-eye"
                            :loading="tool.loading"
                            :disabled="tool.writing"
                            @click="preview(tool)"
                        >
                            Vorschau berechnen
                        </v-btn>
                        <v-btn
                            color="error"
                            prepend-icon="mdi-database-edit"
                            :disabled="!hasWork(tool.plan) || tool.loading || tool.writing"
                            @click="askWrite(tool)"
                        >
                            In Directus schreiben
                        </v-btn>
                    </div>

                    <v-alert
                        v-if="tool.error"
                        type="error"
                        variant="tonal"
                        density="compact"
                        class="mb-3"
                    >
                        {{ tool.error }}
                    </v-alert>

                    <div v-if="tool.writing" class="mb-3">
                        <div class="text-caption mb-1">
                            Schreibe … {{ tool.progress.done }} / {{ tool.progress.total }}
                        </div>
                        <v-progress-linear
                            :model-value="
                                tool.progress.total
                                    ? (tool.progress.done / tool.progress.total) * 100
                                    : 0
                            "
                            color="error"
                            height="6"
                            rounded
                        />
                    </div>

                    <v-alert
                        v-if="tool.result"
                        :type="tool.result.failed ? 'warning' : 'success'"
                        variant="tonal"
                        density="compact"
                        class="mb-3"
                    >
                        {{ tool.result.ok }} Nummern geschrieben<span v-if="tool.result.failed">
                            , {{ tool.result.failed }} fehlgeschlagen</span
                        >.
                    </v-alert>

                    <template v-if="tool.plan">
                        <div class="d-flex flex-wrap ga-2 mb-3">
                            <v-chip size="small" variant="tonal" prepend-icon="mdi-counter">
                                {{ tool.plan.counts.total }} zu nummerieren
                            </v-chip>
                            <v-chip
                                size="small"
                                :color="tool.plan.counts.changed ? 'primary' : undefined"
                                variant="tonal"
                                prepend-icon="mdi-pencil"
                            >
                                {{ tool.plan.counts.changed }} Änderungen
                            </v-chip>
                            <v-chip size="small" variant="tonal" prepend-icon="mdi-check">
                                {{ tool.plan.counts.unchanged }} unverändert
                            </v-chip>
                            <v-chip
                                size="small"
                                :color="tool.plan.counts.clear ? 'warning' : undefined"
                                variant="tonal"
                                prepend-icon="mdi-eraser"
                            >
                                {{ tool.plan.counts.clear }} zu löschen
                            </v-chip>
                            <v-chip
                                v-if="tool.plan.counts.skipped"
                                size="small"
                                color="warning"
                                variant="tonal"
                                prepend-icon="mdi-debug-step-over"
                            >
                                {{ tool.plan.counts.skipped }} übersprungen
                            </v-chip>
                            <v-chip
                                v-if="tool.plan.counts.skippedNoMelodie"
                                size="small"
                                variant="tonal"
                                prepend-icon="mdi-music-note-off"
                            >
                                {{ tool.plan.counts.skippedNoMelodie }} ohne Melodie
                            </v-chip>
                        </div>

                        <p
                            v-if="!hasWork(tool.plan)"
                            class="text-body-2 text-success d-flex align-center ga-1"
                        >
                            <v-icon size="small">mdi-check-circle</v-icon>
                            Alle Nummern sind bereits aktuell – nichts zu schreiben.
                        </p>

                        <div v-if="tool.plan.numbered.length || clearedRows(tool.plan).length">
                            <div v-if="anyExpanded(tool)" class="d-flex justify-end mb-1">
                                <v-btn
                                    size="x-small"
                                    variant="text"
                                    prepend-icon="mdi-unfold-less-horizontal"
                                    @click="collapseAllUnchanged(tool)"
                                >
                                    Unveränderte wieder einklappen
                                </v-btn>
                            </div>

                            <div v-if="tool.plan.numbered.length" class="preview-box">
                                <v-table density="compact" hover>
                                    <thead>
                                        <tr>
                                            <th style="width: 130px">Nr.</th>
                                            <th>Titel</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template
                                            v-for="row in displayRows(tool.plan, tool)"
                                            :key="row.key"
                                        >
                                            <tr
                                                v-if="row.type === 'collapser'"
                                                class="collapser-row"
                                                @click="expandRun(tool, row.runKey)"
                                            >
                                                <td colspan="2" class="text-medium-emphasis">
                                                    <v-icon size="small" class="me-1">
                                                        mdi-chevron-right
                                                    </v-icon>
                                                    {{ row.count }} unveränderte {{ tool.unit }}
                                                    (Nr. {{ row.from }}–{{ row.to }}) anzeigen
                                                </td>
                                            </tr>
                                            <tr
                                                v-else
                                                :class="{ 'text-medium-emphasis': !row.changed }"
                                            >
                                                <td>
                                                    <template v-if="row.changed">
                                                        <span class="text-medium-emphasis">
                                                            {{ row.current ?? '–' }}
                                                        </span>
                                                        <v-icon size="x-small" class="mx-1">
                                                            mdi-arrow-right
                                                        </v-icon>
                                                        <strong>{{ row.next }}</strong>
                                                    </template>
                                                    <template v-else>{{ row.next }}</template>
                                                </td>
                                                <td>{{ row.titel }}</td>
                                            </tr>
                                        </template>
                                    </tbody>
                                </v-table>
                            </div>

                            <template v-if="clearedRows(tool.plan).length">
                                <div
                                    class="d-flex align-center ga-1 text-subtitle-2 font-weight-bold mt-3 mb-1"
                                >
                                    <v-icon size="small">mdi-eraser</v-icon>
                                    Zu löschen ({{ clearedRows(tool.plan).length }})
                                </div>
                                <div class="preview-box">
                                    <v-table density="compact" hover>
                                        <tbody>
                                            <tr v-for="row in clearedRows(tool.plan)" :key="row.key">
                                                <td style="width: 130px">
                                                    <span class="text-medium-emphasis">
                                                        {{ row.current ?? '–' }}
                                                    </span>
                                                    <v-icon size="x-small" class="mx-1">
                                                        mdi-arrow-right
                                                    </v-icon>
                                                    <span class="text-warning">leer</span>
                                                </td>
                                                <td>{{ row.titel }}</td>
                                            </tr>
                                        </tbody>
                                    </v-table>
                                </div>
                            </template>
                        </div>
                    </template>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>

    <v-dialog v-model="confirm_open" max-width="480">
        <v-card>
            <v-card-title class="d-flex align-center ga-2">
                <v-icon color="error">mdi-alert</v-icon>
                Schreiben bestätigen
            </v-card-title>
            <v-card-text v-if="confirm_tool">
                <strong>{{ confirm_tool.title }}</strong> in Directus schreiben?
                <div class="mt-2">
                    {{ confirm_tool.plan?.counts.changed }} Nummern werden geändert,
                    {{ confirm_tool.plan?.counts.clear }} werden gelöscht. Dies kann nicht
                    rückgängig gemacht werden.
                </div>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="confirm_open = false">Abbrechen</v-btn>
                <v-btn color="error" variant="flat" @click="doWrite">Ja, schreiben</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="4000">
        {{ snackbar_message }}
        <template #actions>
            <v-btn variant="text" @click="snackbar = false">OK</v-btn>
        </template>
    </v-snackbar>
</template>

<style scoped>
.preview-box {
    max-height: 55vh;
    overflow-y: auto;
}
.collapser-row {
    cursor: pointer;
    user-select: none;
}
.collapser-row:hover {
    background: rgba(var(--v-theme-primary), 0.06);
}
</style>
