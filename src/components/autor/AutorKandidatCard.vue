<template>
    <!-- Belegkarte eines GND-/Wikidata-Kandidaten im Autoren-Datencheck. -->
    <v-card
        :variant="chosen ? 'tonal' : 'outlined'"
        :color="chosen ? 'success' : undefined"
        rounded="lg"
        class="mb-2 pa-3"
    >
        <!-- Identität: Quelle, Label, externer Link -->
        <div class="d-flex align-center ga-2 mb-1">
            <v-chip
                size="small"
                variant="tonal"
                :color="isGnd ? 'indigo' : 'teal'"
                :prepend-icon="isGnd ? 'mdi-library' : 'mdi-database'"
            >
                {{ isGnd ? 'GND' : 'Wikidata' }}
            </v-chip>
            <div class="text-body-1 font-weight-medium text-truncate flex-grow-1">
                {{ candidate.label }}
            </div>
            <v-btn
                icon="mdi-open-in-new"
                size="x-small"
                variant="text"
                :href="candidate.url"
                target="_blank"
                rel="noopener"
                :title="candidate.ref_id"
            />
        </div>

        <div
            v-if="candidate.description"
            class="text-caption text-medium-emphasis mb-2 clamp-2"
            :title="candidate.description"
        >
            {{ candidate.description }}
        </div>

        <!-- Jahre + Berufe -->
        <div class="d-flex flex-wrap align-center ga-1 mb-2">
            <v-chip size="x-small" variant="tonal" prepend-icon="mdi-calendar">
                {{ lifespan(candidate.birth_year, candidate.death_year) }}
            </v-chip>
            <v-chip
                v-for="(o, i) in candidate.occupations || []"
                :key="i"
                size="x-small"
                variant="tonal"
                label
            >
                {{ o }}
            </v-chip>
        </div>

        <!-- Vertrauens-Maße: Namensgüte + Relevanz -->
        <div class="d-flex ga-4">
            <div class="flex-grow-1">
                <div class="d-flex justify-space-between text-caption">
                    <span>Namensgüte</span>
                    <span>{{ scorePct(candidate.name_score) }}</span>
                </div>
                <v-progress-linear
                    :model-value="(candidate.name_score ?? 0) * 100"
                    :color="scoreColor(candidate.name_score ?? 0)"
                    height="8"
                    rounded
                />
            </div>
            <div class="flex-grow-1">
                <div class="d-flex justify-space-between text-caption">
                    <span>Relevanz</span>
                    <span>{{ scorePct(candidate.relevance) }}</span>
                </div>
                <v-progress-linear
                    :model-value="(candidate.relevance ?? 0) * 100"
                    color="primary"
                    height="8"
                    rounded
                />
            </div>
        </div>

        <!-- Übernehmen -->
        <div class="d-flex justify-end mt-2">
            <v-btn
                size="small"
                color="primary"
                :variant="chosen ? 'flat' : 'tonal'"
                :prepend-icon="liveMatch ? 'mdi-check' : 'mdi-content-save-check'"
                :loading="applyingKey === applyKey"
                :disabled="!canApply || liveMatch"
                @click="$emit('apply', { key: applyKey, birth: candidate.birth_year, death: candidate.death_year })"
            >
                {{ liveMatch ? 'bereits aktiv' : 'Diese Jahre übernehmen' }}
            </v-btn>
        </div>
    </v-card>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    candidate: { type: Object, required: true },
    chosen: { type: Boolean, default: false },
    liveBirth: { type: [Number, String], default: null },
    liveDeath: { type: [Number, String], default: null },
    applyingKey: { type: [String, null], default: null },
    canApply: { type: Boolean, default: false },
});

defineEmits(['apply']);

// Lebensdaten ohne *- und †-Symbole darstellen (vgl. Issue #18).
const lifespan = (b, d) => {
    if (b != null && d != null) return `${b}–${d}`;
    if (b != null) return `geb. ${b}`;
    if (d != null) return `gest. ${d}`;
    return 'ohne Jahr';
};
const scorePct = (s) => `${Math.round((s ?? 0) * 100)}%`;
const scoreColor = (s) => (s >= 0.8 ? 'success' : s >= 0.5 ? 'warning' : 'error');

const isGnd = computed(() => props.candidate.source === 'gnd');
const applyKey = computed(() => `cand:${props.candidate.source}:${props.candidate.ref_id}`);
// Übernehmen würde den Live-Datensatz nicht verändern? Ein fehlendes Kandidaten-
// Jahr (null) zählt als „Live beibehalten“ (kein Löschen), passend zur Merge-
// Logik im View. Dann ist die Aktion ein No-op -> Button „bereits aktiv“.
const liveMatch = computed(() => {
    const lb = props.liveBirth ?? null;
    const ld = props.liveDeath ?? null;
    const cb = props.candidate.birth_year ?? null;
    const cd = props.candidate.death_year ?? null;
    const mergedB = cb == null ? lb : cb;
    const mergedD = cd == null ? ld : cd;
    return mergedB === lb && mergedD === ld;
});
</script>

<style scoped>
.clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
