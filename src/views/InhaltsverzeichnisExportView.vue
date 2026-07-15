<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '@/store/app.js';
import { storeToRefs } from 'pinia';
import { resolveLiednummer2026 } from '@/assets/js/utils';
import { isGenommen } from '@/assets/js/gesangbuchChecks';

// Separater Export des Inhaltsverzeichnisses (Issue #45), das Janosch importieren
// oder einfach kopieren kann. Zwei Varianten:
//   1. alphabetisch nach Lied-Titel
//   2. nach Kategorien, darin wieder nach Lied-Titel
// Hinweis: Es wird voraussichtlich noch ein neues Datenfeld mit reduzierten/
// umbenannten Kategorien geben. Aktuell wird mit den bestehenden Kategorien
// (gesangbuchlied -> kategories) gearbeitet.

const store = useAppStore();
const { gesangbuchlieder, kategorie_inhaltsverzeichnisse, melodies } = storeToRefs(store);

// „Bewertet und genommen" = status === 'accepted' (Issue #51). Es wird bewusst
// nach dem Status gefiltert und nicht mehr nach der Kleiner-Kreis-Bewertung
// „Rein".
const only_accepted = ref(true);
const only_with_number = ref(false);

const snackbar = ref(false);
const snackbar_message = ref('');

const OHNE_KATEGORIE = 'Ohne Kategorie';
// Lieder, deren Kategorien keiner Inhaltsverzeichnis-Kategorie zugeordnet sind
// (Spalte E leer, Issue #53), erscheinen gesammelt am Ende.
const OHNE_IV_KATEGORIE = 'Ohne Inhaltsverzeichnis-Kategorie';

// id -> liednummer2026 (für die Auflösung über die deutsche Liedfassung).
const liednummer2026_by_id = computed(() => {
    const map = {};
    for (const l of gesangbuchlieder.value) {
        if (l && l.id != null && l.liednummer2026) map[l.id] = l.liednummer2026;
    }
    return map;
});

function nummerOf(lied) {
    return resolveLiednummer2026(lied, liednummer2026_by_id.value);
}

// Kategorienamen eines Liedes (kann mehrere sein). `kategories` ist entweder ein
// Array von Verknüpfungen mit `kategorie_name.name` oder der Platzhalter 'Keine'.
function kategorienOf(lied) {
    const list = Array.isArray(lied?.kategories) ? lied.kategories : [];
    const namen = list.map((k) => k?.kategorie_name?.name).filter(Boolean);
    return namen.length ? [...new Set(namen)] : [];
}

// Kategorie-IDs eines Liedes (für das Inhaltsverzeichnis-Mapping, Issue #53).
// Jede Verknüpfung trägt die `kategorie_id`; als Fallback wird die ID aus dem
// aufgelösten Kategorie-Objekt `kategorie_name` gezogen.
function kategorieIdsOf(lied) {
    const list = Array.isArray(lied?.kategories) ? lied.kategories : [];
    const ids = list
        .map((k) => (k?.kategorie_id != null ? k.kategorie_id : k?.kategorie_name?.id))
        .filter((id) => id != null);
    return [...new Set(ids)];
}

