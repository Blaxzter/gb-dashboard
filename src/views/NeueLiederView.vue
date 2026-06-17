<template>
    <v-container>
        <div class="text-h4 mb-2">Neue Lieder, Texte &amp; Melodien</div>
        <p class="text-body-2 text-medium-emphasis mb-6" style="max-width: 820px">
            Diese Übersicht zeigt, wie viel im Gesangbuch 2026 wirklich neu ist – und wie viele
            „neue“ Lieder auf bereits bekannten Melodien aufbauen und damit leicht zu erlernen sind.
            Als <strong>alt</strong> gilt ein Lied / Text / eine Melodie, wenn es bereits im
            Gesangbuch 2000 enthalten war (Liednummer 2000 vorhanden) und seither nicht verändert
            wurde.
        </p>

        <!-- 1. Statistik-Übersicht -->
        <v-row class="mb-8">
            <v-col v-for="card in statCards" :key="card.key" cols="12" sm="4">
                <v-card variant="tonal" :color="card.color" class="h-100" rounded="lg">
                    <v-card-text class="d-flex align-center ga-4">
                        <v-progress-circular
                            :model-value="percent(card.stat)"
                            :size="76"
                            :width="7"
                            :color="card.color"
                        >
                            <span class="text-subtitle-2 font-weight-bold">
                                {{ percent(card.stat) }}%
                            </span>
                        </v-progress-circular>
                        <div>
                            <div class="d-flex align-center mb-1">
                                <v-icon :icon="card.icon" size="small" class="me-1" />
                                <span class="text-overline">{{ card.title }}</span>
                            </div>
                            <div class="text-h4 font-weight-bold">{{ card.stat.neu }}</div>
                            <div class="text-caption text-medium-emphasis">
                                von {{ card.stat.total }} insgesamt
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <!-- 1b. Zusammensetzung: komplett neu vs. überarbeitet vs. übernommen (Issue #46) -->
        <v-card variant="flat" rounded="lg" border class="mb-8">
            <v-card-item>
                <v-card-title class="text-h6">Woher kommen die Lieder?</v-card-title>
                <v-card-subtitle class="text-wrap">
                    Aufschlüsselung der {{ composition.total }} angenommenen Lieder: wie viele
                    komplett neu sind (nicht im Gesangbuch 2000), wie viele bestehende Lieder
                    überarbeitet und wie viele unverändert übernommen wurden.
                </v-card-subtitle>
            </v-card-item>
            <v-card-text>
                <v-row align="center">
                    <v-col cols="12" sm="5" md="4">
                        <div class="composition-chart">
                            <Doughnut :data="compositionChartData" :options="compositionChartOptions" />
                        </div>
                    </v-col>
                    <v-col cols="12" sm="7" md="8">
                        <div
                            v-for="item in compositionLegend"
                            :key="item.key"
                            class="d-flex align-center mb-3"
                        >
                            <span
                                class="composition-swatch me-3"
                                :style="{ backgroundColor: item.color }"
                            />
                            <div class="flex-grow-1">
                                <div class="d-flex align-baseline ga-2">
                                    <span class="text-subtitle-1 font-weight-medium">
                                        {{ item.label }}
                                    </span>
                                    <span class="text-h6 font-weight-bold">{{ item.value }}</span>
                                    <span class="text-caption text-medium-emphasis">
                                        ({{ item.percent }}%)
                                    </span>
                                </div>
                                <v-progress-linear
                                    :model-value="item.percent"
                                    :color="item.color"
                                    height="6"
                                    rounded
                                    class="my-1"
                                />
                                <div class="text-caption text-medium-emphasis">{{ item.hint }}</div>
                            </div>
                        </div>
                        <v-divider class="my-2" />
                        <div class="text-caption text-medium-emphasis">
                            „Neue Lieder“ ({{ stats.lieder.neu }}) = komplett neu
                            ({{ composition.komplettNeu }}) + überarbeitet
                            ({{ composition.ueberarbeitet }}).
                        </div>
                    </v-col>
                </v-row>
            </v-card-text>
        </v-card>

        <!-- 2.-4. Übersichten in Tabs, damit die drei Bereiche nicht gestapelt erscheinen -->
        <v-card variant="flat" rounded="lg" border>
            <v-tabs v-model="tab" color="primary" bg-color="transparent" grow show-arrows>
                <v-tab value="texte">
                    <v-icon start>mdi-text-box-check-outline</v-icon>
                    <span class="text-none">Bekannte Melodie</span>
                    <v-chip size="x-small" class="ms-2" variant="tonal">
                        {{ neueTexteMitBekannterMelodie.length }}
                    </v-chip>
                </v-tab>
                <v-tab value="melodien">
                    <v-icon start>mdi-music-box-multiple-outline</v-icon>
                    <span class="text-none">Melodie, mehrere Texte</span>
                    <v-chip size="x-small" class="ms-2" variant="tonal">
                        {{ neueMelodienMitTexten.length }}
                    </v-chip>
                </v-tab>
                <v-tab value="ueberarbeitet">
                    <v-icon start>mdi-pencil-outline</v-icon>
                    <span class="text-none">Überarbeitet</span>
                    <v-chip size="x-small" class="ms-2" variant="tonal">
                        {{ ueberarbeiteteAlteLieder.length }}
                    </v-chip>
                </v-tab>
            </v-tabs>

            <v-divider />

            <v-window v-model="tab">
                <!-- Neue Texte mit bekannter (alter) Melodie -->
                <v-window-item value="texte">
                    <div class="pa-4">
                        <p class="text-body-2 text-medium-emphasis mb-4">
                            Neuer Text auf einer bereits bekannten Melodie aus dem Gesangbuch 2000 –
                            diese Lieder lassen sich besonders schnell mitsingen.
                        </p>
                        <v-row v-if="neueTexteMitBekannterMelodie.length" dense>
                            <v-col
                                v-for="lied in neueTexteMitBekannterMelodie"
                                :key="lied.id"
                                cols="12"
                                sm="6"
                                md="4"
                            >
                                <v-card
                                    variant="outlined"
                                    rounded="lg"
                                    hover
                                    class="h-100"
                                    @click="openSong(lied)"
                                >
                                    <v-card-item>
                                        <template #append>
                                            <v-chip
                                                size="x-small"
                                                :color="lied.textGeaendert ? 'primary' : 'success'"
                                                variant="tonal"
                                            >
                                                {{ lied.textGeaendert ? 'Text neu gefasst' : 'Neuer Text' }}
                                            </v-chip>
                                        </template>
                                        <v-card-title class="text-body-1 text-wrap">
                                            {{ lied.titel }}
                                        </v-card-title>
                                    </v-card-item>
                                    <v-card-text
                                        class="pt-0 d-flex align-center text-medium-emphasis"
                                    >
                                        <v-icon size="small" class="me-1">
                                            mdi-music-clef-treble
                                        </v-icon>
                                        <span class="text-truncate">{{ lied.melodie_titel }}</span>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>
                        <v-alert v-else type="info" variant="tonal" density="comfortable">
                            Keine neuen Texte mit bekannter Melodie gefunden.
                        </v-alert>
                    </div>
                </v-window-item>

                <!-- Neue Melodien mit mehreren zugeordneten Texten -->
                <v-window-item value="melodien">
                    <div class="pa-4">
                        <p class="text-body-2 text-medium-emphasis mb-4">
                            Wer eine dieser neuen Melodien lernt, kann gleich mehrere Lieder singen.
                            Die Zahl zeigt, wie viele Texte auf der Melodie liegen – sortiert nach
                            dem größten Nutzen.
                        </p>
                        <v-row v-if="neueMelodienMitTexten.length" dense>
                            <v-col
                                v-for="melodie in neueMelodienMitTexten"
                                :key="melodie.id"
                                cols="12"
                                md="6"
                            >
                                <v-card variant="outlined" rounded="lg" class="h-100">
                                    <v-card-item>
                                        <template #prepend>
                                            <v-avatar
                                                color="deep-purple"
                                                variant="tonal"
                                                size="44"
                                            >
                                                <span class="text-h6 font-weight-bold">
                                                    {{ melodie.textCount }}
                                                </span>
                                            </v-avatar>
                                        </template>
                                        <v-card-title class="text-body-1 text-wrap">
                                            {{ melodie.melodie_titel }}
                                        </v-card-title>
                                        <v-card-subtitle>
                                            {{ melodie.textCount }} Texte auf dieser Melodie
                                        </v-card-subtitle>
                                    </v-card-item>
                                    <v-card-text class="pt-1">
                                        <div class="d-flex flex-wrap ga-1">
                                            <v-chip
                                                v-for="song in melodie.songs"
                                                :key="song.id"
                                                size="small"
                                                variant="tonal"
                                                label
                                                @click="openSong(song)"
                                            >
                                                {{ song.titel || '<keine Angabe>' }}
                                            </v-chip>
                                        </div>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>
                        <v-alert v-else type="info" variant="tonal" density="comfortable">
                            Keine neuen Melodien mit mehreren Texten gefunden.
                        </v-alert>
                    </div>
                </v-window-item>

                <!-- Überarbeitete Lieder aus dem Gesangbuch 2000 -->
                <v-window-item value="ueberarbeitet">
                    <div class="pa-4">
                        <p class="text-body-2 text-medium-emphasis mb-4">
                            Diese Lieder gab es schon im Gesangbuch 2000, ihr Text oder ihre Melodie
                            wurde jedoch überarbeitet.
                        </p>
                        <v-row v-if="ueberarbeiteteAlteLieder.length" dense>
                            <v-col
                                v-for="lied in ueberarbeiteteAlteLieder"
                                :key="lied.id"
                                cols="12"
                                sm="6"
                                md="4"
                            >
                                <v-card
                                    variant="outlined"
                                    rounded="lg"
                                    hover
                                    class="h-100"
                                    @click="openSong(lied)"
                                >
                                    <v-card-item>
                                        <template #prepend>
                                            <v-chip
                                                size="small"
                                                variant="tonal"
                                                color="blue-grey"
                                            >
                                                GB {{ lied.liednummer2000 }}
                                            </v-chip>
                                        </template>
                                        <v-card-title class="text-body-1 text-wrap">
                                            {{ lied.titel }}
                                        </v-card-title>
                                    </v-card-item>
                                    <v-card-text class="pt-0 d-flex ga-1">
                                        <v-chip
                                            v-if="lied.textGeaendert"
                                            size="x-small"
                                            color="primary"
                                            variant="tonal"
                                            prepend-icon="mdi-text-box-edit-outline"
                                        >
                                            Text
                                        </v-chip>
                                        <v-chip
                                            v-if="lied.melodieGeaendert"
                                            size="x-small"
                                            color="deep-purple"
                                            variant="tonal"
                                            prepend-icon="mdi-music-box"
                                        >
                                            Melodie
                                        </v-chip>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>
                        <v-alert v-else type="info" variant="tonal" density="comfortable">
                            Keine überarbeiteten Lieder gefunden.
                        </v-alert>
                    </div>
                </v-window-item>
            </v-window>
        </v-card>
    </v-container>

    <v-dialog v-model="song_dialog" width="700">
        <GesangbuchLiedComponent
            v-if="selected_song"
            :selected-song="selected_song"
            @close="song_dialog = false"
        />
    </v-dialog>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/store/app.js';
import { storeToRefs } from 'pinia';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'vue-chartjs';
import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';

ChartJS.register(ArcElement, Tooltip, Legend);

const { gesangbuchlieder } = storeToRefs(useAppStore());

const route = useRoute();
const router = useRouter();

const tab = ref('texte');

// Nur angenommene Lieder betrachten (Bewertung "Rein"). Nicht angenommene Lieder
// werden verworfen und sollen die Neu-/Alt-Statistik nicht verfälschen – konsistent
// zur Text-Melodie-Verteilung.
const reineLieder = computed(() =>
    gesangbuchlieder.value.filter((lied) => lied.bewertung_kleiner_kreis?.bezeichner === 'Rein'),
);

// "bekannt/alt" = im Gesangbuch 2000 enthalten (liednummer2000 vorhanden) und nicht
// verändert. Da textGeaendert/melodieGeaendert pro Gesangbuchlied gesetzt sind, wird
// der bekannte Bestand auf Entitätsebene (Text-/Melodie-Id) ermittelt: Eine Melodie /
// ein Text gilt als bekannt, sobald sie in mindestens einem alten, unveränderten Lied
// vorkommt. Dadurch zählen auch neue Lieder, die eine alte Melodie wiederverwenden,
// korrekt als „neuer Text auf bekannter Melodie“.
const melodieBekanntIds = computed(() => {
    const ids = new Set();
    for (const lied of reineLieder.value) {
        if (lied.melodie?.id != null && lied.liednummer2000 != null && !lied.melodieGeaendert) {
            ids.add(lied.melodie.id);
        }
    }
    return ids;
});

const textBekanntIds = computed(() => {
    const ids = new Set();
    for (const lied of reineLieder.value) {
        if (lied.text?.id != null && lied.liednummer2000 != null && !lied.textGeaendert) {
            ids.add(lied.text.id);
        }
    }
    return ids;
});

const liedIstNeu = (lied) =>
    lied.liednummer2000 == null || lied.textGeaendert === true || lied.melodieGeaendert === true;
const textIstNeu = (lied) => lied.text?.id != null && !textBekanntIds.value.has(lied.text.id);
const melodieIstBekannt = (lied) =>
    lied.melodie?.id != null && melodieBekanntIds.value.has(lied.melodie.id);

// 1. Statistik: Anzahl neuer Lieder sowie eindeutiger neuer Texte / Melodien.
const stats = computed(() => {
    const melodieIds = new Set();
    const neueMelodieIds = new Set();
    const textIds = new Set();
    const neueTextIds = new Set();
    let neueLieder = 0;

    for (const lied of reineLieder.value) {
        if (liedIstNeu(lied)) neueLieder += 1;
        if (lied.melodie?.id != null) {
            melodieIds.add(lied.melodie.id);
            if (!melodieBekanntIds.value.has(lied.melodie.id)) neueMelodieIds.add(lied.melodie.id);
        }
        if (lied.text?.id != null) {
            textIds.add(lied.text.id);
            if (!textBekanntIds.value.has(lied.text.id)) neueTextIds.add(lied.text.id);
        }
    }

    return {
        lieder: { neu: neueLieder, total: reineLieder.value.length },
        texte: { neu: neueTextIds.size, total: textIds.size },
        melodien: { neu: neueMelodieIds.size, total: melodieIds.size },
    };
});

// Differenzierung der angenommenen Lieder (Issue #46): Die „Neue Lieder"-Kennzahl
// fasst komplett neue und überarbeitete Lieder zusammen. Hier wird beides – plus
// die unverändert übernommenen – getrennt ausgewiesen:
//   - komplett neu:   war nicht im Gesangbuch 2000 (keine liednummer2000)
//   - überarbeitet:   war im GB 2000, Text und/oder Melodie wurde überarbeitet
//   - übernommen:     war im GB 2000 und blieb unverändert
const composition = computed(() => {
    let komplettNeu = 0;
    let ueberarbeitet = 0;
    let uebernommen = 0;
    for (const lied of reineLieder.value) {
        if (lied.liednummer2000 == null) komplettNeu += 1;
        else if (lied.textGeaendert || lied.melodieGeaendert) ueberarbeitet += 1;
        else uebernommen += 1;
    }
    return { komplettNeu, ueberarbeitet, uebernommen, total: reineLieder.value.length };
});

const COMPOSITION_META = [
    { key: 'komplettNeu', label: 'Komplett neu', color: '#3949AB', hint: 'nicht im GB 2000' },
    { key: 'ueberarbeitet', label: 'Überarbeitet', color: '#FB8C00', hint: 'GB 2000, Text/Melodie geändert' },
    { key: 'uebernommen', label: 'Unverändert übernommen', color: '#90A4AE', hint: 'GB 2000, unverändert' },
];

const compositionLegend = computed(() =>
    COMPOSITION_META.map((m) => {
        const value = composition.value[m.key];
        const total = composition.value.total;
        return {
            ...m,
            value,
            percent: total > 0 ? Math.round((value / total) * 100) : 0,
        };
    }),
);

const compositionChartData = computed(() => ({
    labels: COMPOSITION_META.map((m) => m.label),
    datasets: [
        {
            data: COMPOSITION_META.map((m) => composition.value[m.key]),
            backgroundColor: COMPOSITION_META.map((m) => m.color),
            borderWidth: 0,
        },
    ],
}));

const compositionChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: { legend: { display: false } },
};

