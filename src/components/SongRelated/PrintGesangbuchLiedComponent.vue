<template>
    <div class="print-song-container">
        <!-- Categories - Top Right -->
        <div class="categories-section">
            <v-chip
                v-for="(category, index) in selectedSong?.kategories"
                :key="index"
                size="small"
                :prepend-icon="gesangbuch_kategorie_name_to_icon(category?.kategorie_name?.name)"
                :style="{ 'background-color': get_color(category) }"
                class="me-1"
            >
                {{ category?.kategorie_name?.name }}
            </v-chip>
        </div>

        <!-- Title -->
        <h1 class="song-title">
            {{ selectedSong?.gesangbuch_titel }}
        </h1>

        <!-- First Note/Image from Carousel -->
        <div v-if="firstCarouselFile" class="notes-section">
          <NotenCarousel
                :melodie="selectedSong?.melodie"
                :gesangbuchlied-satz-mit-melodie-und-text="
                    selectedSong?.gesangbuchlied_satz_mit_melodie_und_text
                "
                :print="true"
            />
        </div>

        <!-- Verses with Annotations -->
        <div class="verses-section">
            <h2 class="section-title">Strophen</h2>
            <div
                v-for="(strophe, index) in selectedSong?.text?.strophenEinzeln"
                :key="index"
                class="verse-row"
            >
                <div class="verse-content">
                    <div class="verse-number">{{ index + 1 }}.</div>
                    <div class="verse-text">
                        {{ formatStropheText(strophe.strophe) }}
                    </div>
                </div>
                <div v-if="strophe.anmerkung" class="verse-annotation">
                    <v-icon icon="mdi-message" size="x-small" class="me-1" />
                    <span>{{ strophe.anmerkung }}</span>
                </div>
            </div>
        </div>

        <!-- Authors -->
        <div class="authors-section">
            <div
                v-for="(author_source, index_1) in [
                    { name: 'Text', src: selectedSong?.text?.authors },
                    { name: 'Melodie', src: selectedSong?.melodie?.authors },
                ]"
                :key="index_1"
            >
                <div v-if="author_source?.src?.length" class="author-group">
                    <h3 class="author-type">{{ author_source.name }} Autor</h3>
                    <div
                        v-for="(author, index) in author_source.src"
                        :key="index"
                        class="author-item"
                    >
                        <span class="author-number">{{ index + 1 }}.</span>
                        <span class="author-name">
                            {{ author.vorname }} {{ author.nachname }}
                            {{
                                author.geburtsjahr || author.sterbejahr
                                    ? ` (${author.geburtsjahr ? '*' + author.geburtsjahr : ''}${author.sterbejahr ? ' - ' + author.sterbejahr : ''})`
                                    : ''
                            }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Submitter -->
        <div v-if="selectedSong?.einreicherName" class="submitter-section">
            <span class="label">Eingereicht von:</span>
            <span>{{ selectedSong?.einreicherName }}</span>
        </div>

        <!-- General Annotations -->
        <div
            v-if="
                selectedSong?.anmerkung ||
                selectedSong?.text?.anmerkung ||
                selectedSong?.melodie?.anmerkung
            "
            class="general-annotations"
        >
            <h3 class="section-subtitle">Anmerkung:</h3>
            <div v-if="selectedSong?.anmerkung" class="annotation-item">
                {{ selectedSong?.anmerkung }}
            </div>
            <div v-if="selectedSong?.text?.anmerkung" class="annotation-item">
                <v-icon icon="mdi-text-box" size="small" class="me-2" />
                {{ selectedSong?.text.anmerkung }}
            </div>
            <div v-if="selectedSong?.melodie?.anmerkung" class="annotation-item">
                <v-icon icon="mdi-music" size="small" class="me-2" />
                {{ selectedSong?.melodie.anmerkung }}
            </div>
        </div>

        <!-- Gesangbuch 2000 Reference -->
        <div v-if="selectedSong?.liednummer2000" class="gb2000-section">
            <span class="label">Gesangbuchlied 2000:</span>
            <span>{{ selectedSong?.liednummer2000 }}</span>
            <span v-if="selectedSong?.melodieGeaendert || selectedSong?.textGeaendert"> mit </span>
            <v-icon v-if="selectedSong?.melodieGeaendert" icon="mdi-music-box" size="small" />
            <span v-if="selectedSong?.melodieGeaendert && selectedSong?.textGeaendert"> und </span>
            <v-icon v-if="selectedSong?.textGeaendert" icon="mdi-text-box-edit" size="small" />
            <span v-if="selectedSong?.melodieGeaendert || selectedSong?.textGeaendert">
                geändert.
            </span>
        </div>

        <!-- Copyright Check Alert -->
        <div v-if="selectedSong?.autor_oder_copyright_checken" class="copyright-alert">
            <v-alert
                type="warning"
                title="Autor/Copyright prüfen"
                text="Dieses Lied muss auf Autor oder Copyright geprüft werden."
                density="compact"
            />
        </div>
    </div>
</template>

<script>
import NotenCarousel from '@/components/SongRelated/NotenCarousel.vue';
import { gesangbuch_kategorie_name_to_icon, chart_colors } from '@/assets/js/utils';
import _ from 'lodash';

export default {
    name: 'PrintGesangbuchLiedComponent',
    components: {
        NotenCarousel,
    },
    props: {
        selectedSong: {
            type: Object,
            required: true,
        },
    },
    computed: {
        firstCarouselFile() {
            const files = _.concat(
                _.map(this.selectedSong?.gesangbuchlied_satz_mit_melodie_und_text, (obj) => ({
                    ...obj,
                    from_melodie: false,
                })),
                _.map(this.selectedSong?.melodie?.files, (obj) => ({
                    ...obj,
                    from_melodie: true,
                })),
            );
            const uniqueFiles = _.uniqBy(files, 'id');
            return uniqueFiles.length > 0 ? uniqueFiles[0] : null;
        },
    },
    methods: {
        gesangbuch_kategorie_name_to_icon,
        get_color(category) {
            return chart_colors[category.id % chart_colors.length];
        },
        formatStropheText(text) {
            if (!text) return '';
            // Remove syllable symbols for print
            return text.replace(/¬/g, '');
        },
    },
};
</script>

<style scoped>
.print-song-container {
    width: 210mm; /* A4 width */
    min-height: 297mm; /* A4 height */
    padding: 15mm;
    background: white;
    box-sizing: border-box;
    position: relative;
    page-break-after: always;
}

/* Categories - Top Right */
.categories-section {
    position: absolute;
    top: 15mm;
    right: 15mm;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 50%;
    justify-content: flex-end;
}

/* Title */
.song-title {
    font-size: 24pt;
    font-weight: bold;
    margin-bottom: 15px;
    margin-top: 0;
    padding-right: 50%; /* Make room for categories */
}

/* Notes Section */
.notes-section {
    /* max-height: 20vh; /* 20% of viewport height, approximately 20% of A4 */
    width: 100%;
    margin-bottom: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

/* Verses Section */
.verses-section {
    margin-bottom: 20px;
}

.section-title {
    font-size: 14pt;
    font-weight: 600;
    margin-bottom: 10px;
    margin-top: 0;
}

.verse-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 15px;
    margin-bottom: 12px;
    page-break-inside: avoid; /* Keep verse and annotation together */
}

.verse-content {
    display: flex;
    gap: 10px;
}

.verse-number {
    font-weight: 600;
    min-width: 25px;
    flex-shrink: 0;
}

.verse-text {
    white-space: pre-line;
    line-height: 1.5;
}

.verse-annotation {
    font-size: 9pt;
    color: #666;
    font-style: italic;
    display: flex;
    align-items: flex-start;
    max-width: 200px;
    padding: 4px 8px;
    background-color: #f5f5f5;
    border-radius: 4px;
}

/* Authors Section */
.authors-section {
    margin-bottom: 15px;
}

.author-group {
    margin-bottom: 10px;
}

.author-type {
    font-size: 11pt;
    font-weight: 600;
    margin-bottom: 5px;
    margin-top: 0;
}

.author-item {
    display: flex;
    gap: 5px;
    margin-bottom: 3px;
    font-size: 10pt;
}

.author-number {
    font-weight: 500;
}

/* Submitter Section */
.submitter-section {
    margin-bottom: 10px;
    font-size: 10pt;
}

/* General Annotations */
.general-annotations {
    margin-bottom: 15px;
}

.section-subtitle {
    font-size: 11pt;
    font-weight: 600;
    margin-bottom: 5px;
    margin-top: 0;
}

.annotation-item {
    font-size: 10pt;
    margin-bottom: 5px;
    white-space: pre-wrap;
    display: flex;
    align-items: flex-start;
}

/* GB2000 Section */
.gb2000-section {
    margin-bottom: 10px;
    font-size: 10pt;
}

/* Copyright Alert */
.copyright-alert {
    margin-top: 15px;
}

/* Common */
.label {
    font-weight: 600;
    margin-right: 5px;
}

/* Print Styles */
@media print {
    .print-song-container {
        width: 100%;
        min-height: 100vh;
        margin: 0;
        padding: 15mm;
        page-break-after: always;
    }

    .notes-section {
        max-height: 60mm; /* Fixed height for print */
    }

    /* Ensure verses don't break awkwardly */
    .verse-row {
        page-break-inside: avoid;
    }

    /* If there are too many verses, they will flow to next page automatically */
    /* This is handled by the browser's print engine */
}

/* Screen view - show page boundaries */
@media screen {
    .print-song-container {
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        margin: 20px auto;
    }
}
</style>