// Kategorien eines Liedes als {id, name}-Paare (für die Diagnose der nicht
// gemappten Lieder). Deduplikiert über id|name.
function kategoriePairsOf(lied) {
    const list = Array.isArray(lied?.kategories) ? lied.kategories : [];
    const seen = new Set();
    const pairs = [];
    for (const k of list) {
        const id = k?.kategorie_id != null ? k.kategorie_id : (k?.kategorie_name?.id ?? null);
        const name = k?.kategorie_name?.name ?? null;
        if (id == null && !name) continue;
        const key = `${id}|${name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ id, name });
    }
    return pairs;
}

// Grundmenge: nach dem Status-Filter, mit aufgelöster Nummer angereichert.
// Bewusst OHNE den „nur mit Liednummer"-Filter, damit die Kennzahlen (u. a.
// „ohne Liednummer") aussagekräftig bleiben.
const base_songs = computed(() => {
    let list = gesangbuchlieder.value.filter((l) => l && (l.titel || '').trim());
    if (only_accepted.value) {
        list = list.filter((l) => isGenommen(l));
    }
    return list.map((l) => ({
        id: l.id,
        titel: (l.titel || '').trim(),
        nummer: nummerOf(l),
        kategorien: kategorienOf(l),
        kategorie_ids: kategorieIdsOf(l),
        kategorie_pairs: kategoriePairsOf(l),
        // Änderungsvermerk fürs Musiker-Verzeichnis (Issue #74): wurde Text bzw.
        // Melodie gegenüber dem Gesangbuch 2000 überarbeitet?
        textGeaendert: l.textGeaendert === true,
        melodieGeaendert: l.melodieGeaendert === true,
    }));
});

// Anzeige-/Exportmenge: zusätzlich optional auf Lieder mit Nummer eingeschränkt.
const songs = computed(() => {
    if (!only_with_number.value) return base_songs.value;
    return base_songs.value.filter((s) => s.nummer !== '' && s.nummer != null);
});

function hasNummer(s) {
    return s.nummer !== '' && s.nummer != null;
}

// Differenzierte Kennzahlen für die Kopfzeile (Issue #50): Gesamtzahl, Anzahl
// der Lieder, die sich eine Liednummer 2026 mit mindestens einem anderen Lied
// teilen, höchste vergebene Liednummer und Lieder ohne Liednummer.
const stats = computed(() => {
    const list = base_songs.value;
    const total = list.length;
    const withNummer = list.filter(hasNummer);
    const withoutNummer = total - withNummer.length;

    let maxNummer = 0;
    for (const s of withNummer) {
        const n = leadingNummer(s);
        if (n != null && n > maxNummer) maxNummer = n;
    }

    const countByNummer = {};
    for (const s of withNummer) {
        const key = String(s.nummer);
        countByNummer[key] = (countByNummer[key] || 0) + 1;
    }
    const duplicate = withNummer.filter((s) => countByNummer[String(s.nummer)] > 1).length;

    return { total, withoutNummer, maxNummer: maxNummer || null, duplicate };
});

// Sortierung nach Liednummer 2026. Die Nummern wurden bereits in der
// (gesangbuch-eigenen) alphabetischen Sortierreihenfolge der Titel vergeben –
// nach der Nummer zu sortieren reproduziert daher die korrekte Titel-Sortierung,
// ohne die Sonderregeln (Artikel, Satzzeichen, Umlaute …) nachbauen zu müssen.
// Lieder ohne Nummer landen am Ende, untereinander alphabetisch nach Titel.
const byTitelCompare = (a, b) => a.titel.localeCompare(b.titel, 'de', { sensitivity: 'base' });
function leadingNummer(s) {
    const match = String(s.nummer ?? '').match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}
const byNummer = (a, b) => {
    const na = leadingNummer(a);
    const nb = leadingNummer(b);
    if (na == null && nb == null) return byTitelCompare(a, b);
    if (na == null) return 1;
    if (nb == null) return -1;
    if (na !== nb) return na - nb;
    // Gleiche führende Nummer (z. B. Liedfassungen 12a/12b): nach voller Nummer, dann Titel.
    const fa = String(a.nummer);
    const fb = String(b.nummer);
    return fa.localeCompare(fb, 'de') || byTitelCompare(a, b);
};

// 1. Nach Liednummer 2026 (= alphabetische Titel-Reihenfolge des Gesangbuchs).
const alphabetical = computed(() => [...songs.value].sort(byNummer));

// --- Alphabetisch mit Änderungsvermerk (Issue #74) ------------------------
// Verzeichnis für die Musiker: Liednummer 2026 aufsteigend (= alphabetische
// Titel-Reihenfolge), Lied-Titel und ein Vermerk, ob Text und/oder Melodie
// gegenüber dem Gesangbuch 2000 überarbeitet wurden. Hilft, vor dem
// Gottesdienst darauf hinzuweisen, dass ein bekanntes Lied gesungen wird, sich
// aber Text oder Melodie geändert haben. Die optionale Einschränkung „nur
// geänderte Lieder" reduziert die Liste auf genau diese Fälle.
const only_changed = ref(false);

const changeList = computed(() => {
    const list = [...songs.value].sort(byNummer);
    return only_changed.value ? list.filter((s) => s.textGeaendert || s.melodieGeaendert) : list;
});

// Anzahl der Lieder mit Text- oder Melodieänderung (im aktuellen Filter).
const changed_count = computed(
    () => songs.value.filter((s) => s.textGeaendert || s.melodieGeaendert).length,
);

// Menschlich lesbarer Änderungsvermerk (für Copy/CSV/InDesign-Spalte). Leer,
// wenn weder Text noch Melodie geändert wurden.
function changeNote(s) {
    if (s.textGeaendert && s.melodieGeaendert) return 'Text & Melodie geändert';
    if (s.textGeaendert) return 'Text geändert';
    if (s.melodieGeaendert) return 'Melodie geändert';
    return '';
}

// --- Nach Choralbuchnummer (Issue #73) ------------------------------------
// Melodie-basiertes Inhaltsverzeichnis: alle Melodien mit einer
// Choralbuchnummer, aufsteigend nach Nummer sortiert, mit Melodie-Titel.
// Die Choralbuchnummer wird nur an Melodien vergeben, die von mindestens
// einem „Bewertet und genommen"-Lied verwendet werden (siehe
// Nummerngenerierung). Diese Liste ist bewusst unabhängig von den Lied-Filtern
// oben und dient als Arbeitsmaterial zum schnellen Recherchieren und Abgleichen.
// Die Objekte tragen absichtlich die Felder `nummer`/`titel`, damit die
// Spalten-Copy-Helfer (copyNummernSpalte/copyTitelSpalte) direkt greifen.
function choralbuchNummerOf(mel) {
    const raw = mel?.choralbuchNummer;
    if (raw === null || raw === undefined || raw === '') return null;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    return Number.isNaN(n) ? null : n;
}

const choralbuch = computed(() =>
    melodies.value
        .map((m) => ({ id: m.id, nummer: choralbuchNummerOf(m), titel: (m.titel || '').trim() }))
        .filter((m) => m.nummer != null)
        .sort((a, b) => a.nummer - b.nummer || byTitelCompare(a, b)),
);

// 2. Nach Kategorien, darin nach Liednummer 2026 (Titel-Reihenfolge). Ein Lied
// erscheint unter jeder seiner Kategorien; Lieder ohne Kategorie unter
// „Ohne Kategorie" (ans Ende sortiert).
const byCategory = computed(() => {
    const groups = {};
    for (const s of songs.value) {
        const kats = s.kategorien.length ? s.kategorien : [OHNE_KATEGORIE];
        for (const kat of kats) {
            (groups[kat] ||= []).push(s);
        }
    }
    return Object.keys(groups)
        .sort((a, b) => {
            if (a === OHNE_KATEGORIE) return 1;
            if (b === OHNE_KATEGORIE) return -1;
            return a.localeCompare(b, 'de', { sensitivity: 'base' });
        })
        .map((kat) => ({ kategorie: kat, songs: [...groups[kat]].sort(byNummer) }));
});

// Gesamtzahl der Einträge (mit Mehrfachzählung: ein Lied pro Kategorie).
const category_song_count = computed(() =>
    byCategory.value.reduce((sum, g) => sum + g.songs.length, 0),
);

// Anzahl eindeutiger Lieder (ohne Mehrfachzählung über Kategorien hinweg).
const category_distinct_count = computed(() => {
    const ids = new Set();
    byCategory.value.forEach((g) => g.songs.forEach((s) => ids.add(s.id)));
    return ids.size;
});

// --- 3. Nach Inhaltsverzeichnis-Kategorien (Issue #53) --------------------
// Neue, reduzierte Kategorien fürs gedruckte Inhaltsverzeichnis. Das Mapping
// steht im Feld `kategorieInhaltsverzeichnis.kategorien`: jede bestehende
// Kategorie ist genau einer Inhaltsverzeichnis-Kategorie zugeordnet, eine
// Inhaltsverzeichnis-Kategorie kann mehrere bestehende Kategorien bündeln.
// Kategorien ohne Zuordnung fließen nicht ins Inhaltsverzeichnis ein.

// Extrahiert die Kategorie-ID aus einem Eintrag des Mapping-Feldes. Robust
// gegenüber der konkreten Directus-Beziehungsform: O2M liefert die
// Kategorie-Objekte direkt (`id`), M2M die Junction-Zeilen (`kategorie_id`/
// `kategorie`); rohe Zahlen/Strings werden ebenfalls akzeptiert.
function kategorieIdFromMapping(entry) {
    if (entry == null) return null;
    if (typeof entry === 'number') return entry;
    if (typeof entry === 'string') {
        const n = parseInt(entry, 10);
        return Number.isNaN(n) ? null : n;
    }
    if (typeof entry === 'object') {
        if (entry.kategorie_id != null) return kategorieIdFromMapping(entry.kategorie_id);
        if (entry.kategorie != null) return kategorieIdFromMapping(entry.kategorie);
        if (entry.id != null) return kategorieIdFromMapping(entry.id);
    }
    return null;
}

// Ob überhaupt Inhaltsverzeichnis-Kategorien geladen wurden (Collection kann in
// Directus noch fehlen bzw. ohne Leseberechtigung sein).
const toc_available = computed(() => kategorie_inhaltsverzeichnisse.value.length > 0);

// kategorie_id -> Inhaltsverzeichnis-Kategorie (roher Directus-Datensatz mit
// name/sortierung). Grundlage für die Gruppierung der Lieder.
const tocByKategorieId = computed(() => {
    const map = {};
    for (const toc of kategorie_inhaltsverzeichnisse.value) {
        const kats = Array.isArray(toc?.kategorien) ? toc.kategorien : [];
        for (const entry of kats) {
            const katId = kategorieIdFromMapping(entry);
            if (katId != null) map[katId] = toc;
        }
    }
    return map;
});

// Lieder gruppiert nach Inhaltsverzeichnis-Kategorie, sortiert nach dem Feld
// `sortierung` (aufsteigend), innerhalb einer Gruppe nach Liednummer 2026.
// Ein Lied erscheint unter jeder Inhaltsverzeichnis-Kategorie, in die (mind.)
// eine seiner Kategorien fällt. Lieder ohne Zuordnung stehen am Ende.
const byTocCategory = computed(() => {
    const map = tocByKategorieId.value;
    const groups = {};
    const ensure = (key, name, sortierung) =>
        (groups[key] ||= { kategorie: name, sortierung, songs: [] });

    for (const s of songs.value) {
        const tocs = new Map();
        for (const katId of s.kategorie_ids) {
            const toc = map[katId];
            if (toc) tocs.set(toc.id, toc);
        }
        if (tocs.size === 0) {
            ensure(OHNE_IV_KATEGORIE, OHNE_IV_KATEGORIE, null).songs.push(s);
        } else {
            for (const toc of tocs.values()) {
                ensure(`toc-${toc.id}`, toc.name || `#${toc.id}`, toc.sortierung ?? null).songs.push(
                    s,
                );
            }
        }
    }

    return Object.values(groups)
        .sort((a, b) => {
            if (a.kategorie === OHNE_IV_KATEGORIE) return 1;
            if (b.kategorie === OHNE_IV_KATEGORIE) return -1;
            const sa = a.sortierung;
            const sb = b.sortierung;
            if (sa == null && sb == null)
                return a.kategorie.localeCompare(b.kategorie, 'de', { sensitivity: 'base' });
            if (sa == null) return 1;
            if (sb == null) return -1;
            if (sa !== sb) return sa - sb;
            return a.kategorie.localeCompare(b.kategorie, 'de', { sensitivity: 'base' });
        })
        .map((g) => ({ ...g, songs: [...g.songs].sort(byNummer) }));
});

