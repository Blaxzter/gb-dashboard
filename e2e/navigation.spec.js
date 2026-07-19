import { test, expect } from '@playwright/test';
import { seedStaticTokenAuth, gotoReady } from './helpers';

// Smoke-Tests für die Hauptseiten „wie ein Mensch": jede lädt aus dem echten
// Backend, zeigt ihren Kerninhalt und die Navigation dazwischen funktioniert.

test.beforeEach(async ({ page }) => {
    await seedStaticTokenAuth(page);
});

test('Dashboard zeigt den aktuellen Stand', async ({ page }) => {
    await gotoReady(page, '/dashboard', (p) => p.getByText('Aktueller Stand'), { timeout: 30_000 });
    await expect(page.getByText('Aktueller Stand')).toBeVisible();
});

test('Gesangbuchlieder-Liste rendert Zeilen', async ({ page }) => {
    await gotoReady(page, '/gesangbuchlieder', (p) =>
        p.getByText('Bereits eingetragene Gesangbuchlieder'),
    );
    await expect(page.locator('tbody tr').first()).toBeVisible();
    expect(await page.locator('tbody tr').count()).toBeGreaterThan(3);
});

test('Notentext-Export-Ansicht lädt (nutzt buildFooter)', async ({ page }) => {
    await gotoReady(page, '/notentext-export', (p) =>
        p.getByRole('heading', { name: 'Notentext-Export' }),
    );
    await expect(page.getByText(/Mit Notentext/)).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('Navigation zwischen Hauptseiten funktioniert', async ({ page }) => {
    await gotoReady(page, '/dashboard', (p) => p.getByText('Aktueller Stand'), { timeout: 30_000 });

    await page.getByRole('link', { name: 'Gesangbuchlieder' }).click();
    await expect(page).toHaveURL(/\/gesangbuchlieder/);
    await expect(page.getByText('Bereits eingetragene Gesangbuchlieder')).toBeVisible();

    await page.getByRole('link', { name: 'Kalender' }).click();
    await expect(page).toHaveURL(/\/kalender/);
    // datumsunabhängig: irgendein Kalender-Ansichts-Umschalter ("… view").
    await expect(page.getByRole('button', { name: /view$/i }).first()).toBeVisible();
});
