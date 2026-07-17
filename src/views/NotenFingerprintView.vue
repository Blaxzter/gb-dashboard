<script setup>
import { computed, ref } from 'vue';
import axios from '@/assets/js/axiossConfig';
import { isFingerprintUsable } from '@/assets/js/notenFingerprint';
import { fingerprintFromPdfBytes } from '@/assets/js/notenFingerprintLoader';

// Superadmin-Werkzeug: Notensatz-Fingerabdrücke pflegen.
//
// Der Druck-Check gleicht den gedruckten Notensatz gegen die Noten-PDF der DB ab
// (printNotenCheck.js). Damit er das ohne Download je Lied kann, liegt der
// Fingerabdruck im Feld `notentext_fingerprint`.
//
// Im Normalbetrieb pflegt sich das selbst: Die Notentext-Upload-Ansicht schreibt
// den Fingerabdruck bei jedem Upload mit. Veralten kann er trotzdem – wird die
// Noten-PDF direkt im Directus-Admin ausgetauscht, bleibt der alte Wert stehen.
// Er trägt die Id der Datei, aus der er gerechnet wurde, und gilt dann als
// „veraltet": Der Druck-Check lädt die PDF im Notfall nach (langsam), meldet
// aber keinen falschen Fehler. Diese Ansicht macht genau das sichtbar und
// behebbar, ohne Token und Kommandozeile.

const base = import.meta.env.VITE_BACKEND_URL;

const loading = ref(false);
const running = ref(false);
const error = ref('');
const lieder = ref(null);
const progress = ref(null); // { done, total }
const result = ref(null); // { written, failed }
const confirm_dialog = ref(false);

// Fingerabdruck-Zustand eines Liedes. `notentext` ohne Fingerabdruck heißt
// „fehlt", ein Fingerabdruck zu einer ANDEREN Datei heißt „veraltet".
function stateOf(l) {
    if (isFingerprintUsable(l.notentext_fingerprint, l.notentext)) return 'ok';
    return l.notentext_fingerprint ? 'stale' : 'missing';
}

const rows = computed(() => (lieder.value || []).map((l) => ({ ...l, state: stateOf(l) })));
const counts = computed(() => {
    const c = { ok: 0, stale: 0, missing: 0 };
    for (const r of rows.value) c[r.state]++;
    return c;
});
const todo = computed(() => rows.value.filter((r) => r.state !== 'ok'));

async function load() {
    loading.value = true;
    error.value = '';
    result.value = null;
    try {
        const resp = await axios.get(`${base}/items/gesangbuchlied`, {
            params: {
                filter: JSON.stringify({ notentext: { _nnull: true } }),
                fields: 'id,liednummer2026,titel,notentext,notentext_fingerprint',
                limit: -1,
            },
        });
        lieder.value = resp.data.data;
    } catch (e) {
        // Häufigster Fall beim ersten Mal: Das Feld ist im Admin noch nicht
        // angelegt (das Directus-Schema wird live gepflegt).
        const msg = e?.response?.data?.errors?.[0]?.message || e?.message || String(e);
        error.value = msg.includes('notentext_fingerprint')
            ? 'Das Feld „notentext_fingerprint" fehlt. Bitte in Directus anlegen: ' +
              'Collection „gesangbuchlied", Feld notentext_fingerprint, Typ JSON, nullable.'
            : 'Lieder konnten nicht geladen werden: ' + msg;
    } finally {
        loading.value = false;
    }
}
load();

