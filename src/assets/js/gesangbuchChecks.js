// Validierungs-Checks für das Gesangbuch.
//
// Diese Datei bündelt die fachlichen Prüfungen, die vor einem Export (oder
// generell zur Qualitätssicherung) über die "Bewertet und genommen"-Lieder
// laufen sollen. Jeder Check ist ein eigenständiges Objekt in `CHECKS` – neue
// Prüfungen lassen sich einfach ergänzen, ohne die View anzufassen.
//
// Ein Check sieht so aus:
//   {
//     id, category, title, description,
//     run(ctx) -> { status, summary, items }
//   }
// wobei `ctx = { alle, genommen }` und
//   status ∈ 'ok' | 'info' | 'warning' | 'error'
//   items  = [{ id?, title, nummer?, detail?, to? }]

import _ from 'lodash';
import { status_mapping } from '@/assets/js/utils';

// "Genommen" = Lieder mit Status 'accepted' ("Bewertet und genommen").
export const GENOMMEN_STATUS = 'accepted';

// Autoren gelten als final geprüft, sobald sie diesen Status tragen
// ("Veröffentlicht"). Der Status wird erst gesetzt, wenn der Autor
// korrekturgelesen und v. a. die Geburts-/Sterbedaten gegengeprüft wurden.
export const AUTOR_VEROEFFENTLICHT_STATUS = 'published';

export const STATUS = {
    ok: { color: 'success', icon: 'mdi-check-circle', label: 'OK', rank: 0 },
    info: { color: 'info', icon: 'mdi-information', label: 'Hinweis', rank: 1 },
    warning: { color: 'warning', icon: 'mdi-alert', label: 'Warnung', rank: 2 },
    error: { color: 'error', icon: 'mdi-alert-circle', label: 'Fehler', rank: 3 },
};

// --- kleine Helfer ---------------------------------------------------------

export function isGenommen(lied) {
    return lied?.status === GENOMMEN_STATUS;
}

export function isRein(lied) {
    const bezeichner = lied?.bewertung_kleiner_kreis?.bezeichner;
    return !!bezeichner && bezeichner.toLowerCase().includes('rein');
}

// Exakt die Bewertung „Rein" – im Gegensatz zu isRein() NICHT die Varianten wie
// „Rein, wenn". Für den Check „genommen-rein" (Issue #42): ein .includes('rein')
// zählt „Rein, wenn" fälschlich als „Rein" und hebelt damit die Prüfung aus, ob
// jedes genommene Lied wirklich die finale Bewertung „Rein" trägt.
export function isExactRein(lied) {
    const bezeichner = lied?.bewertung_kleiner_kreis?.bezeichner;
    return !!bezeichner && bezeichner.trim().toLowerCase() === 'rein';
}

