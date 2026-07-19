import { test, expect } from '@playwright/test';

// Smoke-Test „wie ein Mensch": eine Liedansicht aus dem echten Backend laden,
// prüfen dass das Notentext-PDF angezeigt wird und ein paar Knöpfe bedienen.
//
// Login-Bootstrap ohne interaktives Login: die App liest VITE_AUTH_TOKEN aus
// .env; wir setzen nur die localStorage-Flags, damit autoLogin() läuft und der
// axios-Interceptor den statischen Token anhängt (siehe axiossConfig.js /
// store/user.js). Läuft daher NICHT als PR-Gate, sondern lokal/nightly.

// Bekanntes Lied mit Notentext-PDF (per Directus-API ausgewählt).
const SONG = { id: 2, titel: 'Ich bin ein Kind auf Erden' };

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('username', 'e2e-smoke');
        localStorage.setItem('use_static_token', 'true');
        localStorage.setItem('static_token_kind', 'default');
    });
});

// Cold-Start des Vite-Dev-Servers kann den ersten Chunk-Load mit HTTP 504
// ("Outdated Optimize Dep") quittieren -> bis zu dreimal neu laden.
async function gotoSong(page) {
    for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(`/lied/${SONG.id}`);
        try {
            await expect(page.getByText(SONG.titel).first()).toBeVisible({ timeout: 15_000 });
            return;
        } catch {
            /* reload and retry */
        }
    }
    throw new Error(`Liedansicht /lied/${SONG.id} nicht geladen`);
}

test('Liedansicht lädt aus dem Backend', async ({ page }) => {
    await gotoSong(page);
    // Titel im Browser-Tab + im Inhalt => Auth, Datenladen und Routing gehen.
    await expect(page).toHaveTitle(new RegExp(SONG.titel));
    await expect(page.getByText(SONG.titel).first()).toBeVisible();
    // Strophentext ist geladen.
    await expect(page.getByText(/Strophen/i).first()).toBeVisible();
});

test('Notentext-PDF wird angezeigt', async ({ page }) => {
    await gotoSong(page);
    // pdf.js rendert das PDF in ein <canvas>; ein sichtbares Canvas mit
    // nicht-trivialer Größe ist das Smoke-Signal „PDF geladen & angezeigt".
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    const box = await canvas.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(50);
    expect(box?.height ?? 0).toBeGreaterThan(50);
});

test('Bild-Navigation lässt sich bedienen', async ({ page }) => {
    await gotoSong(page);
    const next = page.getByRole('button', { name: 'Nächstes Bild' });
    const prev = page.getByRole('button', { name: 'Vorheriges Bild' });
    await expect(next).toBeVisible();
    await next.click();
    await prev.click();
    // App lebt noch: Titel weiter sichtbar, PDF-Canvas wieder da (kein Crash).
    await expect(page.getByText(SONG.titel).first()).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
});
