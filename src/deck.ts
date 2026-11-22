// Datenmodell und Parsing für .deck-Dateien (reines JSON).
// Ziel: Die KI (oder du) muss nur die Inhaltsfelder schreiben. Fehlende
// Felder wie id, created und progress ergänzt das Plugin beim Öffnen selbst.

export type Direction = "forward" | "reverse";
export type DirectionSetting = Direction | "both";
export type CardState = "new" | "learning" | "review";
export type Rating = 1 | 2 | 3 | 4; // 1 Nochmal, 2 Schwer, 3 Gut, 4 Einfach

/** Lernstand einer Karte in EINER Richtung. Grundlage für den späteren Timer. */
export interface Progress {
	state: CardState;
	/** Zeitpunkt (ISO), ab dem die Karte wieder fällig ist. null = noch nie gelernt. */
	due: string | null;
	/** Zeitpunkt (ISO), an dem zuletzt bewertet und damit `due` festgelegt wurde. */
	lastReview: string | null;
	/** Aktueller Abstand in Tagen. */
	interval: number;
	/** Faktor, mit dem das Intervall bei "Gut" wächst (wie bei Anki, Start 2.5). */
	ease: number;
	/** Wie oft die Karte insgesamt bewertet wurde. */
	reps: number;
	/** Wie oft die Karte nach dem Lernen wieder vergessen wurde ("Nochmal"). */
	lapses: number;
	lastRating: Rating | null;
}

export interface Card {
	id: string;
	front: string;
	back: string;
	example?: string;
	notes?: string;
	tags?: string[];
	created: string;
	progress: Record<Direction, Progress>;
}

export interface Deck {
	version: number;
	name: string;
	description?: string;
	frontLabel: string;
	backLabel: string;
	/** Welche Richtung standardmäßig abgefragt wird. */
	directions: DirectionSetting;
	cards: Card[];
}

export const DIRECTIONS: Direction[] = ["forward", "reverse"];

export function newProgress(): Progress {
	return {
		state: "new",
		due: null,
		lastReview: null,
		interval: 0,
		ease: 2.5,
		reps: 0,
		lapses: 0,
		lastRating: null,
	};
}

export function generateId(): string {
	return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function createDeck(name: string): Deck {
	return {
		version: 1,
		name,
		description: "",
		frontLabel: "Englisch",
		backLabel: "Deutsch",
		directions: "both",
		cards: [],
	};
}

export function createCard(data: Partial<Card> & { front: string; back: string }): Card {
	return normalizeCard(data, new Set()).card;
}

function str(v: unknown): string {
	return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normalizeProgress(raw: unknown): { progress: Progress; changed: boolean } {
	const base = newProgress();
	if (!raw || typeof raw !== "object") return { progress: base, changed: true };
	const r = raw as Record<string, unknown>;
	let changed = false;
	const pick = <K extends keyof Progress>(key: K, valid: (v: unknown) => boolean) => {
		if (valid(r[key])) (base as any)[key] = r[key];
		else changed = true;
	};
	pick("state", (v) => v === "new" || v === "learning" || v === "review");
	pick("due", (v) => v === null || typeof v === "string");
	pick("lastReview", (v) => v === null || typeof v === "string");
	pick("interval", (v) => typeof v === "number" && v >= 0);
	pick("ease", (v) => typeof v === "number" && v >= 1.3);
	pick("reps", (v) => typeof v === "number");
	pick("lapses", (v) => typeof v === "number");
	pick("lastRating", (v) => v === null || v === 1 || v === 2 || v === 3 || v === 4);
	return { progress: base, changed };
}

function normalizeCard(raw: any, usedIds: Set<string>): { card: Card; changed: boolean } {
	let changed = false;
	let id = str(raw.id);
	if (!id || usedIds.has(id)) {
		id = generateId();
		changed = true;
	}
	usedIds.add(id);

	const created = str(raw.created) || new Date().toISOString().slice(0, 10);
	if (!raw.created) changed = true;

	let tags: string[] | undefined;
	if (Array.isArray(raw.tags)) tags = raw.tags.map(str).filter(Boolean);
	else if (typeof raw.tags === "string") {
		tags = raw.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
		changed = true;
	}

	const progress = {} as Record<Direction, Progress>;
	for (const dir of DIRECTIONS) {
		const res = normalizeProgress(raw.progress?.[dir]);
		progress[dir] = res.progress;
		if (res.changed) changed = true;
	}

	const card: Card = { id, front: str(raw.front), back: str(raw.back), created, progress };
	if (raw.example) card.example = str(raw.example);
	if (raw.notes) card.notes = str(raw.notes);
	if (tags && tags.length) card.tags = tags;
	return { card, changed };
}

export interface ParseResult {
	deck: Deck;
	/** true, wenn das Plugin Felder ergänzt hat und die Datei gespeichert werden sollte. */
	changed: boolean;
}

/** Liest den Dateiinhalt. Akzeptiert auch ein reines Array von Karten. Wirft bei ungültigem JSON. */
export function parseDeck(text: string, fallbackName: string): ParseResult {
	if (!text.trim()) return { deck: createDeck(fallbackName), changed: true };

	const raw = JSON.parse(text);
	let changed = false;
	let obj: any = raw;
	if (Array.isArray(raw)) {
		obj = { cards: raw };
		changed = true;
	}
	if (!obj || typeof obj !== "object") throw new Error("Die Datei enthält kein JSON-Objekt.");

	const deck = createDeck(str(obj.name) || fallbackName);
	if (!obj.name) changed = true;
	if (typeof obj.description === "string") deck.description = obj.description;
	if (typeof obj.frontLabel === "string") deck.frontLabel = obj.frontLabel;
	else changed = true;
	if (typeof obj.backLabel === "string") deck.backLabel = obj.backLabel;
	else changed = true;
	if (obj.directions === "forward" || obj.directions === "reverse" || obj.directions === "both")
		deck.directions = obj.directions;
	else changed = true;
	if (obj.version !== 1) changed = true;

	const used = new Set<string>();
	const cards: unknown[] = Array.isArray(obj.cards) ? obj.cards : [];
	if (!Array.isArray(obj.cards)) changed = true;
	for (const c of cards) {
		if (!c || typeof c !== "object") {
			changed = true;
			continue;
		}
		const res = normalizeCard(c, used);
		deck.cards.push(res.card);
		if (res.changed) changed = true;
	}
	return { deck, changed };
}

export function serializeDeck(deck: Deck): string {
	return JSON.stringify(deck, null, 2) + "\n";
}