function hasNummer(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

// Führende Ganzzahl einer Liednummer ("12" / "12a" / 12 -> 12, "" -> null)
export function parseNummer(value) {
    if (!hasNummer(value)) return null;
    const match = String(value).match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

// Referenz auf die deutsche Liedfassung – entweder ein Objekt mit `id` oder eine
// skalare id. Liefert die id als Zahl (oder null).
function dlfId(lied) {
    const dlf = lied?.deutscheLiedfassung;
    if (dlf == null) return null;
    const id = typeof dlf === 'object' ? dlf.id : dlf;
    if (id == null) return null;
    const num = Number(id);
    return Number.isNaN(num) ? id : num;
}

function strophen(lied) {
    return lied?.text?.strophenEinzeln || [];
}

// Strophentext eines Strophen-Objekts. Wie im Normalisierungs-Skript
// (gb-scripts/app/10-normalize-quotation-marks.py) wird das Feld `strophe`
// bevorzugt, ersatzweise `text`.
function verseText(strophe) {
    if (!strophe || typeof strophe !== 'object') return '';
    if (strophe.strophe) return String(strophe.strophe);
    if (strophe.text) return String(strophe.text);
    return '';
}

// Silbentrennzeichen: das Zeichen ¬ (U+00AC) markiert in den Strophentexten die
// Silbengrenzen für die Silben-/Notenausrichtung (vgl. SyllableEditList.vue,
// beim Export wird es entfernt). Eine Strophe ohne dieses Zeichen ist noch nicht
// in Silben getrennt.
const SILBENTRENNER = '¬';

// Sichtbare Zeichenzahl eines Strophentextes: Silbentrennzeichen und jeglicher
// Whitespace (Leerzeichen, Zeilenumbrüche) werden entfernt, sodass nur der
// eigentliche Textinhalt gezählt wird und unterschiedliche Formatierung die
// Länge nicht verfälscht.
function verseLength(strophe) {
    return verseText(strophe).split(SILBENTRENNER).join('').replace(/\s+/g, '').length;
}

// Auslassungszeichen, die darauf hindeuten, dass der Stropheninhalt nicht
// vollständig übertragen wurde: drei (oder mehr) aufeinanderfolgende Punkte
// oder das Auslassungszeichen … (U+2026).
const AUSLASSUNGS_REGEX = /\.{3,}|…/;

// „ToDo“-Marker in Anmerkungsfeldern (Issue #69): Beim Erfassen und
// Korrekturlesen wird in den Anmerkungsfeldern (Lied, Text, Melodie) häufig
// „ToDo“ notiert, um noch offene Punkte zu markieren – etwa eine noch zu
// klärende Melodie-Bewertung („Rein, wenn“). Vor dem finalen Export sollten
// keine solchen Marker mehr übrig sein. Erkannt werden „todo“, „to-do“ und
// „to do“ (Groß-/Kleinschreibung egal, auch als Mehrzahl „ToDos“). Das führende
// \b verhindert Fehltreffer mitten in Wörtern (z. B. „Auto do…“, „Konto do…“).
const TODO_ANMERKUNG_REGEX = /\bto[-\s]?do/i;

// Silbentrennung mit Minus statt Silbentrennzeichen (Issue #39): Beim
// Korrekturlesen wurde an einzelnen Stellen ein Bindestrich-Minus „-" (U+002D)
// statt des Silbentrennzeichens „¬" gesetzt (z. B. „o-ben" statt „o¬ben",
// „Treu-e" statt „Treu¬e"). Kennzeichen ist ein „-" mit jeweils einem Buchstaben
// direkt davor und dahinter. Diese Regex extrahiert die betroffenen Wörter (eine
// oder mehrere durch „-" verbundene Buchstabengruppen), damit sie im Check als
// Beispiel angezeigt werden können.
const SILBEN_MINUS_WORT_REGEX = /\p{L}+(?:-\p{L}+)+/gu;

// Fälschlicher Gedankenstrich (Issue #40): Ein von Leerzeichen umschlossenes
// Minus „ - " soll als Halbgeviertstrich (Gedankenstrich) „ – " (U+2013) gesetzt
// werden. Erkannt wird ein Bindestrich-Minus „-" (U+002D) mit jeweils einem
// Leerzeichen (normales oder geschütztes) davor und dahinter.
const GEDANKENSTRICH_MINUS_REGEX = /[  ]-[  ]/g; // Zeichenklasse: normales Leerzeichen oder geschütztes Leerzeichen (U+00A0)

// Schwellen für den Strophenlängen-Check (siehe Check „strophen-laenge-ausreisser“).
const STROPHENLAENGE_MIN_STROPHEN = 3; // erst ab 3 (gefüllten) Strophen vergleichbar
const STROPHENLAENGE_UNTERGRENZE = 0.5; // < 50 % des Medians → evtl. fehlender Text
const STROPHENLAENGE_OBERGRENZE = 1.8; // > 180 % des Medians → evtl. Refrain/Anmerkung
const STROPHENLAENGE_MIN_DIFF = 15; // absolute Mindestabweichung in Zeichen (gegen Rauschen)

// Erlaubt sind nur die deutschen „Gänsefüßchen“: öffnend „ (U+201E) und
// schließend “ (U+201C). Alle übrigen doppelten Anführungszeichen-Varianten
// werden vom Normalisierungs-Skript auf diese beiden ersetzt und sollen daher
// nicht in den Strophentexten stehen. Die Auswahl entspricht 1:1 den vom Skript
// ersetzten Zeichen (always_open ohne „, always_close, toggling ohne “).
const VERBOTENE_DOPPEL_ANFUEHRUNGSZEICHEN = {
    '"': 'gerade (")', // U+0022 QUOTATION MARK
    '”': 'englisch schließend (”)', // U+201D RIGHT DOUBLE QUOTATION MARK
    '‟': 'hoch-reversiert (‟)', // U+201F DOUBLE HIGH-REVERSED-9
    '«': 'Guillemet (« )', // U+00AB
    '»': 'Guillemet ( »)', // U+00BB
    '＂': 'vollbreit (＂)', // U+FF02 FULLWIDTH QUOTATION MARK
};

// Zum Verkürzen von Wörtern (Apostroph) ist ausschließlich das rechte einfache
// Anführungszeichen ’ (U+2019) erlaubt – nicht der gerade Apostroph ('), der
// Akut (´), der Gravis (`) o. Ä. Alle übrigen Varianten werden vom
// Normalisierungs-Skript (gb-scripts/app/10-normalize-quotation-marks.py) auf ’
// ersetzt. Die Auswahl entspricht 1:1 den dort ersetzten Zeichen
// (quotation_variants ohne das Zielzeichen ’). Siehe Issue #7.
const VERBOTENE_APOSTROPHE = {
    "'": "gerade (')", // U+0027 APOSTROPHE
    '`': 'Gravis (`)', // U+0060 GRAVE ACCENT
    '´': 'Akut (´)', // U+00B4 ACUTE ACCENT
    '‘': 'links (‘)', // U+2018 LEFT SINGLE QUOTATION MARK
    '‚': 'tief (‚)', // U+201A SINGLE LOW-9 QUOTATION MARK
    '‛': 'hoch-reversiert (‛)', // U+201B SINGLE HIGH-REVERSED-9
    '′': 'Prime (′)', // U+2032 PRIME
    '‵': 'reversierte Prime (‵)', // U+2035 REVERSED PRIME
    ʼ: 'Modifikator-Apostroph (ʼ)', // U+02BC MODIFIER LETTER APOSTROPHE
    ʹ: 'Modifikator-Prime (ʹ)', // U+02B9 MODIFIER LETTER PRIME
    ˈ: 'Senkrechtstrich (ˈ)', // U+02C8 MODIFIER LETTER VERTICAL LINE
    ˊ: 'Modifikator-Akut (ˊ)', // U+02CA MODIFIER LETTER ACUTE ACCENT
    ˋ: 'Modifikator-Gravis (ˋ)', // U+02CB MODIFIER LETTER GRAVE ACCENT
    ꞌ: 'Saltillo (ꞌ)', // U+A78C MODIFIER LETTER SALTILLO
    '＇': 'vollbreit (＇)', // U+FF07 FULLWIDTH APOSTROPHE
    '｀': 'vollbreiter Gravis (｀)', // U+FF40 FULLWIDTH GRAVE ACCENT
    ʾ: 'rechter Halbring (ʾ)', // U+02BE MODIFIER LETTER RIGHT HALF RING
    ʿ: 'linker Halbring (ʿ)', // U+02BF MODIFIER LETTER LEFT HALF RING
    '᾿': 'Koronis (᾿)', // U+1FBD GREEK KORONIS
};

// „Hochzeichen“ = sämtliche Anführungszeichen- und Apostroph-Varianten (erlaubte
// wie unerwünschte, öffnend wie schließend). Sie werden beim Titel-Vergleich
// ignoriert, weil ein Lied-Titel häufig als Zitat in Anführungszeichen steht
// („Ohne mich könnt ihr nichts tun“), die Strophe denselben Wortlaut aber ohne
// Anführungszeichen führt. Satzzeichen wie . , ! ? bleiben bewusst erhalten –
// die sollen beim Vergleich mitzählen.
const HOCHZEICHEN_REGEX = new RegExp(
    `[${['„', '“', '’', ...Object.keys(VERBOTENE_DOPPEL_ANFUEHRUNGSZEICHEN), ...Object.keys(VERBOTENE_APOSTROPHE)].join('')}]`,
    'g',
);

// Wiederholungszeichen: Die musikalischen Marken „|:“ (Anfang) und „:|“ (Ende)
// umschließen wiederholte Liedabschnitte (z. B. „… der heut schließt auf sein
// Himmelreich |: und schenkt uns seinen Sohn. :|“). Sie gehören nicht zum
// eigentlichen Liedtext und werden – wie die Hochzeichen – vor dem Titel-Vergleich
// entfernt. Andernfalls beginnt eine 1. Strophe wie „|: Komm, Heilger Geist, mit
// deiner Kraft …“ vermeintlich nicht mit ihrem Titel und löst einen Fehlalarm aus
// (Issue #34).
const WIEDERHOLUNGSZEICHEN_REGEX = /\|:|:\|/g;

// Alle KI-Reviews eines Liedes (über alle Strophen hinweg)
function kiReviews(lied) {
    return strophen(lied).flatMap((s) => (Array.isArray(s?.kiReview) ? s.kiReview : []));
}

// "Offen" = KI-Review hat ein Ergebnis, aber noch keine menschliche Bewertung
// (akzeptiert / abgelehnt / Diskussion).
function openKiReviews(lied) {
    return kiReviews(lied).filter((r) => r && r.reviewErgebnis && !r.bewertungDurchMensch);
}

// KI-Reviews mit einer bestimmten menschlichen Bewertung ('accepted' | 'rejected'
// | 'discussion').
function kiReviewsWithVerdict(lied, verdict) {
    return kiReviews(lied).filter(
        (r) => r && r.reviewErgebnis && r.bewertungDurchMensch === verdict,
    );
}

function openSuggestions(lied) {
    return strophen(lied).filter(
        (s) => s?.aenderungsvorschlag && String(s.aenderungsvorschlag).trim(),
    );
}

function openRemarks(lied) {
    return strophen(lied).filter((s) => s?.anmerkung && String(s.anmerkung).trim());
}

// Findet ein eventuell vorhandenes Chorbuchnummern-Feld dynamisch, damit der
// Check automatisch greift, sobald ein solches Feld im Datenmodell existiert.
function detectChorbuchField(list) {
    const candidates = new Set();
    list.forEach((lied) => {
        Object.keys(lied || {}).forEach((key) => {
            if (/chorbuch/i.test(key)) candidates.add(key);
        });
    });
    const withData = [...candidates].find((key) => list.some((lied) => hasNummer(lied[key])));
    return withData || [...candidates][0] || null;
}

// Median einer Zahlenreihe (robuster gegen Ausreißer als der Mittelwert).
function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Analysiert eine Zahlenreihe auf Lücken.
function analyzeSequence(values) {
    const nums = _.uniq(values.map(parseNummer).filter((n) => n !== null)).sort((a, b) => a - b);
    const present = new Set(nums);
    const missing = [];
    if (nums.length) {
        for (let n = nums[0]; n <= nums[nums.length - 1]; n++) {
            if (!present.has(n)) missing.push(n);
        }
    }
    return {
        numbers: nums,
        missing,
        min: nums.length ? nums[0] : null,
        max: nums.length ? nums[nums.length - 1] : null,
    };
}

function result(ok, severity, summary, items) {
    return { status: ok ? 'ok' : severity, summary, items: items || [] };
}

function songItem(lied, detail) {
    return {
        // `id` verweist auf das Lied – die View öffnet damit den Lied-Dialog.
        id: lied.id,
        title: lied.titel || `Lied #${lied.id}`,
        nummer: lied.liednummer2026 || lied.liednummer2000 || null,
        detail: detail || '',
    };
}

// --- Copyright-Schreibweisen (Issue #70) -----------------------------------
//
// Ziel: ähnliche, aber unterschiedlich geschriebene Copyright-Angaben finden,
// damit sie vereinheitlicht werden können – z. B. „Bärenreiter-Verlag, Kassel“
// vs. „Bärenreiter-Verlag Karl Vötterle GmbH & Co. KG, Kassel“. Verglichen
// werden die drei Copyright-Felder eines Liedes: Text, Melodie und Lied.

// Generische Rechtsform-/Füllwörter, die einen Copyright-Inhaber kaum
// identifizieren. Sie bleiben beim Vergleich der „aussagekräftigen“ Wörter
// unberücksichtigt, damit die lange und die kurze Schreibweise desselben
// Verlags als gleich erkannt werden.
const COPYRIGHT_STOPWORDS = new Set([
    'verlag',
    'verlags',
    'verlage',
    'musikverlag',
    'musikverlage',
    'edition',
    'editionen',
    'gmbh',
    'mbh',
    'co',
    'kg',
    'kgaa',
    'ohg',
    'ag',
    'ug',
    'gbr',
    'ev',
    'und',
    'u',
    'and',
    'im',
    'in',
    'der',
    'die',
    'das',
    'den',
    'für',
    'auftrag',
    'by',
    'the',
    'of',
    'inc',
    'ltd',
    'llc',
    'corp',
]);

// Zerlegt eine Copyright-Angabe in normalisierte Wort-Token: NFC, Kleinschreibung,
// Trennung an allen Nicht-Buchstaben/-Ziffern (Satzzeichen, Bindestriche,
// Leerzeichen). So werden „Bärenreiter-Verlag, Kassel“ und
// „Bärenreiter-Verlag Kassel“ auf dieselben Token abgebildet.
function copyrightTokens(value) {
    return String(value == null ? '' : value)
        .normalize('NFC')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);
}

// Normalisierte Vergleichsform: Token mit einfachem Leerzeichen verbunden – ohne
// Satzzeichen, Mehrfach-Leerzeichen und Groß-/Kleinschreibung. Gleiche norm-Form
// bei unterschiedlicher Rohform = reiner Formatierungsunterschied.
function copyrightNorm(value) {
    return copyrightTokens(value).join(' ');
}

// „Aussagekräftige“ Token: ohne generische Füllwörter, ohne reine Zahlen
// (Jahreszahlen) und ohne Einzelbuchstaben – im Wesentlichen der Verlags-/
// Autorenname als Identität der Angabe.
function copyrightSignificant(value) {
    return copyrightTokens(value).filter(
        (t) => t.length > 1 && !/^\d+$/.test(t) && !COPYRIGHT_STOPWORDS.has(t),
    );
}

// Levenshtein-Distanz (Editierabstand) zweier Strings – für die Erkennung
// tippfehlernaher Schreibweisen.
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = [];
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        }
        prev = cur;
    }
    return prev[n];
}

