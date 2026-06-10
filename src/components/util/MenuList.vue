<template>
    <v-list
        :rounded="rounded ? 'lg' : 'none'"
        :lines="false"
        nav
        density="compact"
        color="primary"
        class="menu-list"
    >
        <template v-for="(section, sIndex) in visibleSections" :key="section.title || 'main'">
            <v-divider v-if="sIndex > 0" class="my-1" />
            <v-list-subheader v-if="section.title" class="menu-subheader text-uppercase">
                {{ section.title }}
            </v-list-subheader>

            <v-list-item v-for="item in section.items" :key="item.route" :to="item.route">
                <template #prepend>
                    <v-icon :icon="item.icon" />
                </template>
                <v-list-item-title class="text-wrap">
                    <span v-html="item.name" />
                </v-list-item-title>
            </v-list-item>
        </template>

        <v-divider class="my-1" />

        <v-list-item link @click="logout">
            <template #prepend>
                <v-icon class="text-red">mdi-logout</v-icon>
            </template>
            <v-list-item-title class="text-red">Logout</v-list-item-title>
        </v-list-item>
    </v-list>
</template>

<script>
import { useUserStore } from '@/store/user';

const notentextRoles = (import.meta.env.VITE_NOTENTEXT_ROLES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export default {
    name: 'MenuList',
    props: {
        rounded: {
            type: Boolean,
            default: false,
        },
    },
    data: () => ({
        userStore: useUserStore(),
        // Menüeinträge nach Bereichen gruppiert. `public: false` => nur im
        // Kleiner-Kreis-Modus sichtbar. `requiredRoles` schränkt einzelne Einträge
        // zusätzlich auf bestimmte Rollen ein.
        sections: [
            {
                public: true,
                items: [
                    { name: 'Dashboard', route: '/dashboard', icon: 'mdi-home' },
                    { name: 'Kalender', route: '/kalender', icon: 'mdi-calendar-month' },
                    { name: 'Gesangbuch<wbr>lieder', route: '/gesangbuchlieder', icon: 'mdi-music' },
                    {
                        name: 'Neue Lieder &amp; Melodien',
                        route: '/neue-lieder',
                        icon: 'mdi-new-box',
                    },
                    { name: 'Fokusmodus', route: '/fokusmodus', icon: 'mdi-microphone-variant' },
                    {
                        name: 'Arbeitsaufträge',
                        route: '/arbeitsauftraege',
                        icon: 'mdi-file-document-outline',
                    },
                ],
            },
            {
                title: 'Hochladen',
                public: true,
                items: [
                    {
                        name: 'Lied/Text/Melodie <wbr>hochladen',
                        route: '/gesangbuchliedhochladen',
                        icon: 'mdi-upload',
                    },
                    {
                        name: 'Änderung eintragen',
                        route: '/aenderunghochladen',
                        icon: 'mdi-pencil',
                    },
                ],
            },
            {
                title: 'Kleiner Kreis',
                public: false,
                items: [
                    {
                        name: 'Doppelte Einträge',
                        route: '/doppelteeintraege',
                        icon: 'mdi-content-copy',
                    },
                    {
                        name: 'Verlorene Einträge',
                        route: '/missing-match',
                        icon: 'mdi-select-search',
                    },
                    {
                        name: 'Text Melodie Verteilung',
                        route: '/text-melodie-verteilung',
                        icon: 'mdi-chart-bar',
                    },
                    {
                        name: 'Checks &amp; Validierung',
                        route: '/checks',
                        icon: 'mdi-clipboard-check',
                    },
                    {
                        name: 'Autoren-Datencheck',
                        route: '/autoren-datencheck',
                        icon: 'mdi-account-search',
                    },
                    {
                        name: 'Notentext-Export',
                        route: '/notentext-export',
                        icon: 'mdi-file-music',
                        requiredRoles: notentextRoles,
                    },
                    {
                        name: 'Notentext-Hochladen',
                        route: '/notentext-hochladen',
                        icon: 'mdi-cloud-upload',
                        requiredRoles: notentextRoles,
                    },
                ],
            },
        ],
    }),
    computed: {
        visibleSections() {
            return this.sections
                .map((section) => {
                    const sectionVisible =
                        section.public || (this.isKleinerKreis && this.isKleinerKreisAnsicht);
                    if (!sectionVisible) return null;

                    const items = section.items.filter((item) =>
                        item.requiredRoles && item.requiredRoles.length > 0
                            ? this.userStore.has_role(item.requiredRoles)
                            : true,
                    );
                    if (items.length === 0) return null;

                    return { ...section, items };
                })
                .filter(Boolean);
        },
        isKleinerKreis() {
            return this.userStore.is_kleiner_kreis;
        },
        isKleinerKreisAnsicht() {
            return this.userStore.is_kleiner_kreis_ansicht;
        },
    },
    methods: {
        logout() {
            this.userStore.logout();
        },
    },
};
</script>

<style scoped lang="scss">
.menu-list {
    padding-block: 4px;
}

:deep(.menu-subheader) {
    min-height: 26px;
    padding-block: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    opacity: 0.6;
}
</style>
