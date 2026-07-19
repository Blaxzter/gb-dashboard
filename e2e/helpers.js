import { expect } from '@playwright/test';

// Bootstrap eines eingeloggten Zustands über den statischen Token, OHNE
// interaktives Login: die App liest VITE_AUTH_TOKEN aus .env; wir setzen nur die
// localStorage-Flags, damit autoLogin() greift und der axios-Interceptor den
// Token anhängt (siehe src/store/user.js / src/assets/js/axiossConfig.js).
// Muss VOR dem ersten Laden laufen -> addInitScript.
export async function seedStaticTokenAuth(page) {
    await page.addInitScript(() => {
        localStorage.setItem('username', 'e2e-smoke');
        localStorage.setItem('use_static_token', 'true');
        localStorage.setItem('static_token_kind', 'default');
    });
}

// Navigiert zu `path` und wartet, bis `readyMatcher(page)` sichtbar ist. Der
// Vite-Dev-Server kann beim Cold-Start den ersten Chunk-Load mit HTTP 504
// ("Outdated Optimize Dep") quittieren -> bis zu `attempts` mal neu laden.
export async function gotoReady(page, path, readyMatcher, { timeout = 15_000, attempts = 3 } = {}) {
    for (let i = 0; i < attempts; i++) {
        await page.goto(path);
        try {
            await expect(readyMatcher(page)).toBeVisible({ timeout });
            return;
        } catch {
            /* reload and retry */
        }
    }
    throw new Error(`Seite ${path} nicht geladen`);
}
