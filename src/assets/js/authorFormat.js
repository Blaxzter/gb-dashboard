// Einheitliche Formatierung von Autorenangaben.
//
// Wird sowohl für die Autoren-Spalten der Suche (store/app.js -> author_name) als
// auch für den CSV-Export (NotenExportView) verwendet, damit beide identisch
// formatieren (siehe Issues #18, #23, #24).
//
// Format der Jahresangabe (Issue #18 – keine Sternchen / Kreuze mehr):
//   Geburts- und Sterbejahr: (1798–1874)
//   nur Geburtsjahr:         (1989)
//   nur Sterbejahr:          (–1874)

// Jahresangabe eines Autors. Leerer String, wenn weder Geburts- noch Sterbejahr
// vorhanden sind.
export function formatYearRange(geburtsjahr, sterbejahr) {
    if (!geburtsjahr && !sterbejahr) return '';
    return `(${geburtsjahr || ''}${sterbejahr ? `–${sterbejahr}` : ''})`;
}

// Ein einzelner Autor:
//   {Praefix} {Vorname} {Nachname} (Jahre) {Suffix} {Ursprungsautor} (Jahre)
// Leere Bestandteile (inkl. fehlender Vorname, Issue #23) werden samt
// zugehörigem Leerzeichen weggelassen. Der Ursprungsautor (Issue #24) wird ohne
// Praefix/Suffix angehängt; `ursprungsAutorObj` ist entweder ein Autoren-Objekt
// oder der String 'Keine'.
export function formatAuthorEntry(author) {
    if (!author) return '';
    const parts = [];
    if (author.autorPrefix) parts.push(author.autorPrefix);
    const name = [author.vorname, author.nachname].filter(Boolean).join(' ');
    if (name) parts.push(name);
    const years = formatYearRange(author.geburtsjahr, author.sterbejahr);
    if (years) parts.push(years);
    if (author.autorSuffix) parts.push(author.autorSuffix);

    const u = author.ursprungsAutorObj;
    if (u && typeof u === 'object') {
        const uName = [u.vorname, u.nachname].filter(Boolean).join(' ');
        if (uName) parts.push(uName);
        const uYears = formatYearRange(u.geburtsjahr, u.sterbejahr);
        if (uYears) parts.push(uYears);
    }
    return parts.join(' ');
}

// Liste von Autoren als ", "-getrennter String, optional gefolgt von
// Copyright-Zeilen (jeweils mit "© " und durch Zeilenumbruch getrennt).
export function formatAuthors(authors, ...copyrights) {
    const authorStrings = (authors || []).map(formatAuthorEntry).filter(Boolean);
    const copyrightStrings = copyrights
        .filter((c) => c && String(c).trim())
        .map((c) => `© ${String(c).trim()}`);
    return [authorStrings.join(', '), ...copyrightStrings].filter(Boolean).join('\n');
}
