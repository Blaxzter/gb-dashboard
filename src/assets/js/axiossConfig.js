import axios from 'axios';

axios.interceptors.request.use(
    (config) => {
        let token = localStorage.getItem('access_token');

        // Only fall back to the shared static token for alias logins
        // (AK-Gesangbuch / Kleiner-AK) where multiple humans share one
        // Directus account and individual sessions would overwrite each other.
        // Real per-user logins keep their own JWT.
        const useStaticToken = localStorage.getItem('use_static_token') === 'true';
        const staticToken = import.meta.env.VITE_AUTH_TOKEN;
        if (
            useStaticToken &&
            staticToken &&
            staticToken !== 'CHANGE_THIS_AFTER_DIRECTUS_STARTED'
        ) {
            token = staticToken;
        }

        if (token && config.no_auth === undefined) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
    },

    (error) => {
        return Promise.reject(error);
    },
);

export default axios;