const statCards = computed(() => [
    {
        key: 'lieder',
        title: 'Neue Lieder',
        icon: 'mdi-music-note',
        color: 'indigo',
        stat: stats.value.lieder,
    },
    {
        key: 'texte',
        title: 'Neue Texte',
        icon: 'mdi-text-box-outline',
        color: 'teal',
        stat: stats.value.texte,
    },
    {
        key: 'melodien',
        title: 'Neue Melodien',
        icon: 'mdi-music-box',
        color: 'deep-purple',
        stat: stats.value.melodien,
    },
]);

const percent = (stat) => (stat.total > 0 ? Math.round((stat.neu / stat.total) * 100) : 0);

// 2. Neue Texte mit bekannter (alter) Melodie.
const neueTexteMitBekannterMelodie = computed(() =>
    reineLieder.value
        .filter((lied) => textIstNeu(lied) && melodieIstBekannt(lied))
        .slice()
        .sort((a, b) => (a.titel || '').localeCompare(b.titel || '', 'de')),
);

// 3. Neue Melodien, gruppiert mit der Anzahl eindeutiger zugeordneter Texte (>= 2).
const neueMelodienMitTexten = computed(() => {
    const groups = {};
    for (const lied of reineLieder.value) {
        const mid = lied.melodie?.id;
        if (mid == null || melodieBekanntIds.value.has(mid)) continue; // nur neue Melodien
        if (!groups[mid]) {
            groups[mid] = {
                id: mid,
                melodie_titel: lied.melodie?.titel || '<keine Angabe>',
                textIds: new Set(),
                songs: [],
            };
        }
        groups[mid].songs.push(lied);
        if (lied.text?.id != null) groups[mid].textIds.add(lied.text.id);
    }
    return Object.values(groups)
        .map((g) => ({
            id: g.id,
            melodie_titel: g.melodie_titel,
            textCount: g.textIds.size,
            songs: g.songs,
        }))
        .filter((g) => g.textCount >= 2)
        .sort((a, b) => b.textCount - a.textCount);
});

