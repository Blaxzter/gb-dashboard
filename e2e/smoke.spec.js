import { test, expect } from '@playwright/test';
import { seedStaticTokenAuth, gotoReady } from './helpers';

// Smoke-Test „wie ein Mensch": eine Liedansicht aus dem echten Backend laden,
// prüfen dass das Notentext-PDF angezeigt wird und ein paar Knöpfe bedienen.
// Läuft NICHT als PR-Gate, sondern lokal/nightly (siehe e2e/README.md).

// Bekanntes Lied mit Notentext-PDF (per Directus-API ausgewählt).
const SONG = { id: 2, titel: 'Ich bin ein Kind auf Erden' };

test.beforeEach(async ({ page }) => {
    await seedStaticTokenAuth(page);
});

const gotoSong = (page) =>
    gotoReady(page, `/lied/${SONG.id}`, (p) => p.getByText(SONG.titel).first());

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
