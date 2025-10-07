// Utilities
import { defineStore } from 'pinia';

import axios from '@/assets/js/axiossConfig';
import router from '@/router';
import { useAppStore } from '@/store/app';
import moment from 'moment';

const useUserStore = defineStore('user', {
    state: () => ({
        user: null,
        kleiner_kreis: false,
        kleiner_kreis_ansicht: false,
    }),
    getters: {
        get_user: (state) => state.user,
        is_logged_in: (state) => state.user !== null,
        is_kleiner_kreis: (state) => state.kleiner_kreis,
        is_kleiner_kreis_ansicht: (state) => state.kleiner_kreis_ansicht,
    },
    actions: {
        toggle_kleiner_kreis_ansicht() {
            this.kleiner_kreis_ansicht = !this.kleiner_kreis_ansicht;
            localStorage.setItem(
                'kleiner_kreis_ansicht',
                this.kleiner_kreis_ansicht ? 'true' : 'false',
            );
        },

        login(authData, remember_me) {
            const appstore = useAppStore();

            let username = authData.username;

            // Replace hard-coded aliases with environment variables
            const defaultUserAlias = import.meta.env.VITE_DEFAULT_USER_ALIAS;
            const defaultUserName = import.meta.env.VITE_DEFAULT_USER_NAME;
            const specialUserAlias = import.meta.env.VITE_SPECIAL_USER_ALIAS;
            const specialUserName = import.meta.env.VITE_SPECIAL_USER_NAME;

            if (authData.username === defaultUserAlias) {
                username = defaultUserName;
            } else if (authData.username === specialUserAlias) {
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
                    // Use environment variable for kleiner_kreis users
                    const kleinerKreisUsers = import.meta.env.VITE_KLEINER_KREIS_USERS.split(',');

                    if (kleinerKreisUsers.includes(username)) {
                        this.kleiner_kreis = true;
                        localStorage.setItem('kleiner_kreis', 'true');
                        this.kleiner_kreis_ansicht =
                            localStorage.getItem('kleiner_kreis_ansicht') === 'true';
                    }

                    this.set_user_data(authData, response.data.data, remember_me);
                    appstore.loadData();
                })
                .catch((error) => {
                    throw error;
                });
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
            localStorage.removeItem('kleiner_kreis_ansicht');
            localStorage.removeItem('access_token');

            // Navigate to login
            router.replace('/login');
        },
        async autoLogin() {
            const appstore = useAppStore();
            let username = localStorage.getItem('username');

            if (!username) {
                return;
            }

            this.kleiner_kreis_ansicht = localStorage.getItem('kleiner_kreis_ansicht') === 'true';
            this.kleiner_kreis = localStorage.getItem('kleiner_kreis') === 'true';

            this.user = {
                username: username,
            };
            console.log('Auto login successful');
            appstore.loadData();
        },
        set_user_data(authData, response_data, remember_me) {
            this.user = {
                username: authData.username,
            };

            localStorage.setItem('access_token', response_data.access_token);

            if (remember_me) {
                localStorage.setItem('username', authData.username);
            }
        },
    },
});

export { useUserStore };
