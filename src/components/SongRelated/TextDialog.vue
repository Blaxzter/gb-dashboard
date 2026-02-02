<template>
    <v-card class="pa-3">
        <v-card-title>
            <v-card-title>
                <div class="d-flex justify-space-between align-center">
                    <div>
                        {{ text.titel }}
                    </div>
                    <div>
                        {{ status_mapping[text.status] }}
                    </div>
                </div>
                <v-tooltip
                    v-if="text.korrekturlesung1"
                    text="Korrekturlesung abgeschlossen"
                    location="bottom"
                >
                    <template #activator="{ props }">
                        <v-chip
                            v-bind="props"
                            color="success"
                            prepend-icon="mdi-check-circle"
                            size="small"
                        >
                            Korrekturlesung 1
                        </v-chip>
                    </template>
                </v-tooltip>
            </v-card-title>
        </v-card-title>

        <v-card-text class="px-8">
            <div class="mb-4">
                <StrophenList :text="text" :show-extra-strophen-data="true" />
            </div>

            <div>
                <v-card v-for="(auftrag, index) in text.auftrag" :key="index" :text-dialog="true" />
            </div>

            <div v-if="text?.auftrag?.length" class="text-subtitle-1 font-weight-medium">
                Aufträge:
            </div>
            <div v-if="text?.auftrag?.length">
                <div v-for="(auftrag, index) in text?.auftrag" :key="index" class="mb-3">
                    <v-card>
                        <v-card-subtitle class="d-flex align-center pt-2">
                            <!-- icon that shows if a auftrag is done -->
                            <div class="text-body-1 me-3">Auftrag {{ index + 1 }}</div>

                            <v-spacer />
                            <v-tooltip
                                v-if="auftrag.status === 'done'"
                                :text="`Auftrag ist erledigt.`"
                                location="bottom"
                            >
                                <template #activator="{ props }">
                                    <v-icon
                                        v-bind="props"
                                        icon="mdi-check"
                                        size="large"
                                        color="success"
                                    />
                                </template>
                            </v-tooltip>
                            <v-tooltip
                                v-else
                                :text="`Auftrag ist noch nicht erledigt.`"
                                location="bottom"
                            >
                                <template #activator="{ props }">
                                    <v-icon
                                        v-bind="props"
                                        icon="mdi-progress-clock"
                                        size="large"
                                        color="warning"
                                    />
                                </template>
                            </v-tooltip>
                        </v-card-subtitle>
                        <v-card-text>
                            <div class="text-subtitle-1 font-weight-medium">Auftragsart:</div>
                            <div>
                                {{ auftrag_type_to_name[auftrag.auftragsartText] }}
                            </div>
                            <div class="text-subtitle-1 font-weight-medium">Anmerkung:</div>
                            <div class="white-space-pre">
                                {{ auftrag.anmerkung }}
                            </div>
                        </v-card-text>
                    </v-card>
                </div>
            </div>

            <div v-if="text?.anmerkung" class="mb-2">
                <div class="text-subtitle-1 font-weight-medium">Anmerkung:</div>
                <div class="white-space-pre">
                    {{ text?.anmerkung }}
                </div>
            </div>

            <div v-if="text?.rueckfrageAutor" class="mb-2">
                <div class="text-subtitle-1 font-weight-medium">Rückfrage Autor:</div>
                <div>
                    {{ text?.rueckfrageAutor }}
                </div>
            </div>

            <div v-if="text?.quelle" class="mb-2">
                <div class="text-subtitle-1 font-weight-medium">Quelle:</div>
                <div>
                    {{ text?.quelle }}
                </div>
            </div>

            <div v-if="text?.quelllink" class="mb-2">
                <div class="text-subtitle-1 font-weight-medium">Quelle Link:</div>
                <div class="d-flex flex-row align-center">
                    <v-icon icon="mdi-open-in-new" size="tiny" class="me-2" color="blue-darken-3" />
                    <a :href="text?.quelllink" target="_blank">
                        {{ text?.quelllink }}
                    </a>
                </div>
            </div>

            <div v-if="text?.authors?.length" class="text-subtitle-1 font-weight-medium">
                Text Autoren
            </div>
            <div v-for="(author, index) in text?.authors" :key="index" class="d-flex flex-row mb-4">
                <div class="me-2">{{ index + 1 }}.</div>
                <div>
                    {{ author.vorname }} {{ author.nachname }}
                    {{
                        author.geburtsjahr || author.sterbejahr
                            ? ` (${author.geburtsjahr ? '*' + author.geburtsjahr : ''} ${author.sterbejahr ? ' - ' + author.sterbejahr : ''})`
                            : ''
                    }}
                </div>
            </div>
        </v-card-text>
        <v-card-actions>
            <v-btn color="error" @click="$emit('close')">Schließen</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import { auftrag_type_to_name, status_mapping } from '../../assets/js/utils';
import StrophenList from '@/components/SongRelated/StrophenList.vue';

export default {
    name: 'TextDialog',
    components: { StrophenList },
    props: {
        text: {
            type: Object,
            required: true,
        },
    },
    emits: ['close'],
    computed: {
        auftrag_type_to_name() {
            return auftrag_type_to_name;
        },
        status_mapping() {
            return status_mapping;
        },
    },
};
</script>

<style scoped></style>
