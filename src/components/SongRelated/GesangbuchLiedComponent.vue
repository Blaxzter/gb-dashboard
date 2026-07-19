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
                        :style="
                            copied
                                ? 'color: rgb(var(--v-theme-primary))'
                                : 'color: rgb(var(--v-theme-on-surface))'
                        "
                        @click="copyPathInClipboard"
                    >
                        <!--  Clipboard icon        -->
                        <v-icon class="me-2"> mdi-content-copy </v-icon>

                        {{ selectedSong?.gesangbuch_titel }}

                        <v-tooltip
                            v-if="
                                selectedSong?.liednummer2026 &&
                                selectedSong?.liednummer2026 !== 'null'
                            "
                            text="Liednummer Gesangbuch 2026"
                            location="bottom"
                        >
                            <template #activator="{ props: chipProps }">
                                <v-chip
                                    v-bind="chipProps"
                                    size="small"
                                    color="primary"
                                    variant="tonal"
                                    class="ml-2"
                                    @click.stop
                                >
                                    <v-icon start icon="mdi-book-music-outline" size="small" />
                                    {{ selectedSong?.liednummer2026 }}
                                </v-chip>
                            </template>
                        </v-tooltip>
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
                :notentext-files="
                    [selectedSong?.notentext_file, selectedSong?.notentext_seite2_file].filter(
                        Boolean,
                    )
                "
                @visible_file="visible_file = $event"
            />

            <div class="mb-4">
                <StrophenList
                    :text="selectedSong?.text"
                    :show-extra-strophen-data="false"
                    :edit-mode="editMode"
                    @toggle-edit-mode="editMode = !editMode"
                    @edit-completed="editMode = false"
                />
            </div>

            <!-- Kategorien: für Super-Editoren/Administratoren direkt in der
                 Detailansicht bearbeitbar (Issue #66) – spart Luise den Umweg
                 über das Redaktionssystem. -->
            <div class="d-flex align-center flex-wrap">
                <template v-if="!categoryEditMode">
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
                    <span
                        v-if="canEditCategories && !selectedSong?.kategories?.length"
                        class="text-medium-emphasis text-body-2 me-2"
                    >
                        Keine Kategorien
                    </span>
                    <v-tooltip
                        v-if="canEditCategories"
                        text="Kategorien bearbeiten"
                        location="bottom"
                    >
                        <template #activator="{ props }">
                            <v-btn
                                icon="mdi-pencil"
                                size="small"
                                variant="text"
                                color="primary"
                                v-bind="props"
                                @click="startCategoryEdit"
                            />
                        </template>
                    </v-tooltip>
                </template>
            </div>

            <div v-if="categoryEditMode" class="mb-4 mt-1" style="max-width: 600px">
                <v-autocomplete
                    v-model="editedCategoryIds"
                    label="Kategorien"
                    :items="allCategories"
                    item-title="name"
                    item-value="id"
                    variant="outlined"
                    density="comfortable"
                    hide-details="auto"
                    multiple
                    chips
                    closable-chips
                    :disabled="categorySaving"
                >
                    <template #chip="{ props: chipProps, item }">
                        <v-chip
                            v-bind="chipProps"
                            :prepend-icon="gesangbuch_kategorie_name_to_icon(item.raw.name)"
                            :text="item.raw.name"
                        />
                    </template>
                    <template #item="{ props: itemProps, item }">
                        <v-list-item
                            v-bind="itemProps"
                            :prepend-icon="gesangbuch_kategorie_name_to_icon(item.raw.name)"
                            :title="item.raw.name"
                        />
                    </template>
                </v-autocomplete>

                <v-alert
                    v-if="categorySaveError"
                    type="error"
                    variant="tonal"
                    density="compact"
                    class="mt-2"
                    closable
                    @click:close="categorySaveError = null"
                >
                    {{ categorySaveError }}
                </v-alert>

                <div class="d-flex ga-2 mt-2">
                    <v-btn
                        color="primary"
                        variant="elevated"
                        :loading="categorySaving"
                        :disabled="categorySaving"
                        @click="saveCategories"
                    >
                        <v-icon start>mdi-content-save</v-icon>
                        Speichern
                    </v-btn>
                    <v-btn
                        color="grey"
                        variant="outlined"
                        :disabled="categorySaving"
                        @click="cancelCategoryEdit"
                    >
                        <v-icon start>mdi-close</v-icon>
                        Abbrechen
                    </v-btn>
                </div>
            </div>

            <!-- Formatierten Footer (Autoren + Copyright, wie beim Notentext-Export)
                 in die Zwischenablage kopieren – zur direkten Übernahme nach InDesign
                 (Issue #64). Nutzt exakt dieselbe Formatierung wie der Export (buildFooter). -->
            <div v-if="footerText" class="d-flex align-center mb-2">
                <span class="text-subtitle-1 font-weight-medium me-2">Footer</span>
                <v-tooltip text="Formatierten Footer kopieren (für InDesign)" location="bottom">
                    <template #activator="{ props }">
                        <v-btn
                            icon="mdi-clipboard-multiple-outline"
                            size="small"
                            variant="text"
                            color="primary"
                            v-bind="props"
                            @click="copyFooter"
                        />
                    </template>
                </v-tooltip>
            </div>

            <div
                v-for="(author_source, index_1) in [
                    {
                        name: 'Text',
                        src: selectedSong?.text?.authors,
                        copyright: selectedSong?.text?.copyright,
                    },
                    {
                        name: 'Melodie',
                        src: selectedSong?.melodie?.authors,
                        copyright: selectedSong?.melodie?.copyright,
                    },
                ]"
                :key="index_1"
            >
                <v-sheet
                    v-if="author_source?.src?.length || author_source.copyright"
                    color="surface-light"
                    rounded="lg"
                    class="mb-3 pa-3"
                >
                    <div class="text-subtitle-1 font-weight-medium mb-2">
                        {{ author_source.name }} Autor
                    </div>
                    <div
                        v-for="(author, index) in author_source.src"
                        :key="index"
                        class="d-flex flex-row mb-3"
                    >
                        <div class="me-2">{{ index + 1 }}.</div>
                        <div class="d-flex flex-column">
                            <div class="text-medium-emphasis">{{ author.autorPrefix || '' }}</div>
                            <div>
                                {{ author.vorname }} {{ author.nachname }}
                                {{ formatYearRange(author.geburtsjahr, author.sterbejahr) }}
                            </div>
                            <div class="text-medium-emphasis">
                                {{ author.autorSuffix || '' }}
                                {{ ursprungLabel(author?.ursprungsAutorObj) }}
                            </div>
                        </div>
                    </div>
                    <div
                        v-if="author_source.copyright"
                        class="text-medium-emphasis text-body-2 white-space-pre"
                    >
                        © {{ author_source.copyright }}
                    </div>
                </v-sheet>
            </div>

            <v-sheet
                v-if="
                    selectedSong?.copyright ||
                    selectedSong?.einreicherName ||
                    selectedSong?.text?.korrekturlesung1
                "
                color="surface-light"
                rounded="lg"
                class="mb-3 pa-3"
            >
                <div v-if="selectedSong?.copyright">
                    <div class="text-subtitle-1 font-weight-medium">Copyright:</div>
                    <div class="white-space-pre">© {{ selectedSong?.copyright }}</div>
                </div>
                <div
                    v-if="selectedSong?.einreicherName"
                    :class="{ 'mt-2': selectedSong?.copyright }"
                >
                    <span class="text-subtitle-1 font-weight-medium"> Eingereicht von: </span>
                    <span> {{ selectedSong?.einreicherName }} </span>
                </div>
                <div
                    v-if="selectedSong?.text?.korrekturlesung1"
                    :class="{
                        'mt-2': selectedSong?.copyright || selectedSong?.einreicherName,
                    }"
                >
                    <v-chip color="success" prepend-icon="mdi-check-circle">
                        Text: Korrekturlesung abgeschlossen
                    </v-chip>
                </div>
            </v-sheet>

            <v-sheet
                v-if="
                    selectedSong?.anmerkung ||
                    selectedSong?.text?.anmerkung ||
                    selectedSong?.melodie?.anmerkung
                "
                color="surface-light"
                rounded="lg"
                class="mb-3 pa-3"
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
            </v-sheet>

            <v-sheet
                v-if="is_kleiner_kreis && is_kleiner_kreis_ansicht"
                color="surface-light"
                rounded="lg"
                class="mb-3 pa-3"
            >
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
                        <div class="pt-1 white-space-pre">
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
                        <div class="pt-1 white-space-pre">
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
                        <div class="pt-1 white-space-pre">
                            {{ selectedSong?.melodie?.bewertungAnmerkung }}
                        </div>
                    </div>
                </div>
            </v-sheet>

            <v-sheet
                v-if="
                    is_kleiner_kreis &&
                    is_kleiner_kreis_ansicht &&
                    (selectedSong?.liednummer2026 ||
                        selectedSong?.deutscheLiedfassung ||
                        selectedSong?.melodie?.choralbuchNummer)
                "
                color="surface-light"
                rounded="lg"
                class="mb-3 pa-3"
            >
                <div v-if="selectedSong?.liednummer2026">
                    <span class="text-subtitle-1 font-weight-medium"> Gesangbuchlied 2026: </span>
                    <span> {{ selectedSong?.liednummer2026 }} </span>
                </div>
                <div v-if="selectedSong?.melodie?.choralbuchNummer">
                    <span class="text-subtitle-1 font-weight-medium"> Choralbuch Nr.: </span>
                    <span> {{ selectedSong?.melodie?.choralbuchNummer }} </span>
                </div>
                <div v-if="deutsche_liedfassung_id" class="text-medium-emphasis">
                    <v-icon icon="mdi-link-variant" size="small" class="me-1" />
                    <span>Liednummer übernommen von deutscher Liedfassung: </span>
                    <a
                        href="#"
                        class="text-primary"
                        style="text-decoration: underline"
                        @click.prevent="openDeutscheLiedfassung"
                    >
                        {{ deutsche_liedfassung_titel || `#${deutsche_liedfassung_id}` }}
                    </a>
                </div>
            </v-sheet>

            <v-sheet
                v-if="selectedSong?.liednummer2000"
                color="surface-light"
                rounded="lg"
                class="mb-3 pa-3"
            >
                <span class="text-subtitle-1 font-weight-medium"> Gesangbuchlied 2000: </span>
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
            </v-sheet>

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

    <v-snackbar v-model="copySnackbar" :timeout="2500" :color="copySnackbarColor">
        {{ copySnackbarMessage }}
        <template #actions>
            <v-btn variant="text" @click="copySnackbar = false">OK</v-btn>
        </template>
    </v-snackbar>
