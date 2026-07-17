// Einmal-Skript: Notensatz-Fingerabdrücke für den Altbestand nachtragen.
//
// Ab jetzt schreibt die Notentext-Upload-Ansicht den Fingerabdruck bei jedem
// Upload mit. Die bereits hochgeladenen Notensätze haben aber keinen – ohne
// diesen Lauf müsste der Druck-Check jede Noten-PDF einzeln nachladen (~250 KB
// je Lied). Hier passiert das einmal zentral.
//
// Voraussetzung: Das Feld `notentext_fingerprint` (Typ JSON) muss in Directus
// auf `gesangbuchlied` existieren – das Schema wird live im Admin gepflegt.
//
// Aufruf:
//   node scripts/backfill-noten-fingerprints.mjs --token <directus-token> [--dry] [--force]
//
//   --dry     nichts schreiben, nur zeigen, was passieren würde
//   --force   auch schon vorhandene, gültige Fingerabdrücke neu berechnen
//
// Der Token braucht Schreibrechte auf gesangbuchlied. Ohne --token wird
// VITE_AUTH_TOKEN aus .env gelesen (auch in der obf:-Form).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- notenFingerprint.js gespiegelt ---------------------------------------
// Bewusst dupliziert statt importiert: Das Modul liegt hinter dem Vite-Alias
// "@/" und nutzt Browser-Idiome; ein Build nur für dieses Einmal-Skript wäre
// unverhältnismäßig. Ändert sich das Format dort, muss FINGERPRINT_VERSION
// steigen – dann gelten die hier geschriebenen Werte als veraltet und werden
// ignoriert statt falsch ausgewertet.
const FINGERPRINT_VERSION = 1;
const PUA_MIN = 0xe000;
const PUA_MAX = 0xf8ff;

function isMusicGlyphString(str) {
    const s = (str || '').replace(/\s/g, '');
    if (!s) return false;
    for (const ch of s) {
        const c = ch.codePointAt(0);
        if (!(c >= PUA_MIN && c <= PUA_MAX)) return false;
    }
    return true;
}

const r2 = (n) => Math.round(n * 100) / 100;

async function fingerprintNotenPdf(pdfDoc, fileId) {
    const pages = [];
    for (let p = 1; p <= pdfDoc.numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const glyphs = [];
        for (const it of content.items) {
            if (typeof it.str !== 'string' || !isMusicGlyphString(it.str)) continue;
            const s = it.str.replace(/\s/g, '');
            const x = it.transform[4];
            const yTop = viewport.height - it.transform[5];
            for (const ch of s) glyphs.push({ ch, x, yTop });
        }
        pages.push({
            seq: glyphs.map((g) => g.ch).join(''),
            x: glyphs.map((g) => r2(g.x)),
            y: glyphs.map((g) => r2(g.yTop)),
        });
    }
    return { v: FINGERPRINT_VERSION, file: fileId ?? null, pages };
}

// --- Konfiguration ---------------------------------------------------------

const OBF_KEY = 'gb-dashboard-static-token';
function deobfuscateToken(value) {
    if (!value || !value.startsWith('obf:')) return value;
    const binary = Buffer.from(value.slice(4), 'base64').toString('binary');
    let out = '';
    for (let i = 0; i < binary.length; i++) {
        out += String.fromCharCode(binary.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length));
    }
    return out;
}

function readEnv() {
    const file = path.join(ROOT, '.env');
    if (!fs.existsSync(file)) return {};
    return Object.fromEntries(
        fs
            .readFileSync(file, 'utf8')
            .split(/\r?\n/)
            .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
            .map((l) => {
                const i = l.indexOf('=');
                return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
            }),
    );
}

function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? null : process.argv[i + 1];
}
const has = (name) => process.argv.includes(`--${name}`);

const env = readEnv();
const BASE = arg('url') || env.VITE_BACKEND_URL;
const TOKEN = arg('token') || deobfuscateToken(env.VITE_AUTH_TOKEN);
const DRY = has('dry');
const FORCE = has('force');
const CONCURRENCY = 6;