// Sammelt alle distinkten Copyright-Angaben (Rohform) über Text-, Melodie- und
// Lied-Copyright und merkt sich je Angabe die Zahl betroffener Lieder, die Felder
// und ein Beispiel-Lied.
function collectCopyrightEntries(lieder) {
    const map = new Map();
    const add = (value, lied, field) => {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return;
        let e = map.get(raw);
        if (!e) {
            const sig = copyrightSignificant(raw);
            e = {
                raw,
                norm: copyrightNorm(raw),
                sigSet: new Set(sig),
                sigCount: sig.length,
                songIds: new Set(),
                fields: new Set(),
                example: null,
            };
            map.set(raw, e);
        }
        e.fields.add(field);
        if (!e.songIds.has(lied.id)) {
            e.songIds.add(lied.id);
            if (!e.example) e.example = lied;
        }
    };
    lieder.forEach((l) => {
        add(l.text?.copyright, l, 'Text');
        add(l.melodie?.copyright, l, 'Melodie');
        add(l.copyright, l, 'Lied');
    });
    return [...map.values()];
}

// Entscheidet, ob zwei Copyright-Angaben denselben Inhaber meinen (nur
// unterschiedlich geschrieben). `df` ist die Dokumenthäufigkeit der
// aussagekräftigen Token, `genericCap` die Grenze, ab der ein Token als generisch
// (nicht unterscheidungskräftig) gilt.
function sameCopyrightHolder(a, b, df, genericCap) {
    // 1) Reiner Formatierungsunterschied (Groß-/Kleinschreibung, Satzzeichen,
    //    Leerzeichen) → gleiche Angabe.
    if (a.norm === b.norm) return true;
    // 2) Namens-Enthaltensein: die aussagekräftigen Wörter der kürzeren Angabe
    //    stecken vollständig in der längeren (kurze vs. lange Schreibweise),
    //    und mindestens ein geteiltes Wort ist unterscheidungskräftig (nicht z. B.
    //    eine überall vorkommende Stadt).
    const [small, large] =
        a.sigSet.size <= b.sigSet.size ? [a.sigSet, b.sigSet] : [b.sigSet, a.sigSet];
    if (small.size > 0) {
        let contained = true;
        let hasDistinctive = false;
        for (const t of small) {
            if (!large.has(t)) {
                contained = false;
                break;
            }
            if ((df.get(t) || 0) <= genericCap) hasDistinctive = true;
        }
        if (contained && hasDistinctive) return true;
    }
    // 3) Tippfehlernahe Varianten: geringe Editierdistanz auf der normalisierten
    //    Form (nur bei ausreichender Länge, um Zufallstreffer zu vermeiden). Beide
    //    Angaben müssen mindestens ein aussagekräftiges Wort tragen.
    if (a.sigCount > 0 && b.sigCount > 0) {
        const la = a.norm.length;
        const lb = b.norm.length;
        const maxLen = Math.max(la, lb);
        if (maxLen >= 6) {
            const thresh = Math.max(1, Math.ceil(maxLen * 0.12));
            if (Math.abs(la - lb) <= thresh) {
                const dist = levenshtein(a.norm, b.norm);
                if (dist >= 1 && dist <= thresh) return true;
            }
        }
    }
    return false;
}

// Gruppiert distinkte Copyright-Angaben per Union-Find in Cluster „gleicher
// Inhaber, unterschiedliche Schreibweise“.
function clusterCopyrights(entries) {
    const n = entries.length;
    if (n < 2) return entries.map((e) => [e]);
    // Dokumenthäufigkeit der aussagekräftigen Token: in wie vielen distinkten
    // Angaben kommt ein Token vor. Seltene Token (Verlagsnamen) sind
    // unterscheidungskräftig, häufige (z. B. eine oft genannte Stadt) nicht.
    const df = new Map();
    entries.forEach((e) => e.sigSet.forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
    const genericCap = Math.max(4, Math.ceil(n * 0.3));

    const parent = [];
    for (let i = 0; i < n; i++) parent[i] = i;
    const find = (x) => {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };
    const union = (a, b) => {
        parent[find(a)] = find(b);
    };
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (sameCopyrightHolder(entries[i], entries[j], df, genericCap)) union(i, j);
        }
    }
    const byRoot = new Map();
    for (let i = 0; i < n; i++) {
        const r = find(i);
        if (!byRoot.has(r)) byRoot.set(r, []);
        byRoot.get(r).push(entries[i]);
    }
    return [...byRoot.values()];
}

