// Utilities
import { defineStore } from 'pinia';

import axios from '@/assets/js/axiossConfig';
import router from '@/router';
import { useAppStore } from '@/store/app';
import moment from 'moment';

// Kleiner-Kreis users get the extended ("Ansicht") view on by default. Once a
// user flips the toggle, that choice is persisted as 'true'/'false' and wins;
// only the absence of a stored value falls back to the on-by-default.
function resolveKleinerKreisAnsicht() {
    const stored = localStorage.getItem('kleiner_kreis_ansicht');
    return stored === null ? true : stored === 'true';
}

// Directus roles whose members get Kleiner-Kreis features, regardless of which
// account they logged in with. This complements the legacy VITE_KLEINER_KREIS_USERS
// e-mail list: assigning a user to e.g. "Super-Editor" or "Administrator" in the
// backend is enough to unlock the view, no per-e-mail config needed.
const kleinerKreisRoles = (import.meta.env.VITE_KLEINER_KREIS_ROLES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const useUserStore = defineStore('user', {
    state: () => ({
        user: null,
        kleiner_kreis: false,
        kleiner_kreis_ansicht: false,
    }),
    getters: {
        get_user: (state) => state.user,
        is_logged_in: (state) => state.user !== null,
        // Kleiner-Kreis either via the legacy shared-account e-mail list
        // (state.kleiner_kreis) or via the user's Directus role.
        is_kleiner_kreis: (state) =>
            state.kleiner_kreis ||
            (!!state.user?.role && kleinerKreisRoles.includes(state.user.role)),
        is_kleiner_kreis_ansicht: (state) => state.kleiner_kreis_ansicht,
        has_role: (state) => (roleNames) => {
            const required = Array.isArray(roleNames) ? roleNames : [roleNames];
            if (required.length === 0) return true;
            return required.includes(state.user?.role);
        },
    },
    actions: {
        toggle_kleiner_kreis_ansicht() {
            this.kleiner_kreis_ansicht = !this.kleiner_kreis_ansicht;
            localStorage.setItem(
                'kleiner_kreis_ansicht',
                this.kleiner_kreis_ansicht ? 'true' : 'false',
            );
        },

        // Apply the Kleiner-Kreis "Ansicht" default once we know whether the
        // user qualifies (via the e-mail list or their Directus role). On by
        // default; a value the user previously stored wins. Must run after
        // fetchMe() so the role is available to the is_kleiner_kreis getter.
        syncKleinerKreisAnsicht() {
            this.kleiner_kreis_ansicht = this.is_kleiner_kreis
                ? resolveKleinerKreisAnsicht()
                : false;
        },

        login(authData, remember_me) {
            const appstore = useAppStore();

            let username = authData.username;

            // Replace hard-coded aliases with environment variables
            const defaultUserAlias = import.meta.env.VITE_DEFAULT_USER_ALIAS;
            const defaultUserName = import.meta.env.VITE_DEFAULT_USER_NAME;
            const specialUserAlias = import.meta.env.VITE_SPECIAL_USER_ALIAS;
            const specialUserName = import.meta.env.VITE_SPECIAL_USER_NAME;

            // Alias logins share a Directus account; route them through a shared
            // static token to avoid session-overwrite conflicts. Real e-mail logins
            // use their own per-user token. The two aliases are backed by two
            // different remote accounts, so each gets its own static token: the
            // special (Kleiner-AK) alias uses VITE_SPECIAL_AUTH_TOKEN, the default
            // alias uses VITE_AUTH_TOKEN. 'static_token_kind' records which.
            const isDefaultAlias = authData.username === defaultUserAlias;
            const isSpecialAlias = authData.username === specialUserAlias;
            const staticTokenKind = isSpecialAlias
                ? 'special'
                : isDefaultAlias
                  ? 'default'
                  : null;

            if (isDefaultAlias) {
                username = defaultUserName;
            } else if (isSpecialAlias) {
                username = specialUserName;
            }

            return axios({
                method: 'post',
                url: `${import.meta.env.VITE_BACKEND_URL}/auth/login`,
                data: {
                    email: username,
                    password: authData.password,
                },
                no_auth: true,
            })
                .then((response) => {
                    // Legacy shared-account e-mail list for kleiner_kreis users.
                    // Role-based membership is resolved later, after fetchMe.
                    const kleinerKreisUsers = (import.meta.env.VITE_KLEINER_KREIS_USERS || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);

                    if (kleinerKreisUsers.includes(username)) {
                        this.kleiner_kreis = true;
                        localStorage.setItem('kleiner_kreis', 'true');
                    }

                    this.set_user_data(authData, response.data.data, remember_me, staticTokenKind);
                    return this.fetchMe();
                })
                .then(() => {
                    // fetchMe has resolved the role, so is_kleiner_kreis is final.
                    this.syncKleinerKreisAnsicht();
                    appstore.loadData();
                })
                .catch((error) => {
                    throw error;
                });
        },
        async fetchMe() {
            const response = await axios({
                method: 'get',
                url: `${import.meta.env.VITE_BACKEND_URL}/users/me`,
                params: { fields: 'role.name,role.id' },
            });
            const role = response.data?.data?.role?.name ?? null;
            this.user = { ...(this.user ?? {}), role };
        },
        logout() {
            const appStore = useAppStore();

            // Cancel any pending requests
            appStore.cancelRequests();

            // Clear user data
            this.user = null;
            this.kleiner_kreis = false;
            this.kleiner_kreis_ansicht = false;

            // Clear localStorage
            localStorage.removeItem('username');
            localStorage.removeItem('kleiner_kreis');
            // Keep 'kleiner_kreis_ansicht': a user who switched the view off
            // should stay off after re-login. Missing key => default on.
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('token_expires_at');
            localStorage.removeItem('use_static_token');
            localStorage.removeItem('static_token_kind');

            // Navigate to login
            router.replace('/login');
        },
        async autoLogin() {
            const appstore = useAppStore();
            let username = localStorage.getItem('username');

            if (!username) {
                return;
            }

            if (this.user?.role) {
                return;
            }

            this.kleiner_kreis = localStorage.getItem('kleiner_kreis') === 'true';

            this.user = {
                username: username,
            };

            try {
                await this.fetchMe();
            } catch (error) {
                console.warn('Auto login failed, clearing session', error);
                this.logout();
                return;
            }

            // Role is known now; apply the Ansicht default for Kleiner-Kreis
            // users (whether by e-mail list or by Directus role).
            this.syncKleinerKreisAnsicht();

            console.log('Auto login successful');
            appstore.loadData();
        },
        set_user_data(authData, response_data, remember_me, staticTokenKind) {
            this.user = {
                username: authData.username,
            };

            localStorage.setItem('access_token', response_data.access_token);
            localStorage.setItem('use_static_token', staticTokenKind ? 'true' : 'false');
            if (staticTokenKind) {
                localStorage.setItem('static_token_kind', staticTokenKind);
            } else {
                localStorage.removeItem('static_token_kind');
            }

            // Persist the refresh token + absolute expiry so the axios
            // interceptor can transparently refresh the short-lived access
            // token instead of dropping the user back to the login screen.
            if (response_data.refresh_token) {
                localStorage.setItem('refresh_token', response_data.refresh_token);
            }
            if (response_data.expires) {
                localStorage.setItem(
                    'token_expires_at',
                    String(Date.now() + response_data.expires),
                );
            }

            if (remember_me) {
                localStorage.setItem('username', authData.username);
            }
        },
    },
});

export { useUserStore };
