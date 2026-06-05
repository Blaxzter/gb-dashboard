<script setup>
// Kleiner An/Aus/Egal-Umschalter für einen einzelnen Filter.
// `modelValue` ist immer einer von 'an' | 'aus' | 'egal' ('egal' = inaktiv).
defineProps({
    modelValue: { type: String, default: 'egal' },
    label: { type: String, required: true },
    icon: { type: String, default: null },
    onLabel: { type: String, default: 'An' },
    offLabel: { type: String, default: 'Aus' },
});

defineEmits(['update:modelValue']);
</script>

<template>
    <div class="d-flex align-center justify-space-between ga-3 py-1">
        <div class="d-flex align-center ga-2 text-body-2" style="min-width: 0">
            <v-icon v-if="icon" :icon="icon" size="small" color="medium-emphasis" />
            <span class="text-truncate">{{ label }}</span>
        </div>
        <v-btn-toggle
            :model-value="modelValue"
            mandatory
            density="comfortable"
            variant="outlined"
            divided
            class="flex-shrink-0"
            @update:model-value="$emit('update:modelValue', $event)"
        >
            <v-btn value="an" size="small" :color="modelValue === 'an' ? 'success' : undefined">
                {{ onLabel }}
            </v-btn>
            <v-btn value="aus" size="small" :color="modelValue === 'aus' ? 'error' : undefined">
                {{ offLabel }}
            </v-btn>
            <v-btn value="egal" size="small">Egal</v-btn>
        </v-btn-toggle>
    </div>
</template>