if (!BASE || !TOKEN) {
    console.error('VITE_BACKEND_URL / VITE_AUTH_TOKEN fehlen (oder --url / --token angeben).');
    process.exit(1);
}

const authed = (url, init = {}) =>
    fetch(url, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) } });

async function main() {
    const listUrl =
        `${BASE}/items/gesangbuchlied` +
        `?fields=id,liednummer2026,titel,notentext,notentext_fingerprint` +
        `&filter[notentext][_nnull]=true&limit=-1`;
    const resp = await authed(listUrl);
    if (!resp.ok) {
        const body = await resp.text();
        // Häufigster Fall: Das Feld ist im Admin noch nicht angelegt. Das Schema
        // wird live gepflegt, ein Snapshot im Repo hilft hier nicht weiter.
        if (body.includes('notentext_fingerprint')) {
            console.error(
                'Das Feld "notentext_fingerprint" fehlt (oder der Token darf es nicht lesen).\n' +
                    'Bitte in Directus anlegen: Collection "gesangbuchlied",\n' +
                    '  Feld  notentext_fingerprint\n' +
                    '  Typ   JSON, nullable\n' +
                    'Danach dieses Skript erneut ausführen.',
            );
        } else {
            console.error(`Lieder konnten nicht geladen werden: ${resp.status} ${body}`);
        }
        return 1;
    }
    const lieder = (await resp.json()).data;

    const todo = lieder.filter((l) => {
        if (FORCE) return true;
        const fp = l.notentext_fingerprint;
        // Nur überspringen, was schon zur AKTUELLEN Datei passt.
        return !(fp && fp.v === FINGERPRINT_VERSION && fp.file === l.notentext);
    });

    console.log(`${lieder.length} Lieder mit Notensatz, davon ${todo.length} zu berechnen.`);
    if (DRY) console.log('(--dry: es wird nichts geschrieben)');

    let done = 0;
    let written = 0;
    let failed = 0;
    const queue = [...todo];

    async function worker() {
        for (;;) {
            const lied = queue.shift();
            if (!lied) return;
            const label = `GB${lied.liednummer2026 ?? '–'} (id ${lied.id})`;
            try {
                const fileResp = await authed(`${BASE}/assets/${lied.notentext}`);
                if (!fileResp.ok) throw new Error(`Download ${fileResp.status}`);
                const bytes = new Uint8Array(await fileResp.arrayBuffer());
                if (Buffer.from(bytes.slice(0, 4)).toString('latin1') !== '%PDF') {
                    // Im Feld liegt (noch) eine SVG o. Ä. – die trägt keinen
                    // Noten-Text-Layer und ist nicht abgleichbar.
                    console.log(`  ${label}: keine PDF – übersprungen`);
                    done++;
                    continue;
                }
                const doc = await pdfjs.getDocument({ data: bytes, disableFontFace: true }).promise;
                const fp = await fingerprintNotenPdf(doc, lied.notentext);
                await doc.destroy();

                const glyphs = fp.pages.reduce((a, p) => a + p.seq.length, 0);
                if (!glyphs) {
                    console.log(`  ${label}: keine Noten-Glyphen gefunden – übersprungen`);
                    done++;
                    continue;
                }
                if (!DRY) {
                    const patch = await authed(`${BASE}/items/gesangbuchlied/${lied.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notentext_fingerprint: fp }),
                    });
                    if (!patch.ok) throw new Error(`PATCH ${patch.status} ${await patch.text()}`);
                }
                written++;
                done++;
                if (done % 25 === 0) console.log(`  … ${done}/${todo.length}`);
            } catch (e) {
                failed++;
                done++;
                console.warn(`  ${label}: FEHLER – ${e.message}`);
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(
        `\nFertig: ${written} ${DRY ? 'würden geschrieben' : 'geschrieben'}, ${failed} Fehler.`,
    );
    return failed ? 1 : 0;
}

// Sauber beenden statt process.exit(): pdf.js hält Worker-Handles offen, ein
// harter Abbruch quittiert das unter Windows mit einem libuv-Assertion-Fehler.
main().then(
    (code) => {
        process.exitCode = code ?? 0;
    },
    (e) => {
        console.error(e);
        process.exitCode = 1;
    },
);
