// Portierung der Python-Skripte 11 (Choralbuchnummer) und 12 (Liednummer 2026)
// aus gb-scripts/app. Reine Logik ohne Netzwerkzugriff, damit sie gut testbar
// bleibt: die View lädt die Daten, ruft die Plan-Funktionen auf, zeigt das
// Ergebnis als Vorschau an und schreibt es anschließend nach Directus.
//
// Issue #54: Gefiltert wird ausschließlich nach status === 'accepted'
// ("Bewertet und genommen"). Die frühere zusätzliche Bedingung auf die
// Kleiner-Kreis-Bewertung "Rein" entfällt. Das Filtern übernimmt die View beim
// Laden – die Plan-Funktionen erwarten bereits nur die akzeptierten Lieder.

// Sortierschlüssel wie in den Skripten: NFKD-Normalisierung, diakritische
// Zeichen entfernen, casefold (inkl. ß -> ss), Satz-/Sonderzeichen ignorieren und
// trimmen.
//
// Anders als die Python-Skripte (die nur Diakritika/Groß-/Kleinschreibung
// behandelten) werden hier zusätzlich Satz- und Sonderzeichen ignoriert: ein
// Komma, Anführungszeichen, Bindestrich o. ä. soll die alphabetische Reihenfolge
// nicht beeinflussen ("O Mensch, bewein..." sortiert wie "O Mensch bewein..."). So
// entspricht die generierte Reihenfolge der erwarteten Titel-Sortierung.
//
// Reihenfolge der Schritte ist wichtig: erst die kombinierenden Diakritika
// ENTFERNEN (sonst würde "é" = e+◌́ zu "e " statt "e"), danach Sonderzeichen durch
// ein Leerzeichen ERSETZEN. Buchstaben/Ziffern werden Unicode-weit erhalten, damit
// fremdsprachige Titel nicht zerstört werden.
export function sortKey(titel) {
    if (!titel) return '';
    return titel
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // Diakritika (Umlaute etc.) entfernen
        .toLowerCase()
        .replace(/ß/g, 'ss')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Satz-/Sonderzeichen -> Leerzeichen
        .replace(/\s+/g, ' ') // Mehrfach-Leerzeichen zusammenfassen
        .trim();
}

