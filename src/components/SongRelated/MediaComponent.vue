<script>
import VuePdfEmbed from 'vue-pdf-embed';
import VuePdfApp from 'vue3-pdf-app';
// import this to use default icons for buttons
import 'vue3-pdf-app/dist/icons/main.css';

export default {
    name: 'MediaComponent',
    components: { VuePdfEmbed, VuePdfApp },
    props: {
        file: {
            type: Object,
            required: true,
        },
        screenMode: {
            type: String,
            default: null,
        },
        maxHeight: {
            type: Number,
            default: null,
        },
    },
    emits: ['fullscreen_pdf'],
    data: () => ({
        maxWidth: 100,
        image_zoom: 1,
        is_panning: false,
        pan_start: null,
        config: {
            secondaryToolbar: {
                cursorSelectTool: false,
                secondaryPresentationMode: false,
            },
            toolbar: {
                toolbarViewerRight: {
                    openFile: false,
                },
            },
        },
    }),
    computed: {
        zoom_is_image() {
            return this.screenMode === 'sing-mode' && this.file && this.is_image(this.file);
        },
        zoom_minus_disabled() {
            return this.zoom_is_image ? this.image_zoom <= 1 : this.maxWidth === 20;
        },
        zoom_plus_disabled() {
            return this.zoom_is_image ? this.image_zoom >= 4 : this.maxWidth === 100;
        },
    },
    watch: {
        file() {
            this.image_zoom = 1;
        },
    },
    methods: {
        changeToHandTool(pdfApp) {
            pdfApp.pdfCursorTools.switchTool(1);
        },
        is_audio(file) {
            // include audio and add opus
            return file.type.includes('audio') || file.type.includes('application/octet-stream');
        },
        is_opus(file) {
            return file.type.includes('application/octet-stream');
        },
        is_video(file) {
            return file.type.includes('video');
        },
        is_image(file) {
            return file.type.includes('image');
        },
        getPdfUrl(file_id) {
            return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}.pdf`;
        },
        getImgUrl(file_id) {
            return `${import.meta.env.VITE_BACKEND_URL}/assets/${file_id}`;
        },
        fullscreen_pdf(event, file) {
            this.$emit('fullscreen_pdf', event, file);
        },
        // Images in sing-mode use the scroll+zoom pattern (1×–4×, pannable);
        // video/audio still use the maxWidth percentage clamp.
        zoomMinus() {
            if (this.zoom_is_image) {
                this.image_zoom = Math.max(this.image_zoom - 0.25, 1);
            } else {
                this.maxWidth = this.maxWidth - 5 < 20 ? this.maxWidth : this.maxWidth - 5;
            }
        },
        zoomPlus() {
            if (this.zoom_is_image) {
                this.image_zoom = Math.min(this.image_zoom + 0.25, 4);
            } else {
                this.maxWidth = this.maxWidth + 5 > 100 ? this.maxWidth : this.maxWidth + 5;
            }
        },
        onPanStart(e) {
            if (this.image_zoom <= 1) return;
            this.is_panning = true;
            this.pan_start = {
                x: e.clientX,
                y: e.clientY,
                scrollLeft: e.currentTarget.scrollLeft,
                scrollTop: e.currentTarget.scrollTop,
            };
            e.preventDefault();
        },
        onPanMove(e) {
            if (!this.is_panning) return;
            e.currentTarget.scrollLeft = this.pan_start.scrollLeft - (e.clientX - this.pan_start.x);
            e.currentTarget.scrollTop = this.pan_start.scrollTop - (e.clientY - this.pan_start.y);
        },
        onPanEnd() {
            this.is_panning = false;
        },
    },
};
</script>

<template>
    <div
        v-if="screenMode === 'sing-mode' && file?.type !== 'application/pdf'"
        style="position: absolute; z-index: 20"
        class="pl-5 pt-2 position-relative"
    >
        <v-btn
            icon="mdi-magnify-minus-outline"
            variant="text"
            :disabled="zoom_minus_disabled"
            color="primary"
            @click="zoomMinus"
        />
        <v-btn
            icon="mdi-magnify-plus-outline"
            variant="text"
            :disabled="zoom_plus_disabled"
            color="primary"
            @click="zoomPlus"
        />
    </div>
    <div v-if="file?.type === 'application/pdf'" class="h-100">
        <div v-if="screenMode === 'sing-mode'" class="h-100">
            <vue-pdf-app
                ref="pdfApp"
                :config="config"
                :pdf="getPdfUrl(file.id)"
                theme="light"
                @pages-rendered="changeToHandTool"
            ></vue-pdf-app>
        </div>
        <div
            v-else
            class="d-flex align-center justify-center fill-height"
            :class="{ 'bg-surface-light': screenMode !== 'sing-mode' && screenMode !== 'print' }"
        >
            <vue-pdf-embed
                :height="screenMode === 'print' && maxHeight ? maxHeight : 300"
                :source="getPdfUrl(file.id)"
                :page="1"
                :style="screenMode === 'print' ? '' : 'cursor: pointer'"
                @click="screenMode !== 'print' ? fullscreen_pdf($event, file) : null"
            />
        </div>
    </div>
    <div v-else-if="is_audio(file)" class="d-flex flex-column align-center justify-center h-100">
        <div>
            <div class="text-h6 mb-3">
                {{ file.title }}
            </div>
            <div class="d-flex align-center justify-center">
                <v-icon class="me-4" size="40">mdi-music-note-eighth</v-icon>
                <audio controls>
                    <source
                        v-if="is_opus(file)"
                        :src="getImgUrl(file.id)"
                        type="audio/ogg; codecs=opus"
                    />
                    <source v-else :src="getImgUrl(file.id)" :type="file.type" />
                </audio>
            </div>
        </div>
    </div>
    <div v-else-if="is_video(file)" class="d-flex flex-column align-center justify-center h-100">
        <div>
            <div class="text-h6 mb-3">
                {{ file.title }}
            </div>
            <div class="d-flex align-center justify-center">
                <div :style="{ maxWidth: `${maxWidth}%` }">
                    <video controls>
                        <source :src="getImgUrl(file.id)" :type="file.type" />
                    </video>
                </div>
            </div>
        </div>
    </div>
    <div
        v-else-if="is_image(file) && screenMode === 'sing-mode'"
        class="d-flex flex-column h-100"
    >
        <div class="text-h6 mb-3 pt-5 text-center px-10">{{ file.title }}</div>
        <div class="sing-zoom-outer flex-grow-1">
            <div
                class="sing-zoom-scroll"
                :class="{ 'is-zoomed': image_zoom > 1, 'is-panning': is_panning }"
                @mousedown="onPanStart"
                @mousemove="onPanMove"
                @mouseup="onPanEnd"
                @mouseleave="onPanEnd"
            >
                <div
                    class="sing-zoom-wrapper"
                    :style="{
                        width: `${image_zoom * 100}%`,
                        height: `${image_zoom * 100}%`,
                    }"
                >
                    <img
                        :src="getImgUrl(file.id)"
                        alt="Bild"
                        class="sing-zoom-image"
                        draggable="false"
                    />
                </div>
            </div>
        </div>
    </div>
    <div
        v-else-if="is_image(file) && screenMode === 'print'"
        class="d-flex flex-column align-center h-100"
    >
        <div>
            <div class="d-flex align-center justify-center">
                <div
                    :style="{
                        maxWidth: `${maxWidth}%`,
                        maxHeight: maxHeight ? `${maxHeight}px` : 'none'
                    }"
                >
                    <img
                        :src="getImgUrl(file.id)"
                        alt="Bild"
                        :style="{
                            maxHeight: maxHeight ? `${maxHeight}px` : '100%',
                            maxWidth: '100%',
                            objectFit: 'contain'
                        }"
                    />
                </div>
            </div>
        </div>
    </div>
    <div v-else-if="!is_image(file)">
        <div class="d-flex flex-column align-center justify-center h-100">
            <v-icon size="40">mdi-file</v-icon>
            <div class="text-h6">
                {{ file.title }}
            </div>
            <div class="text-subtitle-2">
                Dieses Dateiformat wird aktuell noch nicht unterstützt.
            </div>
            <div class="text-subtitle-2">
                {{ file.type }}
            </div>
        </div>
    </div>
</template>

<style scoped>
/* sing-mode image zoom: same scroll+zoom pattern as NotenCarousel, so a small
 * SVG can actually be made larger (1×–4×) and panned around when zoomed. */
.sing-zoom-outer {
    position: relative;
    width: 100%;
    overflow: hidden;
    min-height: 0;
}
.sing-zoom-scroll {
    position: absolute;
    inset: 0;
    overflow: auto;
}
.sing-zoom-scroll.is-zoomed {
    cursor: grab;
}
.sing-zoom-scroll.is-panning {
    cursor: grabbing;
}
.sing-zoom-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 100%;
    min-height: 100%;
    transition:
        width 0.15s ease,
        height 0.15s ease;
    padding: 8px;
    box-sizing: border-box;
}
.sing-zoom-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
}
</style>
