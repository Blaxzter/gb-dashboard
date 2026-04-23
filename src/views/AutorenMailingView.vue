<script setup>
import _ from 'lodash';
import { ref, computed, onMounted, watch } from 'vue';
import { useAppStore } from '@/store/app.js';

const store = useAppStore();

const STORAGE_KEY = 'mailing_done_authors';

const search = ref('');
const hide_checked = ref(true);
const only_living = ref(true);
const only_with_rein = ref(true);
const sort_by = ref('nachname_asc');
const expanded = ref({});

const sort_options = [
    { title: 'Nachname (A–Z)', value: 'nachname_asc' },
    { title: 'Nachname (Z–A)', value: 'nachname_desc' },
    { title: 'Rein-Lieder (meiste zuerst)', value: 'rein_desc' },
    { title: 'Rein-Lieder (wenigste zuerst)', value: 'rein_asc' },
    { title: 'Beiträge gesamt (meiste zuerst)', value: 'total_desc' },
    { title: 'Nicht-Rein (meiste zuerst)', value: 'nicht_rein_desc' },
    { title: 'Unbewertet (meiste zuerst)', value: 'unbewertet_desc' },
];

const checked_ids = ref([]);

const snackbar = ref(false);
const snackbar_message = ref('');

onMounted(() => {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (Array.isArray(stored)) checked_ids.value = stored;
    } catch {
        checked_ids.value = [];
    }
});

watch(
    checked_ids,
    (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)),
    { deep: true },
);

const toggleChecked = (autor_id) => {
    const idx = checked_ids.value.indexOf(autor_id);
    if (idx >= 0) checked_ids.value.splice(idx, 1);
    else checked_ids.value.push(autor_id);
};

const isChecked = (autor_id) => checked_ids.value.includes(autor_id);

const isRein = (bezeichner) => !!bezeichner && bezeichner.toLowerCase().includes('rein');

const authors_grouped = computed(() => {
    const lieder = store.gesangbuchlieder;

    // Build a map autor_id -> contributions
    const contribByAuthor = {};

    lieder.forEach((lied) => {
        const textAuthorIds = new Set(
            (lied.text?.authors || []).map((a) => a.autor_id).filter((v) => v != null),
        );
        const melodieAuthorIds = new Set(
            (lied.melodie?.authors || []).map((a) => a.autor_id).filter((v) => v != null),
        );
        const allAuthorIds = new Set([...textAuthorIds, ...melodieAuthorIds]);

        allAuthorIds.forEach((autor_id) => {
            const asText = textAuthorIds.has(autor_id);
            const asMelodie = melodieAuthorIds.has(autor_id);
            const role = asText && asMelodie ? 'Text & Melodie' : asText ? 'Text' : 'Melodie';

            if (!contribByAuthor[autor_id]) contribByAuthor[autor_id] = [];
            contribByAuthor[autor_id].push({
                lied,
                role,
                bezeichner: lied.bewertung_kleiner_kreis?.bezeichner || '',
            });
        });
    });

    const byAutorId = _.keyBy(store.authors, 'id');

    return Object.keys(contribByAuthor)
        .map((autor_id_str) => {
            const autor_id = Number(autor_id_str);
            const author = byAutorId[autor_id];
            if (!author) return null;

            const contributions = _.sortBy(contribByAuthor[autor_id], (c) => c.lied.titel || '');
            const rein = contributions.filter((c) => isRein(c.bezeichner));
            const nicht_rein = contributions.filter(
                (c) => c.bezeichner && !isRein(c.bezeichner),
            );
            const unbewertet = contributions.filter((c) => !c.bezeichner);

            return {
                autor_id,
                author,
                verstorben: !!author.sterbejahr,
                contributions,
                rein,
                nicht_rein,
                unbewertet,
            };
        })
        .filter(Boolean);
});

const filtered_authors = computed(() => {
    const q = search.value.trim().toLowerCase();
    const filtered = authors_grouped.value.filter((g) => {
        if (hide_checked.value && isChecked(g.autor_id)) return false;
        if (only_living.value && g.verstorben) return false;
        if (only_with_rein.value && g.rein.length === 0) return false;
        if (q && !(g.author.name || '').toLowerCase().includes(q)) return false;
        return true;
    });

    const nameKey = (g) => (g.author.nachname || '').toLowerCase();

    switch (sort_by.value) {
        case 'nachname_desc':
            return _.orderBy(filtered, [nameKey], ['desc']);
        case 'rein_desc':
            return _.orderBy(filtered, [(g) => g.rein.length, nameKey], ['desc', 'asc']);
        case 'rein_asc':
            return _.orderBy(filtered, [(g) => g.rein.length, nameKey], ['asc', 'asc']);
        case 'total_desc':
            return _.orderBy(
                filtered,
                [(g) => g.contributions.length, nameKey],
                ['desc', 'asc'],
            );
        case 'nicht_rein_desc':
            return _.orderBy(
                filtered,
                [(g) => g.nicht_rein.length, nameKey],
                ['desc', 'asc'],
            );
        case 'unbewertet_desc':
            return _.orderBy(
                filtered,
                [(g) => g.unbewertet.length, nameKey],
                ['desc', 'asc'],
            );
        case 'nachname_asc':
        default:
            return _.orderBy(filtered, [nameKey], ['asc']);
    }
});

