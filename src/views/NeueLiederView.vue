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
            <v-col v-for="card in statCards" :key="card.key" cols="12" md="4">
                <v-card variant="tonal" :color="card.color" class="h-100">
                    <v-card-text>
                        <div class="d-flex align-center mb-1">
                            <v-icon :icon="card.icon" class="me-2" />
                            <span class="text-subtitle-1 font-weight-medium">{{ card.title }}</span>
                        </div>
                        <div class="d-flex align-baseline ga-2">
                            <span class="text-h3 font-weight-bold">{{ card.stat.neu }}</span>
                            <span class="text-medium-emphasis">von {{ card.stat.total }} neu</span>
                        </div>
                        <v-progress-linear
                            :model-value="percent(card.stat)"
                            :color="card.color"
                            height="6"
                            rounded
                            class="mt-2"
                        />
                        <div class="text-caption text-medium-emphasis mt-1">
                            {{ percent(card.stat) }}% neu · {{ card.stat.total - card.stat.neu }} alt
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <!-- 2. Neue Texte mit bekannter (alter) Melodie -->
        <section class="mb-10">
            <div class="text-h5 mb-1">Neue Texte mit bekannter Melodie</div>
            <p class="text-body-2 text-medium-emphasis mb-3">
                Diese Lieder haben einen neuen Text, aber eine bereits bekannte Melodie aus dem
                Gesangbuch 2000 – sie sind dadurch besonders leicht zu erlernen.
                <strong>{{ neueTexteMitBekannterMelodie.length }}</strong> Lieder.
            </p>
            <v-data-table
                :headers="textHeaders"
                :items="neueTexteMitBekannterMelodie"
                item-value="id"
                :items-per-page="25"
                density="comfortable"
                hover
                @click:row="(_e, { item }) => openSong(item)"
            >
                <template #[`item.geaendert`]="{ item }">
                    <v-chip
                        v-if="item.textGeaendert"
                        size="x-small"
                        color="primary"
                        prepend-icon="mdi-text-box-edit"
                    >
                        Text überarbeitet
                    </v-chip>
                    <v-chip v-else size="x-small" color="success" prepend-icon="mdi-new-box">
                        Neuer Text
                    </v-chip>
                </template>
                <template #no-data> Keine neuen Texte mit bekannter Melodie gefunden. </template>
            </v-data-table>
        </section>

        <!-- 3. Neue Melodien mit vielen zugeordneten Texten -->
        <section class="mb-10">
            <div class="text-h5 mb-1">Neue Melodien mit mehreren Texten</div>
            <p class="text-body-2 text-medium-emphasis mb-3">
                Lernt man eine dieser neuen Melodien, kann man gleich mehrere Lieder mit
                verschiedenen Texten abdecken. Sortiert nach Anzahl der zugeordneten Texte.
            </p>
            <v-data-table
                v-model:expanded="expanded"
                :headers="melodieHeaders"
                :items="neueMelodienMitTexten"
                item-value="id"
                :items-per-page="25"
                :sort-by="[{ key: 'textCount', order: 'desc' }]"
                show-expand
                density="comfortable"
            >
                <template #[`item.textCount`]="{ item }">
                    <v-chip size="small" color="primary" variant="flat">
                        {{ item.textCount }}
                    </v-chip>
                </template>
                <template #expanded-row="{ columns, item }">
                    <tr>
                        <td :colspan="columns.length">
                            <div class="d-flex flex-wrap ga-2 pa-2">
                                <div
                                    v-for="song in item.songs"
                                    :key="song.id"
                                    class="border rounded pa-1 song-selection-button"
                                    style="box-shadow: rgba(0, 0, 0, 0.16) 0px 1px 4px"
                                    @click="openSong(song)"
                                >
                                    {{ song.titel || '<keine Angabe>' }}
                                </div>
                            </div>
                        </td>
                    </tr>
                </template>
                <template #no-data> Keine neuen Melodien mit mehreren Texten gefunden. </template>
            </v-data-table>
        </section>

        <!-- 4. Alte Lieder mit Überarbeitung -->
        <section class="mb-6">
            <div class="text-h5 mb-1">Überarbeitete Lieder aus dem Gesangbuch 2000</div>
            <p class="text-body-2 text-medium-emphasis mb-3">
                Diese Lieder waren bereits im Gesangbuch 2000 enthalten, haben aber eine
                Text- oder Melodieüberarbeitung erfahren.
                <strong>{{ ueberarbeiteteAlteLieder.length }}</strong> Lieder.
            </p>
            <v-data-table
                :headers="ueberarbeitetHeaders"
                :items="ueberarbeiteteAlteLieder"
                item-value="id"
                :items-per-page="25"
                density="comfortable"
                hover
                @click:row="(_e, { item }) => openSong(item)"
            >
                <template #[`item.aenderung`]="{ item }">
                    <div class="d-flex ga-1">
                        <v-chip
                            v-if="item.textGeaendert"
                            size="x-small"
                            color="primary"
                            prepend-icon="mdi-text-box-edit"
                        >
                            Text
                        </v-chip>
                        <v-chip
                            v-if="item.melodieGeaendert"
                            size="x-small"
                            color="primary"
                            prepend-icon="mdi-music-box"
                        >
                            Melodie
                        </v-chip>
                    </div>
                </template>
                <template #no-data> Keine überarbeiteten Lieder gefunden. </template>
            </v-data-table>
        </section>
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
import GesangbuchLiedComponent from '@/components/SongRelated/GesangbuchLiedComponent.vue';

const { gesangbuchlieder } = storeToRefs(useAppStore());

const route = useRoute();
const router = useRouter();

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

const textHeaders = [
    { title: 'Titel', key: 'titel' },
    { title: 'Melodie', key: 'melodie_titel' },
    { title: '', key: 'geaendert', sortable: false, align: 'end' },
];

const melodieHeaders = [
    { title: 'Texte', key: 'textCount', align: 'center', width: '90px' },
    { title: 'Melodie', key: 'melodie_titel' },
    { title: '', key: 'data-table-expand' },
];

const ueberarbeitetHeaders = [
    { title: 'GB 2000', key: 'liednummer2000', width: '110px' },
    { title: 'Titel', key: 'titel' },
    { title: 'Änderung', key: 'aenderung', sortable: false, align: 'end' },
];

const expanded = ref([]);

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

<style scoped lang="scss">
.song-selection-button {
    cursor: pointer;

    &:hover {
        background-color: #f5f5f5;
    }
}
</style>