// Fehlende/veraltete Fingerabdrücke neu berechnen. Nacheinander statt parallel:
// Das ist ein seltener Wartungslauf, und je Lied wird eine PDF geladen und
// geparst – Tempo ist hier weniger wert als eine ruhige Oberfläche und ein
// Backend, das nicht mit hundert Downloads gleichzeitig beschossen wird.
async function recompute() {
    confirm_dialog.value = false;
    running.value = true;
    error.value = '';
    result.value = null;
    let written = 0;
    const failed = [];
    const list = todo.value;
    progress.value = { done: 0, total: list.length };
    try {
        for (const row of list) {
            try {
                const resp = await fetch(`${base}/assets/${row.notentext}`);
                if (!resp.ok) throw new Error(`Download ${resp.status}`);
                const bytes = new Uint8Array(await resp.arrayBuffer());
                if (String.fromCharCode(...bytes.slice(0, 4)) !== '%PDF') {
                    throw new Error('keine PDF-Datei');
                }
                const fp = await fingerprintFromPdfBytes(bytes, row.notentext);
                if (!fp.pages.some((p) => p.seq)) throw new Error('keine Noten-Glyphen gefunden');

                await axios.patch(`${base}/items/gesangbuchlied/${row.id}`, {
                    notentext_fingerprint: fp,
                });
                // Lokal nachziehen, damit die Zählung sofort stimmt.
                const local = lieder.value.find((l) => l.id === row.id);
                if (local) local.notentext_fingerprint = fp;
                written++;
            } catch (e) {
                failed.push({ ...row, message: e?.message || String(e) });
            }
            progress.value = { done: progress.value.done + 1, total: list.length };
        }
        result.value = { written, failed };
    } finally {
        running.value = false;
        progress.value = null;
    }
}
</script>

