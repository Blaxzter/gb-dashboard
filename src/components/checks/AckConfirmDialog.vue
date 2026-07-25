<script setup>
// Rückfrage vor dem Bestätigen („kein Fehler") eines Druck-Check-Befunds.
//
// Ein bestätigter Befund verschwindet aus der Liste und zählt nicht mehr als
// offenes Problem – auch bei der nächsten Druck-PDF. Genau deshalb wurden
// Befunde reihenweise weggeklickt, statt sie zu prüfen. Die Rückfrage macht den
// Schritt bewusst: Es geht nicht um „gesehen", sondern um „ist wirklich richtig
// so, nur das Prüftool erfasst es nicht korrekt".
const props = defineProps({
    modelValue: { type: Boolean, default: false },
    // Was wird bestätigt (Check-Titel / Lied) – zur Kontrolle im Dialog.
    label: { type: String, default: '' },
    detail: { type: String, default: '' },
    // >1 bei „alle Befunde eines Liedes bestätigen".
    count: { type: Number, default: 1 },
});
const emit = defineEmits(['update:modelValue', 'confirm']);

function close() {
    emit('update:modelValue', false);
}
function confirm() {
    emit('confirm');
    close();
}
</script>

<template>
    <v-dialog
        :model-value="props.modelValue"
        width="520"
        @update:model-value="emit('update:modelValue', $event)"
    >
        <v-card>
            <v-card-title class="d-flex align-center ga-2">
                <v-icon color="warning">mdi-help-circle-outline</v-icon>
                <span v-if="props.count > 1">
                    {{ props.count }} Befunde als „kein Fehler“ bestätigen?
                </span>
                <span v-else>Befund als „kein Fehler“ bestätigen?</span>
            </v-card-title>
            <v-card-text>
                <p class="text-body-1 mb-4">
                    Bist du dir wirklich sicher, dass das hier kein Fehler ist, sondern so stimmt
                    und das Überprüfungstool das nur nicht richtig erfasst hat?
                </p>

                <v-alert v-if="props.label" variant="tonal" density="compact" class="mb-4">
                    <div class="font-weight-medium">{{ props.label }}</div>
                    <div v-if="props.detail" class="text-caption text-medium-emphasis">
                        {{ props.detail }}
                    </div>
                </v-alert>

                <p class="text-caption text-medium-emphasis">
                    <template v-if="props.count > 1">
                        Alle {{ props.count }} Befunde werden ausgeblendet und zählen
                    </template>
                    <template v-else>Der Befund wird ausgeblendet und zählt</template>
                    nicht mehr als offenes Problem – auch bei der nächsten Druck-PDF, solange sich
                    nichts daran ändert. Im Zweifel lieber offen lassen und gegenlesen; zum
                    Abarbeiten der Liste ist die Bestätigung nicht gedacht.
                </p>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="close">Abbrechen</v-btn>
                <v-btn color="warning" variant="flat" @click="confirm"> Ja, ist kein Fehler </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
