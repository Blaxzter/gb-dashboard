// Erzeugt den unveränderlichen GB2000-Referenzdatensatz aus den Parser-JSONs.
//
// Warum: Die Neue-Lieder-Statistik entscheidet „neu vs. alt" bisher über die
// Häkchen `textGeaendert` / `melodieGeaendert` am Gesangbuchlied. Die werden
// beim Bearbeiten der Lieder mitgepflegt und sind dadurch keine verlässliche
// Quelle mehr (Gegenprobe: von 87 angenommenen 2000er-Liedern mit
// melodieGeaendert=true singen 57-71 nachweislich dieselbe Melodie wie 2000).
// Mit diesem Referenzdatensatz kann die Statistik stattdessen gegen den
// tatsächlichen GB2000-Bestand rechnen.
//
// Quelle sind die beiden Parser-Ausgaben aus dem GB_Parser-Projekt:
//   Johannisches Gesangbuch_komplett_updated.json   Lied 1-420
//   Johannisches_Gesangbuch_extended.json           Lied 421-470
//
// Aufruf:
//   node scripts/build-gb2000-original.mjs [--src <GB_Parser-Verzeichnis>] [--out <datei.json>]
//
// Ergebnis: ein Array mit 470 Objekten, direkt als Directus-JSON-Import
// geeignet (siehe docs/gb2000-referenz.md für die Collection-Felder).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const SRC = arg('--src', 'E:/Programming/Kirche/GB_Parser');
const OUT = arg('--out', path.join(SRC, 'gb2000-original.json'));

const FILES = [
    ['Johannisches Gesangbuch_komplett_updated.json', 'komplett_updated'],
    ['Johannisches_Gesangbuch_extended.json', 'extended'],
];

// Gleiche Normalisierung wie im Textvergleich des Dashboards: Silbentrennzeichen
// raus, typografische Zeichen vereinheitlichen, Umlaute auflösen, alles außer
// a-z0-9 zu einem Leerzeichen. Damit fallen Satzzeichen- und Schreibvarianten
// nicht als „Textänderung" ins Gewicht.
const normalize = (s) =>
    (s ?? '')
        .replace(/\u00ac/g, '')
        .toLowerCase()
        .replace(/[\u2018\u2019\u02bc\u2032]/g, "'")
        .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/ß/g, 'ss')
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const sha1 = (s) => crypto.createHash('sha1').update(s, 'utf8').digest('hex');

// Der Parser übernimmt die Überschrift in Versalien ("ALL IHR CHRISTEN"). Als
// lesbaren Titel dient die erste Zeile der ersten Strophe bis zum ersten
// Satzzeichen – so steht das Lied auch im Buch.
const titelAusStrophe1 = (verses) => {
    const first = verses?.[0]?.[1] ?? '';
    return first.split(/[,.;:!?]/)[0].trim() || first.trim();
};

const src = [];
for (const [file, quelle] of FILES) {
    const p = path.join(SRC, file);
    if (!fs.existsSync(p)) {
        console.error(`Quelldatei fehlt: ${p}`);
        process.exit(1);
    }
    // Der Parser hängt leere Objekte an; die haben keine "number" und fliegen raus.
    for (const entry of JSON.parse(fs.readFileSync(p, 'utf8'))) {
        if (entry?.number) src.push({ ...entry, _quelle: quelle });
    }
}

const seen = new Map();
const out = [];
for (const s of src) {
    const nummer = parseInt(s.number, 10);
    if (seen.has(nummer)) {
        console.error(`Doppelte Liednummer ${nummer} – übersprungen`);
        continue;
    }
    seen.set(nummer, true);

    const strophen = (s.verses || []).map(([nummer, strophe]) => ({ nummer, strophe }));
    const volltext = strophen.map((v) => v.strophe).join('\n');
    const normalisiert = normalize(volltext);
    // equals_to fehlt bei 232 Liedern – dort ist die Melodie beim Lied selbst
    // abgedruckt, der Melodiename ist also der Liedtitel.
    const melodieName = s.equals_to || titelAusStrophe1(s.verses);

    out.push({
        nummer2000: nummer,
        titel: titelAusStrophe1(s.verses),
        titel_versalien: s.title ?? null,
        melodie_name: melodieName,
        melodie_verweis: s.equals_to || null,
        text_autor: s.text_author || null,
        melodie_autor: s.music_author || null,
        strophen,
        strophen_anzahl: strophen.length,
        text_normalisiert: normalisiert,
        text_fingerprint: sha1(normalisiert),
        melodie_fingerprint: sha1(normalize(`${melodieName}|${s.music_author || ''}`)),
        quelle: s._quelle,
    });
}

out.sort((a, b) => a.nummer2000 - b.nummer2000);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

console.log(`${out.length} Lieder geschrieben -> ${OUT}`);
console.log(`  Nummern ${out[0].nummer2000}-${out[out.length - 1].nummer2000}`);
console.log(`  verschiedene Melodien: ${new Set(out.map((x) => normalize(x.melodie_name))).size}`);
console.log(`  ohne Melodieverweis (Melodie beim Lied): ${out.filter((x) => !x.melodie_verweis).length}`);