// Gesamtzahl der Einträge (Mehrfachzählung: ein Lied pro IV-Kategorie).
const toc_song_count = computed(() =>
    byTocCategory.value.reduce((sum, g) => sum + g.songs.length, 0),
);

// Anzahl eindeutiger Lieder (ohne Mehrfachzählung).
const toc_distinct_count = computed(() => {
    const ids = new Set();
    byTocCategory.value.forEach((g) => g.songs.forEach((s) => ids.add(s.id)));
    return ids.size;
});

// Anzahl der Lieder, die keiner Inhaltsverzeichnis-Kategorie zugeordnet sind.
const toc_unmapped_count = computed(() => {
    const group = byTocCategory.value.find((g) => g.kategorie === OHNE_IV_KATEGORIE);
    return group ? group.songs.length : 0;
});

// --- Diagnose: Lieder ohne IV-Zuordnung -----------------------------------
// Eigentlich sollte jede Gesangbuch-Kategorie ein IV-Mapping haben. Diese
// Aufschlüsselung zeigt, über welche Kategorien die nicht zugeordneten Lieder
// verfügen – so wird sichtbar, welchen Kategorien (noch) ein Mapping fehlt.

// Lieder, die in keine IV-Kategorie fallen (identisch zur Gruppe „Ohne
// Inhaltsverzeichnis-Kategorie").
const unmapped_songs = computed(() => {
    const map = tocByKategorieId.value;
    return songs.value.filter((s) => !s.kategorie_ids.some((id) => map[id]));
});

// Aufschlüsselung der nicht zugeordneten Lieder nach ihren Kategorien, absteigend
// nach Lied-Anzahl. `ohneKategorie` zählt Lieder ganz ohne Kategorie-Eintrag.
const unmapped_category_breakdown = computed(() => {
    const map = tocByKategorieId.value;
    const byKat = {};
    let ohneKategorie = 0;
    for (const s of unmapped_songs.value) {
        if (!s.kategorie_pairs.length) {
            ohneKategorie += 1;
            continue;
        }
        for (const p of s.kategorie_pairs) {
            const key = p.id != null ? `id:${p.id}` : `name:${p.name}`;
            const entry = (byKat[key] ||= {
                id: p.id,
                name: p.name || (p.id != null ? `#${p.id}` : 'Unbenannt'),
                count: 0,
                // Sicherheits-Flag: sollte immer false sein (sonst wäre das Lied
                // zugeordnet). true deutet auf eine ID/Name-Inkonsistenz hin.
                hasMapping: p.id != null && !!map[p.id],
            });
            entry.count += 1;
        }
    }
    const list = Object.values(byKat).sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }),
    );
    return { list, ohneKategorie };
});

const unmapped_dialog = ref(false);

function copyUnmappedBreakdown() {
    const { list, ohneKategorie } = unmapped_category_breakdown.value;
    const lines = list.map((k) => `${k.name}\t${k.id ?? ''}\t${k.count}`);
    if (ohneKategorie) lines.push(`Ohne Kategorie\t\t${ohneKategorie}`);
    copyToClipboard(['Kategorie\tID\tLieder', ...lines].join('\n'));
}

