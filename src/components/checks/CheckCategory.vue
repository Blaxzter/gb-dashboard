<script setup>
import { ref, watch } from 'vue';
import { STATUS } from '@/assets/js/gesangbuchChecks.js';

const props = defineProps({
    // { name, checks: [...], problems: Number }
    category: { type: Object, required: true },
    // Zähler-Signale: erhöht der Parent, klappen alle Gruppen auf/zu.
    expandSignal: { type: Number, default: 0 },
    collapseSignal: { type: Number, default: 0 },
});

defineEmits(['open-song']);

// Pro Check maximal so viele Treffer rendern (Performance bei großen Listen).
const MAX_ITEMS = 200;

// Eigene Auf-/Zuklapp-Steuerung über ein Set offener Check-IDs. Standardmäßig ist
// alles zugeklappt (Performance) – und wir verzichten bewusst auf
// <v-expansion-panels>, dessen Gruppen-Modell bei mehreren gleichzeitig
// aktualisierten Gruppen rekursiv in sich selbst schreibt (Stack Overflow).
const open = ref(new Set());

function isOpen(id) {
    return open.value.has(id);
}
function shownItems(check) {
    return check.items.slice(0, MAX_ITEMS);
}
function hiddenCount(check) {
    return Math.max(0, check.items.length - MAX_ITEMS);
}
function toggle(id) {
    const next = new Set(open.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    open.value = next;
}

watch(
    () => props.expandSignal,
    () => {
        open.value = new Set(props.category.checks.map((c) => c.id));
    },
);
watch(
    () => props.collapseSignal,
    () => {
        open.value = new Set();
    },
);
</script>

<template>
    <div class="mb-6">
        <div class="d-flex align-center ga-2 mb-2">
            <h2 class="text-h6">{{ category.name }}</h2>
            <v-chip v-if="category.problems" size="small" color="warning" variant="tonal">
                {{ category.problems }} zu prüfen
            </v-chip>
            <v-chip v-else size="small" color="success" variant="tonal"> alles OK </v-chip>
        </div>

        <div class="d-flex flex-column ga-2">
            <v-card v-for="check in category.checks" :key="check.id" variant="outlined">
                <div class="d-flex align-center ga-3 pa-3 check-header" @click="toggle(check.id)">
                    <v-icon :color="STATUS[check.status].color">
                        {{ STATUS[check.status].icon }}
                    </v-icon>
                    <div class="flex-grow-1">
                        <div class="font-weight-medium">{{ check.title }}</div>
                        <div class="text-caption text-medium-emphasis">{{ check.summary }}</div>
                    </div>
                    <v-chip
                        v-if="check.count"
                        size="small"
                        :color="STATUS[check.status].color"
                        variant="tonal"
                    >
                        {{ check.count }}
                    </v-chip>
                    <v-icon class="text-medium-emphasis">
                        {{ isOpen(check.id) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                    </v-icon>
                </div>

                <v-expand-transition>
                    <div v-if="isOpen(check.id)">
                        <v-divider />
                        <div class="pa-3">
                            <div class="text-body-2 text-medium-emphasis mb-3">
                                {{ check.description }}
                            </div>

                            <v-alert
                                v-if="check.status === 'ok'"
                                type="success"
                                variant="tonal"
                                density="compact"
                            >
                                {{ check.summary }}
                            </v-alert>

                            <v-list v-else density="compact" class="check-items">
                                <v-list-item
                                    v-for="(item, idx) in shownItems(check)"
                                    :key="item.id ?? idx"
                                    :class="{ 'cursor-pointer': item.id != null }"
                                    @click="$emit('open-song', item.id)"
                                >
                                    <template #prepend>
                                        <v-chip
                                            v-if="item.nummer"
                                            size="x-small"
                                            color="primary"
                                            variant="tonal"
                                            class="me-2"
                                        >
                                            {{ item.nummer }}
                                        </v-chip>
                                        <v-icon v-else size="small" class="me-2">
                                            mdi-pound
                                        </v-icon>
                                    </template>
                                    <v-list-item-title>{{ item.title }}</v-list-item-title>
                                    <v-list-item-subtitle v-if="item.detail">
                                        {{ item.detail }}
                                    </v-list-item-subtitle>
                                    <template v-if="item.id != null" #append>
                                        <v-icon size="small" class="text-medium-emphasis">
                                            mdi-open-in-app
                                        </v-icon>
                                    </template>
                                </v-list-item>
                                <v-list-item v-if="hiddenCount(check)">
                                    <v-list-item-subtitle>
                                        … und {{ hiddenCount(check) }} weitere
                                    </v-list-item-subtitle>
                                </v-list-item>
                            </v-list>
                        </div>
                    </div>
                </v-expand-transition>
            </v-card>
        </div>
    </div>
</template>

<style scoped>
.check-header {
    cursor: pointer;
    user-select: none;
}
.check-items {
    max-height: 420px;
    overflow-y: auto;
}
.cursor-pointer {
    cursor: pointer;
}
</style>