<template>
    <div>
        <div class="d-flex align-center flex-wrap ga-2 mb-4">
            <h1 class="me-4">Notensatz-Fingerabdrücke</h1>
            <v-spacer />
            <v-btn
                variant="text"
                size="small"
                prepend-icon="mdi-refresh"
                :loading="loading"
                :disabled="running"
                @click="load"
            >
                Neu laden
            </v-btn>
        </div>

        <v-card class="mb-4">
            <v-card-text>
                <div class="text-medium-emphasis mb-4">
                    Der
                    <strong>Druck-Check</strong>
                    vergleicht den im Satz platzierten Notensatz mit der Noten-PDF aus der Datenbank
                    – so fällt auf, wenn die falsche Sprachfassung platziert wurde oder der
                    Notensatz unten abgeschnitten ist. Dafür liegt zu jeder Noten-PDF ein
                    Fingerabdruck ihrer Notenzeichen in der Datenbank.
                    <br />
                    <br />
                    Beim Hochladen über
                    <strong>Notentext hochladen</strong>
                    wird er automatisch mitgeschrieben – hier muss also normalerweise nichts getan
                    werden. Wird eine Noten-PDF dagegen direkt im Directus-Admin ausgetauscht,
                    bleibt der alte Fingerabdruck stehen und gilt als
                    <strong>veraltet.</strong>
                    Der Druck-Check meldet dann keinen falschen Fehler, muss die PDF aber jedes Mal
                    neu laden – das dauert.
                </div>

                <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
                    {{ error }}
                </v-alert>

                <div v-if="loading" class="d-flex align-center ga-3 text-medium-emphasis">
                    <v-progress-circular indeterminate size="24" />
                    Lieder werden geladen …
                </div>

                <template v-else-if="lieder">
                    <div class="d-flex align-center flex-wrap ga-2 mb-4">
                        <v-chip variant="tonal" prepend-icon="mdi-music-clef-treble">
                            {{ rows.length }} Lieder mit Notensatz
                        </v-chip>
                        <v-divider vertical class="mx-1" />
                        <v-chip color="success" variant="tonal" prepend-icon="mdi-check-circle">
                            Aktuell: {{ counts.ok }}
                        </v-chip>
                        <v-chip
                            v-if="counts.stale"
                            color="warning"
                            variant="tonal"
                            prepend-icon="mdi-alert"
                        >
                            Veraltet: {{ counts.stale }}
                        </v-chip>
                        <v-chip
                            v-if="counts.missing"
                            color="error"
                            variant="tonal"
                            prepend-icon="mdi-alert-circle"
                        >
                            Fehlt: {{ counts.missing }}
                        </v-chip>
                    </div>

                    <v-alert
                        v-if="!todo.length"
                        type="success"
                        variant="tonal"
                        density="compact"
                        prepend-icon="mdi-check-all"
                        class="mb-4"
                    >
                        Alle Notensätze haben einen aktuellen Fingerabdruck – der Druck-Check kommt
                        ohne Nachladen aus.
                    </v-alert>

                    <div v-if="running" class="mb-4">
                        <div class="d-flex align-center ga-3 mb-2 text-medium-emphasis">
                            <v-progress-circular indeterminate size="20" />
                            Fingerabdrücke werden berechnet …
                            {{ progress ? `${progress.done}/${progress.total}` : '' }}
                        </div>
                        <v-progress-linear
                            :model-value="
                                progress && progress.total
                                    ? (progress.done / progress.total) * 100
                                    : 0
                            "
                            color="primary"
                            height="6"
                            rounded
                        />
                    </div>

                    <v-btn
                        v-if="todo.length && !running"
                        color="primary"
                        variant="flat"
                        prepend-icon="mdi-fingerprint"
                        @click="confirm_dialog = true"
                    >
                        {{ todo.length }} Fingerabdruck(e) berechnen
                    </v-btn>

                    <v-alert
                        v-if="result"
                        :type="result.failed.length ? 'warning' : 'success'"
                        variant="tonal"
                        density="compact"
                        class="mt-4"
                    >
                        {{ result.written }} Fingerabdruck(e) geschrieben.
                        <template v-if="result.failed.length">
                            {{ result.failed.length }} fehlgeschlagen:
                            <ul class="mt-1">
                                <li v-for="f in result.failed" :key="f.id">
                                    {{
                                        f.liednummer2026 ? `Lied ${f.liednummer2026}` : `Id ${f.id}`
                                    }}
                                    – {{ f.message }}
                                </li>
                            </ul>
                        </template>
                    </v-alert>

                    <!-- Nur die offenen Fälle listen: Die aktuellen sind uninteressant,
                         und 565 Zeilen „ist in Ordnung" verdecken nur die drei, die es
                         nicht sind. -->
                    <template v-if="todo.length">
                        <v-divider class="my-4" />
                        <div class="text-subtitle-2 mb-2">Offene Lieder</div>
                        <v-table density="compact">
                            <thead>
                                <tr>
                                    <th>Lied</th>
                                    <th>Titel</th>
                                    <th>Zustand</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in todo" :key="row.id">
                                    <td>{{ row.liednummer2026 || '—' }}</td>
                                    <td>{{ row.titel }}</td>
                                    <td>
                                        <v-chip
                                            size="x-small"
                                            variant="tonal"
                                            :color="row.state === 'stale' ? 'warning' : 'error'"
                                        >
                                            {{
                                                row.state === 'stale'
                                                    ? 'veraltet (andere Datei)'
                                                    : 'fehlt'
                                            }}
                                        </v-chip>
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </template>
                </template>
            </v-card-text>
        </v-card>

        <v-dialog v-model="confirm_dialog" width="520">
            <v-card>
                <v-card-title>Fingerabdrücke berechnen?</v-card-title>
                <v-card-text>
                    Für {{ todo.length }} Lied(er) wird die Noten-PDF geladen, ausgewertet und der
                    Fingerabdruck in Directus geschrieben. Bestehende aktuelle Fingerabdrücke
                    bleiben unberührt.
                    <br />
                    <br />
                    Das dauert etwa
                    <strong>{{ Math.max(1, Math.round(todo.length / 2)) }} Sekunden</strong>
                    und lädt rund
                    <strong>{{ Math.round((todo.length * 250) / 1024) }} MB</strong>
                    – bitte die Seite so lange offen lassen.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="confirm_dialog = false">Abbrechen</v-btn>
                    <v-btn color="primary" variant="flat" @click="recompute">Berechnen</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>