const stats = computed(() => {
    const total = authors_grouped.value.length;
    const done = authors_grouped.value.filter((g) => isChecked(g.autor_id)).length;
    const open = total - done;
    return { total, done, open };
});

const buildMailText = (group) => {
    const name = `${group.author.vorname || ''} ${group.author.nachname || ''}`.trim();
    const lines = [];
    lines.push(`Autor: ${name}${group.verstorben ? ' †' : ''}`);
    lines.push('');

    if (group.rein.length > 0) {
        lines.push(`Aufgenommen ins Gesangbuch 2026 (${group.rein.length}):`);
        group.rein.forEach((c, i) => {
            lines.push(`  ${i + 1}. „${c.lied.titel}" — ${c.role}`);
        });
        lines.push('');
    } else {
        lines.push('Aufgenommen ins Gesangbuch 2026: keine');
        lines.push('');
    }

    if (group.nicht_rein.length > 0) {
        lines.push(`Nicht aufgenommen (${group.nicht_rein.length}):`);
        group.nicht_rein.forEach((c, i) => {
            lines.push(`  ${i + 1}. „${c.lied.titel}" — ${c.role} (${c.bezeichner})`);
        });
        lines.push('');
    }

    if (group.unbewertet.length > 0) {
        lines.push(`Noch unbewertet (${group.unbewertet.length}):`);
        group.unbewertet.forEach((c, i) => {
            lines.push(`  ${i + 1}. „${c.lied.titel}" — ${c.role}`);
        });
        lines.push('');
    }

    return lines.join('\n');
};

const buildFilterLink = (group, onlyRein = true) => {
    const filter = {
        selected_author: [group.autor_id],
    };
    if (onlyRein) filter.selected_bewertung = 'Rein';
    const base64 = btoa(JSON.stringify(filter));
    return `${window.location.origin}/korrektur-lesung?filter=${base64}`;
};

const copyToClipboard = async (text, successMsg) => {
    try {
        await navigator.clipboard.writeText(text);
        snackbar_message.value = successMsg;
        snackbar.value = true;
    } catch {
        snackbar_message.value = 'Kopieren fehlgeschlagen';
        snackbar.value = true;
    }
};

const copyMail = (group) => {
    copyToClipboard(buildMailText(group), 'Mail-Text kopiert');
};

const copyLinkRein = (group) => {
    copyToClipboard(buildFilterLink(group, true), 'Filter-Link (Rein) kopiert');
};

const copyLinkAll = (group) => {
    copyToClipboard(buildFilterLink(group, false), 'Filter-Link (alle Lieder) kopiert');
};
</script>

<template>
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
        <h1 class="me-4">Autoren-Mailing</h1>
        <v-chip color="primary" variant="tonal"> Gesamt: {{ stats.total }} </v-chip>
        <v-chip color="success" variant="tonal"> Erledigt: {{ stats.done }} </v-chip>
        <v-chip color="warning" variant="tonal"> Offen: {{ stats.open }} </v-chip>
        <v-spacer />
        <v-select
            v-model="sort_by"
            :items="sort_options"
            prepend-inner-icon="mdi-sort"
            label="Sortierung"
            hide-details
            density="comfortable"
            style="min-width: 260px; max-width: 320px"
        />
    </div>

    <v-card class="mb-4">
        <v-card-text>
            <div class="d-flex flex-wrap align-center ga-4">
                <v-text-field
                    v-model="search"
                    prepend-inner-icon="mdi-magnify"
                    label="Autor suchen"
                    hide-details
                    clearable
                    density="comfortable"
                    style="min-width: 260px; flex: 1"
                />
                <v-checkbox
                    v-model="hide_checked"
                    label="Abgehakte ausblenden"
                    hide-details
                    density="comfortable"
                />
                <v-checkbox
                    v-model="only_living"
                    label="Nur lebende Autoren"
                    hide-details
                    density="comfortable"
                />
                <v-checkbox
                    v-model="only_with_rein"
                    label="Nur mit Rein-Liedern"
                    hide-details
                    density="comfortable"
                />
            </div>
        </v-card-text>
    </v-card>

    <div v-if="filtered_authors.length === 0">
        <v-alert color="info" icon="mdi-information">
            Keine Autoren passen zu den Filtern.
        </v-alert>
    </div>

    <v-expansion-panels v-model="expanded" multiple>
        <v-expansion-panel
            v-for="group in filtered_authors"
            :key="group.autor_id"
            :value="group.autor_id"
        >
            <v-expansion-panel-title>
                <div
                    class="d-flex align-center w-100 ga-2"
                    @click.stop
                >
                    <v-checkbox
                        :model-value="isChecked(group.autor_id)"
                        hide-details
                        density="compact"
                        class="flex-grow-0"
                        @click.stop
                        @update:model-value="toggleChecked(group.autor_id)"
                    />
                    <div class="flex-grow-1">
                        <div class="d-flex align-center ga-2 flex-wrap">
                            <span class="text-subtitle-1 font-weight-medium">
                                {{ group.author.vorname }} {{ group.author.nachname }}
                            </span>
                            <span