// --- Zweiter Dialog: Liederliste ohne IV-Zuordnung ------------------------
// Zeigt die konkreten Lieder, die nur nicht-inkludierte (ungemappte) Kategorien
// haben – optional gefiltert auf eine einzelne Kategorie (Klick auf eine Zeile
// im Aufschlüsselungs-Dialog) oder ganz ohne Kategorie.
const songs_dialog = ref(false);
// null = alle nicht zugeordneten Lieder; { id, name } = nur diese Kategorie;
// { ohneKategorie: true } = nur Lieder ganz ohne Kategorie.
const songs_dialog_filter = ref(null);

function matchesFilter(song, filter) {
    if (!filter) return true;
    if (filter.ohneKategorie) return song.kategorie_pairs.length === 0;
    return song.kategorie_pairs.some((p) =>
        filter.id != null ? p.id === filter.id : p.name === filter.name,
    );
}

const songs_dialog_title = computed(() => {
    const f = songs_dialog_filter.value;
    if (!f) return 'Alle Lieder ohne Zuordnung';
    if (f.ohneKategorie) return 'Lieder ohne Kategorie';
    return `Lieder der Kategorie „${f.name}"`;
});

// Nach dem aktuellen Filter eingeschränkte, nach Liednummer 2026 sortierte Liste.
const unmapped_songs_filtered = computed(() =>
    [...unmapped_songs.value.filter((s) => matchesFilter(s, songs_dialog_filter.value))].sort(
        byNummer,
    ),
);

function openSongsDialog(filter = null) {
    songs_dialog_filter.value = filter;
    songs_dialog.value = true;
}

function copyUnmappedSongs() {
    const rows = unmapped_songs_filtered.value.map(
        (s) => `${s.nummer ?? ''}\t${s.titel}\t${s.kategorien.join(', ')}`,
    );
    copyToClipboard(['Nr. 2026\tTitel\tKategorien', ...rows].join('\n'));
}

// --- Export-Helfer --------------------------------------------------------
function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function buildCsv(headers, rows) {
    const lines = [headers.join(',')];
    rows.forEach((r) => lines.push(r.map(csvEscape).join(',')));
    return '﻿' + lines.join('\n');
}

function download(filename, content, mime = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        snackbar_message.value = 'In die Zwischenablage kopiert.';
    } catch (e) {
        snackbar_message.value = 'Kopieren fehlgeschlagen.';
    }
    snackbar.value = true;
}

// --- Spalten-Copy für den zweispaltigen InDesign-Satz (Issue #67) ---------
// Janosch setzt die Inhaltsverzeichnisse zweispaltig (Nummer | Titel) und
// befüllt jede Spalte einzeln. Deshalb gibt es je einen Copy-Button pro Spalte,
// der die Werte zeilenweise (eine Nummer bzw. ein Titel pro Zeile) liefert.
// Beide Spalten nutzen dieselbe Liederreihenfolge, damit die Zeilen zueinander
// passen; fehlt eine Nummer, bleibt die Zeile leer, sodass die Ausrichtung
// erhalten bleibt.
function copyNummernSpalte(list) {
    copyToClipboard(list.map((s) => s.nummer ?? '').join('\n'));
}
function copyTitelSpalte(list) {
    copyToClipboard(list.map((s) => s.titel).join('\n'));
}

// --- Alphabetisch ---------------------------------------------------------
function downloadAlphabetical() {
    const rows = alphabetical.value.map((s) => [s.nummer, s.titel]);
    download('inhaltsverzeichnis_alphabetisch.csv', buildCsv(['nr_2026', 'titel'], rows));
}
function copyAlphabetical() {
    // Tab-getrennt: lässt sich direkt in Tabellen einfügen.
    const text = alphabetical.value.map((s) => `${s.nummer}\t${s.titel}`).join('\n');
    copyToClipboard(text);
}

// --- Alphabetisch mit Änderungsvermerk (Issue #74) ------------------------
function downloadChangeList() {
    const rows = changeList.value.map((s) => [
        s.nummer,
        s.titel,
        s.textGeaendert ? 'ja' : 'nein',
        s.melodieGeaendert ? 'ja' : 'nein',
    ]);
    download(
        'inhaltsverzeichnis_aenderungsvermerk.csv',
        buildCsv(['nr_2026', 'titel', 'text_geaendert', 'melodie_geaendert'], rows),
    );
}
function copyChangeList() {
    // Tab-getrennt: Nummer, Titel, Vermerk (leer, wenn unverändert).
    const text = changeList.value
        .map((s) => `${s.nummer}\t${s.titel}\t${changeNote(s)}`)
        .join('\n');
    copyToClipboard(text);
}
// Nur die Vermerk-Spalte (ein Wert pro Zeile) für den InDesign-Satz.
function copyVermerkSpalte(list) {
    copyToClipboard(list.map((s) => changeNote(s)).join('\n'));
}

// --- Nach Choralbuchnummer (Issue #73) ------------------------------------
function downloadChoralbuch() {
    const rows = choralbuch.value.map((m) => [m.nummer, m.titel]);
    download(
        'inhaltsverzeichnis_choralbuchnummern.csv',
        buildCsv(['choralbuch_nr', 'melodie_titel'], rows),
    );
}
function copyChoralbuch() {
    const text = choralbuch.value.map((m) => `${m.nummer}\t${m.titel}`).join('\n');
    copyToClipboard(text);
}

// --- Nach Kategorien ------------------------------------------------------
function downloadByCategory() {
    const rows = [];
    byCategory.value.forEach((g) =>
        g.songs.forEach((s) => rows.push([g.kategorie, s.nummer, s.titel])),
    );
    download('inhaltsverzeichnis_kategorien.csv', buildCsv(['kategorie', 'nr_2026', 'titel'], rows));
}
function copyByCategory() {
    // Gut lesbar: Kategorie als Überschrift, darunter die Lieder.
    const text = byCategory.value
        .map((g) => {
            const lines = g.songs.map((s) => `\t${s.nummer}\t${s.titel}`);
            return `${g.kategorie}\n${lines.join('\n')}`;
        })
        .join('\n\n');
    copyToClipboard(text);
}

