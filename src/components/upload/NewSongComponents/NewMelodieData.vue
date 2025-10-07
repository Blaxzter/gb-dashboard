<template>
    <v-card class="mb-5" :elevation="$vuetify.display.xs ? 0 : 1">
        <v-card-title class="text-grey text-subtitle-1" :class="{ 'px-0': $vuetify.display.xs }">
            Melodie Daten
        </v-card-title>
        <v-card-text :class="{ 'px-0': $vuetify.display.xs }">
            <v-row class="my-0">
                <v-col cols="12" class="d-flex align-center py-0 flex-column flex-sm-row">
                    <span class="mr-4 mb-3 mb-sm-0">
                        Nach Melodie in Datenbank suchen oder neuen Anlegen:
                    </span>
                    <v-switch
                        v-model="existing_melodie"
                        class="ps-5"
                        color="primary"
                        density="compact"
                        hide-details
                        :label="
                            existing_melodie
                                ? 'Bestehenden Melodie verwenden'
                                : 'Neue Melodie anlegen'
                        "
                    ></v-switch>
                </v-col>
            </v-row>

            <v-row class="my-0">
                <v-col cols="12" class="my-0">
                    <v-autocomplete
                        v-model="selected_melodie"
                        :disabled="!existing_melodie"
                        label="Suche nach existierenden Melodien"
                        :items="sorted_store_melodie"
                        :custom-filter="custom_filter"
                        item-title="titel"
                        item-value="id"
                        hide-details="auto"
                        class="py-0"
                        return-object
                    >
                        <template #item="{ props, item }">
                            <v-list-item
                                v-bind="props"
                                :title="item?.raw?.titel"
                                :subtitle="item?.raw?.author_name"
                            ></v-list-item>
                        </template>
                    </v-autocomplete>
                </v-col>
            </v-row>

            <v-expansion-panels class="mb-5" :disabled="existing_melodie">
                <v-expansion-panel
                    title="Neue Melodie des Gesangbuchlieds"
                    :value="existing_melodie"
                >
                    <v-expansion-panel-text>
                        <MelodieData
                            :song-title="songTitle"
                            :in-noten="melodie.noten"
                            :in-quellelink="melodie.quelllink"
                            :in-title="melodie.title"
                            :in-quelle="melodie.quelle"
                            :in-anmerkung="melodie.anmerkung"
                            @update:noten="update_file"
                            @update:quellelink="melodie.quelllink = $event"
                            @update:title="melodie.title = $event"
                            @update:quelle="melodie.quelle = $event"
                            @update:anmerkung="melodie.anmerkung = $event"
                        />

                        <AuthorenFom
                            v-model:authors="melodie.authors"
                            :label="'Melodie Autoren'"
                            :selected-author="melodie.selected_authors"
                            class="mb-3"
                            :upload-page="uploadPage"
                            @update:selected_author="melodie.selected_authors = $event"
                            @update:use_same_author_for_text="
                                melodie.use_same_author_for_text = $event
                            "
                        />
                        <!--                <LizensComponent-->
                        <!--                  :label="'Melodie Lizensen'"-->
                        <!--                  :lizenz="melodie.lizenz"-->
                        <!--                  :use_lizenz="melodie.use_lizenz"-->
                        <!--                />-->
                    </v-expansion-panel-text>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-card-text>
    </v-card>
</template>

<script>
import MelodieData from '@/components/upload/NewSongComponents/MelodieData.vue';
import AuthorenFom from '@/components/upload/NewSongComponents/AuthorenFom.vue';
import _ from 'lodash';
import { useAppStore } from '@/store/app';
import moment from 'moment';
import axios from '@/assets/js/axiossConfig';

