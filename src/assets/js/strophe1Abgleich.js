// Strophe-1-Abgleich (Issue #99)
//
// Die 1. Strophe steht doppelt: einmal im Redaktionssystem (erste Strophe des
// Textes) und einmal im Notenbild, wo Jens sie unter die Noten gesetzt und
// Janosch sie übernommen hat. Beide Fassungen wurden bisher nirgends
// gegeneinander gehalten – der Druck-Check kann das nicht leisten, weil die
// 1. Strophe in der Druck-PDF kein Text ist, sondern Teil des Notensatzes
// (siehe notenFingerprint.js). Auch die Korrekturleser lesen nur die Fassung
// unter den Noten; was sie dort anmerken, muss irgendwann zurück ins
// Redaktionssystem.
//
// Dieses Modul liefert die Daten für den manuellen Abgleich:
//   * die 1. Strophe aus der Datenbank in zwei Lesarten – zeilenweise (wie im
//     Redaktionssystem erfasst) und fortlaufend (wie sie unter den Noten
//     läuft, wo die Zeilenumbrüche der Erfassung keine Rolle spielen),
//   * das Notenbild des Liedes als Liste anzeigbarer Seiten,
//   * einen stabilen Schlüssel für die „abgeglichen"-Markierung.

// --- 1. Strophe aus dem Redaktionssystem -----------------------------------

// Das Silbentrennzeichen ist aus den Texten entfernt worden (die Silbentrennung
// ist abgeschlossen), kann aber in Altbeständen noch auftauchen. Für den
// Abgleich stört es nur.
const SILBENTRENNER = /¬/g;

export function strophe1Raw(lied) {
    const strophe = lied?.text?.strophenEinzeln?.[0]?.strophe;
    return typeof strophe === 'string' ? strophe.replace(SILBENTRENNER, '') : '';
}

// Zeilen der 1. Strophe, so wie sie im Redaktionssystem erfasst sind: je
// Textzeile ein Eintrag, Mehrfach-Leerzeichen zusammengefasst, Leerzeilen weg.
export function strophe1Lines(lied) {
    return strophe1Raw(lied)
        .split(/\r?\n/)
        .map((line) => line.replace(/[\p{Zs}\s]+/gu, ' ').trim())
        .filter(Boolean);
}

// Dieselbe Strophe fortlaufend – das ist die Form, in der sie im Notenbild
// steht: dort bestimmen die Notensysteme den Umbruch, nicht die Erfassung. Für
// den Abgleich Wort für Wort ist diese Lesart oft die passendere.
export function strophe1Flow(lied) {
    return strophe1Lines(lied).join(' ');
}

export function hasStrophe1(lied) {
    return strophe1Flow(lied).length > 0;
}

// --- Notenbild --------------------------------------------------------------

// Womit ist diese Datei anzuzeigen? Maßgeblich ist der Medientyp der Datei,
// nicht das Feld, in dem sie steckt: In `notentext` liegt zwar üblicherweise die
// Notensatz-PDF, aber nichts hindert einen Upload daran, dort ein Bild abzulegen
// – und ein Bild durch den PDF-Betrachter zu schicken endet in einer leeren
// Fläche. Ist der Typ unbekannt (Datei nicht in der geladenen Dateiliste), gilt
// die Feld-Konvention als Annahme.
function kindOf(file, fallback) {
    const type = file?.type;
    if (!type) return fallback;
    if (type === 'application/pdf') return 'pdf';
    if (type.startsWith('image/')) return 'image';
    return fallback;
}

// Die anzeigbaren Seiten des Notenbildes, in Druckreihenfolge.
//
// `notentext` ist die gesetzte Notensatz-PDF, `notentext_seite2` die zweite
// Seite mehrseitiger Sätze (Konvention: `notentext` ist einseitig). Fehlt beides,
// bleibt als Anzeige die gebackene SVG – sie zeigt dasselbe Notenbild, ist aber
// nicht das, was in InDesign platziert wird, und deshalb nur Rückfallebene.
export function notenbildPages(lied) {
    const pages = [];
    if (lied?.notentext) {
        pages.push({
            id: lied.notentext,
            kind: kindOf(lied.notentext_file, 'pdf'),
            label: 'Notenbild',
            name: lied.notentext_file?.filename_download || '',
        });
    }
    if (lied?.notentext_seite2) {
        pages.push({
            id: lied.notentext_seite2,
            kind: kindOf(lied.notentext_seite2_file, 'pdf'),
            label: 'Notenbild · Seite 2',
            name: lied.notentext_seite2_file?.filename_download || '',
        });
    }
    if (!pages.length && lied?.notentext_svg) {
        pages.push({
            id: lied.notentext_svg,
            kind: kindOf(lied.notentext_svg_file, 'image'),
            label: 'Notenbild (SVG)',
            name: lied.notentext_svg_file?.filename_download || '',
        });
    }
    return pages;
}

export function hasNotenbild(lied) {
    return notenbildPages(lied).length > 0;
}

// --- Schlüssel der „abgeglichen"-Markierung --------------------------------

// djb2 – kurz, stabil und für einen Speicherschlüssel völlig ausreichend.
function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

// Ein Abgleich gilt für genau diesen Stand: dieses Lied, dieses Notenbild,
// dieser Strophentext. Wird eines davon ausgetauscht – neue Notensatz-Datei,
// korrigierte Strophe –, ändert sich der Schlüssel und das Lied taucht wieder
// als offen auf. Dieselbe Logik trägt der Druck-Check (siehe druckCheckAcks.js):
// eine Markierung, die einen alten Stand bestätigt, wäre schlimmer als keine.
export function abgleichKey(lied) {
    if (!lied?.id) return '';
    const files = notenbildPages(lied)
        .map((p) => p.id)
        .join('+');
    return `${lied.id}:${hash(files)}:${hash(strophe1Flow(lied))}`;
}
