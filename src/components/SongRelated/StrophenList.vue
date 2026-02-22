<template>
    <div v-if="includeTitle" class="text-h6 mx-auto mb-1 d-flex align-center">
        <span class="me-2"> Strophen </span>
        <div v-if="isAdmin && isAdminView" class="d-flex ga-2">
            <v-tooltip text="Silbenmodus bearbeiten" location="bottom">
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
        </div>
        <!-- Syllable Edit Mode -->
        <div v-else>
            <SyllableEditList
                :text="{ strophenEinzeln: [strophe] }"
                :include-title="false"
                :show-syllable-symbols="effectiveShowSyllableSymbols"
                :show-spaces-as-dots="effectiveShowSpacesAsDots"
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
        <v-checkbox
            v-model="korrekturlesung1"
            label="Korrektur gelesen"
            color="primary"
            density="compact"
            hide-details
        />
        <div class="d-flex ga-2">
            <v-btn
                color="primary"
                variant="elevated"
                :loading="isSaving"
                :disabled="isSaving"
                @click="saveEditedStrophen"
            >
                <v-icon start>mdi-content-save</v-icon>
                Speichern
            </v-btn>
            <v-btn color="grey" variant="outlined" :disabled="isSaving" @click="cancelEdit">
                <v-icon start>mdi-close</v-icon>
                Abbrechen
            </v-btn>
        </div>
    </div>
</template>

<script>
import _ from 'lodash';
import SyllableEditList from './SyllableEditList.vue';
import { useAppStore } from '@/store/app';
import { useUserStore } from '@/store/user';

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
        syllableEditMode: false,
        internalShowSyllableSymbols: false,
        internalShowSpacesAsDots: false,
        editedStrophen: [],
        isSaving: false,
        saveError: null,
        korrekturlesung1: false,
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
    },
    mounted() {
        this.show_strophen = _.map(this.text?.strophenEinzeln, (obj) => ({
            ...obj,
            show: this.showExtraStrophenData,
        }));

        // Initialize edited strophen as deep copy
        this.editedStrophen = _.cloneDeep(this.show_strophen);

        // Initialize korrekturlesung1 from text object
        this.korrekturlesung1 = this.text?.korrekturlesung1 || false;

        // Load settings from localStorage
        this.loadSettings();
    },
    watch: {
        editMode(newVal) {
            if (newVal) {
                // Reset edited strophen when entering edit mode
                this.editedStrophen = _.cloneDeep(this.show_strophen);
                // Reset korrekturlesung1 from text object
                this.korrekturlesung1 = this.text?.korrekturlesung1 || false;
            }
        },
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
                this.store.updateTextStrophes(
                    this.text.id,
                    this.show_strophen.map((strophe) => ({
                        strophe: strophe.strophe,
                        aenderungsvorschlag: strophe.aenderungsvorschlag,
                        anmerkung: strophe.anmerkung,
                    })),
                );
            }
        },

        copyToClipboard(text) {
            // Replace ¬ symbols with - symbols
            let textToCopy = text.replace(/¬/g, '-');
            // Ensure space after punctuation when followed by a letter (fixes missing spaces at line breaks)
            textToCopy = textToCopy.replace(/([.,;:!?])(?=[A-ZÄÖÜa-zäöüß])/g, '$1 ');

            // Only add space when the next line starts with a letter (continuation)
            textToCopy = textToCopy.replace(/([^\s])\n(?=[A-ZÄÖÜa-zäöüß])/g, '$1 \n');

            if (navigator.clipboard && window.isSecureContext) {
                // Use the modern clipboard API
                navigator.clipboard
                    .writeText(textToCopy)
                    .then(() => {
                        // Optional: Show a success message or toast
                        console.log('Text copied to clipboard successfully');
                    })
                    .catch((err) => {
                        console.error('Failed to copy text: ', err);
                    });
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    console.log('Text copied to clipboard successfully (fallback)');
                } catch (err) {
                    console.error('Failed to copy text (fallback): ', err);
                }
                document.body.removeChild(textArea);
            }
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
        },

        loadSettings() {
            const savedSyllableSymbols = localStorage.getItem('strophen-show-syllable-symbols');
            const savedSpacesAsDots = localStorage.getItem('strophen-show-spaces-as-dots');

            if (savedSyllableSymbols !== null) {
                this.internalShowSyllableSymbols = JSON.parse(savedSyllableSymbols);
            }

            if (savedSpacesAsDots !== null) {
                this.internalShowSpacesAsDots = JSON.parse(savedSpacesAsDots);
            }
        },

        async saveEditedStrophen() {
            this.isSaving = true;
            this.saveError = null;

            try {
                // Save to Directus backend via store
                await this.store.updateTextStrophes(
                    this.text.id,
                    this.editedStrophen.map((strophe, index) => ({
                        strophe: strophe.strophe,
                        // Preserve original values for these fields
                        aenderungsvorschlag: this.show_strophen[index].aenderungsvorschlag,
                        anmerkung: this.show_strophen[index].anmerkung,
                    })),
                    this.korrekturlesung1,
                );

                // Update local data only after successful save
                this.show_strophen = this.show_strophen.map((strophe, index) => ({
                    ...strophe,
                    strophe: this.editedStrophen[index].strophe,
                }));

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
            // Reset korrekturlesung1
            this.korrekturlesung1 = this.text?.korrekturlesung1 || false;
            this.saveError = null;
            // Emit event to close edit mode
            this.$emit('edit-completed');
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
</style>
