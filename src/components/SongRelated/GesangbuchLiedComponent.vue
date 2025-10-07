<template>
    <v-card class="pa-3">
        <v-card-title
            class="d-flex justify-space-between pb-0 align-center flex-column flex-md-row"
        >
            <v-tooltip
                :text="
                    copied
                        ? 'In die zwischenablage kopiert'
                        : 'Kopiere den Pfad in die Zwischenablage.'
                "
                location="bottom"
            >
                <template #activator="{ props }">
                    <div
                        class="card-header"
                        v-bind="props"
                        :style="copied ? 'color: #1867c0' : 'color: black'"
                        @click="copyPathInClipboard"
                    >
                        <!--  Clipboard icon        -->
                        <v-icon class="me-2"> mdi-content-copy </v-icon>

                        {{ selectedSong?.gesangbuch_titel }}
                    </div>
                </template>
            </v-tooltip>

            <div>
                <v-tooltip
                    v-if="selectedSong?.text"
                    :text="`Mehr Text Informationen.${selectedSong?.text.auftrag ? ' Es existiert ein Arbeitsauftrag' : ''}`"
                    location="bottom"
                >
                    <template #activator="{ props }">
                        <v-btn
                            icon="mdi-text-box"
                            v-bind="props"
                            variant="text"
                            :color="
                                selectedSong.text.auftrag
                                    ? text_has_done_auftraege
                                        ? 'success'
                                        : 'warning'
                                    : 'primary'
                            "
                            @click="text_dialog = true"
                        />
                    </template>
                </v-tooltip>
                <v-tooltip
                    v-if="selectedSong?.melodie"
                    :text="`Mehr Melodie Informationen.${selectedSong?.melodie.auftrag ? ' Es existiert ein Arbeitsauftrag' : ''}`"
                    location="bottom"
                >
                    <template #activator="{ props }">
                        <v-btn
                            icon="mdi-music"
                            v-bind="props"
                            variant="text"
                            :color="
                                selectedSong.melodie.auftrag
                                    ? melodie_has_done_auftraege
                                        ? 'success'
                                        : 'warning'
                                    : 'primary'
                            "
                            @click="melodie_dialog = true"
                        />
                    </template>
                </v-tooltip>
                <SingModeDialog :selected-song="selectedSong" :selected-media-file="visible_file" />
            </div>
        </v-card-title>
        <v-card-title> </v-card-title>

        <v-card-text class="pt-0 px-8">
            <NotenCarousel
                :melodie="selectedSong?.melodie"
                :gesangbuchlied-satz-mit-melodie-und-text="
                    selectedSong?.gesangbuchlied_satz_mit_melodie_und_text
                "
                @visible_file="visible_file = $event"
            />

            <div class="mb-4">
                <StrophenList :text="selectedSong?.text" :show-extra-strophen-data="false" />
            </div>

            <v-chip-group>
                <v-chip
                    v-for="(category, index) in selectedSong?.kategories"
                    :key="index"
                    :prepend-icon="
                        gesangbuch_kategorie_name_to_icon(category?.kategorie_name?.name)
                    "
                    :style="{ 'background-color': get_color(category) }"
                >
                    {{ category?.kategorie_name?.name }}
                </v-chip>
            </v-chip-group>

            <div
                v-for="(author_source, index_1) in [
                    { name: 'Text', src: selectedSong?.text?.authors },
                    { name: 'Melodie', src: selectedSong?.melodie?.authors },
                ]"
                :key="index_1"
            >
                <div v-if="author_source?.src?.length">
                    <div class="text-subtitle-1 font-weight-medium">
                        {{ author_source.name }} Autor
                    </div>
                    <div
                        v-for="(author, index) in author_source.src"
                        :key="index"
                        class="d-flex flex-row mb-4"
                    >
                        <div class="me-2">{{ index + 1 }}.</div>
                        <div>
                            {{ author.vorname }} {{ author.nachname }}
                            {{
                                author.geburtsjahr || author.sterbejahr
                                    ? ` (${author.geburtsjahr ? '*' + author.geburtsjahr : ''}${author.sterbejahr ? ' - ' + author.sterbejahr : ''})`
                                    : ''
                            }}
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="selectedSong?.einreicherName" class="mb-4">
                <span class="text-subtitle-1 font-weight-medium"> Eingereicht von: </span>
                <span> {{ selectedSong?.einreicherName }} </span>
            </div>

            <div
                v-if="
                    selectedSong?.anmerkung ||
                    selectedSong?.text?.anmerkung ||
                    selectedSong?.melodie?.anmerkung
                "
                class="mb-4"
            >
                <div class="text-subtitle-1 font-weight-medium">Anmerkung:</div>
                <div class="white-space-pre">{{ selectedSong?.anmerkung }}</div>
                <div v-if="selectedSong?.text?.anmerkung" class="d-flex mt-2">
                    <v-icon class="me-2"> mdi-text-box </v-icon>
                    <div class="white-space-pre">
                        {{ selectedSong?.text.anmerkung }}
                    </div>
                </div>
                <div v-if="selectedSong?.melodie?.anmerkung" class="d-flex mt-2">
                    <!--  note icon         -->
                    <v-icon class="me-2"> mdi-music </v-icon>
                    <div>
                        {{ selectedSong?.melodie.anmerkung }}
                    </div>
                </div>
            </div>

            <div v-if="is_kleiner_kreis && is_kleiner_kreis_ansicht">
                <div class="text-subtitle-1 font-weight-medium">Bewertung Kleiner Kreis:</div>
                <div>
                    <div
                        v-if="selectedSong?.bewertung_kleiner_kreis?.bezeichner"
                        class="d-flex"
                        :style="{
                            color: rang_to_color[selectedSong?.bewertung_kleiner_kreis?.rangfolge],
                        }"
                    >
                        <v-icon icon="mdi-music" class="me-2" />
                        <span class="me-2">Lied</span>
                        <v-icon icon="mdi-arrow-right" class="me-2" />
                        {{ selectedSong?.bewertung_kleiner_kreis?.bezeichner }}
                    </div>
                    <div v-if="selectedSong?.bewertungAnmerkung" class="ms-10 d-flex">
                        <v-icon icon="mdi-arrow-right-bottom" class="me-2" />
                        <div class="pt-1">
                            {{ selectedSong?.bewertungAnmerkung }}
                        </div>
                    </div>
                </div>
                <div>
                    <div
                        v-if="selectedSong?.text?.bewertung_kleiner_kreis?.bezeichner"
                        :style="{
                            color: rang_to_color[
                                selectedSong?.text?.bewertung_kleiner_kreis?.rangfolge
                            ],
                        }"
                    >
                        <v-icon icon="mdi-text-box" class="me-2" />
                        <span class="me-2">Text</span>
                        <v-icon icon="mdi-arrow-right" class="me-2" />
                        {{ selectedSong?.text?.bewertung_kleiner_kreis?.bezeichner }}
                    </div>
                    <div v-if="selectedSong?.text?.bewertungAnmerkung" class="ms-10 d-flex">
                        <v-icon icon="mdi-arrow-right-bottom" class="me-2" />
                        <div class="pt-1">
                            {{ selectedSong?.text?.bewertungAnmerkung }}
                        </div>
                    </div>
                </div>
                <div>
                    <div
                        v-if="selectedSong?.melodie?.bewertung_kleiner_kreis?.bezeichner"
                        :style="{
                            color: rang_to_color[
                                selectedSong?.melodie?.bewertung_kleiner_kreis?.rangfolge
                            ],
                        }"
                    >
                        <v-icon icon="mdi-music-note" class="me-2" />
                        <span class="me-2">Melodie</span>
                        <v-icon icon="mdi-arrow-right" class="me-2" />
                        {{ selectedSong?.melodie?.bewertung_kleiner_kreis?.bezeichner }}
                    </div>
                    <div v-if="selectedSong?.melodie?.bewertungAnmerkung" class="ms-10 d-flex">
                        <v-icon icon="mdi-arrow-right-bottom" class="me-2" />
                        <div class="pt-1">
                            {{ selectedSong?.melodie?.bewertungAnmerkung }}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <span
                    v-if="selectedSong?.liednummer2000"
                    class="text-subtitle-1 font-weight-medium"
                >
                    Gesangbuchlied 2000:
                </span>
                <span> {{ selectedSong?.liednummer2000 }} </span>
                <span v-if="selectedSong?.melodieGeaendert || selectedSong?.textGeaendert">
                    mit
                </span>
                <v-icon
                    v-if="selectedSong?.melodieGeaendert"
                    icon="mdi-music-box"
                    color="primary"
                />
                <span v-if="selectedSong?.melodieGeaendert && selectedSong?.textGeaendert">
                    und
                </span>
                <v-icon
                    v-if="selectedSong?.textGeaendert"
                    icon="mdi-text-box-edit"
                    color="primary"
                />
                <span v-if="selectedSong?.melodieGeaendert || selectedSong?.textGeaendert">
                    geändert.
                </span>
            </div>

            <div v-if="selectedSong?.autor_oder_copyright_checken" class="mt-4">
                <v-alert
                    type="warning"
                    title="Autor/Copyright prüfen"
                    text="Dieses Lied muss auf Autor oder Copyright geprüft werden."
                    class="mb-0"
                />
            </div>
        </v-card-text>
        <v-card-actions>
            <v-btn color="error" @click="$emit('close')">Schließen</v-btn>
            <v-spacer />
            <v-btn
                color="primary"
                prepend-icon="mdi-printer"
                variant="outlined"
                @click="openPrintView"
            >
                Druckansicht
            </v-btn>
        </v-card-actions>
    </v-card>

    <v-dialog v-model="text_dialog" width="700">
        <TextDialog :text="selectedSong.text" @close="text_dialog = false" />
    </v-dialog>
    <v-dialog v-model="melodie_dialog" width="700" @close="melodie_dialog = false">
        <MelodieDialog :melodie="selectedSong.melodie" @close="melodie_dialog = false" />
    </v-dialog>
