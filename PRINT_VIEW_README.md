# Druckansicht (Print View) - Dokumentation

## Überblick

Die Druckansicht ist eine neue Funktion, die es ermöglicht, Gesangbuchlieder in einem druckfreundlichen A4-Format anzuzeigen. Diese Ansicht ist speziell für das Drucken optimiert und zeigt alle relevanten Informationen auf einer Seite an.

## Komponenten

### 1. PrintGesangbuchLiedComponent
**Pfad:** `src/components/SongRelated/PrintGesangbuchLiedComponent.vue`

Dies ist die Hauptkomponente für die Druckansicht. Sie zeigt ein einzelnes Gesangbuchlied in einem druckfreundlichen Format an.

#### Anzeige-Elemente (in dieser Reihenfolge):
1. **Kategorien** - Oben rechts als Chips
2. **Titel** - Großer, fettgedruckter Titel
3. **Noten/Bilder** - Erste Datei aus dem Karussell (max. 20% der Seite)
4. **Strophen** - Mit Anmerkungen **neben** den Versen (nicht darunter)
5. **Autoren** - Text- und Melodieautoren
6. **Einreicher** - Falls vorhanden
7. **Allgemeine Anmerkungen** - Lied-, Text- und Melodieanmerkungen
8. **Gesangbuch 2000 Referenz** - Falls vorhanden
9. **Copyright-Warnung** - Falls eine Prüfung erforderlich ist

#### Nicht enthalten:
- Keine Dialoge
- Keine "Kleiner Kreis" Bewertungen
- Keine interaktiven Elemente
- Keine Bewertungen

### 2. PrintView
**Pfad:** `src/views/PrintView.vue`

Dies ist die View-Komponente, die eine oder mehrere PrintGesangbuchLiedComponent-Instanzen anzeigt.

### 3. CopyrightCheckPrintView
**Pfad:** `src/views/CopyrightCheckPrintView.vue`

Eine spezialisierte View-Komponente, die automatisch alle Lieder mit gesetztem `autor_oder_copyright_checken` Flag anzeigt. Diese View ist speziell für die Massenprüfung von Copyright-Informationen gedacht.

## Verwendung

### Einzelnes Lied drucken

1. **Über die Gesangbuchlieder-Übersicht:**
   - Öffnen Sie ein Gesangbuchlied in der Dialog-Ansicht
   - Klicken Sie auf den Button "Druckansicht" unten rechts
   - Die Druckansicht öffnet sich in einem neuen Tab
   - Klicken Sie auf "Drucken" oder verwenden Sie `Strg+P` / `Cmd+P`

2. **Direkt über URL:**
   ```
   /druckansicht?songId=123
   ```

### Mehrere Lieder drucken

Um mehrere Lieder auf einmal zu drucken (ein Lied pro Seite), können Sie die URL-Parameter erweitern:

**Zukünftige Implementierung (TODO):**
```javascript
// Beispiel für mehrere Lieder
this.$router.push({
  path: '/druckansicht',
  params: { songIds: [1, 2, 3, 4] }
});
```

### Copyright-Prüfung Druckansicht

Eine spezielle Druckansicht zeigt alle Lieder an, die auf Autor/Copyright geprüft werden müssen:

1. **Über URL:**
   ```
   /copyright-pruefen-druckansicht
   ```

2. **Features:**
   - Zeigt automatisch alle Lieder mit `autor_oder_copyright_checken = true`
   - Ein Lied pro Seite
   - Zählt die Anzahl der zu prüfenden Lieder in der Kopfzeile
   - Zeigt eine Erfolgsmeldung, wenn keine Lieder zu prüfen sind

## Druckoptimierung

### A4-Format
- Die Komponente ist für A4-Papier (210mm x 297mm) optimiert
- Automatische Seitenumbrüche nach jedem Lied
- 15mm Randabstand auf allen Seiten

### Versumbruch
Bei Liedern mit vielen Versen:
- Die Verse fließen automatisch auf die nächste Seite über
- Verse und ihre Anmerkungen werden zusammengehalten (`page-break-inside: avoid`)
- Der Browser verwaltet die Seitenumbrüche automatisch

### Bildgröße
- Bilder/Noten nehmen maximal 20% der Seitenhöhe ein
- Bilder werden zentriert und proportional skaliert
- Bei PDFs wird nur die erste Seite angezeigt

## Styling

### Bildschirm-Ansicht
- Zeigt Seitengrenzen mit Schatten an
- Zentriert die Seiten
- Zeigt ein Steuerfeld oben an

### Druck-Ansicht
- Entfernt alle nicht-druckbaren Elemente (Steuerfeld, Navigation)
- Optimiert für schwarz-weiß Druck
- Seitenumbrüche nach jedem Lied

## Technische Details

### Route
**Pfad:** `/druckansicht`
**Name:** `PrintView`

### Query-Parameter
- `songId` (String/Number) - ID eines einzelnen Liedes

### Abhängigkeiten
- `vue-pdf-embed` - Für PDF-Vorschau
- `vuetify` - Für UI-Komponenten
- Store: `useAppStore` - Für Lied-Daten

## Zukünftige Erweiterungen

1. **Batch-Druck:**
   - Auswahl mehrerer Lieder in der Übersicht
   - "Ausgewählte drucken" Button

2. **Druckoptionen:**
   - Auswahl: Mit/ohne Bilder
   - Schriftgröße anpassen
   - Farbe vs. Schwarz-weiß

3. **Export:**
   - PDF-Export direkt aus der Anwendung
   - Speichern als Dokument

4. **Layout-Varianten:**
   - Kompakt-Ansicht (mehr Verse pro Seite)
   - Großdruck-Ansicht (für bessere Lesbarkeit)

## Beispielcode

### Komponente verwenden
```vue
<template>
  <PrintGesangbuchLiedComponent :selected-song="mySong" />
</template>

<script>
import PrintGesangbuchLiedComponent from '@/components/SongRelated/PrintGesangbuchLiedComponent.vue';

export default {
  components: { PrintGesangbuchLiedComponent },
  data() {
    return {
      mySong: {
        // Lied-Objekt aus dem Store
      }
    }
  }
}
</script>
```

### Programmatisch zur Druckansicht navigieren
```javascript
// Einzelnes Lied
this.$router.push({ 
  path: '/druckansicht', 
  query: { songId: 123 } 
});

// In neuem Tab öffnen
window.open(`/druckansicht?songId=123`, '_blank');
```

## Wartung

Bei Änderungen an den Lied-Datenstrukturen:
1. Prüfen Sie beide Komponenten (`GesangbuchLiedComponent` und `PrintGesangbuchLiedComponent`)
2. Stellen Sie sicher, dass alle Felder korrekt gemappt sind
3. Testen Sie die Druckausgabe in verschiedenen Browsern

## Browser-Unterstützung

Getestet in:
- Chrome/Chromium
- Firefox
- Safari
- Edge

**Hinweis:** Die Druckausgabe kann je nach Browser leicht variieren.
