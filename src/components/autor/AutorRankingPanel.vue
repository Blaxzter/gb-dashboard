<template>
    <v-card variant="outlined" class="h-100">
        <v-card-title class="d-flex align-center">
            <span>{{ title }}</span>
            <v-spacer />
            <v-chip size="small" variant="tonal" color="primary">
                {{ ranking.length }} Autoren
            </v-chip>
        </v-card-title>
        <v-card-subtitle>
            {{ workCount }} {{ workLabel }} (eindeutig) · {{ totalEntries }} Zuordnungen
        </v-card-subtitle>

        <v-card-text>
            <div v-if="ranking.length === 0" class="text-medium-emphasis text-center py-8">
                Keine Daten vorhanden.
            </div>

            <template v-else>
                <!-- Donut: count(*) GROUP BY Autor (Top-N, Rest als „Andere") -->
                <div style="height: 280px" class="mb-4">
                    <Doughnut :data="donutData" :options="donutOptions" />
                </div>

                <!-- Ranking: Anzahl pro Autor, absteigend -->
                <v-text-field
                    v-model="search"
                    label="Autor suchen"
                    prepend-inner-icon="mdi-magnify"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    class="mb-3"
                />

                <v-data-table
                    v-model:sort-by="sortBy"
                    :headers="tableHeaders"
                    :items="filteredItems"
                    :items-per-page="itemsPerPage"
                    item-value="autorId"
                    density="compact"
                    class="ranking-table"
                    hover
                    @click:row="onRowClick"
                >
                    <template #[`item.rang`]="{ item }">
                        <span class="text-medium-emphasis">{{ item.rang }}</span>
                    </template>
                    <template #[`item.name`]="{ item }">
                        <span class="d-inline-flex align-center">
                            {{ item.name }}
                            <v-icon size="14" class="ml-1 text-medium-emphasis">
                                mdi-open-in-new
                            </v-icon>
                        </span>
                    </template>
                    <template #[`item.count`]="{ item }">
                        <span class="font-weight-bold">{{ item.count }}</span>
                    </template>
                </v-data-table>
            </template>
        </v-card-text>
    </v-card>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'vue-chartjs';
import chroma from 'chroma-js';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps({
    // Titel der Karte, z. B. „Gesangbuch 2000".
    title: { type: String, required: true },
    // Bereits absteigend sortierte Rangliste: [{ autorId, name, count, songs }].
    // songs = [{ lied, nummer, titel }] – die Lieder, an denen der Autor beteiligt ist.
    ranking: { type: Array, required: true },
    // Anzahl eindeutiger Werke (Texte/Melodien) in dieser Auswahl – für den Untertitel.
    workCount: { type: Number, default: 0 },
    // Bezeichnung der gezählten Werke (für Untertitel & Tooltip), z. B. „Texte".
    workLabel: { type: String, default: 'Werke' },
    // Anzahl der einzeln dargestellten Donut-Segmente; der Rest wird zu „Andere".
    topN: { type: Number, default: 10 },
    itemsPerPage: { type: Number, default: 15 },
});

// Klick auf einen Autor öffnet einen Dialog mit dessen Liedern – die View hält
// den Dialog und bekommt den Autor samt Kontext (Ausgabe/Werkart) übergeben.
const emit = defineEmits(['open-author']);

const search = ref('');
const sortBy = ref([{ key: 'count', order: 'desc' }]);

const onRowClick = (_event, { item }) => {
    emit('open-author', { author: item, title: props.title, workLabel: props.workLabel });
};

// Summe aller Zuordnungen (ein Werk mit zwei Autoren zählt zweimal) – Kontext im Untertitel.
const totalEntries = computed(() => props.ranking.reduce((sum, r) => sum + r.count, 0));

const tableHeaders = [
    { title: 'Rang', key: 'rang', align: 'center', width: '70px' },
    { title: 'Autor', key: 'name' },
    { title: 'Anzahl', key: 'count', align: 'end', width: '90px' },
];

// Stabiler Rang aus der absteigenden Reihenfolge der übergebenen Liste.
const rankedItems = computed(() => props.ranking.map((r, i) => ({ ...r, rang: i + 1 })));

const filteredItems = computed(() => {
    const term = (search.value || '').trim().toLowerCase();
    if (!term) return rankedItems.value;
    return rankedItems.value.filter((r) => r.name.toLowerCase().includes(term));
});

// Top-N einzeln, der Rest gebündelt als „Andere".
const topRanking = computed(() => props.ranking.slice(0, props.topN));
const restRanking = computed(() => props.ranking.slice(props.topN));
const restCount = computed(() => restRanking.value.reduce((sum, r) => sum + r.count, 0));

// Für die Legende den Jahres-Zusatz „(1685–1750)" entfernen, damit die Beschriftung
// in der halbbreiten Vergleichsspalte kompakt bleibt; die Tabelle zeigt die Jahre.
const shortName = (name) => name.replace(/\s*\([^)]*\)\s*$/, '');

