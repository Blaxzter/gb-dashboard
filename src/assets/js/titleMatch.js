// Unscharfer Titelvergleich für den Notentext-Upload: Dateinamen gegen Lied-
// bzw. Melodietitel. Aus NotentextUploadView herausgezogen, damit auch die
// Melodie-Zuordnung der Choralbuchsätze (Issue #108) dieselben Maße nutzt und
// sich testen lässt.

export function normalize(s) {
    return (s || '')
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function levenshtein(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = dp[j];
            dp[j] = a[i - 1] === b[j - 1]
                ? prev
                : Math.min(prev, dp[j], dp[j - 1]) + 1;
            prev = tmp;
        }
    }
    return dp[b.length];
}

export function similarity(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const d = levenshtein(a, b);
    return 1 - d / Math.max(a.length, b.length);
}

// Slides the shorter string over the longer and returns the best window similarity.
// Handles "filename is a prefix/substring of song title" (and vice versa) cleanly.
export function partialRatio(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    if (longer.includes(shorter)) return 1;
    const len = shorter.length;
    let best = 0;
    for (let i = 0; i <= longer.length - len; i++) {
        const sim = 1 - levenshtein(shorter, longer.slice(i, i + len)) / len;
        if (sim > best) best = sim;
        if (best === 1) break;
    }
    return best;
}

// Asymmetric token overlap: how much of the smaller token set is covered.
// Handles word reordering and extra trailing words ("Befiehl du deine Wege und was...").
export function tokenSetRatio(a, b) {
    const ta = new Set(a.split(' ').filter(Boolean));
    const tb = new Set(b.split(' ').filter(Boolean));
    if (!ta.size || !tb.size) return 0;
    let intersect = 0;
    for (const t of ta) if (tb.has(t)) intersect++;
    return intersect / Math.min(ta.size, tb.size);
}

export function hybridScore(candidate, query) {
    if (!candidate || !query) return 0;
    return Math.max(partialRatio(candidate, query), tokenSetRatio(candidate, query));
}

// --- Choralbuchsatz → Melodie (Issue #108) -----------------------------------
//
// Der Choralbuchsatz trägt im Kopf die Choralbuchnummer und den Titel des
// Liedes, unter dem die Melodie im Choralbuch steht – das ist oft NICHT der
// Melodietitel in Directus (z. B. „Herr, zur Taufe schenke Segen" liegt auf der
// Melodie „Ich will beten, Gott wird hören (ungenutzt)", Choralbuch-Nr. 177).
// Deshalb zählt neben dem Melodietitel jeder Titel eines Liedes, das auf der
// Melodie gesungen wird.