v-if="group.author.geburtsjahr || group.author.sterbejahr"
                                class="text-caption text-medium-emphasis">
                                ({{ group.author.geburtsjahr ? '*' + group.author.geburtsjahr : '' }}{{
                                    group.author.sterbejahr ? ' – ' + group.author.sterbejahr : ''
                                }})
                            </span>
                            <v-chip
                                v-if="group.verstorben"
                                size="x-small"
                                color="grey"
                                variant="tonal"
                                prepend-icon="mdi-cross"
                            >
                                verstorben
                            </v-chip>
                        </div>
                    </div>
                    <div class="d-flex ga-1">
                        <v-chip size="small" color="success" variant="tonal">
                            Rein: {{ group.rein.length }}
                        </v-chip>
                        <v-chip size="small" color="error" variant="tonal">
                            Nicht: {{ group.nicht_rein.length }}
                        </v-chip>
                        <v-chip
                            v-if="group.unbewertet.length > 0"
                            size="small"
                            color="grey"
                            variant="tonal"
                        >
                            Offen: {{ group.unbewertet.length }}
                        </v-chip>
                    </div>
                </div>
            </v-expansion-panel-title>

            <v-expansion-panel-text>
                <div class="d-flex flex-wrap ga-2 mb-4">
                    <v-btn
                        prepend-icon="mdi-content-copy"
                        color="primary"
                        variant="tonal"
                        size="small"
                        @click="copyMail(group)"
                    >
                        Mail-Text kopieren
                    </v-btn>
                    <v-btn
                        prepend-icon="mdi-link-variant"
                        color="success"
                        variant="tonal"
                        size="small"
                        :disabled="group.rein.length === 0"
                        @click="copyLinkRein(group)"
                    >
                        Filter-Link „Rein"
                    </v-btn>
                    <v-btn
                        prepend-icon="mdi-link-variant"
                        variant="tonal"
                        size="small"
                        @click="copyLinkAll(group)"
                    >
                        Filter-Link alle Lieder
                    </v-btn>
                </div>

                <v-table density="compact" class="mb-4">
                    <thead>
                        <tr>
                            <th style="width: 30%">Titel</th>
                            <th style="width: 20%">Rolle</th>
                            <th style="width: 20%">Bewertung</th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-if="group.rein.length > 0">
                            <tr>
                                <td colspan="3" class="font-weight-bold bg-green-lighten-5">
                                    Aufgenommen ({{ group.rein.length }})
                                </td>
                            </tr>
                            <tr v-for="c in group.rein" :key="'r' + c.lied.id">
                                <td>{{ c.lied.titel }}</td>
                                <td>{{ c.role }}</td>
                                <td>
                                    <v-chip size="x-small" color="success" variant="tonal">
                                        {{ c.bezeichner }}
                                    </v-chip>
                                </td>
                            </tr>
                        </template>
                        <template v-if="group.nicht_rein.length > 0">
                            <tr>
                                <td colspan="3" class="font-weight-bold bg-red-lighten-5">
                                    Nicht aufgenommen ({{ group.nicht_rein.length }})
                                </td>
                            </tr>
                            <tr v-for="c in group.nicht_rein" :key="'n' + c.lied.id">
                                <td>{{ c.lied.titel }}</td>
                                <td>{{ c.role }}</td>
                                <td>
                                    <v-chip size="x-small" color="error" variant="tonal">
                                        {{ c.bezeichner }}
                                    </v-chip>
                                </td>
                            </tr>
                        </template>
                        <template v-if="group.unbewertet.length > 0">
                            <tr>
                                <td colspan="3" class="font-weight-bold bg-grey-lighten-4">
                                    Noch unbewertet ({{ group.unbewertet.length }})
                                </td>
                            </tr>
                            <tr v-for="c in group.unbewertet" :key="'u' + c.lied.id">
                                <td>{{ c.lied.titel }}</td>
                                <td>{{ c.role }}</td>
                                <td class="text-medium-emphasis">—</td>
                            </tr>
                        </template>
                    </tbody>
                </v-table>

                <v-expansion-panels variant="accordion">
                    <v-expansion-panel>
                        <v-expansion-panel-title class="text-caption">
                            Vorschau Mail-Text
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <pre class="mail-preview">{{ buildMailText(group) }}</pre>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-expansion-panel-text>
        </v-expansion-panel>
    </v-expansion-panels>

    <v-snackbar v-model="snackbar" :timeout="2500">
        {{ snackbar_message }}
        <template #actions>
            <v-btn variant="text" @click="snackbar = false">Close</v-btn>
        </template>
    </v-snackbar>
</template>

<style scoped>
.mail-preview {
    white-space: pre-wrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    background-color: #f7f7f7;
    padding: 12px;
    border-radius: 4px;
    margin: 0;
}
</style>
