<template>
    <v-main>
        <v-container fluid class="main-container">
            <v-row>
                <v-col v-if="$vuetify.display.lgAndUp" cols="2">
                    <v-sheet rounded="lg" class="nav-sheet">
                        <MenuList rounded />
                    </v-sheet>
                </v-col>

                <v-col cols="12" lg="10">
                    <v-sheet rounded="lg" class="content-sheet">
                        <!-- <v-container>
            </v-container> -->
                        <div class="pa-4">
                            <router-view />
                        </div>

                        <v-divider class="my-4"></v-divider>

                        <footer-bar />
                    </v-sheet>
                </v-col>
            </v-row>
        </v-container>
    </v-main>
</template>

<script setup>
import MenuList from '@/components/util/MenuList.vue';
import FooterBar from '@/layouts/new/FooterBar.vue';
</script>

<style>
.main-container {
    max-width: 1600px;
}

.nav-sheet {
    position: sticky;
    top: 80px;
    /* Bei niedrigen Viewports innerhalb der Seitenleiste scrollen, statt unten
       aus dem sichtbaren Bereich zu laufen. */
    max-height: calc(100vh - 96px);
    overflow-y: auto;
}

.content-sheet {
    min-height: 70vh;
    display: flex;
    flex-direction: column;
}
</style>
