# easyCard – Obsidian-Plugin

Vokabel-Stapel als `.deck`-Dateien (JSON), Lernoberfläche angelehnt an Anki.

- Format & Regeln für Karten: `docs/DECK_FORMAT.md` (bei Vokabel-Aufträgen immer daran halten)
- Code: `src/deck.ts` (Datenmodell/Parsing), `src/scheduler.ts` (Intervalle), `src/view.ts` (UI), `src/main.ts` (Registrierung)
- Build: `npm install && npm run build` → `main.js`, `manifest.json`, `styles.css`
