# E2E-Smoke-Tests (Playwright)

Smoke-Tests „wie ein Mensch": eine Liedansicht aus dem **echten** Backend laden,
prüfen dass das Notentext-PDF angezeigt wird, ein paar Knöpfe bedienen.

## Ausführen

```bash
pnpm e2e        # headless
pnpm e2e:ui     # Playwright UI-Modus (interaktiv)
```

Playwright startet den Dev-Server selbst (`corepack pnpm dev`, Port 3000,
`reuseExistingServer`). Voraussetzung: eine `.env` mit

- `VITE_BACKEND_URL` — erreichbares Directus
- `VITE_AUTH_TOKEN` — gültiger statischer Token (lesend genügt)

Beim ersten Mal einmalig die Browser installieren:

```bash
pnpm exec playwright install chromium
```

## Login-Bootstrap (kein interaktives Login)

Die App liest den statischen Token aus `VITE_AUTH_TOKEN`. Die Tests setzen vor dem
Laden nur die localStorage-Flags (`use_static_token`, `static_token_kind`,
`username`), damit `autoLogin()` läuft und der axios-Interceptor den Token anhängt
(siehe `src/assets/js/axiossConfig.js` und `src/store/user.js`).

## Warum nicht im PR-CI?

Der Suite braucht ein erreichbares Backend + Token und ist damit langsamer/flakier
als die Vitest-Logik-Tests. Sie ist deshalb als **lokaler/nightly** Lauf gedacht,
nicht als PR-Gate. Für einen Nightly-Workflow würden `VITE_BACKEND_URL` und
`VITE_AUTH_TOKEN` als GitHub-Secrets hinterlegt.