// Lange Namen kürzen, damit die Legende nicht abgeschnitten wirkt (Tooltip zeigt
// den vollständigen Namen).
const MAX_LABEL = 22;
const truncate = (text) =>
    text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1).trimEnd()}…` : text;

// Ein Segment je Donut-Slice – entweder ein Autor oder das gebündelte „Andere".
// Die Reihenfolge ist die Basis für Labels, Werte, Farben und Klick-Auflösung.
const donutSegments = computed(() => {
    const segments = topRanking.value.map((author) => ({
        author,
        fullLabel: shortName(author.name),
        value: author.count,
    }));
    if (restRanking.value.length > 0) {
        segments.push({
            author: null,
            fullLabel: `Andere (${restRanking.value.length} Autoren)`,
            value: restCount.value,
        });
    }
    return segments;
});

const donutValues = computed(() => donutSegments.value.map((s) => s.value));

const donutColors = computed(() => {
    const palette = [
        '#1ba3c6',
        '#2cb5c0',
        '#30bcad',
        '#21B087',
        '#33a65c',
        '#57a337',
        '#a2b627',
        '#d5bb21',
        '#f8b620',
        '#f89217',
        '#f06719',
        '#e03426',
        '#f64971',
        '#fc719e',
        '#eb73b3',
        '#ce69be',
        '#a26dc2',
        '#7873c0',
        '#4f7cba',
    ];
    const colors = chroma
        .scale(chroma.bezier(palette))
        .mode('lch')
        .colors(Math.max(topRanking.value.length, 1));
    // „Andere" bewusst grau, damit es sich vom Ranking abhebt.
    if (restRanking.value.length > 0) colors.push('#bdbdbd');
    return colors;
});

const donutData = computed(() => ({
    labels: donutSegments.value.map((s) => truncate(s.fullLabel)),
    datasets: [{ backgroundColor: donutColors.value, data: donutValues.value }],
}));

// Klick auf ein Donut-Segment öffnet den Autor-Dialog (außer beim gebündelten
// „Andere"). Die Legende behält bewusst ihr Standardverhalten: ein Klick auf einen
// Legendeneintrag blendet das jeweilige Segment aus/ein.
const openSegment = (index) => {
    const segment = donutSegments.value[index];
    if (segment && segment.author) {
        emit('open-author', {
            author: segment.author,
            title: props.title,
            workLabel: props.workLabel,
        });
    }
};

const donutOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
        if (elements.length) openSegment(elements[0].index);
    },
    onHover: (event, elements) => {
        event.native.target.style.cursor = elements[0] ? 'pointer' : 'default';
    },
    plugins: {
        legend: {
            position: 'right',
            labels: { boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
            callbacks: {
                label: (ctx) => {
                    const total = donutValues.value.reduce((sum, v) => sum + v, 0);
                    const value = ctx.parsed;
                    const pct = total ? ((value / total) * 100).toFixed(1) : '0';
                    const fullLabel = donutSegments.value[ctx.dataIndex]?.fullLabel ?? ctx.label;
                    return `${fullLabel}: ${value} ${props.workLabel} (${pct}%)`;
                },
            },
        },
    },
}));
</script>

<style scoped lang="scss">
.ranking-table :deep(td),
.ranking-table :deep(th) {
    padding-inline: 8px !important;
}

// Datenzeilen als anklickbar kennzeichnen (öffnet den Lieder-Dialog des Autors).
.ranking-table :deep(tbody tr) {
    cursor: pointer;
}
</style>
