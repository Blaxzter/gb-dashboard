import axios from 'axios';

import { deobfuscateToken } from '@/assets/js/obfuscation';

axios.interceptors.request.use(
    (config) => {
        let token = localStorage.getItem('access_token');

        // Only fall back to a shared static token for alias logins
        // (AK-Gesangbuch / Kleiner-AK) where multiple humans share one
        // Directus account and individual sessions would overwrite each other.
        // Real per-user logins keep their own JWT.
        //
        // The two aliases map to two different Directus accounts on the remote,
        // so each has its own static token: the Kleiner-AK alias uses
        // VITE_SPECIAL_AUTH_TOKEN, every other alias uses VITE_AUTH_TOKEN. If no
        // special token is configured we fall back to the default one so
        // existing single-token setups keep working unchanged.
        const useStaticToken = localStorage.getItem('use_static_token') === 'true';
        if (useStaticToken) {
            const placeholder = 'CHANGE_THIS_AFTER_DIRECTUS_STARTED';
            // Tokens are stored obfuscated ("obf:..." prefix) in the env so they
            // aren't plain text in the bundle; decode them here before use.
            // Plain values (incl. the placeholder) pass through untouched.
            const defaultToken = deobfuscateToken(import.meta.env.VITE_AUTH_TOKEN);
            const specialToken = deobfuscateToken(import.meta.env.VITE_SPECIAL_AUTH_TOKEN);
            const useSpecial =
                localStorage.getItem('static_token_kind') === 'special' &&
                specialToken &&
                specialToken !== placeholder;
            const staticToken = useSpecial ? specialToken : defaultToken;
            if (staticToken && staticToken !== placeholder) {
                token = staticToken;
            }
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

// --- Token refresh -------------------------------------------------------
// Directus access tokens are short-lived JWTs (ACCESS_TOKEN_TTL, default 15
// min). Without refreshing them the user gets silently logged out: the next
// request after expiry returns 401 and autoLogin() would fall back to the
// login screen. We transparently exchange the refresh token for a new access
// token on the first 401 and retry the original request. The refresh token
// itself lives much longer (REFRESH_TOKEN_TTL, default 7 days).

// A single in-flight refresh shared by all requests that 401 at once, so we
// only hit /auth/refresh once even if many requests fail simultaneously.
let refreshPromise = null;

async function refreshAccessToken() {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) {
        throw new Error('No refresh token available');
    }

    // no_auth so the request interceptor doesn't attach the (expired) token.
    const response = await axios({
        method: 'post',
        url: `${import.meta.env.VITE_BACKEND_URL}/auth/refresh`,
        data: { refresh_token, mode: 'json' },
        no_auth: true,
    });

    const data = response.data.data;
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    if (data.expires) {
        localStorage.setItem('token_expires_at', String(Date.now() + data.expires));
    }
    return data.access_token;
}

async function handleSessionExpired() {
    // Refresh token is gone or rejected → the session is truly over. Route
    // through the store's logout so in-memory state and localStorage stay
    // consistent (lazy import avoids a circular dependency with user.js).
    try {
        const { useUserStore } = await import('@/store/user');
        useUserStore().logout();
    } catch {
        const { default: router } = await import('@/router');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token_expires_at');
        localStorage.removeItem('use_static_token');
        localStorage.removeItem('static_token_kind');
        router.replace('/login');
    }
}

axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        const useStaticToken = localStorage.getItem('use_static_token') === 'true';

        // Only attempt a refresh for genuine 401s on normal authenticated
        // requests. Skip: non-401 errors, login/refresh calls (no_auth),
        // already-retried requests, and alias logins on the static token
        // (which never expires and has no refresh token).
        if (
            status !== 401 ||
            !originalRequest ||
            originalRequest.no_auth ||
            originalRequest._retry ||
            useStaticToken
        ) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            if (!refreshPromise) {
                refreshPromise = refreshAccessToken().finally(() => {
                    refreshPromise = null;
                });
            }
            const newToken = await refreshPromise;
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return axios(originalRequest);
        } catch (refreshError) {
            await handleSessionExpired();
            return Promise.reject(refreshError);
        }
    },
);

export default axios;