</template>

<script>
import TextDialog from '@/components/SongRelated/TextDialog.vue';
import MelodieDialog from '@/components/SongRelated/MelodieDialog.vue';
import {
    gesangbuch_kategorie_name_to_icon,
    chart_colors,
    rang_to_color,
    writeToClipboard,
} from '@/assets/js/utils';
import { formatYearRange, buildFooter } from '@/assets/js/authorFormat';
import StrophenList from '@/components/SongRelated/StrophenList.vue';
import NotenCarousel from '@/components/SongRelated/NotenCarousel.vue';
import { useUserStore } from '@/store/user';
import { useAppStore } from '@/store/app';

import _ from 'lodash';
import SingModeDialog from '@/components/SongRelated/SingModeDialog.vue';

// Das Bearbeiten der Kategorien ist auf bestimmte Directus-Rollen beschränkt
// (Issue #66): standardmäßig Super-Editoren und Administratoren. Leere Konfig
// deaktiviert die Rollenprüfung (analog zu den übrigen *_ROLES-Variablen).
const kategorieEditRoles = (
    import.meta.env.VITE_KATEGORIE_EDIT_ROLES || 'Super-Editor,Administrator'
)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

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
    emits: ['close', 'switch-song'],
    data: () => ({
        user: useUserStore(),
        appStore: useAppStore(),
        text_dialog: false,
        melodie_dialog: false,
        copied: false,
        visible_file: null,
        editMode: false,
        // Kategorien-Bearbeitung (Issue #66).
        categoryEditMode: false,
        editedCategoryIds: [],
        categorySaving: false,
        categorySaveError: null,
        // Rückmeldung für den „Footer kopieren"-Button (Issue #64).
        copySnackbar: false,
        copySnackbarMessage: '',
        copySnackbarColor: undefined,
    }),
    computed: {
        rang_to_color() {
            return rang_to_color;
        },
        is_kleiner_kreis() {
            return this.user.is_kleiner_kreis;
        },
        // Kategorien nur für Super-Editoren/Administratoren bearbeitbar (Issue #66).
        canEditCategories() {
            return this.user.has_role(kategorieEditRoles);
        },
        // Alle verfügbaren Kategorien (alphabetisch) für das Bearbeiten-Dropdown.
        allCategories() {
            return _.sortBy(this.appStore.kategorien, (k) => (k?.name || '').toLowerCase());
        },
        is_kleiner_kreis_ansicht() {
            return this.user.is_kleiner_kreis_ansicht;
        },
        deutsche_liedfassung_id() {
            const dlf = this.selectedSong?.deutscheLiedfassung;
            if (dlf == null) return null;
            return typeof dlf === 'object' ? dlf.id : dlf;
        },
        deutsche_liedfassung_song() {
            const id = this.deutsche_liedfassung_id;
            if (id == null) return null;
            return _.find(this.appStore.gesangbuchlieder, { id: Number(id) });
        },
        deutsche_liedfassung_titel() {
            return this.deutsche_liedfassung_song?.gesangbuch_titel;
        },
        text_has_done_auftraege() {
            return this.has_only_done_auftraege(this.selectedSong.text.auftrag);
        },
        melodie_has_done_auftraege() {
            return this.has_only_done_auftraege(this.selectedSong.melodie.auftrag);
        },
        // Formatierter Footer (Autoren + Copyright) exakt wie beim Notentext-Export
        // (Issue #64). Leer, wenn es nichts zu kopieren gibt – dann wird der Button
        // ausgeblendet.
        footerText() {
            return buildFooter(this.selectedSong);
        },
    },

    methods: {
        gesangbuch_kategorie_name_to_icon,
        // Jahresangabe einheitlich wie in der Gesangbuchlieder-Übersicht (Issue #43):
        // (1932–2025) statt (*1932 - 2025).
        formatYearRange,
        // Ursprungsautor als „Vorname Nachname (Jahre)“ in derselben Formatierung.
        ursprungLabel(u) {
            if (!u || typeof u !== 'object') return '';
            const name = [u.vorname, u.nachname].filter(Boolean).join(' ');
            const years = formatYearRange(u.geburtsjahr, u.sterbejahr);
            return [name, years].filter(Boolean).join(' ');
        },
        get_color(category) {
            return chart_colors[category.id % chart_colors.length];
        },

        // Kategorien-Bearbeitung (Issue #66): Vorbelegung der aktuell verknüpften
        // Kategorien und Umschalten in den Bearbeitungsmodus.
        startCategoryEdit() {
            this.categorySaveError = null;
            this.editedCategoryIds = _.map(
                this.selectedSong?.kategories,
                (category) => category?.kategorie_name?.id ?? category?.kategorie_id,
            ).filter((id) => id != null);
            this.categoryEditMode = true;
        },
        cancelCategoryEdit() {
            this.categoryEditMode = false;
            this.categorySaveError = null;
        },
        async saveCategories() {
            this.categorySaving = true;
            this.categorySaveError = null;
            try {
                await this.appStore.updateGesangbuchliedKategorien(
                    this.selectedSong.id,
                    this.editedCategoryIds,
                );
                this.categoryEditMode = false;
            } catch (error) {
                console.error('Error saving categories:', error);
                this.categorySaveError =
                    'Fehler beim Speichern der Kategorien. Bitte versuchen Sie es erneut.';
            } finally {
                this.categorySaving = false;
            }
        },

        copyPathInClipboard() {
            navigator.clipboard.writeText(window.location.href);
            this.copied = true;
        },

        // Kopiert den formatierten Footer (Autoren + Copyright) in die Zwischenablage –
        // identisch zum Notentext-Export (buildFooter), zur direkten Übernahme nach
        // InDesign (Issue #64).
        async copyFooter() {
            const textToCopy = this.footerText;
            if (!textToCopy) {
                this.showCopySnackbar('Kein Footer zum Kopieren vorhanden.', 'warning');
                return;
            }
            const ok = await writeToClipboard(textToCopy);
            if (ok) {
                this.showCopySnackbar('Footer in die Zwischenablage kopiert.', 'success');
            } else {
                this.showCopySnackbar('Kopieren fehlgeschlagen.', 'error');
            }
        },

        showCopySnackbar(message, color) {
            this.copySnackbarMessage = message;
            this.copySnackbarColor = color;
            this.copySnackbar = true;
        },
        has_only_done_auftraege(auftrag) {
            return _.every(auftrag, (auftrag) => auftrag.status === 'done');
        },
        openPrintView() {
            // Open the print view in a new tab with the current song
            const url = `/druckansicht?songId=${this.selectedSong.id}`;
            window.open(url, '_blank');
        },
        openDeutscheLiedfassung() {
            const song = this.deutsche_liedfassung_song;
            if (song) {
                this.$emit('switch-song', song);
            }
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