function compareIds(a, b) {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    const sa = String(a);
    const sb = String(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
}

// Vergleich nach (Sortierschlüssel des Titels, id) – wie die Python-Skripte
// (Codepoint-Ordnung des Schlüssels, kein locale-spezifisches Sortieren).
export function compareByTitle(a, b) {
    const ka = sortKey(a.titel);
    const kb = sortKey(b.titel);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return compareIds(a.id, b.id);
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

// Master-Fassung (deutsche Liedfassung) eines Liedes. REST liefert die M2O-
// Beziehung je nach `fields`-Angabe als reine id oder als { id }.
function masterIdOf(song) {
    const dlf = song?.deutscheLiedfassung;
    if (dlf === null || dlf === undefined) return null;
    return typeof dlf === 'object' ? (dlf.id ?? null) : dlf;
}

// --- Liednummer 2026 (Skript 12) ------------------------------------------
// acceptedSongs:  [{ id, titel, liednummer2026, deutscheLiedfassung }]
// numberedSongs:  [{ id, titel, liednummer2026 }] – alle Lieder mit gesetzter Nummer
export function planLiednummern(acceptedSongs, numberedSongs = []) {
    const sorted = [...acceptedSongs].sort(compareByTitle);
    const byId = new Map(sorted.map((s) => [s.id, s]));
    const numbers = new Map();

    // 1. Durchlauf: "primäre" Lieder (ohne deutsche Liedfassung) fortlaufend
    //    durchnummerieren; abgeleitete Lieder zurückstellen.
    let counter = 0;
    const derived = [];
    for (const song of sorted) {
        if (masterIdOf(song) != null) {
            derived.push(song);
            continue;
        }
        counter += 1;
        numbers.set(song.id, counter);
    }

    // 2. Durchlauf: abgeleitete Lieder übernehmen die Nummer ihrer Master-
    //    Fassung; Ketten werden bis zur primären Fassung aufgelöst. Lieder, deren
    //    Master nicht (mehr) akzeptiert/auflösbar ist, werden übersprungen.
    const skipped = [];
    for (const song of derived) {
        const masterNumber = resolveMasterNumber(masterIdOf(song), byId, numbers);
        if (masterNumber == null) {
            skipped.push({ id: song.id, titel: song.titel, masterId: masterIdOf(song) });
            continue;
        }
        numbers.set(song.id, masterNumber);
    }

    const numbered = [...numbers.entries()]
        .map(([id, next]) => {
            const song = byId.get(id);
            const current = toNumberOrNull(song?.liednummer2026);
            return {
                id,
                titel: song?.titel ?? '',
                current,
                next,
                isMaster: masterIdOf(song) == null,
                changed: current !== next,
            };
        })
        .sort((a, b) => a.next - b.next || compareByTitle(a, b));

    const numberedIds = new Set(numbers.keys());
    const toClear = numberedSongs
        .filter((s) => !numberedIds.has(s.id))
        .map((s) => ({ id: s.id, titel: s.titel, current: toNumberOrNull(s.liednummer2026) }));

    const changed = numbered.filter((n) => n.changed);
    return {
        field: 'liednummer2026',
        collection: 'gesangbuchlied',
        numbered,
        changed,
        toClear,
        skipped,
        counts: {
            total: numbered.length,
            changed: changed.length,
            unchanged: numbered.length - changed.length,
            clear: toClear.length,
            skipped: skipped.length,
        },
    };
}

function resolveMasterNumber(startId, byId, numbers) {
    const seen = new Set();
    let currentId = startId;
    while (currentId != null && !seen.has(currentId)) {
        seen.add(currentId);
        if (numbers.has(currentId)) return numbers.get(currentId);
        const current = byId.get(currentId);
        if (!current) return null;
        currentId = masterIdOf(current);
    }
    return null;
}

// --- Choralbuchnummer (Skript 11) -----------------------------------------
// acceptedSongs:     [{ id, melodie: { id, titel, choralbuchNummer } | null }]
// numberedMelodies:  [{ id, titel, choralbuchNummer }] – alle Melodien mit Nummer
export function planChoralbuchNummern(acceptedSongs, numberedMelodies = []) {
    // Eindeutige Melodien der akzeptierten Lieder (erstes Vorkommen gewinnt).
    const unique = new Map();
    let skippedNoMelodie = 0;
    for (const song of acceptedSongs) {
        const mel = song?.melodie;
        const melId = mel && typeof mel === 'object' ? mel.id : mel;
        if (melId == null) {
            skippedNoMelodie += 1;
            continue;
        }
        if (!unique.has(melId)) {
            unique.set(melId, {
                id: melId,
                titel: mel?.titel ?? '',
                choralbuchNummer: toNumberOrNull(mel?.choralbuchNummer),
            });
        }
    }

    const melodies = [...unique.values()].sort(compareByTitle);
    const numbered = melodies.map((m, idx) => {
        const next = idx + 1;
        return {
            id: m.id,
            titel: m.titel,
            current: m.choralbuchNummer,
            next,
            changed: m.choralbuchNummer !== next,
        };
    });

    const acceptedIds = new Set(unique.keys());
    const toClear = numberedMelodies
        .filter((m) => !acceptedIds.has(m.id))
        .map((m) => ({ id: m.id, titel: m.titel, current: toNumberOrNull(m.choralbuchNummer) }));

    const changed = numbered.filter((n) => n.changed);
    return {
        field: 'choralbuchNummer',
        collection: 'melodie',
        numbered,
        changed,
        toClear,
        skippedNoMelodie,
        counts: {
            total: numbered.length,
            changed: changed.length,
            unchanged: numbered.length - changed.length,
            clear: toClear.length,
            skippedNoMelodie,
        },
    };
}
