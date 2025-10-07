<template>
    <div>
        <v-row>
            <v-col cols="12" class="pb-0">
                <div class="d-flex align-center">
                    <div class="h-100">
                        <v-tooltip text="Den Gesangbuchlied-Titel kopieren" location="bottom">
                            <template #activator="{ props }">
                                <v-btn
                                    icon="mdi-content-copy"
                                    size="tiny"
                                    variant="plain"
                                    class="me-5"
                                    v-bind="props"
                                    color="primary"
                                    @click="copy_song_title"
                                />
                            </template>
                        </v-tooltip>
                    </div>
                    <v-text-field
                        v-model="title"
                        label="Melodie Titel"
                        hide-details="auto"
                        class="mb-3"
                        @change="$emit('update:title', $event.target.value)"
                    ></v-text-field>
                    <div v-if="title_already_exists">
                        <v-tooltip text="Titel existiert bereits" location="bottom">
                            <template #activator="{ props }">
                                <v-icon
                                    icon="mdi-alert"
                                    v-bind="props"
                                    class="px-5"
                                    color="warning"
                                />
                            </template>
                        </v-tooltip>
                    </div>
                </div>
            </v-col>
        </v-row>

        <v-row>
            <v-col cols="12" class="pb-0">
                <v-file-input
                    v-model="noten"
                    show-size
                    label="Noten Datein"
                    multiple
                    counter
                    chips
                    @change="$emit('update:noten', noten)"
                >
                </v-file-input>
            </v-col>
        </v-row>

        <v-row>
            <v-col cols="12" md="6" class="py-0">
                <v-text-field
                    v-model="quelle"
                    label="Quelle"
                    hide-details="auto"
                    class="mb-3"
                    @change="$emit('update:quelle', $event.target.value)"
                ></v-text-field>
            </v-col>
            <v-col cols="12" md="6" class="py-0">
                <v-text-field
                    v-model="quellelink"
                    label="Melodie Quelle Link"
                    hide-details="auto"
                    class="mb-3"
                    @change="$emit('update:quellelink', $event.target.value)"
                ></v-text-field>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" class="pt-0">
                <v-textarea
                    v-model="anmerkung"
                    label="Melodie Anmerkung"
                    hide-details="auto"
                    class="mb-3"
                    @change="$emit('update:anmerkung', $event.target.value)"
                ></v-textarea>
            </v-col>
        </v-row>
    </div>
</template>

<script>
import _ from 'lodash';
import { useAppStore } from '@/store/app';

export default {
    name: 'MelodieData',
    props: {
        songTitle: {
            type: String,
            required: false,
            default: '',
        },
        inNoten: {
            type: Array,
            required: false,
            default: () => [],
        },
        inQuellelink: {
            type: String,
            required: false,
            default: '',
        },
        inTitle: {
            type: String,
            required: false,
            default: '',
        },
        inQuelle: {
            type: String,
            required: false,
            default: '',
        },
        inAnmerkung: {
            type: String,
            required: false,
            default: '',
        },
    },
    emits: [
        'update:title',
        'update:noten',
        'update:quelle',
        'update:quellelink',
        'update:anmerkung',
    ],
    data: () => ({
        store: useAppStore(),
        noten: [],
        title: '',
        quelle: '',
        quellelink: '',
        anmerkung: '',
    }),
    computed: {
        store_melodies() {
            return this.store.melodies;
        },
        existing_melodies_title() {
            return _.map(this.store_melodies, 'titel');
        },
        title_already_exists() {
            return this.existing_melodies_title.includes(this.title);
        },
    },
    mounted() {
        this.noten = this.inNoten;
        this.quellelink = this.inQuellelink;
        this.title = this.inTitle;
        this.quelle = this.inQuelle;
        this.anmerkung = this.inAnmerkung;
    },
    methods: {
        copy_song_title() {
            this.$emit('update:title', this.songTitle);
            this.title = this.songTitle;
        },
    },
};
</script>

<style scoped></style>
