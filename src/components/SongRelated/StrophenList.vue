<template>
    <div v-if="includeTitle" class="text-h6 mx-auto mb-1 d-flex align-center">
        <span class="me-2"> Strophen </span>
        <!-- Strophen 2–n ohne Silbentrennzeichen/Zeilenumbrüche in die Zwischenablage
             kopieren – für die direkte Übernahme nach InDesign. Formatiert wie der
             Notentext-Export (Issue #61). -->
        <v-tooltip
            v-if="!showTextOnly && hasFollowupStrophen"
            text="Strophen 2–n ohne Trennzeichen kopieren (für InDesign)"
            location="bottom"
        >
            <template #activator="{ props }">
                <v-btn
                    icon="mdi-clipboard-multiple-outline"
                    size="small"
                    variant="text"
                    color="primary"
                    class="me-2"
                    v-bind="props"
                    @click="copyFollowupStrophen"
                />
            </template>
        </v-tooltip>
        <div v-if="isAdmin && isAdminView" class="d-flex ga-2">
            <!-- Silbentrennung (¬) ausgeblendet: Die Wort-/Silbentrennung wurde
                 abgeschlossen und das Trennzeichen aus den Texten entfernt. Zum
                 Reaktivieren `silbentrennungEnabled` auf true setzen. -->
            <v-tooltip v-if="silbentrennungEnabled" text="Silbenmodus bearbeiten" location="bottom">
                <template #activator="{ props }">
                    <v-btn
                        icon="mdi-format-letter-matches"
                        size="small"
                        variant="text"
                        :color="syllableEditMode ? 'primary' : 'grey'"
                        v-bind="props"
                        @click="toggleSyllableEditMode"
                    />
                </template>
            </v-tooltip>
            <v-tooltip text="Text bearbeiten" location="bottom">
                <template #activator="{ props }">
                    <v-btn
                        icon="mdi-pencil"
                        size="small"
                        variant="text"
                        :color="editMode ? 'primary' : 'grey'"
                        v-bind="props"
                        @click="toggleTextEditMode"
                    />
                </template>
            </v-tooltip>
            <v-tooltip text="KI-Anmerkungen ein-/ausblenden" location="bottom">
                <template #activator="{ props }">
                    <v-btn
                        icon="mdi-robot-outline"
                        size="small"
                        variant="text"
                        :color="effectiveShowKiReview ? 'primary' : 'grey'"
                        v-bind="props"
                        @click="toggleKiReview"
                    />
                </template>
            </v-tooltip>
        </div>
        <v-expand-transition>
            <div v-if="syllableEditMode" class="ms-4 d-flex ga-2">
                <v-tooltip text="Silbensymbole ein-/ausblenden" location="bottom">
                    <template #activator="{ props }">
                        <v-btn
                            icon="mdi-format-letter-matches"
                            size="small"
                            variant="text"
                            :color="effectiveShowSyllableSymbols ? 'primary' : 'grey'"
                            v-bind="props"
                            @click="toggleSyllableSymbols"
                        />
                    </template>
                </v-tooltip>
                <v-tooltip text="Leerzeichen als Punkte anzeigen" location="bottom">
                    <template #activator="{ props }">
                        <v-btn
                            icon="mdi-circle-small"
                            size="small"
                            variant="text"
                            :color="effectiveShowSpacesAsDots ? 'primary' : 'grey'"
                            v-bind="props"
                            @click="toggleSpacesAsDots"
                        />
                    </template>
                </v-tooltip>
            </div>
        </v-expand-transition>
    </div>
    <div
        v-for="(strophe, index) in show_strophen"
        :key="index"
        :style="{ 'max-width': !includeTitle ? '' : '500px' }"
        class="mx-auto"
    >
        <!-- Edit Mode -->
        <div v-if="editMode">
            <v-textarea
                v-model="editedStrophen[index].strophe"
                :label="`Strophentext ${index + 1}`"
                variant="outlined"
                auto-grow
                rows="3"
                density="compact"
            />
        </div>
        <!-- Normal Mode -->
        <div v-else-if="!syllableEditMode">
            <div
                class="d-flex py-3 px-5"
                :class="
                    (strophe.aenderungsvorschlag || strophe.anmerkung) && !showTextOnly
                        ? 'hover-border'
                        : ''
                "
                @click="strophe.show = !strophe.show && !showTextOnly"
            >
                <v-tooltip
                    v-if="!showTextOnly"
                    text="Text mit bindestrichen in die Zwischenablage kopieren"
                    location="bottom"
                >
                    <template #activator="{ props }">
                        <v-icon
                            v-bind="props"
                            icon="mdi-content-copy"
                            size="tiny"
                            color="primary"
                            class="copy-button me-2 mt-1"
                            @click.stop="copyToClipboard(strophe.strophe)"
                        />
                    </template>
                </v-tooltip>
                <div class="pb-0 me-3" style="white-space: nowrap">{{ index + 1 }}.</div>
                <div class="pb-0" style="white-space: pre-line">
                    {{ formatStropheText(strophe.strophe) }}
                </div>
                <div class="d-flex flex-column align-center ms-3">
                    <v-tooltip
                        v-if="strophe.aenderungsvorschlag && !showTextOnly"
                        text="Strophe hat einen Änderungsvorschlag"
                        location="bottom"
                    >
                        <template #activator="{ props }">
                            <v-icon
                                v-bind="props"
                                icon="mdi-pencil"
                                size="tiny"
                                color="warning"
                                :class="index === 0 ? 'pt-2' : ''"
                            />
                        </template>
                    </v-tooltip>

                    <v-tooltip
                        v-if="strophe.anmerkung && !showTextOnly"
                        text="Strophe hat eine Anmerkung"
                        location="bottom"
                    >
                        <template #activator="{ props }">
                            <v-icon
                                v-bind="props"
                                icon="mdi-message"
                                size="tiny"
                                color="warning"
                                :class="strophe.aenderungsvorschlag || index === 0 ? 'pt-2' : ''"
                            />
                        </template>
                    </v-tooltip>
                </div>
            </div>
            <v-expand-transition>
                <div v-if="strophe.show">
                    <div v-if="strophe.aenderungsvorschlag" class="pt-2 d-flex">
                        <div class="d-flex align-center pt-0"></div>
                        <div
                            class="pt-0 ms-7"
                            :class="{ 'pb-0': strophe.anmerkung }"
                            style="font-size: 0.9rem; white-space: pre-wrap"
                        >
                            <v-icon
                                icon="mdi-pencil"
                                size="tiny"
                                class="me-3"
                                :class="{ 'pb-0': strophe.anmerkung }"
                            ></v-icon>
                            {{ strophe.aenderungsvorschlag }}
                        </div>
                    </div>
                    <div v-if="strophe.anmerkung" class="pt-2 d-flex">
                        <div class="d-flex align-center pt-0"></div>
                        <div class="pt-0 ms-7" style="font-size: 0.9rem; white-space: pre-wrap">
                            <v-icon icon="mdi-message" size="tiny" class="me-3"></v-icon>
                            {{ strophe.anmerkung }}
                        </div>
                    </div>
                </div>
            </v-expand-transition>
            <div
                v-if="
                    !showTextOnly &&
                    isAdmin &&
                    isAdminView &&
                    effectiveShowKiReview &&
                    strophe.kiReview &&
                    strophe.kiReview.length > 0
                "
                class="ki-review-section ms-5 me-5 mb-3"
            >
                <div
                    v-for="(review, reviewIndex) in strophe.kiReview"
                    :key="reviewIndex"
                    class="ki-review-entry pt-2"
                    :class="{ 'ki-review-collapsed': isCollapsedReview(review) }"
                >
                    <!-- Compact view for accepted/rejected reviews -->
                    <div
                        v-if="isCollapsedReview(review)"
                        class="d-flex align-center ga-2 ki-review-collapsed-compact"
                    >
                        <v-btn
                            :icon="
                                review.bewertungDurchMensch === 'accepted'
                                    ? 'mdi-check-circle'
                                    : 'mdi-close-circle'
                            "
                            size="x-small"
                            variant="text"
                            :color="
                                review.bewertungDurchMensch === 'accepted' ? 'success' : 'error'
                            "
                            :title="
                                review.bewertungDurchMensch === 'accepted'
                                    ? 'Akzeptierung rückgängig machen'
                                    : 'Ablehnung rückgängig machen'
                            "
                            @click="revertBewertung(review)"
                        />
                        <div class="ki-review-collapsed-text">
                            {{ firstLine(review.reviewErgebnis) }}
                        </div>
                        <v-menu :close-on-content-click="false" location="bottom end">
                            <template #activator="{ props }">
                                <v-btn
                                    icon="mdi-eye-outline"
                                    size="x-small"
                                    variant="text"
                                    color="info"
                                    title="KI-Review anzeigen"
                                    class="ki-review-eye"
                                    v-bind="props"
                                />
                            </template>
                            <v-card max-width="500" class="pa-3">
                                <div class="d-flex align-start ga-2">
                                    <v-icon
                                        icon="mdi-robot-outline"
                                        size="small"
                                        color="info"
                                        class="mt-1"
                                    />
                                    <div style="font-size: 0.9rem; white-space: pre-wrap">
                                        {{ review.reviewErgebnis }}
                                    </div>
                                </div>
                                <div
                                    v-if="review.anmerkungDurchMensch"
                                    class="text-caption mt-3 ms-8"
                                >
                                    <strong>Anmerkung:</strong> {{ review.anmerkungDurchMensch }}
                                </div>
                            </v-card>
                        </v-menu>
                    </div>
                    <!-- Full view -->
                    <template v-else>
                        <div class="d-flex align-start ga-3">
                            <v-icon
                                icon="mdi-robot-outline"
                                size="tiny"
                                color="info"
                                class="mt-3"
                            />
                            <div
                                class="flex-grow-1 pt-2"
                                style="font-size: 0.9rem; white-space: pre-wrap"
                            >
                                {{ review.reviewErgebnis }}
                            </div>
                            <v-select
                                v-if="review.reviewErgebnis"
                                v-model="review.bewertungDurchMensch"
                                :items="bewertungOptions"
                                label="Bewertung"
                                density="compact"
                                variant="outlined"
                                hide-details
                                clearable
                                style="max-width: 200px; min-width: 160px"
                                @update:model-value="onKiReviewChanged"
                            />
                        </div>
                        <div v-if="review.reviewErgebnis" class="ms-8 mt-2">
                            <v-text-field
                                v-model="review.anmerkungDurchMensch"
                                label="Anmerkung"
                                density="compact"
                                variant="outlined"
                                hide-details
                                @blur="onKiReviewChanged"
                            />
                        </div>
                    </template>
                </div>
            </div>
        </div>
        <!-- Syllable Edit Mode -->
        <div v-else>
            <SyllableEditList
                :text="{ strophenEinzeln: [strophe] }"
                :include-title="false"
                :show-syllable-symbols="effectiveShowSyllableSymbols"
                :show-spaces-as-dots="effectiveShowSpacesAsDots"
                :strophe-number="index + 1"
                @update-strophen="updateStrophe(index, $event)"
            />
        </div>
    </div>

    <!-- Save/Cancel buttons for Edit Mode -->
    <div v-if="editMode" class="d-flex flex-column align-center ga-2 mt-4 mb-2">
        <v-alert
            v-if="saveError"
            type="error"
            variant="tonal"
            closable
            @click:close="saveError = null"
        >
            {{ saveError }}
        </v-alert>
        <div class="d-flex flex-column align-start">
            <v-checkbox
                v-model="korrekturlesung1"
                label="1. Korrekturlesung (1. Strophe) erfolgt"
                color="primary"
                density="compact"
                hide-details
            />
            <v-checkbox
                v-model="korrekturlesung1_alle_Strophen"
                label="1. Korrekturlesung (alle Strophen) erfolgt"
                color="primary"
                density="compact"
                hide-details
            />
            <v-checkbox
                v-model="korrekturlesung2"
                label="2. Korrekturlesung (alle Strophen) erfolgt"
                color="primary"
                density="compact"
                hide-details
            />
        </div>
        <div class="d-flex ga-2">
            <v-btn
                color="primary"
                variant="elevated"
                :loading="isSaving || checkingConflict"
                :disabled="isSaving || checkingConflict"
                @click="saveEditedStrophen"
            >
                <v-icon start>mdi-content-save</v-icon>
                Speichern
            </v-btn>
            <v-btn
                color="grey"
                variant="outlined"
                :disabled="isSaving || checkingConflict"
                @click="cancelEdit"
            >
                <v-icon start>mdi-close</v-icon>
                Abbrechen
            </v-btn>
        </div>
    </div>

    <!-- Konflikt-Warnung (Issue #52): der Text wurde zwischenzeitlich serverseitig
         geändert. Der Nutzer entscheidet, ob er überschreibt. -->
    <v-dialog v-model="conflictDialog" max-width="520" persistent>
        <v-card>
            <v-card-title class="d-flex align-center ga-2">
                <v-icon color="warning">mdi-alert</v-icon>
                Zwischenzeitlich geändert
            </v-card-title>
            <v-card-text>
                Dieser Text wurde geöffnet bzw. zuletzt geladen und in der Zwischenzeit von jemand
                anderem (oder in einem anderen Tab) gespeichert. Wenn du jetzt speicherst,
                <strong>überschreibst du diese neueren Änderungen</strong>.
                <div class="mt-3 text-medium-emphasis text-body-2">
                    Empfehlung: Abbrechen, die Seite neu laden und deine Änderungen erneut
                    eintragen.
                </div>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="conflictDialog = false">Abbrechen</v-btn>
                <v-btn color="warning" variant="flat" :loading="isSaving" @click="forceSave">
                    Trotzdem speichern
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Rückmeldung nach dem Kopieren der Strophen 2–n (Issue #61). -->
    <v-snackbar v-model="copySnackbar" :timeout="2500" :color="copySnackbarColor">
        {{ copySnackbarMessage }}
        <template #actions>
            <v-btn variant="text" @click="copySnackbar = false">OK</v-btn>
        </template>
    </v-snackbar>
</template>

<script>
import _ from 'lodash';
import SyllableEditList from './SyllableEditList.vue';
import { useAppStore } from '@/store/app';
import { useUserStore } from '@/store/user';
import { formatStrophenForExport, writeToClipboard } from '@/assets/js/utils';

export default {
    name: 'StrophenList',
    components: {
        SyllableEditList,
    },
    props: {
        text: {
            type: Object,
            required: true,
        },
        showExtraStrophenData: {
            type: Boolean,
            default: false,
        },
        showTextOnly: {
            type: Boolean,
            default: false,
        },
        includeTitle: {
            type: Boolean,
            default: true,
        },
        showSyllableSymbols: {
            type: Boolean,
            default: null,
        },
        showSpacesAsDots: {
            type: Boolean,
            default: null,
        },
        showKiReview: {
            type: Boolean,
            default: null,
        },
        editMode: {
            type: Boolean,
            default: false,
        },
    },
    emits: ['edit-completed', 'toggle-edit-mode'],
    data: () => ({
        store: useAppStore(),
        userStore: useUserStore(),
        show_strophen: [],
        // Silbentrennung (¬) ist abgeschlossen und ausgeblendet. Schaltet den
        // Silbenmodus-Button und die zugehörigen Optionen aus. Auf true setzen,
        // um die Silbentrennungs-UI wieder einzublenden.
        silbentrennungEnabled: false,
        syllableEditMode: false,
        internalShowSyllableSymbols: false,
        internalShowSpacesAsDots: false,
        internalShowKiReview: true,
        editedStrophen: [],
        isSaving: false,
        saveError: null,
        // Konflikterkennung (Issue #52): date_updated des Textes zum Zeitpunkt des
        // Bearbeitungsstarts. Beim Speichern wird der aktuelle Server-Wert dagegen
        // geprüft, um zwischenzeitliche Änderungen anderer Nutzer zu erkennen.
        loadedDateUpdated: null,
        conflictDialog: false,
        conflictInfo: null,
        checkingConflict: false,
        korrekturlesung1: false,
        korrekturlesung1_alle_Strophen: false,
        korrekturlesung2: false,
        // Rückmeldung für den „Strophen 2–n kopieren"-Button (Issue #61).
        copySnackbar: false,
        copySnackbarMessage: '',
        copySnackbarColor: undefined,
        bewertungOptions: [
            { title: 'Akzeptiert', value: 'accepted' },
            { title: 'Abgelehnt', value: 'rejected' },
            { title: 'Diskussion', value: 'discussion' },
        ],
    }),
    computed: {
        // Computed property to determine if the text is a song
        isAdmin() {
            return this.userStore.is_kleiner_kreis;
        },
        isAdminView() {
            return this.userStore.is_kleiner_kreis_ansicht;
        },
        effectiveShowSyllableSymbols() {
            return this.showSyllableSymbols !== null
                ? this.showSyllableSymbols
                : this.internalShowSyllableSymbols;
        },
        effectiveShowSpacesAsDots() {
            return this.showSpacesAsDots !== null
                ? this.showSpacesAsDots
                : this.internalShowSpacesAsDots;
        },
        effectiveShowKiReview() {
            return this.showKiReview !== null ? this.showKiReview : this.internalShowKiReview;
        },
        // Es gibt überhaupt Strophen 2..n, die kopiert werden können (Issue #61).
        hasFollowupStrophen() {
            return (this.text?.strophenEinzeln?.length ?? 0) > 1;
        },
    },
    watch: {
        text: {
            handler(newText) {
                this.show_strophen = _.map(newText?.strophenEinzeln, (obj) => ({
                    ...obj,
                    show: this.showExtraStrophenData,
                }));
                this.editedStrophen = _.cloneDeep(this.show_strophen);
                this.syncKorrekturlesung(newText);
                // Solange NICHT bearbeitet wird, gilt der jeweils geladene Stand
                // als Bearbeitungsbasis. Während des Bearbeitens bleibt die Basis
                // bewusst stehen, damit zwischenzeitliche Änderungen erkannt werden.
                if (!this.editMode) {
                    this.loadedDateUpdated = newText?.date_updated ?? null;
                }
            },
            deep: true,
        },
        editMode(newVal) {
            if (newVal) {
                // Reset edited strophen when entering edit mode
                this.editedStrophen = _.cloneDeep(this.show_strophen);
                // Reset korrekturlesung flags from text object
                this.syncKorrekturlesung(this.text);
                // Bearbeitungsbasis für die Konflikterkennung festhalten.
                this.loadedDateUpdated = this.text?.date_updated ?? null;
            }
        },
    },
    mounted() {
        this.show_strophen = _.map(this.text?.strophenEinzeln, (obj) => ({
            ...obj,
            show: this.showExtraStrophenData,
        }));

        // Initialize edited strophen as deep copy
        this.editedStrophen = _.cloneDeep(this.show_strophen);

        // Initialize korrekturlesung flags from text object
        this.syncKorrekturlesung(this.text);

        // Bearbeitungsbasis für die Konflikterkennung (Issue #52).
        this.loadedDateUpdated = this.text?.date_updated ?? null;

        // Load settings from localStorage
        this.loadSettings();
    },
    methods: {
        toggleSyllableEditMode() {
            this.syllableEditMode = !this.syllableEditMode;
        },

        toggleTextEditMode() {
            this.$emit('toggle-edit-mode');
        },

        toggleSyllableSymbols() {
            this.internalShowSyllableSymbols = !this.internalShowSyllableSymbols;
            this.saveSettings();
        },

        toggleSpacesAsDots() {
            this.internalShowSpacesAsDots = !this.internalShowSpacesAsDots;
            this.saveSettings();
        },

        toggleKiReview() {
            this.internalShowKiReview = !this.internalShowKiReview;
            this.saveSettings();
        },

        formatStropheText(text) {
            let formattedText = text;

            // Hide syllable symbols if option is disabled
            if (!this.effectiveShowSyllableSymbols) {
                formattedText = formattedText?.replace(/¬/g, '') || 'Kein Text';
            }

            // Replace spaces with dots if option is enabled
            if (this.effectiveShowSpacesAsDots) {
                formattedText = formattedText?.replace(/ /g, '·\u200B') || 'Kein Text';
            }

            return formattedText;
        },

        updateStrophe(index, updatedStrophen) {
            // Update the specific strophe when edited in syllable mode
            if (updatedStrophen && updatedStrophen.length > 0) {
                this.show_strophen[index] = {
                    ...this.show_strophen[index],
                    ...updatedStrophen[0],
                };

                // Save the updated strophen to the main text object
                this.store.updateTextStrophes(this.text.id, this.buildStrophenPayload());
            }
        },

        buildStrophenPayload() {
            return this.show_strophen.map((strophe) => {
                const payload = {
                    strophe: strophe.strophe,
                    aenderungsvorschlag: strophe.aenderungsvorschlag,
                    anmerkung: strophe.anmerkung,
                };
                if (strophe.kiReview) {
                    payload.kiReview = strophe.kiReview;
                }
                return payload;
            });
        },

        async onKiReviewChanged() {
            try {
                await this.store.updateTextStrophes(this.text.id, this.buildStrophenPayload());
            } catch (error) {
                console.error('Error saving KI review:', error);
            }
        },

        firstLine(text) {
            if (!text) return '';
            const line = text.split('\n')[0].trim();
            return line.length > 120 ? line.slice(0, 117) + '…' : line;
        },

        // Akzeptierte und abgelehnte KI-Reviews werden eingeklappt dargestellt
        // (Issue #63). Nur "Diskussion" und noch nicht bewertete Reviews bleiben
        // vollständig sichtbar.
        isCollapsedReview(review) {
            return (
                review.bewertungDurchMensch === 'accepted' ||
                review.bewertungDurchMensch === 'rejected'
            );
        },

        revertBewertung(review) {
            review.bewertungDurchMensch = null;
            this.onKiReviewChanged();
        },

        // Schreibt Text in die Zwischenablage (gemeinsame Util-Funktion mit
        // Fallback für ältere Browser / unsichere Kontexte). Liefert true bei Erfolg.
        writeToClipboard,

        copyToClipboard(text) {
            // Replace ¬ symbols with - symbols
            let textToCopy = text.replace(/¬/g, '-');
            // Ensure space after punctuation when followed by a letter (fixes missing spaces at line breaks)
            textToCopy = textToCopy.replace(/([.,;:!?])(?=[A-ZÄÖÜa-zäöüß])/g, '$1 ');

            // Only add space when the next line starts with a letter (continuation)
            textToCopy = textToCopy.replace(/([^\s])\n(?=[A-ZÄÖÜa-zäöüß])/g, '$1 \n');

            this.writeToClipboard(textToCopy);
        },

        // Strophen 2..n formatiert wie der Notentext-Export (ohne Silbentrennzeichen,
        // ohne Zeilenumbrüche, Strophen mit \n getrennt) in die Zwischenablage
        // kopieren – zur direkten Übernahme nach InDesign (Issue #61).
        async copyFollowupStrophen() {
            const textToCopy = formatStrophenForExport(this.text?.strophenEinzeln);
            if (!textToCopy) {
                this.showCopySnackbar('Keine Strophen 2–n zum Kopieren vorhanden.', 'warning');
                return;
            }
            const ok = await this.writeToClipboard(textToCopy);
            if (ok) {
                const count = textToCopy.split('\n').length;
                this.showCopySnackbar(
                    `${count} ${count === 1 ? 'Strophe' : 'Strophen'} (2–n) in die Zwischenablage kopiert.`,
                    'success',
                );
            } else {
                this.showCopySnackbar('Kopieren fehlgeschlagen.', 'error');
            }
        },

        showCopySnackbar(message, color) {
            this.copySnackbarMessage = message;
            this.copySnackbarColor = color;
            this.copySnackbar = true;
        },

        saveSettings() {
            localStorage.setItem(
                'strophen-show-syllable-symbols',
                JSON.stringify(this.internalShowSyllableSymbols),
            );
            localStorage.setItem(
                'strophen-show-spaces-as-dots',
                JSON.stringify(this.internalShowSpacesAsDots),
            );
            localStorage.setItem(
                'strophen-show-ki-review',
                JSON.stringify(this.internalShowKiReview),
            );
        },

        loadSettings() {
            const savedSyllableSymbols = localStorage.getItem('strophen-show-syllable-symbols');
            const savedSpacesAsDots = localStorage.getItem('strophen-show-spaces-as-dots');
            const savedKiReview = localStorage.getItem('strophen-show-ki-review');

            if (savedSyllableSymbols !== null) {
                this.internalShowSyllableSymbols = JSON.parse(savedSyllableSymbols);
            }

            if (savedSpacesAsDots !== null) {
                this.internalShowSpacesAsDots = JSON.parse(savedSpacesAsDots);
            }

            if (savedKiReview !== null) {
                this.internalShowKiReview = JSON.parse(savedKiReview);
            }
        },

        // Konflikterkennung (Issue #52): Vor dem Speichern prüfen, ob der Text seit
        // dem Bearbeitungsstart serverseitig verändert wurde. Falls ja, warnen und
        // den Nutzer entscheiden lassen (überschreiben oder abbrechen) – statt
        // stillschweigend fremde Änderungen zu überschreiben. Schlägt die Prüfung
        // selbst fehl (z. B. offline), wird normal gespeichert (best effort).
        async saveEditedStrophen() {
            this.saveError = null;
            this.checkingConflict = true;
            try {
                const remote = await this.store.getTextDateUpdated(this.text.id);
                const remoteDate = remote?.date_updated ?? null;
                if (this.loadedDateUpdated && remoteDate && remoteDate !== this.loadedDateUpdated) {
                    this.conflictInfo = { remoteDate };
                    this.conflictDialog = true;
                    this.checkingConflict = false;
                    return;
                }
            } catch (error) {
                console.warn('Konfliktprüfung fehlgeschlagen, speichere trotzdem:', error);
            } finally {
                this.checkingConflict = false;
            }

            await this.performSave();
        },

        // Trotz erkannten Konflikts speichern (überschreibt den fremden Stand).
        async forceSave() {
            this.conflictDialog = false;
            await this.performSave();
        },

        async performSave() {
            this.isSaving = true;
            this.saveError = null;

            try {
                // Save to Directus backend via store
                const result = await this.store.updateTextStrophes(
                    this.text.id,
                    this.editedStrophen.map((strophe, index) => {
                        const payload = {
                            strophe: strophe.strophe,
                            // Preserve original values for these fields
                            aenderungsvorschlag: this.show_strophen[index].aenderungsvorschlag,
                            anmerkung: this.show_strophen[index].anmerkung,
                        };
                        if (this.show_strophen[index].kiReview) {
                            payload.kiReview = this.show_strophen[index].kiReview;
                        }
                        return payload;
                    }),
                    {
                        korrekturlesung1: this.korrekturlesung1,
                        korrekturlesung1_alle_Strophen: this.korrekturlesung1_alle_Strophen,
                        korrekturlesung2: this.korrekturlesung2,
                    },
                );

                // Update local data only after successful save
                this.show_strophen = this.show_strophen.map((strophe, index) => ({
                    ...strophe,
                    strophe: this.editedStrophen[index].strophe,
                }));

                // Bearbeitungsbasis auf den frisch gespeicherten Stand setzen, damit
                // ein direkt folgendes Speichern nicht fälschlich als Konflikt gilt.
                const savedDate = result?.data?.date_updated;
                if (savedDate) this.loadedDateUpdated = savedDate;

                // Emit event to close edit mode
                this.$emit('edit-completed');
            } catch (error) {
                console.error('Error saving strophen:', error);
                this.saveError =
                    'Fehler beim Speichern der Änderungen. Bitte versuchen Sie es erneut.';
            } finally {
                this.isSaving = false;
            }
        },

        cancelEdit() {
            // Reset edited strophen
            this.editedStrophen = _.cloneDeep(this.show_strophen);
            // Reset korrekturlesung flags
            this.syncKorrekturlesung(this.text);
            this.saveError = null;
            // Emit event to close edit mode
            this.$emit('edit-completed');
        },

        // Übernimmt die Korrekturlesungs-Flags aus einem Text-Objekt in die lokalen
        // Checkboxen (Issue #20).
        syncKorrekturlesung(text) {
            this.korrekturlesung1 = text?.korrekturlesung1 || false;
            this.korrekturlesung1_alle_Strophen = text?.korrekturlesung1_alle_Strophen || false;
            this.korrekturlesung2 = text?.korrekturlesung2 || false;
        },
    },
};
</script>

<style scoped>
.bigger_text {
    font-size: 1.3rem;
}

.hover-border:hover {
    box-shadow:
        rgba(255, 255, 255, 0.2) 0px 0px 0px 1px inset,
        rgba(0, 0, 0, 0.9) 0px 0px 0px 1px;
    transition: box-shadow 0.3s ease-in-out;
    cursor: pointer;
    border-radius: 4px;
}

.copy-button:hover {
    transform: scale(1.1);
    transition: transform 0.2s ease-in-out;
}

.ki-review-collapsed {
    opacity: 0.55;
    filter: grayscale(1);
    transition:
        opacity 0.2s ease-in-out,
        filter 0.2s ease-in-out;
}

.ki-review-collapsed:hover {
    opacity: 1;
    filter: grayscale(0);
}

.ki-review-eye {
    display: none;
}

/* Show on row hover, and keep visible while the menu is open so it
   doesn't lose its anchor (aria-expanded is set by Vuetify's activator). */
.ki-review-collapsed:hover .ki-review-eye,
.ki-review-eye[aria-expanded='true'] {
    display: inline-flex;
}

.ki-review-collapsed-text {
    font-size: 0.8rem;
    color: rgba(0, 0, 0, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1 1 auto;
    min-width: 0;
}
</style>
