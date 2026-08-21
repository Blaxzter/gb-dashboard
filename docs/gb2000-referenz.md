# GB2000-Referenzdatensatz

## Warum

Die Neue-Lieder-Statistik (`src/views/NeueLiederView.vue`) entscheidet „neu vs.
alt" über drei Angaben am Gesangbuchlied:

- `liednummer2000` – war das Lied im Gesangbuch 2000?
- `textGeaendert` – wurde der Text überarbeitet?
- `melodieGeaendert` – wurde die Melodie ausgetauscht?

`textGeaendert` lässt sich prüfen und hält der Gegenprobe stand. `melodieGeaendert`
lässt sich **nicht** prüfen: Es bedeutet „die Melodie wurde überarbeitet" (z. B.
wechselnde 4/4-3/4-2/4-Taktung zu durchgehend 4/4 vereinheitlicht), und dazu enthält
der Quelldatensatz nichts – nur Melodiename und Komponist, keine Noten. Auch der
heutige Notensatz gibt kein Signal: Aus allen 342 MusicXML-Dateien ausgelesen zeigen
markierte Lieder mit 75 % sogar geringfügig häufiger Taktwechsel als unmarkierte (68 %).

Das Problem ist deshalb nicht, dass Häkchen falsch säßen, sondern dass die Statistik
`melodieGeaendert` als „andere Melodie" liest. Gegenprobe gegen das gedruckte
Gesangbuch 2000 (Stand 19.08.2026, 343 angenommene 2000er-Lieder, Text Strophe für
Strophe und Wort für Wort verglichen):

| Befund | Anzahl |
| --- | --- |
| `melodieGeaendert = true`, Melodie stand schon im GB2000 | 63 von 87 |
| `melodieGeaendert = false`, Melodie nachweislich ausgetauscht | 9 |
| `textGeaendert = true`, Text tatsächlich überarbeitet | 34 von 49 |
| `textGeaendert = true`, nur 1–3 Wörter geändert | 13 |
| `textGeaendert = true`, Wortlaut identisch | 2 |
| `textGeaendert = false`, Text tatsächlich überarbeitet | 6 |

Über die Häkchen gerechnet sind 50 % der Melodien „neu", gegen den echten
GB2000-Bestand 44 % der Melodien-Datensätze bzw. 32 % der Lieder. Sollen überarbeitete
Melodien sichtbar bleiben, gehören sie in eine eigene Kategorie neben „neu" und
„unverändert" – nicht in die Neu-Zählung.

Beim Textvergleich müssen Parser-Artefakte herausgerechnet werden, sonst entstehen
Fehlbefunde: Wiederholungszeichen liest der Parser als `I:` / `:I` statt `|:` / `:|`,
dazu kommen fehlende Leerzeichen, großes I statt l und Apostroph-Varianten
(`geleit'` → `geleit`). `text_normalisiert` ist entsprechend aufbereitet.

## Stand

Die Ansicht rechnet inzwischen ohne den Referenzdatensatz korrigiert
(`src/assets/js/neueLiederStatistik.js`, getestet):

- Der GB2000-Bestand wird über **alle** Lieder gebildet, nicht nur die
  angenommenen – eine Melodie, die 2000 im Buch stand, bleibt alt, auch wenn ihr
  Lied für 2026 aussortiert wurde.
- `melodieGeaendert` entfernt die Melodie **nicht** mehr aus dem Altbestand.
- Die Melodiekarte zählt **Lieder**, nicht Melodie-Datensätze.

Ergebnis: „Lieder auf neuer Melodie" 155 von 564 (27 %) statt „Neue Melodien"
186 von 363 (51 %).

Was der Referenzdatensatz zusätzlich brächte: Die jetzige Regel behandelt alle
94 markierten Lieder als „nur überarbeitet". Tatsächlich haben 33 eine andere
Melodie bekommen; deren Melodien gehören nicht in den Altbestand. Mit dem
Referenzdatensatz sind es 181 von 564 (32 %) statt 155 (27 %) – und die Zahl
hängt dann nicht mehr an Häkchen, die beim Bearbeiten anders gesetzt werden.

Der Referenzdatensatz hält den GB2000-Stand fest, wie er gedruckt wurde, und
ändert sich nicht mehr.

## Erzeugen

```bash
node scripts/build-gb2000-original.mjs [--src <GB_Parser-Verzeichnis>] [--out <datei.json>]
```

Quelle sind die beiden Parser-Ausgaben aus dem GB_Parser-Projekt
(`Johannisches Gesangbuch_komplett_updated.json`, Lied 1–420, und
`Johannisches_Gesangbuch_extended.json`, Lied 421–470). Ergebnis: ein Array mit
470 Objekten, direkt als Directus-JSON-Import geeignet.

## Directus-Collection

Das Schema wird live im Admin gepflegt – die Collection muss dort einmal
angelegt werden, bevor der Import läuft. Vorschlag: `gesangbuchlied2000`,
schreibgeschützt für alle außer Admins, damit sie Referenz bleibt.

| Feld | Typ | Bemerkung |
| --- | --- | --- |
| `id` | Integer, Auto-Increment | Primärschlüssel |
| `nummer2000` | Integer, unique | Join-Schlüssel auf `gesangbuchlied.liednummer2000` |
| `titel` | String | erste Zeile der 1. Strophe bis zum ersten Satzzeichen |
| `titel_versalien` | String | Überschrift wie im Buch (Versalien) |
| `melodie_name` | String | Melodiename; ohne Verweis der Liedtitel selbst |
| `melodie_verweis` | String, nullable | `null` = Melodie steht beim Lied (232 Lieder) |
| `text_autor` | Text, nullable | Autorenzeile wie im Buch |
| `melodie_autor` | Text, nullable | Komponistenzeile wie im Buch |
| `strophen` | JSON | `[{ nummer, strophe }]` |
| `strophen_anzahl` | Integer | |
| `text_normalisiert` | Text | kleingeschrieben, ohne Satzzeichen, Umlaute aufgelöst |
| `text_fingerprint` | String (40) | SHA-1 über `text_normalisiert` |
| `melodie_fingerprint` | String (40) | SHA-1 über Melodiename + Komponist |
| `quelle` | String | `komplett_updated` / `extended` |

`text_normalisiert` ist der Vergleichstext: Über die Bigramm-Ähnlichkeit gegen
`text.strophenEinzeln` lässt sich pro Lied bestimmen, ob der Text tatsächlich
überarbeitet wurde – unabhängig davon, was am Lied angehakt ist.

## Grenzen der Quelle

- Die Melodie selbst ist nicht enthalten, nur Melodiename und Komponist. Eine
  überarbeitete Melodie (Taktung, Tonart, Satz) unter unverändertem Namen ist
  daraus **nicht** erkennbar. Der Referenzdatensatz beantwortet ausschließlich:
  stand diese Melodie schon im Gesangbuch 2000?
- `melodie_verweis` fehlt bei 232 Liedern; dort ist die Melodie beim Lied
  abgedruckt, der Melodiename ist also der Liedtitel.
- Die englischen Fassungen (`gesangbuchlied.deutscheLiedfassung` gesetzt, 12
  angenommene Lieder) haben im GB2000 keine Entsprechung; ihr Text weicht
  naturgemäß ab und darf nicht als „Textänderung" gezählt werden.