export default {
    name: 'NewMelodieData',
    components: { AuthorenFom, MelodieData },
    props: {
        songTitle: {
            type: String,
            required: false,
            default: '',
        },
        inMelodie: {
            type: Object,
            required: true,
        },
        uploadPage: Boolean,
    },
    emits: ['update:melodie', 'update:existing_melodie', 'update:selected_melodie'],
    data: () => ({
        store: useAppStore(),
        existing_melodie: false,
        selected_melodie: null,
        melodie: {},
        successfully_created: {
            melodie: null,
            authors: [],
            melodie_author_mapping: [],
            melodie_files: [],
            created_files: [],
        },
        to_be_created_melodie_authors: [],
    }),
    computed: {
        store_melodie() {
            return this.store.melodies;
        },
        sorted_store_melodie() {
            return _.sortBy(this.store_melodie, 'titel');
        },
    },
    watch: {
        melodie: {
            handler() {
                this.$emit('update:melodie', this.melodie);
            },
            deep: true,
        },
        existing_melodie() {
            this.$emit('update:existing_melodie', this.existing_melodie);
        },
        selected_melodie() {
            this.$emit('update:selected_melodie', this.selected_melodie);
        },
    },
    mounted() {
        this.melodie = this.inMelodie;
        this.$emit('update:melodie', this.melodie);
    },
    methods: {
        custom_filter(item, queryText, itemText) {
            return itemText.raw.autocomplete.toLowerCase().includes(queryText.toLowerCase());
        },
        update_file(event) {
            this.melodie.noten = event;
        },
        validate() {
            // VALIDATE MELODIE AUTHORS
            console.log('VALIDATE MELODIE AUTHORS');
            this.to_be_created_melodie_authors = [];
            if (!this.existing_melodie) {
                for (let author of this.melodie.authors) {
                    if (!this.validate_author(author)) {
                        alert('Ein Melodie Autor hat keinen Nachnamen.');
                        return;
                    }
                    let to_be_created_melodie_author = {
                        vorname: author.firstName === '' ? null : author.firstName,
                        nachname: author.lastName === '' ? null : author.lastName,
                        geburtsjahr: author.birthdate
                            ? Number(moment(author.birthdate).format('YYYY'))
                            : null,
                        sterbejahr: author.deathdate
                            ? Number(moment(author.deathdate).format('YYYY'))
                            : null,
                    };
                    if (!_.every(to_be_created_melodie_author, (val) => val === null)) {
                        to_be_created_melodie_author['status'] = 'uploaded';
                        this.to_be_created_melodie_authors.push(to_be_created_melodie_author);
                    }
                }
            }
        },
        async upload() {
            // CREATE MELODIE
            console.log('CREATE MELODIE');
            let created_melodie = null;
            if (!this.existing_melodie) {
                let create_melodie = {
                    titel: _.isEmpty(this.melodie.title) ? null : this.melodie.title,
                    quelle: _.isEmpty(this.melodie.quelle) ? null : this.melodie.quelle,
                    quelllink: _.isEmpty(this.melodie.quelllink) ? null : this.melodie.quelllink,
                    anmerkung: _.isEmpty(this.melodie.anmerkung) ? null : this.melodie.anmerkung,
                };

                if (!_.every(create_melodie, (val) => val === null)) {
                    create_melodie['status'] = 'uploaded';
                    console.log('create_melodie', create_melodie);

                    await axios
                        .post(`${import.meta.env.VITE_BACKEND_URL}/items/melodie`, create_melodie)
                        .then((resp) => {
                            console.log('created created_melodie', resp.data.data);
                            created_melodie = resp.data.data;
                            this.successfully_created.melodie = resp.data.data;
                        });

                    // CREATE NEW MELODIE AUTHORS
                    console.log('CREATE NEW MELODIE AUTHORS');
                    let created_melodie_authors = [];
                    if (!this.existing_melodie && this.to_be_created_melodie_authors.length !== 0) {
                        console.log('created_melodie_author', this.to_be_created_melodie_authors);
                        await axios
                            .post(
                                `${import.meta.env.VITE_BACKEND_URL}/items/autor`,
                                this.to_be_created_melodie_authors,
                            )
                            .then((resp) => {
                                console.log('created melodie authors', resp.data.data);
                                created_melodie_authors = resp.data.data;
                                this.successfully_created.authors.push(...resp.data.data);
                            });
                    }

                    // MELODIE AUTHOR N TO M MAPPING
                    created_melodie_authors.push(...this.melodie.selected_authors);

                    let to_be_created_melodie_author_mapping = [];
                    for (let created_author of created_melodie_authors) {
                        let create_author_melodie = {
                            melodie_id: created_melodie.id,
                            autor_id: created_author.id,
                        };
                        if (!_.every(create_author_melodie, (val) => val === null))
                            to_be_created_melodie_author_mapping.push(create_author_melodie);
                    }
                    if (to_be_created_melodie_author_mapping.length !== 0) {
                        console.log(
                            'to_be_created_melodie_author_mapping',
                            to_be_created_melodie_author_mapping,
                        );
                        await axios
                            .post(
                                `${import.meta.env.VITE_BACKEND_URL}/items/melodie_autor`,
                                to_be_created_melodie_author_mapping,
                            )
                            .then((resp) => {
                                console.log('created melodie_author_mapping', resp.data.data);
                                this.successfully_created.melodie_author_mapping.push(
                                    ...resp.data.data,
                                );
                            });
                    }

                    // MELODIE TO FILE MELODIE MAPPING
                    const created_files = await this.upload_file();
                    let to_be_created_melodie_file_mapping = [];
                    for (let created_file of created_files) {
                        let create_file_melodie = {
                            melodie_id: created_melodie.id,
                            directus_files_id: created_file.id,
                        };
                        to_be_created_melodie_file_mapping.push(create_file_melodie);
                    }

                    if (to_be_created_melodie_file_mapping.length !== 0) {
                        console.log(
                            'to_be_created_melodie_file_mapping',
                            to_be_created_melodie_file_mapping,
                        );
                        await axios
                            .post(
                                `${import.meta.env.VITE_BACKEND_URL}/items/melodie_files`,
                                to_be_created_melodie_file_mapping,
                            )
                            .then((resp) => {
                                console.log('created melodie_files', resp.data.data);
                                this.successfully_created.melodie_files = resp.data.data;
                            });
                    }
                }
            }
            return this.existing_melodie
                ? this.selected_melodie?.id
                : created_melodie
                  ? created_melodie.id
                  : null;
        },
        validate_author(author) {
            if (
                !_.isEmpty(author.firstName) ||
                !_.isEmpty(author.birthdate) ||
                !_.isEmpty(author.deathdate)
            )
                if (_.isEmpty(author.firstName)) return false;
            return true;
        },
        async upload_file() {
            if (this.melodie.noten) {
                for (let file of this.melodie.noten) {
                    console.log('Upload file ', file);
                    const formData = new FormData();
                    formData.append('title', file.name);
                    formData.append('file', file);

                    await axios
                        .post(`${import.meta.env.VITE_BACKEND_URL}/files`, formData)
                        .then((resp) =>
                            this.successfully_created.created_files.push(resp.data.data),
                        );
                }
            }
            return this.successfully_created.created_files;
        },
    },
};
</script>

<style scoped></style>
