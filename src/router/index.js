// Composables
import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/store/user';

const notentextRoles = (import.meta.env.VITE_NOTENTEXT_ROLES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Rollen mit Zugriff auf die Superadmin-Werkzeuge (z. B. Nummerngenerierung).
// Standard: "Administrator", falls VITE_SUPERADMIN_ROLES nicht gesetzt ist.
const superadminRoles = (import.meta.env.VITE_SUPERADMIN_ROLES || 'Administrator')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const routes = [
    {
        path: '/',
        component: () => import('@/layouts/new/DefaultLayout.vue'),
        meta: { requiresAuth: true },
        children: [
            {
                path: '/',
                redirect: '/dashboard',
            },
            {
                path: 'dashboard',
                name: 'Dashboard',
                component: () => import(/* webpackChunkName: "home" */ '@/views/DashboardView.vue'),
            },
            {
                path: 'gesangbuchliedhochladen',
                name: 'GesangbuchliedHochladen',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/UploadFormView.vue'),
            },
            {
                path: 'aenderunghochladen',
                name: 'AenderungHochladen',
                component: () => import(/* webpackChunkName: "home" */ '@/views/ChangeForm.vue'),
            },
            {
                path: 'kalender',
                name: 'Kalender',
                component: () => import(/* webpackChunkName: "home" */ '@/views/KalenderView.vue'),
            },
            {
                path: 'arbeitsauftraege',
                name: 'Arbeitsaufträge',
                component: () => import(/* webpackChunkName: "home" */ '@/views/WorkorderView.vue'),
            },
            {
                path: 'gesangbuchlieder/:id?',
                name: 'Gesangbuchlieder',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/SongOverviewView.vue'),
            },
            {
                path: 'lied/:id',
                name: 'LiedDetail',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/SongDetailView.vue'),
            },
            {
                path: 'fokusmodus',
                name: 'Fokusmodus',
                component: () => import(/* webpackChunkName: "home" */ '@/views/SingModeView.vue'),
            },
            {
                path: 'doppelteeintraege',
                name: 'DoubleEntries',
                component: () => import(/* webpackChunkName: "home" */ '@/views/DoubleEntries.vue'),
            },
            {
                path: 'missing-match',
                name: 'MissingMatches',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/MissingMatching.vue'),
            },
            {
                path: 'text-melodie-verteilung/:id?',
                name: 'TextMelodieVerteilung',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/TextMelodieVerteilung.vue'),
            },
            {
                path: 'neue-lieder/:id?',
                name: 'NeueLieder',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/NeueLiederView.vue'),
            },
            {
                path: 'korrektur-lesung/:id?',
                name: 'CorrectionReading',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/CorrectionView.vue'),
            },
            {
                path: 'autoren-datencheck/:id?',
                name: 'AutorenDatencheck',
                component: () =>
                    import(
                        /* webpackChunkName: "home" */ '@/views/AutorenDatencheckView.vue'
                    ),
            },
            {
                path: 'autoren-mailing',
                name: 'AutorenMailing',
                component: () =>
                    import(/* webpackChunkName: "home" */ '@/views/AutorenMailingView.vue'),
            },
            {
                path: 'checks/:id?',
                name: 'Checks',
                component: () =>
                    import(/* webpackChunkName: "checks" */ '@/views/GesangbuchChecksView.vue'),
            },
            {
                path: 'notentext-export/:id?',
                name: 'NotentextExport',
                meta: { requiredRoles: notentextRoles },
                component: () =>
                    import(/* webpackChunkName: "noten-export" */ '@/views/NotenExportView.vue'),
            },
            {
                path: 'inhaltsverzeichnis-export',
                name: 'InhaltsverzeichnisExport',
                meta: { requiredRoles: notentextRoles },
                component: () =>
                    import(
                        /* webpackChunkName: "inhaltsverzeichnis-export" */ '@/views/InhaltsverzeichnisExportView.vue'
                    ),
            },
            {
                path: 'notentext-hochladen',
                name: 'NotentextHochladen',
                meta: { requiredRoles: notentextRoles },
                component: () =>
                    import(
                        /* webpackChunkName: "noten-upload" */ '@/views/NotentextUploadView.vue'
                    ),
            },
            {
                path: 'nummerngenerierung',
                name: 'Nummerngenerierung',
                meta: { requiredRoles: superadminRoles },
                component: () =>
                    import(
                        /* webpackChunkName: "nummerngenerierung" */ '@/views/NummerngenerierungView.vue'
                    ),
            },
        ],
    },
    {
        path: '/druckansicht',
        name: 'PrintView',
        component: () => import(/* webpackChunkName: "home" */ '@/views/PrintView.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/copyright-pruefen-druckansicht',
        name: 'CopyrightCheckPrintView',
        component: () =>
            import(/* webpackChunkName: "home" */ '@/views/CopyrightCheckPrintView.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import(/* webpackChunkName: "home" */ '@/views/LoginPage.vue'),
        meta: { requiresAuth: false },
    },
    {
        path: '/*',
        redirect: '/',
    },
    // 404 path to redirect to home
    {
        path: '/:pathMatch(.*)*',
        redirect: '/',
    },
];

const router = createRouter({
    history: createWebHistory(process.env.BASE_URL),
    routes,
});

router.beforeEach(async (to, from, next) => {
    const user_store = useUserStore();
    await user_store.autoLogin();
    if (to.matched.some((record) => record.meta.requiresAuth)) {
        if (!user_store.is_logged_in) {
            console.log('Not logged in');
            next({ path: '/login', query: { redirect: to.fullPath } });
            return;
        }
        const required = to.meta.requiredRoles;
        if (required && required.length > 0 && !user_store.has_role(required)) {
            console.log(`Access denied to ${to.fullPath} — required roles: ${required.join(', ')}`);
            next({ path: '/dashboard' });
            return;
        }
    }
    next();
});

export default router;
