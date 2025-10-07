<template>
    <v-container>
        <!-- Chart with Hide Button and Filters -->
        <div class="d-flex align-center">
            <div class="text-h4 mb-6">Text-Melodie Verteilung</div>
            <v-spacer />

            <!-- Existing Min Songs Filter -->
            <div>
                <div class="text-caption">
                    Zeige Minimal
                    <span class="font-weight-bold">{{ minSongCount }}</span> Texte pro Melodie
                </div>
                <v-slider
                    v-model="minSongCount"
                    :min="1"
                    :max="maxSongCount"
                    :step="1"
                    show-ticks="always"
                    thumb-label
                ></v-slider>
            </div>

            <v-btn
                variant="text"
                icon="mdi-chart-bar"
                class="mb-2"
                :color="!showChart ? 'error' : 'primary'"
                @click="showChart = !showChart"
            >
            </v-btn>

            <v-btn
                variant="text"
                :icon="showFilter ? 'mdi-filter' : 'mdi-filter-outline'"
                class="mb-2"
                :color="'primary'"
                @click="showFilter = !showFilter"
            >
            </v-btn>
        </div>

        <!-- Rest of your template remains the same -->
        <v-expand-transition>
            <div v-show="showChart" style="width: 100%; height: 100px">
                <Bar :data="chartData" :options="options" />
            </div>
        </v-expand-transition>

        <v-expand-transition>
            <!-- Syllable Filter -->
            <div v-show="showFilter">
                <v-select
                    v-model="selectedSilbenProStrophe"
                    :items="silbenProStropheItems"
                    label="Silben pro Strophe"
                    multiple
                    chips
                    closable-chips
                    clearable
                >
                    <template #prepend>
                        <v-btn
                            size="small"
                            variant="text"
                            :color="isAllSelected ? 'primary' : 'default'"
                            @click="toggleSelectAll"
                        >
                            {{ isAllSelected ? 'Alle Abwählen' : 'Alle Anwählen' }}
                        </v-btn>
                    </template>
                </v-select>
            </div>
        </v-expand-transition>

        <!-- Melody Search Input -->
        <v-text-field
            v-model="melodySearch"
            label="Search Melodies"
            prepend-inner-icon="mdi-magnify"
            clearable
            class="mb-4"
        ></v-text-field>

        <!-- Data Table -->
        <v-data-table
            v-model:expanded="expanded"
            v-model:sort-by="sortBy"
            :headers="tableHeaders"
            :items="melodyGroupsFiltered"
            item-value="id"
            :items-per-page="100"
            show-expand
            @click:row="rowClick"
        >
            <template #[`header.count`]="{}">
                <v-icon>mdi-pound</v-icon>
                <v-icon>mdi-text-box-outline</v-icon>
            </template>
            <template #[`header.sum`]="{}">
                <v-icon>mdi-sigma</v-icon>
            </template>
            <template #[`header.data-table-expand`]="{}">
                <v-icon v-if="expanded.length === 0" size="15" @click="expandAll"
                    >mdi-arrow-expand-down</v-icon
                >
                <v-icon v-else size="small" @click="expanded = []">mdi-arrow-expand-up</v-icon>
            </template>
            <!-- Expanded Row Slot -->
            <template #expanded-row="{ columns, item }">
                <tr>
                    <td :colspan="columns.length">
                        <div class="d-flex flex-wrap ga-2 pa-2">
                            <div
                                v-for="song in item.songs"
                                :key="song.id"
                                class="border rounded pa-1 cursor-pointer hover:bg-grey-lightest song-selection-button"
                                style="box-shadow: rgba(0, 0, 0, 0.16) 0px 1px 4px"
                                @click="openSongDialog(song)"
                            >
                                <span v-if="song.gesangbuch_titel !== 'null'">
                                    {{ song.gesangbuch_titel }}
                                </span>
                                <span v-else>
                                    <!--  <keine Angaben>      -->
                                    &lt;keine Angaben&gt;
                                </span>
                            </div>
                        </div>
                    </td>
                </tr>
            </template>
        </v-data-table>
    </v-container>

    <v-dialog v-model="song_dialog" width="700">
        <GesangbuchLiedComponent :selected-song="selected_song" @close="song_dialog = false" />
    </v-dialog>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
} from 'chart.js';
import { Bar } from 'vue-chartjs';

import { useAppStore } from '@/store/app.js';
import { storeToRefs } from 'pinia';
import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const { gesangbuchlieder } = storeToRefs(useAppStore());

const showChart = ref(true);
const showFilter = ref(false);
const minSongCount = ref(2);
const maxSongCount = ref(20);
const expanded = ref([]);
const melodySearch = ref('');
const selectedSilbenProStrophe = ref([]);

const sortBy = ref([{ key: 'count', order: 'desc' }]);
const song_dialog = ref(false);
const selected_song = ref(null);

const uniqueSilbenProStrophe = computed(() =>
    Array.from(new Set(filteredSongs.value.map((song) => song.melodie.silben_pro_strophe))),
);

