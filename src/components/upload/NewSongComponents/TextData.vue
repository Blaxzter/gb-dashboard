<template>
    <div>
        <div class="d-flex align-center mb-3">
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

            <v-text-field
                v-model="title"
                label="Text Titel"
                hide-details="auto"
                @change="$emit('update:title', $event.target.value)"
            ></v-text-field>
            <div v-if="title_already_exists">
                <v-tooltip text="Titel existiert bereits" location="bottom">
                    <template #activator="{ props }">
                        <v-icon icon="mdi-alert" v-bind="props" class="px-5" color="warning" />
                    </template>
                </v-tooltip>
            </div>
        </div>
        <div class="d-flex flex-column flex-md-row">
            <v-text-field
                :model-value="quelle"
                label="Quelle"
                hide-details="auto"
                class="mb-3 me-md-5"
                @change="$emit('update:quelle', $event.target.value)"
            ></v-text-field>
            <v-text-field
                :model-value="quellelink"
                label="Quelle Link"
                hide-details="auto"
                class="mb-3"
                @change="$emit('update:quellelink', $event.target.value)"
            ></v-text-field>
        </div>
        <v-textarea
            :model-value="anmerkung"
            label="Text Anmerkung"
            hide-details="auto"
            class="mb-3"
            rows="2"
            @change="$emit('update:anmerkung', $event.target.value)"
        ></v-textarea>
    </div>
</template>

<script>
import _ from 'lodash';
import { useAppStore } from '@/store/app';

export default {
    name: 'TextData',
    props: {
        songTitle: { type: String, required: true },
        inTitle: { type: String, required: true },
        inQuelle: { type: String, required: true },
        inQuellelink: { type: String, required: true },
        inAnmerkung: { type: String, required: true },
    },
    emits: ['update:title', 'update:quelle', 'update:quellelink', 'update:anmerkung'],
    data: () => ({
        store: useAppStore(),
        title: '',
        quelle: '',
        quellelink: '',
        anmerkung: '',
    }),
    computed: {
        store_text() {
            return this.store.texts;
        },
        existing_text_title() {
            return _.map(this.store_text, 'titel');
        },
        title_already_exists() {
            console.log(this.title);
            return this.existing_text_title.includes(this.title);
        },
    },
    mounted() {
        this.title = this.inTitle;
        this.quelle = this.inQuelle;
        this.quellelink = this.inQuellelink;
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