// Klammerzusätze wie „(ungenutzt)" oder „(alternative Melodie)" gehören nicht
// zum Titel, der im Dateinamen steht.
function melodieTitleCore(titel) {
    return (titel || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

/**
 * @param {{normalizedBase:string, liednummer:string|null}} parsed  aus parseFilename
 * @param {Array} melodien   store.melodies
 * @param {Array} lieder     store.gesangbuchlieder (braucht id, titel, melodieId)
 * @returns {Array<{melodie, score:number, reason:string}>}  beste zuerst
 */
export function rankMelodienForChoralbuch(parsed, melodien, lieder, limit = 5) {
    const liedTitelByMelodie = new Map();
    for (const l of lieder || []) {
        if (!l?.melodieId || !l.titel) continue;
        if (!liedTitelByMelodie.has(l.melodieId)) liedTitelByMelodie.set(l.melodieId, []);
        liedTitelByMelodie.get(l.melodieId).push(l.titel);
    }
    const query = parsed.normalizedBase;
    const scored = (melodien || []).map((melodie) => {
        const reason = [];
        let score = 0;
        const nummer = melodie.choralbuchNummer;
        const hasNummer = nummer !== null && nummer !== undefined && nummer !== '';
        // Eine führende Zahl im Dateinamen ist hier die Choralbuchnummer, nicht
        // die Liednummer – die beiden überschneiden sich (Lied 252 ≠ Choralbuch 252).
        // Sie entscheidet (Konvention „<Nr> <Titel>.pdf"), der Titel kann sie
        // nicht überstimmen.
        const nummerMatch =
            !!parsed.liednummer && hasNummer && String(nummer) === parsed.liednummer;
        if (nummerMatch) {
            score += 1;
            reason.push(`Choralbuch-Nr. = ${nummer}`);
        }
        let best = { sim: 0, full: 0, via: '' };
        const consider = (titel, via) => {
            const n = normalize(titel);
            const sim = hybridScore(n, query);
            const full = similarity(n, query);
            if (sim > best.sim || (sim === best.sim && full > best.full)) {
                best = { sim, full, via };
            }
        };
        consider(melodieTitleCore(melodie.titel), 'Melodie');
        for (const t of liedTitelByMelodie.get(melodie.id) || []) consider(t, `Lied „${t}"`);
        // Exakter Titel schlägt bloßes Enthaltensein („Nun ruhen alle Wälder"
        // vs. „… (alternative Melodie)"), und nur Melodien mit Choralbuchnummer
        // stehen überhaupt im Choralbuch – beides nur als Tiebreaker.
        score += best.sim * 0.9 + best.full * 0.04 + (hasNummer ? 0.05 : 0);
        if (best.sim > 0.4) reason.push(`${best.via} ~ ${(best.sim * 100).toFixed(0)}%`);
        return { melodie, score, reason: reason.join(', '), titleScore: best.sim, nummerMatch };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
}

// Ab hier gilt der Titel als „passt zur Nummer".
export const CHORALBUCH_TITLE_CONFIRM = 0.6;
// Ohne Nummer: Mindestwert und Abstand zur zweitbesten Melodie, damit
// automatisch zugeordnet wird. „Gebt Gott die Ehre, ihr Christen der Welt"
// passt gleich gut auf „Gebt Gott die Ehre" (112) und „Christen der Welt" (33).
const TITLE_ONLY_THRESHOLD = 0.75;
const TITLE_ONLY_MARGIN = 0.02;

/**
 * Melodie für einen Choralbuchsatz bestimmen. Dateinamen-Konvention:
 * „<Choralbuchnummer> <Titel>.pdf". Die Nummer entscheidet; der Titel wird nur
 * gegengeprüft. Ohne Nummer wird über den Titel gesucht, aber nur bei klarem
 * Vorsprung automatisch zugeordnet.
 *
 * @returns {{melodie: object|null, suggestions: Array, warnings: string[]}}
 */
export function matchChoralbuchMelodie(parsed, melodien, lieder) {
    const suggestions = rankMelodienForChoralbuch(parsed, melodien, lieder);
    const warnings = [];
    const [top, second] = suggestions;

    if (parsed.liednummer) {
        if (top?.nummerMatch) {
            if (top.titleScore < CHORALBUCH_TITLE_CONFIRM) {
                warnings.push(
                    `Titel im Dateinamen passt nicht zu Choralbuch-Nr. ${parsed.liednummer} ` +
                        `(Melodie „${top.melodie.titel}") – Nummer oder Titel prüfen`,
                );
            }
            return { melodie: top.melodie, suggestions, warnings };
        }
        warnings.push(
            `Keine Melodie mit Choralbuch-Nr. ${parsed.liednummer} – Melodie bitte wählen`,
        );
        return { melodie: null, suggestions, warnings };
    }

    warnings.push('Keine Choralbuchnummer im Dateinamen (erwartet: „<Nr> <Titel>.pdf")');
    const clear =
        top &&
        top.score >= TITLE_ONLY_THRESHOLD &&
        (!second || top.score - second.score >= TITLE_ONLY_MARGIN);
    return { melodie: clear ? top.melodie : null, suggestions, warnings };
}