// --- Nach Inhaltsverzeichnis-Kategorien (Issue #53) -----------------------
function downloadByTocCategory() {
    const rows = [];
    byTocCategory.value.forEach((g) =>
        g.songs.forEach((s) => rows.push([g.kategorie, s.nummer, s.titel])),
    );
    download(
        'inhaltsverzeichnis_iv_kategorien.csv',
        buildCsv(['inhaltsverzeichnis_kategorie', 'nr_2026', 'titel'], rows),
    );
}
function copyByTocCategory() {
    const text = byTocCategory.value
        .map((g) => {
            const lines = g.songs.map((s) => `\t${s.nummer}\t${s.titel}`);
            return `${g.kategorie}\n${lines.join('\n')}`;
        })
        .join('\n\n');
    copyToClipboard(text);
}
</script>

<template>
    <div class="d-flex align-center flex-wrap ga-2 mb-2">
        <h1 class="me-4">Inhaltsverzeichnis-Export</h1>
        <v-tooltip text="Lieder insgesamt (Bewertet und genommen)" location="bottom">
            <template #activator="{ props }">
                <v-chip
                    v-bind="props"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-music"
                >
                    {{ stats.total }} Lieder
                </v-chip>
            </template>
        </v-tooltip>
        <v-tooltip
            text="Lieder, die sich eine Liednummer 2026 mit mindestens einem anderen Lied teilen"
            location="bottom"
        >
            <template #activator="{ props }">
                <v-chip
                    v-bind="props"
                    :color="stats.duplicate ? 'warning' : undefined"
                    variant="tonal"
                    prepend-icon="mdi-content-duplicate"
                >
                    {{ stats.duplicate }} gleiche Nr.
                </v-chip>
            </template>
        </v-tooltip>
        <v-tooltip text="Höchste vergebene Liednummer 2026" location="bottom">
            <template #activator="{ props }">
                <v-chip
                    v-bind="props"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-pound"
                >
                    Höchste Nr.: {{ stats.maxNummer ?? '–' }}
                </v-chip>
            </template>
        </v-tooltip>
        <v-tooltip text="Lieder ohne Liednummer 2026" location="bottom">
            <template #activator="{ props }">
                <v-chip
                    v-bind="props"
                    :color="stats.withoutNummer ? 'warning' : undefined"
                    variant="tonal"
                    prepend-icon="mdi-help-circle-outline"
                >
                    {{ stats.withoutNummer }} ohne Nr.
                </v-chip>
            </template>
        </v-tooltip>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-4" style="max-width: 820px">
        Separater Export des Inhaltsverzeichnisses zum Importieren oder Kopieren – alphabetisch nach
        Titel, nach den bestehenden Kategorien, alphabetisch mit Änderungsvermerk (für die Musiker),
        nach Choralbuchnummer (Melodien) sowie nach den reduzierten Inhaltsverzeichnis-Kategorien
        (Spalte E). Die CSV-Datei eignet sich zum Import, die Schaltfläche „In Zwischenablage
        kopieren“ liefert eine direkt einfügbare (Tabulator-getrennte) Fassung. Für den
        zweispaltigen Satz in InDesign gibt es zusätzlich je einen Copy-Button „Nummern“ und
        „Titel“, der nur die jeweilige Spalte (ein Wert pro Zeile) kopiert – bei den
        Kategorie-Ansichten pro Kategorie.
    </p>

    <v-card class="mb-4">
        <v-card-text class="d-flex flex-wrap align-center ga-4">
            <v-checkbox
                v-model="only_accepted"
                label='Nur "Bewertet und genommen"'
                color="success"
                hide-details
                density="comfortable"
            />
            <v-checkbox
                v-model="only_with_number"
                label="Nur mit Liednummer 2026"
                hide-details
                density="comfortable"
            />
        </v-card-text>
    </v-card>

    <v-row>
        <!-- 1. Alphabetisch nach Titel -->
        <v-col cols="12" md="6">
            <v-card class="h-100">
                <v-card-title class="d-flex align-center ga-2">
                    <v-icon>mdi-sort-alphabetical-ascending</v-icon>
                    Alphabetisch nach Titel
                    <v-chip size="small" variant="tonal" class="ms-1">
                        {{ alphabetical.length }}
                    </v-chip>
                </v-card-title>
                <v-card-text>
                    <div class="d-flex flex-wrap ga-2 mb-3">
                        <v-btn
                            color="primary"
                            prepend-icon="mdi-download"
                            :disabled="alphabetical.length === 0"
                            @click="downloadAlphabetical"
                        >
                            CSV herunterladen
                        </v-btn>
                        <v-btn
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="alphabetical.length === 0"
                            @click="copyAlphabetical"
                        >
                            In Zwischenablage kopieren
                        </v-btn>
                    </div>
                    <div class="d-flex flex-wrap align-center ga-2 mb-3">
                        <span class="text-caption text-medium-emphasis">Spalten für InDesign:</span>
                        <v-btn
                            size="small"
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="alphabetical.length === 0"
                            @click="copyNummernSpalte(alphabetical)"
                        >
                            Nummern
                        </v-btn>
                        <v-btn
                            size="small"
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="alphabetical.length === 0"
                            @click="copyTitelSpalte(alphabetical)"
                        >
                            Titel
                        </v-btn>
                    </div>
                    <div class="toc-preview">
                        <v-table density="compact" hover>
                            <thead>
                                <tr>
                                    <th style="width: 90px">Nr. 2026</th>
                                    <th>Titel</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="s in alphabetical" :key="s.id">
                                    <td class="text-medium-emphasis">{{ s.nummer || '–' }}</td>
                                    <td>{{ s.titel }}</td>
                                </tr>
                                <tr v-if="alphabetical.length === 0">
                                    <td colspan="2" class="text-center text-medium-emphasis py-4">
                                        Keine Lieder im aktuellen Filter.
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </div>
                </v-card-text>
            </v-card>
        </v-col>

        <!-- 2. Nach Kategorien -->
        <v-col cols="12" md="6">
            <v-card class="h-100">
                <v-card-title class="d-flex align-center ga-2">
                    <v-icon>mdi-tag-multiple</v-icon>
                    Nach Kategorien
                    <v-chip size="small" variant="tonal" class="ms-1">
                        {{ byCategory.length }} Kategorien · {{ category_distinct_count }} Lieder ·
                        {{ category_song_count }} Einträge
                    </v-chip>
                </v-card-title>
                <v-card-text>
                    <div class="d-flex flex-wrap ga-2 mb-3">
                        <v-btn
                            color="primary"
                            prepend-icon="mdi-download"
                            :disabled="byCategory.length === 0"
                            @click="downloadByCategory"
                        >
                            CSV herunterladen
                        </v-btn>
                        <v-btn
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="byCategory.length === 0"
                            @click="copyByCategory"
                        >
                            In Zwischenablage kopieren
                        </v-btn>
                    </div>
                    <p class="text-caption text-medium-emphasis mb-2">
                        Ein Lied mit mehreren Kategorien erscheint unter jeder davon.
                    </p>
                    <div class="toc-preview">
                        <template v-if="byCategory.length">
                            <div v-for="g in byCategory" :key="g.kategorie" class="mb-3">
                                <div class="d-flex align-center ga-2 mb-1">
                                    <div class="text-subtitle-2 font-weight-bold">
                                        {{ g.kategorie }}
                                        <span class="text-medium-emphasis">
                                            ({{ g.songs.length }})
                                        </span>
                                    </div>
                                    <v-spacer />
                                    <v-btn
                                        size="x-small"
                                        variant="tonal"
                                        prepend-icon="mdi-content-copy"
                                        @click="copyNummernSpalte(g.songs)"
                                    >
                                        Nummern
                                    </v-btn>
                                    <v-btn
                                        size="x-small"
                                        variant="tonal"
                                        prepend-icon="mdi-content-copy"
                                        @click="copyTitelSpalte(g.songs)"
                                    >
                                        Titel
                                    </v-btn>
                                </div>
                                <v-table density="compact">
                                    <tbody>
                                        <tr v-for="s in g.songs" :key="g.kategorie + '-' + s.id">
                                            <td style="width: 90px" class="text-medium-emphasis">
                                                {{ s.nummer || '–' }}
                                            </td>
                                            <td>{{ s.titel }}</td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </div>
                        </template>
                        <div v-else class="text-center text-medium-emphasis py-4">
                            Keine Lieder im aktuellen Filter.
                        </div>
                    </div>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>

    <!-- 3. Alphabetisch mit Änderungsvermerk (Musiker, Issue #74) -->
    <v-row>
        <v-col cols="12">
            <v-card>
                <v-card-title class="d-flex align-center flex-wrap ga-2">
                    <v-icon>mdi-playlist-edit</v-icon>
                    Alphabetisch mit Änderungsvermerk
                    <v-chip size="small" variant="tonal" class="ms-1">
                        {{ changeList.length }} Lieder
                    </v-chip>
                    <v-chip
                        size="small"
                        :color="changed_count ? 'primary' : undefined"
                        variant="tonal"
                    >
                        {{ changed_count }} geändert
                    </v-chip>
                </v-card-title>
                <v-card-text>
                    <div class="d-flex flex-wrap ga-2 mb-3">
                        <v-btn
                            color="primary"
                            prepend-icon="mdi-download"
                            :disabled="changeList.length === 0"
                            @click="downloadChangeList"
                        >
                            CSV herunterladen
                        </v-btn>
                        <v-btn
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="changeList.length === 0"
                            @click="copyChangeList"
                        >
                            In Zwischenablage kopieren
                        </v-btn>
                    </div>
                    <div class="d-flex flex-wrap align-center ga-4 mb-3">
                        <v-checkbox
                            v-model="only_changed"
                            label="Nur geänderte Lieder"
                            color="primary"
                            hide-details
                            density="comfortable"
                        />
                        <div class="d-flex flex-wrap align-center ga-2">
                            <span class="text-caption text-medium-emphasis">
                                Spalten für InDesign:
                            </span>
                            <v-btn
                                size="small"
                                variant="tonal"
                                prepend-icon="mdi-content-copy"
                                :disabled="changeList.length === 0"
                                @click="copyNummernSpalte(changeList)"
                            >
                                Nummern
                            </v-btn>
                            <v-btn
                                size="small"
                                variant="tonal"
                                prepend-icon="mdi-content-copy"
                                :disabled="changeList.length === 0"
                                @click="copyTitelSpalte(changeList)"
                            >
                                Titel
                            </v-btn>
                            <v-btn
                                size="small"
                                variant="tonal"
                                prepend-icon="mdi-content-copy"
                                :disabled="changeList.length === 0"
                                @click="copyVermerkSpalte(changeList)"
                            >
                                Vermerk
                            </v-btn>
                        </div>
                    </div>
                    <p class="text-caption text-medium-emphasis mb-2">
                        Für die Musiker: Liednummer 2026 aufsteigend, mit Hinweis, ob Text
                        <v-icon icon="mdi-text-box-edit" color="primary" size="x-small" /> und/oder
                        Melodie <v-icon icon="mdi-music-box" color="primary" size="x-small" />
                        gegenüber dem Gesangbuch 2000 überarbeitet wurden.
                    </p>
                    <div class="toc-preview">
                        <v-table density="compact" hover>
                            <thead>
                                <tr>
                                    <th style="width: 90px">Nr. 2026</th>
                                    <th>Titel</th>
                                    <th style="width: 70px" class="text-center">Text</th>
                                    <th style="width: 80px" class="text-center">Melodie</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="s in changeList" :key="s.id">
                                    <td class="text-medium-emphasis">{{ s.nummer || '–' }}</td>
                                    <td>{{ s.titel }}</td>
                                    <td class="text-center">
                                        <v-tooltip
                                            v-if="s.textGeaendert"
                                            text="Text wurde gegenüber Gesangbuch 2000 geändert"
                                            location="bottom"
                                        >
                                            <template #activator="{ props }">
                                                <v-icon
                                                    v-bind="props"
                                                    icon="mdi-text-box-edit"
                                                    color="primary"
                                                    size="small"
                                                />
                                            </template>
                                        </v-tooltip>
                                        <span v-else class="text-disabled">–</span>
                                    </td>
                                    <td class="text-center">
                                        <v-tooltip
                                            v-if="s.melodieGeaendert"
                                            text="Melodie wurde gegenüber Gesangbuch 2000 geändert"
                                            location="bottom"
                                        >
                                            <template #activator="{ props }">
                                                <v-icon
                                                    v-bind="props"
                                                    icon="mdi-music-box"
                                                    color="primary"
                                                    size="small"
                                                />
                                            </template>
                                        </v-tooltip>
                                        <span v-else class="text-disabled">–</span>
                                    </td>
                                </tr>
                                <tr v-if="changeList.length === 0">
                                    <td colspan="4" class="text-center text-medium-emphasis py-4">
                                        {{
                                            only_changed
                                                ? 'Keine geänderten Lieder im aktuellen Filter.'
                                                : 'Keine Lieder im aktuellen Filter.'
                                        }}
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </div>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>

    <!-- 4. Nach Choralbuchnummer (Melodien, Issue #73) -->
    <v-row>
        <v-col cols="12">
            <v-card>
                <v-card-title class="d-flex align-center ga-2">
                    <v-icon>mdi-music-clef-treble</v-icon>
                    Nach Choralbuchnummer (Melodien)
                    <v-chip size="small" variant="tonal" class="ms-1">
                        {{ choralbuch.length }} Melodien
                    </v-chip>
                </v-card-title>
                <v-card-text>
                    <div class="d-flex flex-wrap ga-2 mb-3">
                        <v-btn
                            color="primary"
                            prepend-icon="mdi-download"
                            :disabled="choralbuch.length === 0"
                            @click="downloadChoralbuch"
                        >
                            CSV herunterladen
                        </v-btn>
                        <v-btn
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="choralbuch.length === 0"
                            @click="copyChoralbuch"
                        >
                            In Zwischenablage kopieren
                        </v-btn>
                    </div>
                    <div class="d-flex flex-wrap align-center ga-2 mb-3">
                        <span class="text-caption text-medium-emphasis">Spalten für InDesign:</span>
                        <v-btn
                            size="small"
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="choralbuch.length === 0"
                            @click="copyNummernSpalte(choralbuch)"
                        >
                            Nummern
                        </v-btn>
                        <v-btn
                            size="small"
                            variant="tonal"
                            prepend-icon="mdi-content-copy"
                            :disabled="choralbuch.length === 0"
                            @click="copyTitelSpalte(choralbuch)"
                        >
                            Titel
                        </v-btn>
                    </div>
                    <p class="text-caption text-medium-emphasis mb-2">
                        Alle Melodien mit einer Choralbuchnummer, aufsteigend nach Nummer sortiert.
                        Die Choralbuchnummer wird an Melodien vergeben, die von mindestens einem
                        „Bewertet und genommen“-Lied verwendet werden – die Lied-Filter oben wirken
                        sich hier nicht aus.
                    </p>
                    <div class="toc-preview">
                        <v-table density="compact" hover>
                            <thead>
                                <tr>
                                    <th style="width: 120px">Choralbuch-Nr.</th>
                                    <th>Melodie-Titel</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="m in choralbuch" :key="m.id">
                                    <td class="text-medium-emphasis">{{ m.nummer }}</td>
                                    <td>{{ m.titel || '–' }}</td>
                                </tr>
                                <tr v-if="choralbuch.length === 0">
                                    <td colspan="2" class="text-center text-medium-emphasis py-4">
                                        Keine Melodien mit Choralbuchnummer.
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </div>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>

    <!-- 5. Nach Inhaltsverzeichnis-Kategorien (Issue #53) -->
    <v-row>
        <v-col cols="12">
            <v-card>
                <v-card-title class="d-flex align-center flex-wrap ga-2">
                    <v-icon>mdi-format-list-bulleted-type</v-icon>
                    Nach Inhaltsverzeichnis-Kategorien
                    <v-chip v-if="toc_available" size="small" variant="tonal" class="ms-1">
                        {{ byTocCategory.length }} Kategorien · {{ toc_distinct_count }} Lieder ·
                        {{ toc_song_count }} Einträge
                    </v-chip>
                    <v-tooltip
                        text="Kategorien der nicht zugeordneten Lieder anzeigen"
                        location="bottom"
                    >
                        <template #activator="{ props }">
                            <v-chip
                                v-if="toc_available && toc_unmapped_count"
                                v-bind="props"
                                size="small"
                                color="warning"
                                variant="tonal"
                                prepend-icon="mdi-help-circle-outline"
                                append-icon="mdi-open-in-new"
                                style="cursor: pointer"
                                role="button"
                                @click="unmapped_dialog = true"
                            >
                                {{ toc_unmapped_count }} ohne Zuordnung
                            </v-chip>
                        </template>
                    </v-tooltip>
                </v-card-title>
                <v-card-text>
                    <v-alert
                        v-if="!toc_available"
                        type="info"
                        variant="tonal"
                        density="comfortable"
                        class="mb-2"
                    >
                        Es sind keine Inhaltsverzeichnis-Kategorien verfügbar. Sobald die Kategorien
                        und ihr Mapping in Directus angelegt und freigegeben sind, erscheinen die
                        Lieder hier gruppiert.
                    </v-alert>
                    <template v-else>
                        <div class="d-flex flex-wrap ga-2 mb-3">
                            <v-btn
                                color="primary"
                                prepend-icon="mdi-download"
                                :disabled="byTocCategory.length === 0"
                                @click="downloadByTocCategory"
                            >
                                CSV herunterladen
                            </v-btn>
                            <v-btn
                                variant="tonal"
                                prepend-icon="mdi-content-copy"
                                :disabled="byTocCategory.length === 0"
                                @click="copyByTocCategory"
                            >
                                In Zwischenablage kopieren
                            </v-btn>
                        </div>
                        <p class="text-caption text-medium-emphasis mb-2">
                            Reduzierte Kategorien fürs gedruckte Inhaltsverzeichnis, sortiert nach
                            der hinterlegten Reihenfolge. Ein Lied erscheint unter jeder
                            Inhaltsverzeichnis-Kategorie, in die eine seiner Kategorien fällt.
                        </p>
                        <div class="toc-preview">
                            <template v-if="byTocCategory.length">
                                <div v-for="g in byTocCategory" :key="g.kategorie" class="mb-3">
                                    <div class="d-flex align-center ga-2 mb-1">
                                        <div class="text-subtitle-2 font-weight-bold">
                                            {{ g.kategorie }}
                                            <span class="text-medium-emphasis">
                                                ({{ g.songs.length }})
                                            </span>
                                        </div>
                                        <v-spacer />
                                        <v-btn
                                            size="x-small"
                                            variant="tonal"
                                            prepend-icon="mdi-content-copy"
                                            @click="copyNummernSpalte(g.songs)"
                                        >
                                            Nummern
                                        </v-btn>
                                        <v-btn
                                            size="x-small"
                                            variant="tonal"
                                            prepend-icon="mdi-content-copy"
                                            @click="copyTitelSpalte(g.songs)"
                                        >
                                            Titel
                                        </v-btn>
                                    </div>
                                    <v-table density="compact">
                                        <tbody>
                                            <tr
                                                v-for="s in g.songs"
                                                :key="g.kategorie + '-' + s.id"
                                            >
                                                <td
                                                    style="width: 90px"
                                                    class="text-medium-emphasis"
                                                >
                                                    {{ s.nummer || '–' }}
                                                </td>
                                                <td>{{ s.titel }}</td>
                                            </tr>
                                        </tbody>
                                    </v-table>
                                </div>
                            </template>
                            <div v-else class="text-center text-medium-emphasis py-4">
                                Keine Lieder im aktuellen Filter.
                            </div>
                        </div>
                    </template>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>

    <!-- Diagnose-Dialog: Kategorien der nicht zugeordneten Lieder (Issue #53) -->
    <v-dialog v-model="unmapped_dialog" max-width="720">
        <v-card>
            <v-card-title class="d-flex align-center ga-2">
                <v-icon color="warning">mdi-help-circle-outline</v-icon>
                Lieder ohne Inhaltsverzeichnis-Zuordnung
            </v-card-title>
            <v-card-subtitle class="text-wrap">
                {{ toc_unmapped_count }} Lieder fallen in keine Inhaltsverzeichnis-Kategorie. Diese
                Kategorien haben (noch) kein Mapping – jede sollte einer
                Inhaltsverzeichnis-Kategorie zugeordnet werden.
            </v-card-subtitle>
            <v-card-text>
                <div class="d-flex flex-wrap ga-2 mb-3">
                    <v-btn
                        size="small"
                        color="primary"
                        variant="tonal"
                        prepend-icon="mdi-format-list-bulleted"
                        :disabled="toc_unmapped_count === 0"
                        @click="openSongsDialog(null)"
                    >
                        Alle {{ toc_unmapped_count }} Lieder anzeigen
                    </v-btn>
                    <v-btn
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-content-copy"
                        :disabled="unmapped_category_breakdown.list.length === 0"
                        @click="copyUnmappedBreakdown"
                    >
                        Liste kopieren
                    </v-btn>
                </div>
                <p class="text-caption text-medium-emphasis mb-2">
                    Zeile anklicken, um die Lieder der jeweiligen Kategorie anzuzeigen.
                </p>
                <v-table density="compact" hover>
                    <thead>
                        <tr>
                            <th>Kategorie</th>
                            <th style="width: 70px">ID</th>
                            <th style="width: 90px" class="text-right">Lieder</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="k in unmapped_category_breakdown.list"
                            :key="k.id ?? k.name"
                            style="cursor: pointer"
                            @click="openSongsDialog({ id: k.id, name: k.name })"
                        >
                            <td>
                                {{ k.name }}
                                <v-chip
                                    v-if="k.hasMapping"
                                    size="x-small"
                                    color="error"
                                    variant="tonal"
                                    class="ms-1"
                                >
                                    Mapping-Konflikt
                                </v-chip>
                            </td>
                            <td class="text-medium-emphasis">{{ k.id ?? '–' }}</td>
                            <td class="text-right">{{ k.count }}</td>
                        </tr>
                        <tr
                            v-if="unmapped_category_breakdown.ohneKategorie"
                            style="cursor: pointer"
                            @click="openSongsDialog({ ohneKategorie: true })"
                        >
                            <td class="font-italic text-medium-emphasis">
                                Ohne Kategorie (kein Kategorie-Eintrag)
                            </td>
                            <td class="text-medium-emphasis">–</td>
                            <td class="text-right">
                                {{ unmapped_category_breakdown.ohneKategorie }}
                            </td>
                        </tr>
                        <tr
                            v-if="
                                unmapped_category_breakdown.list.length === 0 &&
                                !unmapped_category_breakdown.ohneKategorie
                            "
                        >
                            <td colspan="3" class="text-center text-medium-emphasis py-4">
                                Alle Lieder sind zugeordnet.
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="unmapped_dialog = false">Schließen</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <!-- Zweiter Dialog: konkrete Lieder ohne IV-Zuordnung (Issue #53) -->
    <v-dialog v-model="songs_dialog" max-width="720" scrollable>
        <v-card>
            <v-card-title class="d-flex align-center ga-2">
                <v-icon color="warning">mdi-music-note-off-outline</v-icon>
                {{ songs_dialog_title }}
            </v-card-title>
            <v-card-subtitle class="text-wrap">
                {{ unmapped_songs_filtered.length }} Lieder, die in keine
                Inhaltsverzeichnis-Kategorie fallen.
            </v-card-subtitle>
            <v-card-text style="max-height: 60vh">
                <div class="d-flex flex-wrap ga-2 mb-3">
                    <v-btn
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-content-copy"
                        :disabled="unmapped_songs_filtered.length === 0"
                        @click="copyUnmappedSongs"
                    >
                        Liste kopieren
                    </v-btn>
                </div>
                <v-table density="compact" hover>
                    <thead>
                        <tr>
                            <th style="width: 90px">Nr. 2026</th>
                            <th>Titel</th>
                            <th>Kategorien</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="s in unmapped_songs_filtered" :key="s.id">
                            <td class="text-medium-emphasis">{{ s.nummer || '–' }}</td>
                            <td>{{ s.titel }}</td>
                            <td class="text-medium-emphasis">
                                {{ s.kategorien.length ? s.kategorien.join(', ') : '–' }}
                            </td>
                        </tr>
                        <tr v-if="unmapped_songs_filtered.length === 0">
                            <td colspan="3" class="text-center text-medium-emphasis py-4">
                                Keine Lieder.
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="songs_dialog = false">Schließen</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="3000">
        {{ snackbar_message }}
        <template #actions>
            <v-btn variant="text" @click="snackbar = false">OK</v-btn>
        </template>
    </v-snackbar>
</template>

<style scoped>
.toc-preview {
    max-height: 60vh;
    overflow-y: auto;
}
</style>
