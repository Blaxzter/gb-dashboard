<script setup>
import { computed } from 'vue';

// Änderungsvermerk eines Lied-Bestandteils (Text bzw. Melodie) als Icon
// (Issues #105, #106). Drei Zustände:
//   'neu'       – stand so nicht im Gesangbuch 2000
//   'geaendert' – stand 2000 schon im Buch, wurde aber überarbeitet
//   ''          – unverändert übernommen (nur ein Strich, kein Tooltip)
// Die Werte kommen aus textVermerk()/melodieVermerk() in neueLiederStatistik.js.
const props = defineProps({
    vermerk: { type: String, default: '' },
    // „Text" / „Melodie" – nur für den Tooltip-Text.
    bereich: { type: String, required: true },
});

const config = computed(() => {
    if (props.vermerk === 'neu') {
        return {
            icon: 'mdi-plus-box',
            color: 'success',
            text: `${props.bereich} neu – stand nicht im Gesangbuch 2000`,
        };
    }
    if (props.vermerk === 'geaendert') {
        return {
            icon: 'mdi-pencil-box',
            color: 'primary',
            text: `${props.bereich} gegenüber dem Gesangbuch 2000 überarbeitet`,
        };
    }
    return null;
});
</script>

<template>
    <v-tooltip v-if="config" :text="config.text" location="bottom">
        <template #activator="{ props: tooltipProps }">
            <v-icon v-bind="tooltipProps" :icon="config.icon" :color="config.color" size="small" />
        </template>
    </v-tooltip>
    <span v-else class="text-disabled">–</span>
</template>
