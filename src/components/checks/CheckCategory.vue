<script setup>
import { ref, watch } from 'vue';
import { STATUS } from '@/assets/js/gesangbuchChecks.js';
import { useDruckCheckAcks } from '@/assets/js/druckCheckAcks.js';

const props = defineProps({
    // { name, checks: [...], problems: Number }
    category: { type: Object, required: true },
    // Zähler-Signale: erhöht der Parent, klappen alle Gruppen auf/zu.
    expandSignal: { type: Number, default: 0 },
    collapseSignal: { type: Number, default: 0 },
    // Nur im Druck-Check: „Bestätigen"-Buttons (localStorage) an den Items.
    allowAck: { type: Boolean, default: false },
});

defineEmits(['open-song']);

const acks = useDruckCheckAcks();

// Pro Check maximal so viele Treffer rendern (Performance bei großen Listen).
const MAX_ITEMS = 200;

// Aufgeklappte „Bestätigt"-Bereiche (je Check).
const ackedOpen = ref(new Set());
function isAckedOpen(id) {
    return ackedOpen.value.has(id);
}
function toggleAcked(id) {
    const next = new Set(ackedOpen.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    ackedOpen.value = next;
}
function toggleItemAck(item) {
    acks.toggle(item.fp);
}

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
                                <template
                                    v-for="(item, idx) in shownItems(check)"
                                    :key="item.id != null ? `it-${item.id}-${idx}` : `it-${idx}`"
                                >
                                    <!-- Gruppenkopf (z. B. Copyright-Check): trennt zusammen-
                                         gehörige Einträge sichtbar voneinander. -->
                                    <v-divider v-if="item.groupHeader && idx > 0" class="mt-2 mb-1" />
                                    <v-list-subheader
                                        v-if="item.groupHeader"
                                        class="check-group-header"
                                    >
                                        {{ item.groupHeader }}
                                    </v-list-subheader>
                                    <v-list-item
                                        :class="{
                                            'cursor-pointer': item.id != null,
                                            'check-group-item': item.group != null,
                                        }"
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
                                        <template #append>
                                            <v-btn
                                                v-if="allowAck && item.fp"
                                                icon="mdi-check-circle-outline"
                                                size="x-small"
                                                variant="text"
                                                title="Als geprüft / gewollt bestätigen und ausblenden"
                                                @click.stop="toggleItemAck(item)"
                                            />
                                            <v-icon
                                                v-if="item.id != null"
                                                size="small"
                                                class="text-medium-emphasis ms-1"
                                            >
                                                mdi-open-in-app
                                            </v-icon>
                                        </template>
                                    </v-list-item>
                                </template>
                                <v-list-item v-if="hiddenCount(check)">
                                    <v-list-item-subtitle>
                                        … und {{ hiddenCount(check) }} weitere
                                    </v-list-item-subtitle>
                                </v-list-item>
                            </v-list>

                            <!-- Bestätigte (ausgeblendete) Befunde dieses Checks -->
                            <div
                                v-if="allowAck && check.ackedItems && check.ackedItems.length"
                                class="acked-block"
                            >
                                <div class="acked-toggle" @click="toggleAcked(check.id)">
                                    <v-icon size="small">
                                        {{ isAckedOpen(check.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                                    </v-icon>
                                    <v-icon size="small" color="success">mdi-check-circle</v-icon>
                                    Bestätigt / ausgeblendet ({{ check.ackedItems.length }})
                                </div>
                                <v-list v-if="isAckedOpen(check.id)" density="compact" class="check-items">
                                    <v-list-item
                                        v-for="(item, idx) in check.ackedItems"
                                        :key="'ack-' + (item.fp ?? idx)"
                                        class="acked-item"
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
                                            <v-icon v-else size="small" class="me-2">mdi-pound</v-icon>
                                        </template>
                                        <v-list-item-title>{{ item.title }}</v-list-item-title>
                                        <v-list-item-subtitle v-if="item.detail">
                                            {{ item.detail }}
                                        </v-list-item-subtitle>
                                        <template #append>
                                            <v-btn
                                                icon="mdi-restore"
                                                size="x-small"
                                                variant="text"
                                                title="Bestätigung zurücknehmen"
                                                @click.stop="toggleItemAck(item)"
                                            />
                                        </template>
                                    </v-list-item>
                                </v-list>
                            </div>
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
/* Gruppierte Befunde (z. B. Copyright-Schreibweisen): Kopfzeile je Gruppe und
   ein farbiger Randstrich, der die Einträge einer Gruppe optisch zusammenfasst. */
.check-group-header {
    min-height: 30px;
    padding-inline: 8px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.85);
}
.check-group-item {
    border-left: 3px solid rgba(var(--v-theme-primary), 0.35);
}
.cursor-pointer {
    cursor: pointer;
}
.acked-block {
    margin-top: 8px;
    border-top: 1px solid rgba(var(--v-border-color), 0.3);
}
.acked-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 4px 4px;
    cursor: pointer;
    user-select: none;
    font-size: 0.8rem;
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.acked-toggle:hover {
    color: rgba(var(--v-theme-on-surface), 0.95);
}
.acked-item {
    opacity: 0.7;
}
</style>