</template>

<script>
import TextDialog from '@/components/SongRelated/TextDialog.vue';
import MelodieDialog from '@/components/SongRelated/MelodieDialog.vue';
import { gesangbuch_kategorie_name_to_icon, chart_colors, rang_to_color } from '@/assets/js/utils';
import StrophenList from '@/components/SongRelated/StrophenList.vue';
import NotenCarousel from '@/components/SongRelated/NotenCarousel.vue';
import { useUserStore } from '@/store/user';

import _ from 'lodash';
import SingModeDialog from '@/components/SongRelated/SingModeDialog.vue';

export default {
    name: 'GesangbuchLiedComponent',
    components: {
        SingModeDialog,
        NotenCarousel,
        StrophenList,
        MelodieDialog,
        TextDialog,
    },
    props: {
        selectedSong: {
            type: Object,
            required: true,
        },
    },
    emits: ['close'],
    data: () => ({
        user: useUserStore(),
        text_dialog: false,
        melodie_dialog: false,
        copied: false,
        visible_file: null,
    }),
    computed: {
        rang_to_color() {
            return rang_to_color;
        },
        is_kleiner_kreis() {
            return this.user.is_kleiner_kreis;
        },
        is_kleiner_kreis_ansicht() {
            return this.user.is_kleiner_kreis_ansicht;
        },
        text_has_done_auftraege() {
            return this.has_only_done_auftraege(this.selectedSong.text.auftrag);
        },
        melodie_has_done_auftraege() {
            return this.has_only_done_auftraege(this.selectedSong.melodie.auftrag);
        },
    },

    methods: {
        gesangbuch_kategorie_name_to_icon,
        get_color(category) {
            return chart_colors[category.id % chart_colors.length];
        },
        copyPathInClipboard() {
            navigator.clipboard.writeText(window.location.href);
            this.copied = true;
        },
        has_only_done_auftraege(auftrag) {
            return _.every(auftrag, (auftrag) => auftrag.status === 'done');
        },
        openPrintView() {
            // Open the print view in a new tab with the current song
            const url = `/druckansicht?songId=${this.selectedSong.id}`;
            window.open(url, '_blank');
        },
    },
};
</script>

<style lang="scss">
.card-header {
    cursor: pointer;

    &:hover {
        transition: all 0.2s ease-in-out;
        transform: scale(1.05);
    }
}
</style>
