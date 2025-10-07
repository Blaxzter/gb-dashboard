<template>
    <v-card :loading="loading" title="Gesangbuchlied wird Hochgelanden">
        <v-card-text>
            <div class="text-h6 mb-5">Hochgeladene Elemente:</div>

            <v-card v-if="gesangbuchlied" title="Gesangbuchlied" class="mb-4">
                <v-card-text>
                    <div>
                        <strong>ID: </strong>{{ gesangbuchlied.id }} <strong>Titel: </strong
                        >{{ gesangbuchlied.titel }}
                    </div>

                    <div class="d-flex flex-row">
                        <v-card
                            v-for="(elem, index) of categoryGesangbuchliedMapping"
                            :key="index"
                            width="200"
                            class="me-5"
                            :title="'Kategorie ' + (index + 1)"
                        >
                            <v-card-text>
                                <div>
                                    <div><strong>Kategorie </strong>{{ index + 1 }}:</div>
                                    <div>
                                        <strong>Gesangbuchlied: </strong>
                                        {{ elem.gesangbuchlied_id }}
                                    </div>
                                    <div><strong>Kategorie: </strong> {{ elem.kategorie_id }}</div>
                                </div>
                            </v-card-text>
                        </v-card>
                    </div>
                </v-card-text>
            </v-card>

            <v-card v-if="authors.length" title="Autoren" class="mb-5">
                <v-card-text>
                    <div class="d-flex flex-row flex-wrap">
                        <v-card
                            v-for="(elem, index) of authors"
                            :key="index"
                            width="200"
                            class="me-5 mb-5"
                            :title="'Autor ' + (index + 1)"
                        >
                            <v-card-text>
                                <div>
                                    <div><strong>ID: </strong>{{ elem.id }}</div>
                                    <div><strong>Vorname: </strong>{{ elem.vorname }}</div>
                                    <div><strong>Nachname: </strong>{{ elem.nachname }}</div>
                                </div>
                            </v-card-text>
                        </v-card>
                    </div>
                </v-card-text>
            </v-card>

            <v-card v-if="text" title="Text" class="mb-5">
                <v-card-text class="mb-0">
                    <div>
                        <div>
                            <strong>ID: </strong>{{ text.id }} <strong>Text Titel: </strong
                            >{{ text.titel }}
                        </div>

                        <div class="d-flex flex-row flex-wrap">
                            <v-card
                                v-for="(elem, index) of textAuthorMapping"
                                :key="index"
                                width="200"
                                class="me-5 mb-5"
                                :title="'Text Author ' + (index + 1)"
                            >
                                <v-card-text>
                                    Test
                                    <div>
                                        <div><strong>Text ID: </strong>{{ elem.text_id }},</div>
                                        <div><strong>Autor ID: </strong>{{ elem.autor_id }}</div>
                                    </div>
                                </v-card-text>
                            </v-card>
                        </div>
                    </div>
                </v-card-text>
            </v-card>

            <v-card v-if="melodie" title="Melodie">
                <v-card-text>
                    <div class="mb-5">
                        <strong>ID: </strong>{{ melodie.id }} <strong>Titel: </strong
                        >{{ melodie.titel }}
                    </div>

                    <div class="text-h6">Melodie Autoren</div>
                    <div class="d-flex flex-row flex-wrap">
                        <v-card
                            v-for="(elem, index) of melodieAuthorMapping"
                            :key="index"
                            width="200"
                            :title="'Melodie Autor ' + (index + 1)"
                            class="me-5 mb-5"
                        >
                            <v-card-text>
                                <div>
                                    <div><strong>Melodie</strong> Autor {{ index + 1 }}:</div>
                                    <div><strong>Melodie</strong> {{ elem.melodie_id }},</div>
                                    <div><strong>Autor</strong> {{ elem.autor_id }}</div>
                                </div>
                            </v-card-text>
                        </v-card>
                    </div>

                    <div class="text-h6">Melodie Datein</div>
                    <div class="d-flex flex-row">
                        <v-card
                            v-for="(elem, index) of melodieFiles"
                            :key="index"
                            width="200"
                            :title="'Melodie File ' + (index + 1)"
                            class="me-5 mb-5"
                        >
                            <v-card-text>
                                <div>
                                    <div>
                                        <strong>Id:</strong>
                                        {{ elem.melodie_id }}
                                    </div>

                                    <div>
                                        <strong>File ID</strong>
                                        {{ elem.directus_files_id }}
                                    </div>
                                </div>
                            </v-card-text>
                        </v-card>
                    </div>
                </v-card-text>
            </v-card>
        </v-card-text>
        <v-card-actions>
            <v-btn block color="primary" variant="tonal" @click="$emit('reset')"
                >Neues Lied anlegen</v-btn
            >
        </v-card-actions>
    </v-card>
</template>

<script>
export default {
    name: 'UploadProgress',
    props: {
        loading: {
            type: Boolean,
            default: false,
        },
        gesangbuchlied: {
            type: Object,
            default: null,
        },
        text: {
            type: Object,
            default: null,
        },
        melodie: {
            type: Object,
            default: null,
        },
        categoryGesangbuchliedMapping: {
            type: Array,
            default: () => [],
        },
        authors: {
            type: Array,
            default: () => [],
        },
        textAuthorMapping: {
            type: Array,
            default: () => [],
        },
        melodieAuthorMapping: {
            type: Array,
            default: () => [],
        },
        melodieFiles: {
            type: Array,
            default: () => [],
        },
        createdFiles: {
            type: Array,
            default: () => [],
        },
    },
    emits: ['reset'],
};
</script>

<style scoped></style>