function truncateText(value, max) {
    const s = String(value == null ? '' : value);
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// --- die eigentlichen Checks ----------------------------------------------

export const CHECKS = [
    // ===== Nummerierung =====
    {
        id: 'liednummer-fehlt',
        category: 'Nummerierung',
        title: 'Alle genommenen Lieder haben eine Liednummer (2026)',
        description:
            'Jedes „Bewertet und genommen“-Lied sollte eine Liednummer für das Gesangbuch 2026 besitzen.',
        run({ genommen }) {
            const fehlt = genommen.filter((l) => !hasNummer(l.liednummer2026));
            return result(
                fehlt.length === 0,
                'error',
                fehlt.length === 0
                    ? 'Alle genommenen Lieder haben eine Liednummer.'
                    : `${fehlt.length} genommene(s) Lied(er) ohne Liednummer 2026.`,
                fehlt.map((l) => songItem(l)),
            );
        },
    },
    {
        id: 'liednummer-luecken',
        category: 'Nummerierung',
        title: 'Keine Lücken in den Liednummern',
        description:
            'Die Liednummern (2026) der genommenen Lieder sollten eine lückenlose Reihe bilden.',
        run({ genommen }) {
            const seq = analyzeSequence(genommen.map((l) => l.liednummer2026));
            if (!seq.numbers.length) {
                return result(true, 'warning', 'Noch keine nummerierten Lieder vorhanden.', []);
            }
            const ok = seq.missing.length === 0;
            return result(
                ok,
                'error',
                ok
                    ? `Lückenlos von ${seq.min} bis ${seq.max} (${seq.numbers.length} Nummern).`
                    : `${seq.missing.length} fehlende Nummer(n) zwischen ${seq.min} und ${seq.max}.`,
                seq.missing.map((n) => ({ title: `Liednummer ${n} fehlt`, nummer: n })),
            );
        },
    },
    {
        id: 'liednummer-duplikate',
        category: 'Nummerierung',
        title: 'Keine doppelten Liednummern',
        description:
            'Keine Liednummer (2026) sollte mehrfach vergeben sein. Ausnahme: deutsche und fremdsprachige Fassungen desselben Liedes (verknüpft über die deutsche Liedfassung) dürfen sich eine Nummer teilen.',
        run({ genommen }) {
            const groups = _.groupBy(
                genommen.filter((l) => hasNummer(l.liednummer2026)),
                (l) => String(l.liednummer2026).trim().toLowerCase(),
            );
            // Eine Gruppe ist nur dann ein echtes Duplikat, wenn sie mehr als eine
            // eigenständige „Wurzel“ enthält – also mehr als ein Lied, das nicht
            // über die deutsche Liedfassung auf ein anderes Lied der Gruppe verweist.
            const dups = Object.values(groups).filter((arr) => {
                if (arr.length < 2) return false;
                const ids = new Set(arr.map((l) => l.id));
                const roots = arr.filter((l) => {
                    const ref = dlfId(l);
                    return ref == null || !ids.has(ref);
                });
                return roots.length > 1;
            });
            const items = dups.flatMap((arr) =>
                arr.map((l) => songItem(l, `Nr. ${l.liednummer2026}`)),
            );
            return result(
                dups.length === 0,
                'error',
                dups.length === 0
                    ? 'Alle Liednummern sind eindeutig (Liedfassungen ausgenommen).'
                    : `${dups.length} doppelt vergebene Nummer(n).`,
                items,
            );
        },
    },
    {
        id: 'liedfassung-nummer',
        category: 'Nummerierung',
        title: 'Liedfassungen tragen dieselbe Liednummer',
        description:
            'Lieder mit Verweis auf eine deutsche Liedfassung sollten dieselbe Liednummer (2026) wie diese tragen.',
        run({ genommen, alle }) {
            const byId = _.keyBy(alle, 'id');
            const items = [];
            genommen.forEach((l) => {
                const ref = dlfId(l);
                if (ref == null) return;
                const deutsch = byId[ref];
                if (!deutsch) return;
                const a = parseNummer(l.liednummer2026);
                const b = parseNummer(deutsch.liednummer2026);
                if (a != null && b != null && a !== b) {
                    items.push(
                        songItem(
                            l,
                            `Nr. ${l.liednummer2026} ≠ „${deutsch.titel || 'dt. Fassung'}“ (Nr. ${deutsch.liednummer2026})`,
                        ),
                    );
                }
            });
            return result(
                items.length === 0,
                'error',
                items.length === 0
                    ? 'Alle Liedfassungen tragen dieselbe Liednummer.'
                    : `${items.length} Lied(er) mit abweichender Nummer zur deutschen Fassung.`,
                items,
            );
        },
    },
    {
        id: 'chorbuchnummer-luecken',
        category: 'Nummerierung',
        title: 'Keine Lücken in den Chorbuchnummern',
        description:
            'Analog zu den Liednummern: die Chorbuchnummern der genommenen Lieder sollten lückenlos sein.',
        run({ genommen }) {
            const field = detectChorbuchField(genommen);
            if (!field) {
                return result(
                    true,
                    'info',
                    'Kein Chorbuchnummern-Feld in den Daten gefunden – Prüfung wird automatisch aktiv, sobald es existiert.',
                    [],
                );
            }
            const seq = analyzeSequence(genommen.map((l) => l[field]));
            if (!seq.numbers.length) {
                return result(
                    true,
                    'info',
                    `Noch keine Chorbuchnummern vergeben (Feld „${field}“).`,
                    [],
                );
            }
            const ok = seq.missing.length === 0;
            return result(
                ok,
                'warning',
                ok
                    ? `Lückenlos von ${seq.min} bis ${seq.max} (${seq.numbers.length} Nummern).`
                    : `${seq.missing.length} fehlende Chorbuchnummer(n) zwischen ${seq.min} und ${seq.max}.`,
                seq.missing.map((n) => ({ title: `Chorbuchnummer ${n} fehlt`, nummer: n })),
            );
        },
    },

    // ===== Bewertung =====
    {
        id: 'genommen-rein',
        category: 'Bewertung',
        title: 'Alle genommenen Lieder sind „Rein“ bewertet',
        description:
            'Jedes „Bewertet und genommen“-Lied sollte die Bewertung „Rein“ haben. Varianten wie „Rein, wenn“ zählen hier NICHT als „Rein“ und werden gemeldet (Issue #42).',
        run({ genommen }) {
            // Exakter Abgleich auf „Rein“ – nicht isRein() (includes), das „Rein, wenn“
            // fälschlich durchgehen ließe (Issue #42).
            const nichtRein = genommen.filter((l) => !isExactRein(l));
            return result(
                nichtRein.length === 0,
                'error',
                nichtRein.length === 0
                    ? 'Alle genommenen Lieder sind „Rein“.'
                    : `${nichtRein.length} genommene(s) Lied(er) ohne Bewertung „Rein“.`,
                nichtRein.map((l) =>
                    songItem(
                        l,
                        `Bewertung: ${l.bewertung_kleiner_kreis?.bezeichner || 'Unbewertet'}`,
                    ),
                ),
            );
        },
    },
    {
        id: 'rein-nicht-genommen',
        category: 'Bewertung',
        title: '„Rein“ bewertete Lieder sind auch genommen',
        description:
            'Lieder mit Bewertung „Rein“, die noch nicht den Status „Bewertet und genommen“ haben – evtl. übersehen?',
        run({ alle }) {
            const offen = alle.filter((l) => isRein(l) && !isGenommen(l));
            return result(
                offen.length === 0,
                'info',
                offen.length === 0
                    ? 'Alle „Rein“-Lieder sind genommen.'
                    : `${offen.length} „Rein“-Lied(er) noch nicht genommen.`,
                offen.map((l) => songItem(l, `Status: ${l.status_mapped || l.status}`)),
            );
        },
    },
    {
        id: 'aenderungsflag-offen',
        category: 'Bewertung',
        title: 'Keine offenen Änderungs-Markierungen',
        description:
            'Genommene Lieder, bei denen das Flag „Lied hat Änderung“ noch gesetzt ist (sollte nach Sichtung zurückgesetzt werden).',
        run({ genommen }) {
            const offen = genommen.filter((l) => l.liedHatAenderung);
            return result(
                offen.length === 0,
                'warning',
                offen.length === 0
                    ? 'Keine offenen Änderungs-Markierungen.'
                    : `${offen.length} genommene(s) Lied(er) mit gesetztem Änderungs-Flag.`,
                offen.map((l) => songItem(l)),
            );
        },
    },

    // ===== KI-Review =====
    {
        id: 'offene-ki-reviews',
        category: 'KI-Review',
        title: 'Keine offenen KI-Anmerkungen',
        description:
            'KI-Reviews zu Strophen genommener Lieder, die noch nicht akzeptiert/abgelehnt/diskutiert wurden.',
        run({ genommen }) {
            const items = genommen
                .map((l) => ({ lied: l, open: openKiReviews(l) }))
                .filter((x) => x.open.length > 0)
                .map((x) => songItem(x.lied, `${x.open.length} offene KI-Anmerkung(en)`));
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Keine offenen KI-Anmerkungen.'
                    : `${items.length} Lied(er) mit unbearbeiteten KI-Anmerkungen.`,
                items,
            );
        },
    },
    {
        id: 'ki-review-diskussion',
        category: 'KI-Review',
        title: 'Keine KI-Anmerkungen in Diskussion',
        description: 'Genommene Lieder mit KI-Anmerkungen, die als „Diskussion“ markiert sind.',
        run({ genommen }) {
            const items = genommen
                .map((l) => ({ lied: l, n: kiReviewsWithVerdict(l, 'discussion').length }))
                .filter((x) => x.n > 0)
                .map((x) => songItem(x.lied, `${x.n} KI-Anmerkung(en) in Diskussion`));
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Keine KI-Anmerkungen in Diskussion.'
                    : `${items.length} Lied(er) mit KI-Anmerkungen in Diskussion.`,
                items,
            );
        },
    },

    // ===== Redaktion / Inhalt =====
    {
        id: 'korrektur-gelesen',
        category: 'Redaktion',
        title: 'Texte sind korrekturgelesen',
        description: 'Genommene Lieder, deren Text noch nicht als korrekturgelesen markiert ist.',
        run({ genommen }) {
            const offen = genommen.filter((l) => l.text && l.text.korrekturlesung1 !== true);
            return result(
                offen.length === 0,
                'warning',
                offen.length === 0
                    ? 'Alle Texte sind korrekturgelesen.'
                    : `${offen.length} genommene(s) Lied(er) ohne Korrekturlesung.`,
                offen.map((l) => songItem(l)),
            );
        },
    },
    {
        id: 'offene-aenderungsvorschlaege',
        category: 'Redaktion',
        title: 'Keine offenen Änderungsvorschläge',
        description:
            'Strophen genommener Lieder mit noch nicht eingearbeiteten Änderungsvorschlägen.',
        run({ genommen }) {
            const items = genommen
                .map((l) => ({ lied: l, s: openSuggestions(l) }))
                .filter((x) => x.s.length > 0)
                .map((x) => songItem(x.lied, `${x.s.length} Vorschlag/Vorschläge`));
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Keine offenen Änderungsvorschläge.'
                    : `${items.length} Lied(er) mit offenen Änderungsvorschlägen.`,
                items,
            );
        },
    },
    {
        id: 'offene-anmerkungen',
        category: 'Redaktion',
        title: 'Keine offenen Strophen-Anmerkungen',
        description: 'Strophen genommener Lieder, die noch eine Anmerkung tragen.',
        run({ genommen }) {
            const items = genommen
                .map((l) => ({ lied: l, a: openRemarks(l) }))
                .filter((x) => x.a.length > 0)
                .map((x) => songItem(x.lied, `${x.a.length} Anmerkung(en)`));
            return result(
                items.length === 0,
                'info',
                items.length === 0
                    ? 'Keine offenen Anmerkungen.'
                    : `${items.length} Lied(er) mit Strophen-Anmerkungen.`,
                items,
            );
        },
    },
    {
        id: 'todo-in-anmerkungen',
        category: 'Redaktion',
        title: 'Keine „ToDo“-Marker in Anmerkungsfeldern',
        description:
            'Offene Punkte werden in den Anmerkungsfeldern häufig mit „ToDo“ markiert (z. B. eine noch zu klärende Melodie-Bewertung „Rein, wenn“). Vor dem finalen Export sollten keine solchen Marker mehr übrig sein. Geprüft werden die Anmerkungsfelder von Lied, Text und Melodie genommener Lieder auf „ToDo“/„To-Do“/„To Do“ (Groß-/Kleinschreibung egal). Siehe Issue #69.',
        run({ genommen }) {
            const items = [];
            genommen.forEach((l) => {
                const stellen = [
                    ['Lied', l.anmerkung],
                    ['Text', l.text?.anmerkung],
                    ['Melodie', l.melodie?.anmerkung],
                ]
                    .filter(([, wert]) => TODO_ANMERKUNG_REGEX.test(String(wert || '')))
                    .map(([label]) => label);
                if (stellen.length) {
                    // Quellen mit „ · “ (Mittelpunkt) trennen – hebt Lied, Text und
                    // Melodie deutlicher voneinander ab als ein Komma (wie beim
                    // Copyright-Check).
                    items.push(songItem(l, `„ToDo“ in Anmerkung: ${stellen.join(' · ')}`));
                }
            });
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Keine „ToDo“-Marker in Anmerkungsfeldern.'
                    : `${items.length} genommene(s) Lied(er) mit „ToDo“ in einem Anmerkungsfeld.`,
                items,
            );
        },
    },
    {
        id: 'fehlende-autoren',
        category: 'Redaktion',
        title: 'Autor oder Copyright vorhanden',
        description:
            'Genommene Lieder ganz ohne Autorenangabe und ohne Copyright (Text, Melodie und Lied).',
        run({ genommen }) {
            const fehlt = genommen.filter((l) => {
                const textHas = l.text?.authors?.length || l.text?.copyright;
                const meloHas = l.melodie?.authors?.length || l.melodie?.copyright;
                return !(textHas || meloHas || l.copyright);
            });
            return result(
                fehlt.length === 0,
                'info',
                fehlt.length === 0
                    ? 'Alle genommenen Lieder haben Autor- oder Copyright-Angaben.'
                    : `${fehlt.length} genommene(s) Lied(er) ohne jede Autor-/Copyright-Angabe.`,
                fehlt.map((l) => songItem(l)),
            );
        },
    },
    {
        id: 'text-melodie-ohne-autor',
        category: 'Redaktion',
        title: 'Text und Melodie haben mindestens einen Autor',
        description:
            'Jedes genommene Lied soll sowohl beim Text als auch bei der Melodie mindestens einen Autor hinterlegt haben. Anders als der Check „Autor oder Copyright vorhanden“ (der ein Copyright genügen lässt) verlangt diese Prüfung je Seite einen echten Autoreneintrag. Gemeldet werden genommene Lieder, deren Autorenliste beim Text und/oder der Melodie leer ist (Issue #72).',
        run({ genommen }) {
            const items = [];
            genommen.forEach((l) => {
                const fehlend = [];
                if (!l.text?.authors?.length) fehlend.push('Text');
                if (!l.melodie?.authors?.length) fehlend.push('Melodie');
                if (fehlend.length) {
                    items.push(songItem(l, `Kein Autor bei: ${fehlend.join(' & ')}`));
                }
            });
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Text und Melodie aller genommenen Lieder haben mindestens einen Autor.'
                    : `${items.length} genommene(s) Lied(er) ohne Autor bei Text und/oder Melodie.`,
                items,
            );
        },
    },
    {
        id: 'autoren-nicht-veroeffentlicht',
        category: 'Redaktion',
        title: 'Autoren sind „Veröffentlicht“',
        description:
            'Autoren genommener Lieder, die noch nicht den Status „Veröffentlicht“ haben. Dieser Status wird erst gesetzt, wenn der Autor korrekturgelesen und insbesondere die Geburts-/Sterbedaten gegengeprüft wurden (siehe Issue #14). Gezählt wird jeder Autor (Text und Melodie) einmal.',
        run({ genommen, authors }) {
            const byId = _.keyBy(authors || [], 'id');
            // Distinkte Autoren der genommenen Lieder mit Anzahl betroffener Lieder.
            // Die maßgebliche Autor-Angabe (inkl. Status) kommt aus `authors`,
            // verknüpft über `autor_id` – nicht aus dem eingebetteten Autor-Objekt,
            // dessen `id` die Verknüpfungszeile und nicht den Autor meint.
            const liederProAutor = {};
            genommen.forEach((l) => {
                const gesehen = new Set();
                [...(l.text?.authors || []), ...(l.melodie?.authors || [])].forEach((a) => {
                    const id = a?.autor_id;
                    if (id == null || gesehen.has(id)) return;
                    gesehen.add(id);
                    liederProAutor[id] = (liederProAutor[id] || 0) + 1;
                });
            });
            const items = Object.keys(liederProAutor)
                .map((id) => byId[id])
                .filter((autor) => autor && autor.status !== AUTOR_VEROEFFENTLICHT_STATUS)
                .map((autor) => {
                    const statusLabel =
                        status_mapping[autor.status] || autor.status || 'ohne Status';
                    const anzahl = liederProAutor[autor.id];
                    const name =
                        autor.name ||
                        `${autor.vorname || ''} ${autor.nachname || ''}`.trim() ||
                        `Autor #${autor.id}`;
                    return {
                        title: name,
                        detail: `Status: ${statusLabel} – in ${anzahl} genommenen Lied(ern)`,
                    };
                });
            const sortiert = _.sortBy(items, (i) => i.title.toLowerCase());
            return result(
                sortiert.length === 0,
                'warning',
                sortiert.length === 0
                    ? 'Alle Autoren genommener Lieder sind „Veröffentlicht“.'
                    : `${sortiert.length} Autor(en) genommener Lieder noch nicht „Veröffentlicht“.`,
                sortiert,
            );
        },
    },
    {
        id: 'doppelte-titel',
        category: 'Redaktion',
        title: 'Keine doppelten Titel',
        description: 'Genommene Lieder mit identischem Titel (mögliche Dubletten).',
        run({ genommen }) {
            const groups = _.groupBy(
                genommen.filter((l) => l.titel && l.titel.trim()),
                (l) => l.titel.trim().toLowerCase(),
            );
            const dups = Object.values(groups).filter((arr) => arr.length > 1);
            const items = dups.flatMap((arr) => arr.map((l) => songItem(l)));
            return result(
                dups.length === 0,
                'info',
                dups.length === 0
                    ? 'Keine doppelten Titel.'
                    : `${dups.length} Titel mehrfach vergeben.`,
                items,
            );
        },
    },

    {
        id: 'lied-text-titel-abweichung',
        category: 'Redaktion',
        title: 'Lied-Titel stimmt mit Text-Titel überein',
        description:
            'Hinweis (kein Fehler): Genommene Lieder, deren eigener Titel vom Titel des verknüpften Textes abweicht. In vielen Fällen ist das in Ordnung – manchmal ist aber auch eine echte Abweichung durchgerutscht, die man sich noch einmal anschauen sollte. Verglichen wird ohne Beachtung von Groß-/Kleinschreibung und mehrfachen Leerzeichen. Lieder ohne verknüpften Text oder ohne Text-Titel werden übersprungen.',
        run({ genommen }) {
            // Normalisiert einen Titel für den Vergleich: Unicode (NFC),
            // Whitespace zusammenfassen, trimmen, Kleinschreibung – so lösen reine
            // Formatierungs-/Schreibungsunterschiede keinen Hinweis aus.
            const norm = (value) =>
                String(value || '')
                    .normalize('NFC')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();
            const items = [];
            genommen.forEach((l) => {
                const liedTitel = (l.titel || '').trim();
                const textTitel = (l.text_titel || '').trim();
                // Nur vergleichen, wenn beide Titel vorhanden sind.
                if (!liedTitel || !textTitel) return;
                if (norm(liedTitel) !== norm(textTitel)) {
                    items.push(songItem(l, `Lied „${liedTitel}“ ≠ Text „${textTitel}“`));
                }
            });
            return result(
                items.length === 0,
                'info',
                items.length === 0
                    ? 'Alle Lied-Titel stimmen mit dem Titel des verknüpften Textes überein.'
                    : `${items.length} Lied(er) mit abweichendem Text-Titel.`,
                items,
            );
        },
    },

    {
        id: 'lied-titel-erste-strophe',
        category: 'Redaktion',
        title: 'Titel stimmt mit dem Anfang der 1. Strophe überein',
        description:
            'Hinweis (kein Fehler): Genommene Lieder, deren erste Strophe nicht mit dem Liedtitel beginnt. Üblicherweise beginnt die 1. Strophe mit dem Titel (z. B. Titel „Lobe den Herren“). Weicht der Anfang ab, kann ein Tippfehler oder ein vertauschter Titel dahinterstecken. Verglichen wird ohne Beachtung von Groß-/Kleinschreibung, Silbentrennzeichen, Anführungszeichen und Apostrophen („Hochzeichen“), Wiederholungszeichen (|: :|), Zeilenumbrüchen und mehrfachen Leerzeichen – der Titel darf also über die erste Notenzeile hinausreichen. Satzzeichen wie Punkt, Komma und Ausrufezeichen werden hingegen mitverglichen. Lieder ohne Titel oder ohne (gefüllte) 1. Strophe werden übersprungen.',
        run({ genommen }) {
            // Vergleichsnormalisierung: Unicode (NFC), Silbentrennzeichen entfernen,
            // Hochzeichen entfernen, Wiederholungszeichen entfernen, Whitespace
            // zusammenfassen, trimmen, Kleinschreibung.
            //
            // Nur Anführungszeichen/Apostrophe werden entfernt (siehe
            // HOCHZEICHEN_REGEX), weil ein Titel oft als Zitat in Anführungszeichen
            // steht, die Strophe denselben Wortlaut aber ohne. Satzzeichen wie
            // . , ! ? bleiben absichtlich erhalten und müssen mit dem Titel
            // übereinstimmen. Wiederholungszeichen (|: :|) gehören zur Notation,
            // nicht zum Text, und werden entfernt (Issue #34).
            const norm = (value) =>
                String(value || '')
                    .normalize('NFC')
                    .split(SILBENTRENNER)
                    .join('')
                    .replace(HOCHZEICHEN_REGEX, '')
                    .replace(WIEDERHOLUNGSZEICHEN_REGEX, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();
            const items = [];
            genommen.forEach((l) => {
                const titel = (l.titel || '').trim();
                if (!titel) return;
                // Ganze 1. Strophe – Zeilenumbrüche werden ignoriert, weil der
                // Titel über die erste Notenzeile hinausreichen kann (norm() fasst
                // jeglichen Whitespace inkl. \n zu einem Leerzeichen zusammen).
                const strophe1 = verseText(strophen(l)[0]);
                if (!strophe1.trim()) return;
                // In code gedacht (Issue #17): strophe1.startsWith(title)
                if (!norm(strophe1).startsWith(norm(titel))) {
                    // Für die Anzeige nur den (einzeiligen) Anfang der Strophe zeigen.
                    const anfang = strophe1
                        .split(SILBENTRENNER)
                        .join('')
                        .replace(/\s+/g, ' ')
                        .trim();
                    const gekuerzt = anfang.length > 60 ? `${anfang.slice(0, 60)}…` : anfang;
                    items.push(
                        songItem(l, `Titel „${titel}“ ≠ Anfang der 1. Strophe „${gekuerzt}“`),
                    );
                }
            });
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Alle genommenen Lieder beginnen mit ihrem Titel.'
                    : `${items.length} Lied(er), deren 1. Strophe nicht mit dem Titel beginnt.`,
                items,
            );
        },
    },

    {
        id: 'leere-strophen',
        category: 'Redaktion',
        title: 'Keine leeren Strophen',
        description:
            'Eine Strophe ganz ohne Textinhalt deutet auf einen Eingabefehler hin – etwa eine versehentlich angelegte oder beim Übertragen leer gebliebene Strophe. Gemeldet werden genommene Lieder, deren Strophenliste leere Einträge (ohne sichtbaren Text) enthält.',
        run({ genommen }) {
            const items = [];
            genommen.forEach((l) => {
                const leer = [];
                strophen(l).forEach((s, index) => {
                    if (verseText(s).trim() === '') leer.push(index + 1);
                });
                if (leer.length) {
                    const label = leer.length === 1 ? 'Strophe' : 'Strophen';
                    items.push(songItem(l, `${label} ${leer.join(', ')} ohne Textinhalt`));
                }
            });
            return result(
                items.length === 0,
                'error',
                items.length === 0
                    ? 'Keine leeren Strophen.'
                    : `${items.length} genommene(s) Lied(er) mit leeren Strophen.`,
                items,
            );
        },
    },

    {
        id: 'strophen-anfuehrungszeichen',
        category: 'Redaktion',
        title: 'Nur deutsche Anführungszeichen „ “ in Strophentexten',
        description:
            'Strophentexte sollen ausschließlich die deutschen Anführungszeichen „ und “ verwenden. Gerade (") oder andere Varianten lassen sich mit dem Skript 10-normalize-quotation-marks.py automatisch ersetzen.',
        run({ genommen }) {
            const verboten = Object.keys(VERBOTENE_DOPPEL_ANFUEHRUNGSZEICHEN);
            const items = [];
            genommen.forEach((l) => {
                const gefunden = new Set();
                let betroffeneStrophen = 0;
                strophen(l).forEach((s) => {
                    const text = verseText(s);
                    const inDieser = verboten.filter((ch) => text.includes(ch));
                    if (inDieser.length) {
                        betroffeneStrophen++;
                        inDieser.forEach((ch) => gefunden.add(ch));
                    }
                });
                if (gefunden.size) {
                    const zeichen = [...gefunden]
                        .map((ch) => VERBOTENE_DOPPEL_ANFUEHRUNGSZEICHEN[ch])
                        .join(', ');
                    items.push(songItem(l, `${betroffeneStrophen} Strophe(n) mit ${zeichen}`));
                }
            });
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Alle Strophentexte verwenden nur deutsche Anführungszeichen „ “.'
                    : `${items.length} Lied(er) mit unerwünschten Anführungszeichen in Strophentexten.`,
                items,
            );
        },
    },

    {
        id: 'apostroph-variante',
        category: 'Redaktion',
        title: 'Nur das Apostroph „’“ in Texten, Titeln und Autorenangaben',
        description:
            "Zum Verkürzen von Wörtern soll ausschließlich das rechte einfache Anführungszeichen ’ (U+2019) verwendet werden – nicht der gerade Apostroph ('), Akut (´), Gravis (`) o. Ä. Geprüft werden Strophentexte, die Titel von Lied, Text und Melodie sowie die Autoren-Präfixe und -Suffixe (Issue #25). Die Varianten lassen sich mit dem Skript 10-normalize-quotation-marks.py automatisch ersetzen.",
        run({ genommen }) {
            const verboten = Object.keys(VERBOTENE_APOSTROPHE);
            const enthaltene = (wert) => verboten.filter((ch) => String(wert || '').includes(ch));
            const items = [];
            genommen.forEach((l) => {
                const gefunden = new Set();
                const stellen = [];
                // Titel von Lied, Text und Melodie (vgl. Issue #7).
                [
                    ['Liedtitel', l.titel],
                    ['Texttitel', l.text_titel],
                    ['Melodietitel', l.melodie_titel],
                ].forEach(([label, wert]) => {
                    const treffer = enthaltene(wert);
                    if (treffer.length) {
                        stellen.push(label);
                        treffer.forEach((ch) => gefunden.add(ch));
                    }
                });
                // Strophentexte.
                let betroffeneStrophen = 0;
                strophen(l).forEach((s) => {
                    const treffer = enthaltene(verseText(s));
                    if (treffer.length) {
                        betroffeneStrophen++;
                        treffer.forEach((ch) => gefunden.add(ch));
                    }
                });
                if (betroffeneStrophen) {
                    stellen.push(`${betroffeneStrophen} Strophe(n)`);
                }
                // Autoren-Präfixe und -Suffixe von Text und Melodie (Issue #25).
                let betroffeneAutoren = 0;
                [...(l.text?.authors || []), ...(l.melodie?.authors || [])].forEach((a) => {
                    const treffer = [...enthaltene(a?.autorPrefix), ...enthaltene(a?.autorSuffix)];
                    if (treffer.length) {
                        betroffeneAutoren++;
                        treffer.forEach((ch) => gefunden.add(ch));
                    }
                });
                if (betroffeneAutoren) {
                    stellen.push(`${betroffeneAutoren} Autor-Präfix/-Suffix`);
                }
                if (gefunden.size) {
                    const zeichen = [...gefunden].map((ch) => VERBOTENE_APOSTROPHE[ch]).join(', ');
                    items.push(songItem(l, `${stellen.join(', ')} – mit ${zeichen}`));
                }
            });
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Alle Strophentexte, Titel und Autorenangaben verwenden nur das Apostroph ’.'
                    : `${items.length} Lied(er) mit abweichenden Apostroph-Varianten.`,
                items,
            );
        },
    },

    {
        id: 'strophen-ohne-silbentrenner',
        category: 'Redaktion',
        // Silbentrennung (¬) ist abgeschlossen und das Trennzeichen aus den
        // Texten entfernt – dieser Check ist damit gegenstandslos und wird
        // ausgeblendet (siehe Filter in runChecks). hidden entfernen zum Reaktivieren.
        hidden: true,
        title: 'Alle Strophen sind in Silben getrennt',
        description:
            'Strophentexte werden für die Silben-/Notenausrichtung mit dem Trennzeichen „¬“ versehen. Hier werden genommene Lieder gemeldet, bei denen einzelne Strophen (mit Text) noch kein einziges Silbentrennzeichen enthalten.',
        run({ genommen }) {
            const items = [];
            genommen.forEach((l) => {
                const ohne = [];
                strophen(l).forEach((s, index) => {
                    const text = verseText(s).trim();
                    // Leere Strophen können nicht getrennt werden – überspringen.
                    if (text !== '' && !text.includes(SILBENTRENNER)) {
                        ohne.push(index + 1);
                    }
                });
                if (ohne.length) {
                    const label = ohne.length === 1 ? 'Strophe' : 'Strophen';
                    items.push(songItem(l, `${label} ${ohne.join(', ')} ohne Silbentrennzeichen`));
                }
            });
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Alle Strophen mit Text sind in Silben getrennt.'
                    : `${items.length} Lied(er) mit Strophen ohne Silbentrennzeichen.`,
                items,
            );
        },
    },

    {
        id: 'silbentrennung-minus',
        category: 'Redaktion',
        // Silbentrennung (¬) ist abgeschlossen – Check ausgeblendet (siehe
        // Filter in runChecks). hidden entfernen zum Reaktivieren.
        hidden: true,
        title: 'Silbentrennung mit „-“ statt „¬“',
        description:
            'Beim Korrekturlesen wurde an einzelnen Stellen ein Minus „-“ statt des Silbentrennzeichens „¬“ gesetzt (z. B. „o-ben“ statt „o¬ben“, „Treu-e“ statt „Treu¬e“). Gemeldet werden genommene Lieder, in deren Strophen ein „-“ mit jeweils einem Buchstaben davor und dahinter steht – ein Hinweis auf eine fälschlich mit Minus getrennte Silbe (Issue #39).',
        run({ genommen }) {
            const items = [];
            genommen.forEach((l) => {
                const woerter = new Set();
                const betroffeneStrophen = [];
                strophen(l).forEach((s, index) => {
                    const treffer = verseText(s).match(SILBEN_MINUS_WORT_REGEX);
                    if (treffer && treffer.length) {
                        betroffeneStrophen.push(index + 1);
                        treffer.forEach((w) => woerter.add(w));
                    }
                });
                if (woerter.size) {
                    const label = betroffeneStrophen.length === 1 ? 'Strophe' : 'Strophen';
                    const beispiele = [...woerter].slice(0, 5).join(', ');
                    const mehr = woerter.size > 5 ? ` … (+${woerter.size - 5})` : '';
                    items.push(
                        songItem(
                            l,
                            `${label} ${betroffeneStrophen.join(', ')}: ${beispiele}${mehr}`,
                        ),
                    );
                }
            });
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Keine mit „-“ getrennten Silben gefunden.'
                    : `${items.length} Lied(er) mit fälschlich per „-“ getrennten Silben.`,
                items,
            );
        },
    },

    {
        id: 'gedankenstrich-minus',
        category: 'Redaktion',
        title: 'Gedankenstrich „–“ statt „ - “',
        description:
            'Ein von Leerzeichen umschlossenes Minus „ - “ soll als Gedankenstrich (Halbgeviertstrich) „ – “ gesetzt werden. Gemeldet werden genommene Lieder, in deren Strophen die Zeichenfolge „ - “ vorkommt (Issue #40).',
        run({ genommen }) {
            const items = [];
            genommen.forEach((l) => {
                let anzahl = 0;
                const betroffeneStrophen = [];
                strophen(l).forEach((s, index) => {
                    const treffer = verseText(s).match(GEDANKENSTRICH_MINUS_REGEX);
                    if (treffer && treffer.length) {
                        betroffeneStrophen.push(index + 1);
                        anzahl += treffer.length;
                    }
                });
                if (anzahl) {
                    const label = betroffeneStrophen.length === 1 ? 'Strophe' : 'Strophen';
                    items.push(
                        songItem(l, `${anzahl}× „ - “ in ${label} ${betroffeneStrophen.join(', ')}`),
                    );
                }
            });
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Keine von Leerzeichen umschlossenen „ - “ gefunden.'
                    : `${items.length} Lied(er) mit „ - “ statt Gedankenstrich „ – “.`,
                items,
            );
        },
    },

    {
        id: 'strophen-auslassung',
        category: 'Redaktion',
        title: 'Keine ausgelassenen Strophentexte (…)',
        description:
            'Strophentexte, die „...“ oder „…“ enthalten – ein deutlicher Hinweis darauf, dass der Stropheninhalt nicht vollständig übertragen wurde.',
        run({ genommen }) {
            const items = [];
            genommen.forEach((l) => {
                const betroffen = [];
                strophen(l).forEach((s, index) => {
                    if (AUSLASSUNGS_REGEX.test(verseText(s))) betroffen.push(index + 1);
                });
                if (betroffen.length) {
                    const label = betroffen.length === 1 ? 'Strophe' : 'Strophen';
                    items.push(
                        songItem(l, `${label} ${betroffen.join(', ')} mit Auslassungszeichen`),
                    );
                }
            });
            return result(
                items.length === 0,
                'warning',
                items.length === 0
                    ? 'Keine Strophentexte mit Auslassungszeichen.'
                    : `${items.length} Lied(er) mit „...“/„…“ in Strophentexten.`,
                items,
            );
        },
    },

    {
        id: 'strophen-laenge-ausreisser',
        category: 'Redaktion',
        title: 'Strophen eines Liedes etwa gleich lang',
        description:
            'Die Strophen eines Liedes sollten ähnlich viel Text enthalten. Stark abweichende Strophen können auf nicht vollständig übertragenen Text, einen nur in einer Strophe eingetragenen Refrain oder ein als Anmerkungsfeld missbrauchtes Strophen-Feld hindeuten. Verglichen wird die sichtbare Zeichenzahl (ohne Silbentrennzeichen und Leerzeichen) gegen den Median des Liedes – erst ab 3 gefüllten Strophen.',
        run({ genommen }) {
            const items = [];
            genommen.forEach((l) => {
                // Nur gefüllte Strophen vergleichen (leere verzerren den Median).
                const lengths = strophen(l)
                    .map((s, index) => ({ nr: index + 1, len: verseLength(s) }))
                    .filter((x) => x.len > 0);
                if (lengths.length < STROPHENLAENGE_MIN_STROPHEN) return;
                const med = median(lengths.map((x) => x.len));
                if (med <= 0) return;
                const ausreisser = lengths.filter((x) => {
                    const ratio = x.len / med;
                    const abweichend =
                        ratio < STROPHENLAENGE_UNTERGRENZE || ratio > STROPHENLAENGE_OBERGRENZE;
                    // Zusätzlich eine absolute Mindestabweichung verlangen, damit kurze
                    // Strophen (z. B. Median 10) keine Fehlalarme auslösen.
                    return abweichend && Math.abs(x.len - med) >= STROPHENLAENGE_MIN_DIFF;
                });
                if (ausreisser.length) {
                    const detail = ausreisser
                        .map(
                            (x) =>
                                `Strophe ${x.nr}: ${x.len} Z. (${x.len < med ? 'kürzer' : 'länger'})`,
                        )
                        .join(', ');
                    items.push(songItem(l, `${detail} – Median ${Math.round(med)} Z.`));
                }
            });
            return result(
                items.length === 0,
                'info',
                items.length === 0
                    ? 'Alle Lieder haben etwa gleich lange Strophen.'
                    : `${items.length} Lied(er) mit auffällig unterschiedlichen Strophenlängen.`,
                items,
            );
        },
    },

    // ===== Copyright =====
    {
        id: 'copyright-schreibweisen',
        category: 'Copyright',
        title: 'Einheitliche Schreibweise der Copyright-Angaben',
        description:
            'Hinweis (kein Fehler): Findet ähnliche, aber unterschiedlich geschriebene Copyright-Angaben genommener Lieder – über die drei Felder Text-, Melodie- und Lied-Copyright hinweg –, damit sie vereinheitlicht werden können. Beispiel: „Bärenreiter-Verlag, Kassel“ vs. „Bärenreiter-Verlag Karl Vötterle GmbH & Co. KG, Kassel“. Verglichen wird ohne Beachtung von Groß-/Kleinschreibung, Satzzeichen und generischen Zusätzen (Verlag, GmbH, Co., KG …). Erkannt werden kurze/lange Schreibweisen desselben Herstellers, reine Formatierungsunterschiede sowie tippfehlernahe Varianten. Je Gruppe wird die häufigste Schreibweise als Angleichungs-Vorschlag markiert.',
        run({ genommen }) {
            const entries = collectCopyrightEntries(genommen);
            // Nur Angaben mit mindestens einem aussagekräftigen Wort lassen sich
            // sinnvoll vergleichen.
            const comparable = entries.filter((e) => e.sigCount > 0);
            const usageOf = (group) => group.reduce((sum, e) => sum + e.songIds.size, 0);
            // Interessant sind nur Cluster mit mehr als einer Schreibweise.
            const groups = clusterCopyrights(comparable)
                .filter((c) => c.length > 1)
                .sort((a, b) => b.length - a.length || usageOf(b) - usageOf(a));

            const items = [];
            groups.forEach((group, groupIdx) => {
                const sorted = [...group].sort((x, y) => y.songIds.size - x.songIds.size);
                // Häufigste Schreibweise als Angleichungs-Vorschlag.
                const canonicalShort = truncateText(sorted[0].raw, 48);
                sorted.forEach((e, idx) => {
                    const nr = e.example
                        ? e.example.liednummer2026 || e.example.liednummer2000 || null
                        : null;
                    const detail = [
                        `${e.songIds.size}×`,
                        [...e.fields].join('/'),
                        nr ? `z. B. Nr. ${nr}` : null,
                    ]
                        .filter(Boolean)
                        .join(' · ');
                    items.push({
                        id: e.example ? e.example.id : undefined,
                        title: e.raw,
                        detail,
                        // Gruppen-Index: fasst die Einträge einer Gruppe in der
                        // Anzeige zusammen (Randstrich + gemeinsamer Kopf).
                        group: groupIdx,
                        // Kopfzeile nur am ersten (häufigsten) Eintrag der Gruppe.
                        groupHeader:
                            idx === 0
                                ? `${sorted.length} Schreibweisen · Vorschlag: „${canonicalShort}“`
                                : undefined,
                    });
                });
            });

            return result(
                groups.length === 0,
                'info',
                groups.length === 0
                    ? 'Keine ähnlichen, aber unterschiedlich geschriebenen Copyright-Angaben gefunden.'
                    : `${groups.length} Gruppe(n) ähnlicher, aber unterschiedlich geschriebener Copyright-Angaben.`,
                items,
            );
        },
    },

    // ===== Export-Bereitschaft =====
    {
        id: 'kein-notentext',
        category: 'Export-Bereitschaft',
        title: 'Notentext vorhanden',
        description:
            'Genommene Lieder ohne hinterlegten Notentext – diese können nicht als PDF exportiert werden.',
        run({ genommen }) {
            const fehlt = genommen.filter((l) => !l.notentext);
            return result(
                fehlt.length === 0,
                'warning',
                fehlt.length === 0
                    ? 'Alle genommenen Lieder haben einen Notentext.'
                    : `${fehlt.length} genommene(s) Lied(er) ohne Notentext.`,
                fehlt.map((l) => songItem(l)),
            );
        },
    },
    {
        id: 'fehlende-verknuepfung',
        category: 'Export-Bereitschaft',
        title: 'Text und Melodie verknüpft',
        description: 'Genommene Lieder, denen ein verknüpfter Text oder eine Melodie fehlt.',
        run({ genommen }) {
            const fehlt = genommen
                .map((l) => {
                    const missing = [];
                    if (!l.text) missing.push('Text');
                    if (!l.melodie) missing.push('Melodie');
                    return { lied: l, missing };
                })
                .filter((x) => x.missing.length > 0);
            return result(
                fehlt.length === 0,
                'error',
                fehlt.length === 0
                    ? 'Alle genommenen Lieder sind mit Text und Melodie verknüpft.'
                    : `${fehlt.length} genommene(s) Lied(er) mit fehlender Verknüpfung.`,
                fehlt.map((x) => songItem(x.lied, `Fehlt: ${x.missing.join(' & ')}`)),
            );
        },
    },
];

// Führt alle Checks aus und liefert die angereicherten Ergebnisse zurück.
// `authors` ist die vollständige Autorenliste (store.authors) – für Prüfungen,
// die den Autor-Status (z. B. „Veröffentlicht“) auswerten.
export function runChecks(alle, authors) {
    const list = alle || [];
    const genommen = list.filter(isGenommen);
    const ctx = { alle: list, genommen, authors: authors || [] };
    // Ausgeblendete Checks (z. B. abgeschlossene Silbentrennung) überspringen.
    return CHECKS.filter((check) => !check.hidden).map((check) => {
        let r;
        try {
            r = check.run(ctx);
        } catch (e) {
            r = {
                status: 'error',
                summary: `Prüfung fehlgeschlagen: ${e?.message || e}`,
                items: [],
            };
        }
        return { ...check, ...r, count: r.items?.length || 0 };
    });
}
