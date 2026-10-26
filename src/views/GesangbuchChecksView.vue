<script setup>
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/store/app.js';
import { useUserStore } from '@/store/user';
import { runChecks, isGenommen } from '@/assets/js/gesangbuchChecks.js';
import { createMusicXmlLoader } from '@/assets/js/notenAbgleichLoader';
import { useStrophe1Ocr } from '@/assets/js/strophe1Ocr.js';
import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';
import CheckCategory from '@/components/checks/CheckCategory.vue';

const store = useAppStore();
const route = useRoute();
const router = useRouter();

// Der Notentext-Export ist wie das Notentext-Hochladen auf bestimmte Rollen
// beschränkt (VITE_NOTENTEXT_ROLES) – Button nur für Berechtigte anzeigen.
const notentextRoles = (import.meta.env.VITE_NOTENTEXT_ROLES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const userStore = useUserStore();
const can_export = computed(
    () => notentextRoles.length === 0 || userStore.has_role(notentextRoles),
);

const only_problems = ref(false);

// Lied-Dialog: Klick auf einen Treffer öffnet das Lied direkt in dieser View.
// Die URL wird dabei auf /checks/:id angepasst, damit ein geöffnetes Lied
// verlinkbar ist und beim Neuladen wieder geöffnet wird.
const song_dialog = ref(false);
const selected_song = ref(null);

function openSong(id) {
    if (id == null) return;
    const lied = alle_lieder.value.find((l) => l.id === id);
    if (!lied) return;
    selected_song.value = lied;
    song_dialog.value = true;
    if (String(route.params.id) !== String(id)) {
        router.replace({ name: 'Checks', params: { id: String(id) } });
    }
    if (lied.gesangbuch_titel) document.title = lied.gesangbuch_titel;
}

// Lied aus der URL (z. B. nach Reload oder per geteiltem Link) öffnen, sobald
// die Lieder geladen sind.
function openSongFromRoute() {
    const id = route.params.id;
    if (id == null || id === '' || selected_song.value) return;
    openSong(parseInt(id, 10));
}

// Beim Schließen des Dialogs die URL wieder auf /checks zurücksetzen.
watch(song_dialog, (is_open) => {
    if (is_open) return;
    selected_song.value = null;
    if (route.params.id != null) router.replace({ name: 'Checks' });
    document.title = 'Gesangbuch 2026';
});

const alle_lieder = computed(() => store.gesangbuchlieder);
const genommen = computed(() => alle_lieder.value.filter(isGenommen));

// PDF↔MusicXML-Abgleich: Die Checks laufen synchron, die MusicXML-Dateien
// müssen aber geladen werden. Das passiert hier einmal je Besuch (der Loader
// cached je Datei-Id); `mxml_state` reicht den Stand an die Checks weiter. Er
// wird nur alle paar Dateien ersetzt, weil jede Änderung ALLE Checks neu laufen
// lässt.
const MXML_PARALLEL = 6;
const MXML_PUBLISH_EVERY = 50;
const mxml_state = shallowRef(null);
let mxml_started = false;
const loadScore = createMusicXmlLoader({ backendUrl: import.meta.env.VITE_BACKEND_URL });

async function loadMusicXml() {
    if (mxml_started || alle_lieder.value.length === 0) return;
    mxml_started = true;
    // Der Notenabgleich braucht zusätzlich einen Fingerabdruck und nur eine
    // Notenseite, der Liedtext-Abgleich nicht – geladen wird daher für alle.
    const list = genommen.value.filter((l) => l.notentext && l.notentext_mxml);
    const scores = new Map();
    let done = 0;
    const publish = () => {
        mxml_state.value = { scores: new Map(scores), done, total: list.length };
    };
    publish();
    let next = 0;
    async function worker() {
        while (next < list.length) {
            const lied = list[next++];
            const fileId = lied.notentext_mxml;
            try {
                scores.set(lied.id, { fileId, score: await loadScore(fileId) });
            } catch (e) {
                scores.set(lied.id, { fileId, error: e?.message || String(e) });
            }
            done++;
            if (done % MXML_PUBLISH_EVERY === 0) publish();
        }
    }
    await Promise.all(Array.from({ length: MXML_PARALLEL }, worker));
    publish();
}

// Text unter den Noten für den Liedtext-Abgleich: die Befunddatei von
// gb-scripts/app/26 (dieselbe wie im Strophe-1-Abgleich). Fehlt sie oder ist
// sie nicht lesbar, prüft der Check eben nichts (false statt null).
const ocr = useStrophe1Ocr();
const notenbild_text = computed(() => {
    if (ocr.status.value === 'ready') return ocr.data.value;
    if (ocr.status.value === 'missing' || ocr.status.value === 'error') return false;
    return null;
});

const results = computed(() =>
    runChecks(alle_lieder.value, store.authors, {
        musicxml: mxml_state.value,
        notenbildText: notenbild_text.value,
    }),
);

// Beim ersten Laden und sobald die Lieder verfügbar sind ein evtl. in der URL
// hinterlegtes Lied öffnen und den MusicXML-Abgleich anstoßen.
onMounted(() => {
    openSongFromRoute();
    loadMusicXml();
    ocr.loadOnce();
});
watch(alle_lieder, () => {
    openSongFromRoute();
    loadMusicXml();
});

const summary = computed(() => {
    const counts = { ok: 0, info: 0, warning: 0, error: 0 };
    results.value.forEach((r) => {
        counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
});

const all_good = computed(() => summary.value.error === 0 && summary.value.warning === 0);

// Nach Kategorie gruppieren, Reihenfolge der ersten Vorkommen beibehalten.
const categories = computed(() => {
    const visible = only_problems.value
        ? results.value.filter((r) => r.status !== 'ok')
        : results.value;
    const order = [];
    const map = {};
    visible.forEach((r) => {
        if (!map[r.category]) {
            map[r.category] = [];
            order.push(r.category);
        }
        map[r.category].push(r);
    });
    return order.map((name) => ({
        name,
        checks: map[name],
        problems: map[name].filter((c) => c.status !== 'ok').length,
    }));
});

// „Alle auf-/zuklappen“ wird über Zähler-Signale an die Kategorie-Komponenten
// weitergereicht; jede hält ihr eigenes Panel-Modell.
const expandSignal = ref(0);
const collapseSignal = ref(0);
function expandAll() {
    expandSignal.value++;
}
function collapseAll() {
    collapseSignal.value++;
}
</script>

<template>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
        <h1 class="me-4">Checks &amp; Validierung</h1>
        <v-chip color="primary" variant="tonal" prepend-icon="mdi-music">
            Genommen: {{ genommen.length }}
        </v-chip>
        <v-chip color="success" variant="tonal" prepend-icon="mdi-check-circle">
            OK: {{ summary.ok }}
        </v-chip>
        <v-chip v-if="summary.warning" color="warning" variant="tonal" prepend-icon="mdi-alert">
            Warnungen: {{ summary.warning }}
        </v-chip>
        <v-chip v-if="summary.error" color="error" variant="tonal" prepend-icon="mdi-alert-circle">
            Fehler: {{ summary.error }}
        </v-chip>
        <v-chip v-if="summary.info" color="info" variant="tonal" prepend-icon="mdi-information">
            Hinweise: {{ summary.info }}
        </v-chip>
    </div>

    <v-card class="mb-4">
        <v-card-text>
            <div class="d-flex flex-wrap align-center ga-4">
                <div class="text-medium-emphasis" style="flex: 1; min-width: 260px">
                    Prüfungen über alle „Bewertet und genommen“-Lieder – ideal als Kontrolle
                    <strong>vor dem Export</strong>.
                </div>
                <v-switch
                    v-model="only_problems"
                    label="Nur Probleme anzeigen"
                    color="primary"
                    hide-details
                    density="comfortable"
                />
                <v-btn
                    variant="text"
                    size="small"
                    prepend-icon="mdi-unfold-more-horizontal"
                    @click="expandAll"
                >
                    Alle aufklappen
                </v-btn>
                <v-btn
                    variant="text"
                    size="small"
                    prepend-icon="mdi-unfold-less-horizontal"
                    @click="collapseAll"
                >
                    Alle zuklappen
                </v-btn>
                <v-btn
                    v-if="can_export"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-file-music"
                    to="/notentext-export"
                >
                    Zum Notentext-Export
                </v-btn>
            </div>
        </v-card-text>
    </v-card>

    <v-alert
        v-if="alle_lieder.length === 0"
        type="info"
        variant="tonal"
        class="mb-4"
        prepend-icon="mdi-database-clock"
    >
        Daten werden geladen …
    </v-alert>

    <template v-else>
        <v-alert
            v-if="all_good"
            type="success"
            variant="tonal"
            class="mb-4"
            prepend-icon="mdi-party-popper"
        >
            Alles in Ordnung – keine Fehler oder Warnungen. Bereit zum Export.
        </v-alert>

        <CheckCategory
            v-for="category in categories"
            :key="category.name"
            :category="category"
            :expand-signal="expandSignal"
            :collapse-signal="collapseSignal"
            @open-song="openSong"
        />
    </template>

    <v-dialog v-model="song_dialog" width="700">
        <GesangbuchLiedComponent
            v-if="selected_song"
            :selected-song="selected_song"
            @close="song_dialog = false"
        />
    </v-dialog>
</template>
