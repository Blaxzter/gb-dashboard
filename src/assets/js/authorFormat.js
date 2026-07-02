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

// --- Footer nach Janoschs Grammatik ----------------------------------------
// Gemeinsam genutzt vom Notentext-Export (CSV-Spalte „footer") und vom
// Kopier-Button in der Lied-Detailansicht (Issue #64), damit beide exakt
// identisch formatieren. Jahresangabe (Issue #18): (1798–1874) / (1989) – ohne
// Sternchen oder Kreuz, über formatYearRange.

// ursprungsAutor:  {vorname} {nachname} (geburtsjahr–sterbejahr)  (ohne Praefix/Suffix)
// ursprungsAutorObj ist entweder ein Autoren-Objekt oder der String 'Keine'.
function formatFooterUrsprungsAutor(u) {
    if (!u || typeof u !== 'object') return '';
    let s = '';
    if (u.vorname) s += `${u.vorname} `;
    if (u.nachname) s += u.nachname;
    s = s.trimEnd();
    const years = formatYearRange(u.geburtsjahr, u.sterbejahr);
    if (years) s = s ? `${s} ${years}` : years;
    return s.trim();
}

// Pro Autor:  {praefix} {vorname} {nachname} (geburtsjahr–sterbejahr) {suffix} {ursprungsAutor}
//   - Leerzeichen nach vorname/praefix nur, wenn nicht leer
function formatFooterAuthorEntry(author) {
    if (!author) return '';
    let s = '';
    if (author.autorPrefix) s += `${author.autorPrefix} `;
    if (author.vorname) s += `${author.vorname} `;
    if (author.nachname) s += author.nachname;
    s = s.trimEnd();

    const years = formatYearRange(author.geburtsjahr, author.sterbejahr);
    if (years) s = s ? `${s} ${years}` : years;
    if (author.autorSuffix) s += s ? ` ${author.autorSuffix}` : author.autorSuffix;

    const ursprung = formatFooterUrsprungsAutor(author.ursprungsAutorObj);
    if (ursprung) s += s ? ` ${ursprung}` : ursprung;
    return s.trim();
}

function formatFooterAuthors(authors) {
    return (authors || []).map(formatFooterAuthorEntry).filter(Boolean).join(', ');
}

function footerCopyright(copyright) {
    const v = copyright && String(copyright).trim();
    return v ? `© ${v}` : '';
}

// Liefert den fertig formatierten Footer:
//   Text: {Text-Autor} © {Text-Copyright}
//   Melodie: {Melodie-Autor} © {Melodie-Copyright}
//   © {Lied-Copyright}
// Sind Text- und Melodie-Autor gleich: "Text und Melodie: {Autor}".
// Leere Bestandteile (Copyright, Autor) werden samt führendem Trenner weggelassen.
export function buildFooter(lied) {
    const textAuthors = formatFooterAuthors(lied?.text?.authors);
    const melodyAuthors = formatFooterAuthors(lied?.melodie?.authors);
    const textCr = footerCopyright(lied?.text?.copyright);
    const melodyCr = footerCopyright(lied?.melodie?.copyright);
    const liedCr = footerCopyright(lied?.copyright);

    const lines = [];

    if (textAuthors && melodyAuthors && textAuthors === melodyAuthors) {
        const crs = [...new Set([textCr, melodyCr].filter(Boolean))];
        lines.push(['Text und Melodie:', textAuthors, ...crs].join(' '));
    } else {
        const textBody = [textAuthors, textCr].filter(Boolean).join(' ');
        if (textBody) lines.push(`Text: ${textBody}`);
        const melodyBody = [melodyAuthors, melodyCr].filter(Boolean).join(' ');
        if (melodyBody) lines.push(`Melodie: ${melodyBody}`);
    }

    if (liedCr) lines.push(liedCr);

    return lines.join('\n');
}
