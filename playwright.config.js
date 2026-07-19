import { defineConfig, devices } from '@playwright/test';

// E2E-Smoke gegen ein ECHTES Backend (lesend). Die App liest VITE_BACKEND_URL +
// VITE_AUTH_TOKEN aus .env; der Dev-Server injiziert sie. Der Login wird über den
// statischen Token gebootstrappt (siehe e2e/smoke.spec.js), kein interaktives Login.
export default defineConfig({
    testDir: './e2e',
    timeout: 90_000,
    expect: { timeout: 20_000 },
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'corepack pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
