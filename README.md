# easyCard

Obsidian-Plugin zum Vokabellernen, angelehnt an Anki. Jeder Stapel ist eine `.deck`-Datei (reines JSON) im Vault. Beim Anklicken öffnet sich statt des JSON eine Lernoberfläche.

## Funktionen (v0.1)

- `.deck`-Dateien erscheinen im Datei-Explorer und öffnen sich als Stapel-Ansicht
- Übersicht mit Statistik (neu / fällig / später), Kartenliste mit Suche, Bearbeiten und Löschen
- Karten über ein Formular hinzufügen („Speichern & nächste“ für schnelles Eintippen)
- Lernen in Richtung EN→DE, DE→EN oder beides, jede Richtung mit eigenem Lernstand
- Bewertung wie bei Anki: **Nochmal / Schwer / Gut / Einfach**, jeweils mit Anzeige, wann die Karte wiederkommt
- Karten markieren (Stern, nur innerhalb des Stapels) und gezielt „Markierte lernen“
- Tastatur: `Leertaste`/`Enter` = aufdecken, `1`–`4` = bewerten, `M` = markieren
- Kartenfelder unterstützen Markdown und HTML (inkl. Bilder aus dem Vault), siehe Formatbeschreibung
- Beim Bearbeiten einer Karte siehst du pro Richtung, in wie vielen Tagen sie wiederkommt, und kannst das mit −/+ ändern oder den Lernstand zurücksetzen
- Tastatur: `Leertaste`/`Enter` = aufdecken, `1`–`4` = bewerten
- „JSON bearbeiten“ (Symbol oben rechts) für direktes Bearbeiten der Rohdaten
- Neuer Stapel: Ribbon-Symbol, Befehl „Neuen Vokabelstapel erstellen“ oder Rechtsklick auf einen Ordner

**Noch ohne Timer:** Eine Lernrunde fragt immer alle Karten ab. Fälligkeit (`due`) und `lastReview` werden aber schon gespeichert, siehe [docs/DECK_FORMAT.md](docs/DECK_FORMAT.md).

## Karten per KI erstellen

Gib der KI deine Vokabelliste und verweise auf `docs/DECK_FORMAT.md`. Sie muss nur `front`, `back` und optional `example`, `notes` und `tags` schreiben. IDs und Lernstand ergänzt das Plugin beim Öffnen. Ein Beispiel liegt in [`examples/`](examples/).

## Installation

```bash
npm install
npm run build
```

Danach `main.js`, `manifest.json` und `styles.css` nach `<Vault>/.obsidian/plugins/easycard/` kopieren und das Plugin unter *Einstellungen → Community-Plugins* aktivieren.

Für die Entwicklung: `npm run dev` baut bei jeder Änderung neu.
