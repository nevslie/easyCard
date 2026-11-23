# .deck-Format (Anleitung für KI und Menschen)

Eine `.deck`-Datei ist **reines JSON**. Jede Datei ist ein Stapel, jedes Objekt in `cards` ist eine Karte.

## Minimal (so soll die KI neue Stapel/Karten schreiben)

```json
{
  "name": "Englisch Unit 3",
  "frontLabel": "Englisch",
  "backLabel": "Deutsch",
  "directions": "both",
  "cards": [
    { "front": "to persuade", "back": "überzeugen", "example": "She persuaded him to come.", "tags": ["unit3"] },
    { "front": "reliable", "back": "zuverlässig" }
  ]
}
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `front` | ja | Vorderseite (z. B. Englisch) |
| `back` | ja | Rückseite (z. B. Deutsch) |
| `example` | nein | Beispielsatz, wird nach dem Aufdecken gezeigt |
| `notes` | nein | Freie Notiz |
| `tags` | nein | Array von Strings |
| `id`, `created`, `progress` | **nein – nicht selbst schreiben** | ergänzt das Plugin beim Öffnen |

### Markdown & HTML

`front`, `back`, `example` und `notes` werden in der Lernansicht als **Obsidian-Markdown** gerendert. Damit geht alles, was auch in einer Notiz geht:

- Formatierung: `**fett**`, `*kursiv*`, `==markiert==`, Listen, Tabellen, Code
- HTML: `<span style="color: red">irregular</span>`, `<sub>`, `<br>` …
- Bilder und Links aus dem Vault: `![[bild.png]]`, `[[Notiz]]`

Im JSON gelten die normalen Regeln: Zeilenumbrüche als `\n`, Anführungszeichen als `\"`. Beispiel:

```json
{ "front": "to **go** – went – gone", "back": "gehen", "notes": "<span style=\"color: var(--color-red)\">unregelmäßig</span>\n\n- Präsens: go\n- Präteritum: went" }
```

In der Kartenliste der Übersicht wird der Text ungerendert angezeigt.

`directions`: `"forward"` (front → back), `"reverse"` (back → front) oder `"both"` = Standard-Abfragerichtung.

## Regeln für die KI beim Ergänzen

- Neue Karten **unten an `cards` anhängen**, bestehende Karten nicht verändern.
- Bei bestehenden Karten `id` und `progress` **nie löschen oder ändern** (sonst geht der Lernstand verloren).
- Duplikate vermeiden (gleiches `front`).
- Gültiges JSON: keine Kommentare, kein Komma nach dem letzten Element.

## Lernstand (`progress`) – vom Plugin verwaltet

Jede Karte hat pro Richtung einen eigenen Lernstand:

```json
"progress": {
  "forward": {
    "state": "review",
    "due": "2026-11-27T00:00:00.000Z",
    "lastReview": "2026-11-22T16:40:12.000Z",
    "interval": 5,
    "ease": 2.5,
    "reps": 2,
    "lapses": 0,
    "lastRating": 3
  },
  "reverse": { "state": "new", "due": null, "lastReview": null, "interval": 0, "ease": 2.5, "reps": 0, "lapses": 0, "lastRating": null }
}
```

| Feld | Bedeutung |
|---|---|
| `state` | `new` (nie gelernt), `learning` (gerade vergessen / „Nochmal“), `review` (gelernt) |
| `due` | Ab wann die Karte wieder dran ist |
| `lastReview` | Wann das zuletzt entschieden wurde |
| `interval` | Aktueller Abstand in Tagen |
| `ease` | Wachstumsfaktor des Intervalls (Start 2,5; min. 1,3) |
| `reps` / `lapses` | Anzahl Bewertungen / wie oft vergessen |
| `lastRating` | 1 Nochmal · 2 Schwer · 3 Gut · 4 Einfach |

### Wie das Intervall berechnet wird (vereinfachtes Anki/SM-2)

- **Neue Karte:** Nochmal → gleich nochmal · Schwer → 1 Tag · Gut → 2 Tage · Einfach → 4 Tage
- **Gelernte Karte** (bisheriges Intervall `I`):
  - Nochmal → wieder `learning`, `ease − 0,2`, `lapses + 1`
  - Schwer → `I × 1,2`, `ease − 0,15`
  - Gut → `I × ease`
  - Einfach → `I × ease × 1,3`, `ease + 0,15`

In **Version 1** wird das nur gespeichert; eine Lernrunde fragt immer alle Karten ab.