// 4. Alte (2000er) Lieder mit Text- oder Melodieüberarbeitung.
const ueberarbeiteteAlteLieder = computed(() =>
    reineLieder.value
        .filter((lied) => lied.liednummer2000 != null && (lied.textGeaendert || lied.melodieGeaendert))
        .slice()
        .sort((a, b) => (a.liednummer2000 ?? 0) - (b.liednummer2000 ?? 0)),
);

// Detailansicht (Lied-Dialog), an die URL gekoppelt (Deep-Link, Muster wie in der
// Text-Melodie-Verteilung). Pfad-Param :id = geöffnetes Lied.
const song_dialog = ref(false);
const selected_song = ref(null);
const openSong = (lied) => {
    selected_song.value = lied;
    song_dialog.value = true;
};

watch(song_dialog, (is_open) => {
    if (is_open) {
        if (selected_song.value && String(route.params.id) !== String(selected_song.value.id)) {
            router.replace({ name: 'NeueLieder', params: { id: String(selected_song.value.id) } });
        }
    } else {
        selected_song.value = null;
        if (route.params.id != null) {
            router.replace({ name: 'NeueLieder' });
        }
    }
});

// Dialog aus der URL wiederherstellen, sobald die Lieder verfügbar sind –
// z. B. nach Reload oder über einen geteilten Link.
const openFromRoute = () => {
    const id = route.params.id;
    if (id == null || id === '' || song_dialog.value) return;
    const idNum = parseInt(id, 10);
    const lied = gesangbuchlieder.value.find((l) => l.id === idNum);
    if (!lied) return;
    selected_song.value = lied;
    song_dialog.value = true;
};

onMounted(openFromRoute);
watch(gesangbuchlieder, openFromRoute);
</script>

<style scoped>
.composition-chart {
    position: relative;
    height: 200px;
}
.composition-swatch {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex: 0 0 auto;
}
</style>
