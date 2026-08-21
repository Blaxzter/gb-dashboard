// Neu/Alt-Bestimmung für die Neue-Lieder-Ansicht.
//
// Die Regeln sehen harmlos aus, entscheiden aber über eine Zahl, die nach außen
// kommuniziert wird ("wie viel im Gesangbuch 2026 ist neu?"). Zwei Annahmen der
// ersten Fassung waren falsch und haben die Melodiezahl von 40 % auf 51 %
// getrieben – deshalb liegt die Logik hier statt in der View und ist getestet.
//
// 1. Der GB2000-Bestand wurde nur aus angenommenen Liedern gebildet. Eine
//    Melodie, die im Gesangbuch 2000 stand, ist aber alt – auch wenn das Lied,
//    das sie trug, für 2026 aussortiert wurde. Sie muss trotzdem als bekannt
//    gelten, sobald ein neues Lied sie wiederverwendet.
//
// 2. `melodieGeaendert` schloss die Melodie aus dem Bestand aus. Das Häkchen
//    heißt aber "die Melodie wurde überarbeitet" (z. B. wechselnde
//    4/4-3/4-2/4-Taktung zu durchgehend 4/4 vereinheitlicht) – nicht "es ist
//    eine andere Melodie". Wer "Befiehl du deine Wege" nach überarbeiteter
//    Taktung singt, singt weiterhin "Valet will ich dir geben" von 1615. Ein
//    Abgleich gegen den gedruckten GB2000-Bestand zeigt: von 94 markierten
//    Liedern haben 33 tatsächlich eine andere Melodie bekommen, der Rest singt
//    dieselbe. Das Häkchen darf die Melodie deshalb nicht aus dem Altbestand
//    entfernen.
//
// Beim Text ist es umgekehrt: `textGeaendert` ist geprüft und verlässlich
// (34 von 49 Häkchen markieren echte Überarbeitungen, 13 weitere ein bis drei
// geänderte Wörter, nur 2 sind wortgleich). Ein überarbeiteter Text ist auch
// wirklich ein anderer Text – dort bleibt das Häkchen also Teil der Regel.
//
// Genauer wird das erst mit dem GB2000-Referenzdatensatz, der ausgetauschte von
// überarbeiteten Melodien trennt; siehe docs/gb2000-referenz.md.

/** Ein Lied gilt als angenommen, wenn der Kleine Kreis es mit "Rein" bewertet hat. */
export const istAngenommen = (lied) => lied?.bewertung_kleiner_kreis?.bezeichner === 'Rein';

/** Stand das Lied schon im Gesangbuch 2000? */
export const istAus2000 = (lied) => lied?.liednummer2000 != null;

/**
 * Melodien, die es im Gesangbuch 2000 schon gab.
 *
 * Bewusst über *alle* Lieder gebildet, nicht nur die angenommenen, und ohne
 * Rücksicht auf `melodieGeaendert` – siehe Kopfkommentar.
 */
export function melodienAus2000(gesangbuchlieder) {
    const ids = new Set();
    for (const lied of gesangbuchlieder ?? []) {
        if (istAus2000(lied) && lied.melodie?.id != null) ids.add(lied.melodie.id);
    }
    return ids;
}

/**
 * Texte, die es im Gesangbuch 2000 schon gab und die seither nicht überarbeitet
 * wurden. Auch hier zählen alle Lieder, nicht nur die angenommenen.
 */
export function texteAus2000(gesangbuchlieder) {
    const ids = new Set();
    for (const lied of gesangbuchlieder ?? []) {
        if (istAus2000(lied) && lied.text?.id != null && !lied.textGeaendert) ids.add(lied.text.id);
    }
    return ids;
}

/**
 * Kennzahlen der Übersicht.
 *
 * Melodien werden **pro Lied** ausgewiesen, nicht pro Melodie-Datensatz. Eine
 * Zählung über Datensätze gewichtet jede neue Einzelmelodie so schwer wie eine,
 * auf der neun Lieder stehen: neue Melodien tragen fast immer genau ein Lied,
 * bekannte bis zu neun. Für die Frage hinter der Statistik – wie viel muss die
 * Gemeinde neu lernen? – zählt das Lied. Die Zahl der Melodie-Datensätze bleibt
 * als `melodienDatensaetze` erhalten, sie beschreibt den Lernaufwand des Chores.
 */
export function berechneStatistik(gesangbuchlieder) {
    const alle = gesangbuchlieder ?? [];
    const angenommen = alle.filter(istAngenommen);
    const melodieAlt = melodienAus2000(alle);
    const textAlt = texteAus2000(alle);

    const melodieIds = new Set();
    const neueMelodieIds = new Set();
    const textIds = new Set();
    const neueTextIds = new Set();
    let neueLieder = 0;
    let liederAufNeuerMelodie = 0;
    let komplettNeu = 0;
    let ueberarbeitet = 0;

    for (const lied of angenommen) {
        if (!istAus2000(lied)) {
            komplettNeu += 1;
            neueLieder += 1;
        } else if (lied.textGeaendert || lied.melodieGeaendert) {
            ueberarbeitet += 1;
            neueLieder += 1;
        }

        if (lied.melodie?.id != null) {
            melodieIds.add(lied.melodie.id);
            if (!melodieAlt.has(lied.melodie.id)) {
                neueMelodieIds.add(lied.melodie.id);
                liederAufNeuerMelodie += 1;
            }
        }
        if (lied.text?.id != null) {
            textIds.add(lied.text.id);
            if (!textAlt.has(lied.text.id)) neueTextIds.add(lied.text.id);
        }
    }

    return {
        lieder: { neu: neueLieder, total: angenommen.length },
        texte: { neu: neueTextIds.size, total: textIds.size },
        // Kennzahl der Karte: Lieder, die eine neue Melodie mitbringen.
        melodien: { neu: liederAufNeuerMelodie, total: angenommen.length },
        // Nebenzahl für den Fließtext: verschiedene Melodien statt Lieder.
        melodienDatensaetze: { neu: neueMelodieIds.size, total: melodieIds.size },
        komposition: {
            komplettNeu,
            ueberarbeitet,
            uebernommen: angenommen.length - komplettNeu - ueberarbeitet,
            total: angenommen.length,
        },
    };
}

/** Anteil in Prozent, gerundet. */
export const anteil = (stat) =>
    stat && stat.total > 0 ? Math.round((stat.neu / stat.total) * 100) : 0;