const silbenProStropheItems = computed(() =>
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    uniqueSilbenProStrophe.value
        .sort((a, b) => a - b) // Sort numerically in ascending order
        .map((value) => ({
            title: `${value} Silben`,
            value: value,
        })),
);

const isAllSelected = computed(
    () => selectedSilbenProStrophe.value.length === uniqueSilbenProStrophe.value.length,
);

const toggleSelectAll = () => {
    if (isAllSelected.value) {
        selectedSilbenProStrophe.value = [];
    } else {
        selectedSilbenProStrophe.value = uniqueSilbenProStrophe.value;
    }
};

onMounted(() => {
    selectedSilbenProStrophe.value = [...uniqueSilbenProStrophe.value];

    const savedShowChart = localStorage.getItem('melody-distribution-show-chart');
    const savedShowFilter = localStorage.getItem('melody-distribution-show-filter');

    if (savedShowChart !== null) {
        showChart.value = JSON.parse(savedShowChart);
    }

    if (savedShowFilter !== null) {
        showFilter.value = JSON.parse(savedShowFilter);
    }
});

const openSongDialog = (song) => {
    selected_song.value = song;
    song_dialog.value = true;
};

const rowClick = (row, item) => {
    console.log(row, item);
    console.log(item.item.id);
    expanded.value = expanded.value.includes(item.item.id) ? [] : [item.item.id];
};

// Filter songs with rating 'rein'
const filteredSongs = computed(() =>
    gesangbuchlieder.value.filter((song) => song.bewertung_kleiner_kreis.bezeichner === 'Rein'),
);

// Group songs by melody
const melodyGroups = computed(() => {
    const groups = {};
    filteredSongs.value.forEach((song) => {
        if (!groups[song.melodie?.id]) {
            groups[song.melodie?.id] = {
                id: song.melodie?.id,
                melodie: song.melodie,
                melodie_titel: song.melodie?.titel,
                count: 0,
                sum: song.melodie.silben_pro_strophe,
                songs: [],
            };
        }
        groups[song.melodie?.id].count += 1;
        groups[song.melodie?.id].songs.push(song);
    });
    return Object.values(groups);
});

// Update maxSongCount based on the data
maxSongCount.value = Math.max(...melodyGroups.value.map((group) => group.count));

// Filter melody groups based on minSongCount and search term
const melodyGroupsFiltered = computed(() =>
    melodyGroups.value.filter(
        (group) =>
            group.count >= minSongCount.value &&
            (melodySearch.value == null ||
                group.melodie_titel?.toLowerCase().includes(melodySearch.value?.toLowerCase())) &&
            (selectedSilbenProStrophe.value.length === 0 || // Show all if nothing selected
                selectedSilbenProStrophe.value.includes(group.melodie.silben_pro_strophe)),
    ),
);

// New computed property for the chart (filtered only by minSongCount)
const melodyGroupsForChart = computed(() =>
    melodyGroups.value.filter(
        (group) =>
            group.count >= minSongCount.value &&
            (selectedSilbenProStrophe.value.length === 0 || // Show all if nothing selected
                selectedSilbenProStrophe.value.includes(group.melodie.silben_pro_strophe)),
    ),
);

// Table headers
const tableHeaders = [
    {
        title: '#',
        key: 'count',
        sortable: true,
        align: 'center',
        width: '100px',
    },
    {
        title: '∑',
        key: 'sum',
        sortable: true,
        align: 'center',
        width: '100px',
    },
    { title: 'Melody', key: 'melodie_titel', sortable: true },
    { title: '', key: 'data-table-expand', align: 'center' },
];

const expandAll = () => {
    expanded.value = melodyGroupsFiltered.value.map((group) => group.melody);
};

const chartData = computed(() => {
    const data = {
        labels: melodyGroupsForChart.value.map((group) => group.melodie_titel),
        datasets: [
            {
                label: 'Songs',
                data: melodyGroupsForChart.value.map((group) => group.count),
                backgroundColor: '#3f51b5',
            },
        ],
    };
    return data;
});

// Click handler for the chart
const onChartClick = (event, elements) => {
    if (elements.length > 0) {
        const elementIndex = elements[0].index;
        const clickedGroup = melodyGroupsForChart.value[elementIndex];
        const clickedMelodyTitle = clickedGroup.melodie_titel;

        // Update the melodySearch to the clicked melody title
        melodySearch.value = clickedMelodyTitle;
    }
};

const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: onChartClick, // Include the click handler in options
    plugins: {
        legend: {
            display: false,
        },
    },
    scales: {
        x: {
            grid: {
                display: false,
            },
            ticks: {
                display: false,
            },
        },
        y: {
            grid: {
                display: false,
            },
            ticks: {
                stepSize: 1,
            },
        },
    },
};

watch(showChart, (newValue) => {
    localStorage.setItem('melody-distribution-show-chart', JSON.stringify(newValue));
});

watch(showFilter, (newValue) => {
    localStorage.setItem('melody-distribution-show-filter', JSON.stringify(newValue));
});
</script>

<style scoped lang="scss">
.song-selection-button {
    cursor: pointer;

    &:hover {
        background-color: #f5f5f5;
    }
}
</style>
