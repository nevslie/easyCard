import { MarkdownRenderer, Menu, Notice, TextFileView, WorkspaceLeaf, setIcon } from "obsidian";
import {
	Card,
	Deck,
	Direction,
	DirectionSetting,
	Rating,
	createCard,
	parseDeck,
	serializeDeck,
} from "./deck";
import { formatInterval, isDue, nextInterval, schedule } from "./scheduler";
import { CardInput, CardModal, JsonModal } from "./modals";

export const VIEW_TYPE_DECK = "easycard-deck-view";

interface QueueItem {
	cardId: string;
	dir: Direction;
}

interface Session {
	queue: QueueItem[];
	total: number;
	done: number;
	again: number;
	revealed: boolean;
}

const RATINGS: { rating: Rating; label: string; cls: string }[] = [
	{ rating: 1, label: "Nochmal", cls: "again" },
	{ rating: 2, label: "Schwer", cls: "hard" },
	{ rating: 3, label: "Gut", cls: "good" },
	{ rating: 4, label: "Einfach", cls: "easy" },
];

function shuffle<T>(arr: T[]): T[] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export class DeckView extends TextFileView {
	private deck: Deck | null = null;
	private parseError: string | null = null;
	private session: Session | null = null;
	private studyDirection: DirectionSetting = "both";
	private filter = "";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return VIEW_TYPE_DECK;
	}

	getDisplayText() {
		return this.deck?.name || this.file?.basename || "Vokabelstapel";
	}

	getIcon() {
		return "layers";
	}

	async onOpen() {
		this.contentEl.addClass("vocab-view");
		this.contentEl.tabIndex = 0;
		this.registerDomEvent(this.contentEl, "keydown", (e) => this.onKey(e));
		this.addAction("braces", "JSON bearbeiten", () => this.openJson());
	}

	// ---- TextFileView ----

	getViewData(): string {
		// Bei kaputtem JSON nichts überschreiben.
		if (!this.deck || this.parseError) return this.data;
		return serializeDeck(this.deck);
	}

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		if (clear) this.session = null;
		try {
			const res = parseDeck(data, this.file?.basename ?? "Stapel");
			this.deck = res.deck;
			this.parseError = null;
			if (clear) this.studyDirection = res.deck.directions;
			if (res.changed) this.requestSave();
		} catch (e) {
			this.deck = null;
			this.parseError = e instanceof Error ? e.message : String(e);
		}
		this.render();
	}

	clear(): void {
		this.deck = null;
		this.session = null;
		this.parseError = null;
	}

	onPaneMenu(menu: Menu, source: string) {
		super.onPaneMenu(menu, source);
		menu.addItem((i) => i.setTitle("JSON bearbeiten").setIcon("braces").onClick(() => this.openJson()));
	}

	// ---- Helfer ----

	private persist() {
		if (this.deck) this.data = serializeDeck(this.deck);
		this.requestSave();
	}

	private cardById(id: string): Card | undefined {
		return this.deck?.cards.find((c) => c.id === id);
	}

	private openJson() {
		new JsonModal(this.app, this.getViewData(), (json) => {
			try {
				JSON.parse(json);
			} catch (e) {
				new Notice("Ungültiges JSON: " + (e instanceof Error ? e.message : e));
				return false;
			}
			this.setViewData(json, true);
			this.requestSave();
			return true;
		}).open();
	}

	private openCardModal(existing?: Card) {
		if (!this.deck) return;
		new CardModal(
			this.app,
			this.deck,
			(input: CardInput) => {
				if (!this.deck) return;
				if (existing) Object.assign(existing, cleanInput(input));
				else this.deck.cards.push(createCard(cleanInput(input)));
				this.persist();
				this.render();
			},
			existing,
		).open();
	}

	// ---- Rendering ----

	private render(): void {
		const el = this.contentEl;
		el.empty();
		if (this.parseError) return this.renderError(el);
		if (!this.deck) return;
		if (this.session) return this.renderStudy(el, this.session);
		this.renderOverview(el, this.deck);
	}

	private renderError(el: HTMLElement) {
		const box = el.createDiv({ cls: "vocab-error" });
		box.createEl("h3", { text: "Die Datei konnte nicht gelesen werden" });
		box.createEl("pre", { text: this.parseError ?? "" });
		box.createEl("button", { text: "JSON bearbeiten", cls: "mod-cta" }).onclick = () => this.openJson();
	}

	private renderOverview(el: HTMLElement, deck: Deck) {
		const wrap = el.createDiv({ cls: "vocab-overview" });
		const header = wrap.createDiv({ cls: "vocab-header" });
		header.createEl("h2", { text: deck.name });
		if (deck.description) header.createEl("p", { text: deck.description, cls: "vocab-muted" });

		// Statistik
		const now = new Date();
		let fresh = 0;
		let due = 0;
		let learned = 0;
		for (const c of deck.cards)
			for (const dir of this.dirs()) {
				const p = c.progress[dir];
				if (p.state === "new") fresh++;
				else if (isDue(p, now)) due++;
				else learned++;
			}
		const stats = wrap.createDiv({ cls: "vocab-stats" });
		const stat = (n: number, label: string, cls: string) => {
			const s = stats.createDiv({ cls: "vocab-stat " + cls });
			s.createDiv({ text: String(n), cls: "vocab-stat-num" });
			s.createDiv({ text: label, cls: "vocab-stat-label" });
		};
		stat(deck.cards.length, "Karten", "");
		stat(fresh, "Neu", "is-new");
		stat(due, "Fällig", "is-due");
		stat(learned, "Später", "is-later");

		// Steuerung
		const controls = wrap.createDiv({ cls: "vocab-controls" });
		const select = controls.createEl("select", { cls: "dropdown" });
		const opts: [DirectionSetting, string][] = [
			["forward", `${deck.frontLabel} → ${deck.backLabel}`],
			["reverse", `${deck.backLabel} → ${deck.frontLabel}`],
			["both", "Beide Richtungen"],
		];
		for (const [value, label] of opts) {
			const o = select.createEl("option", { text: label, value });
			if (value === this.studyDirection) o.selected = true;
		}
		select.onchange = () => {
			this.studyDirection = select.value as DirectionSetting;
			this.render();
		};

		const start = controls.createEl("button", { text: "Lernen starten", cls: "mod-cta" });
		start.disabled = deck.cards.length === 0;
		start.onclick = () => this.startSession();

		const add = controls.createEl("button", { text: "Karte hinzufügen" });
		add.onclick = () => this.openCardModal();

		// Kartenliste
		const listHeader = wrap.createDiv({ cls: "vocab-list-header" });
		listHeader.createEl("h4", { text: "Karten" });
		const search = listHeader.createEl("input", {
			type: "search",
			placeholder: "Suchen…",
			cls: "vocab-search",
		});
		search.value = this.filter;

		const list = wrap.createDiv({ cls: "vocab-list" });
		const renderList = () => {
			list.empty();
			const q = this.filter.toLowerCase();
			const cards = deck.cards.filter(
				(c) =>
					!q ||
					c.front.toLowerCase().includes(q) ||
					c.back.toLowerCase().includes(q) ||
					(c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
			);
			if (cards.length === 0) {
				list.createDiv({
					text: deck.cards.length ? "Keine Treffer." : "Noch keine Karten. Füge welche hinzu oder lass die KI die Datei befüllen.",
					cls: "vocab-muted vocab-empty",
				});
				return;
			}
			for (const c of cards) this.renderListRow(list, c);
		};
		search.oninput = () => {
			this.filter = search.value;
			renderList();
		};
		renderList();
	}

	private renderListRow(list: HTMLElement, c: Card) {
		const row = list.createDiv({ cls: "vocab-row" });
		const main = row.createDiv({ cls: "vocab-row-main" });
		main.createSpan({ text: c.front, cls: "vocab-row-front" });
		main.createSpan({ text: c.back, cls: "vocab-row-back" });
		if (c.tags?.length) {
			const tags = main.createDiv({ cls: "vocab-tags" });
			for (const t of c.tags) tags.createSpan({ text: t, cls: "vocab-tag" });
		}
		const info = row.createDiv({ cls: "vocab-row-info vocab-muted" });
		for (const dir of this.dirs()) {
			const p = c.progress[dir];
			const arrow = dir === "forward" ? "→" : "←";
			const text =
				p.state === "new" ? "neu" : p.due ? new Date(p.due).toLocaleDateString() : "–";
			info.createDiv({ text: `${arrow} ${text}`, attr: { title: dueTooltip(p) } });
		}
		const actions = row.createDiv({ cls: "vocab-row-actions" });
		const edit = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Bearbeiten" } });
		setIcon(edit, "pencil");
		edit.onclick = () => this.openCardModal(c);
		const del = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Löschen" } });
		setIcon(del, "trash-2");
		del.onclick = () => {
			if (!this.deck) return;
			if (!confirm(`Karte „${c.front}“ löschen?`)) return;
			this.deck.cards = this.deck.cards.filter((x) => x.id !== c.id);
			this.persist();
			this.render();
		};
	}

	private dirs(): Direction[] {
		return this.studyDirection === "both" ? ["forward", "reverse"] : [this.studyDirection];
	}

	// ---- Lernrunde ----

	private startSession() {
		if (!this.deck) return;
		// Version 1: alle Karten, ohne Timer-Filter. Später einfach nach isDue() filtern.
		const queue: QueueItem[] = [];
		for (const c of this.deck.cards) for (const dir of this.dirs()) queue.push({ cardId: c.id, dir });
		shuffle(queue);
		this.session = { queue, total: queue.length, done: 0, again: 0, revealed: false };
		this.render();
		this.contentEl.focus();
	}

	private endSession() {
		this.session = null;
		this.render();
	}

	private renderStudy(el: HTMLElement, s: Session): void {
		const deck = this.deck!;
		const wrap = el.createDiv({ cls: "vocab-study" });

		const top = wrap.createDiv({ cls: "vocab-study-top" });
		const back = top.createEl("button", { text: "← Beenden" });
		back.onclick = () => this.endSession();
		top.createDiv({ text: `${s.done} / ${s.total}`, cls: "vocab-muted" });
		const bar = wrap.createDiv({ cls: "vocab-progress" });
		bar.createDiv({ cls: "vocab-progress-fill" }).style.width = `${(s.done / Math.max(1, s.total)) * 100}%`;

		const item = s.queue[0];
		const card = item && this.cardById(item.cardId);
		if (!item || !card) {
			if (item) {
				// Karte wurde inzwischen gelöscht
				s.queue.shift();
				return this.render();
			}
			const done = wrap.createDiv({ cls: "vocab-done" });
			done.createEl("h2", { text: "Geschafft! 🎉" });
			done.createEl("p", {
				text: `${s.total} Karten gelernt, ${s.again}× „Nochmal“.`,
				cls: "vocab-muted",
			});
			done.createEl("button", { text: "Zurück zur Übersicht", cls: "mod-cta" }).onclick = () =>
				this.endSession();
			return;
		}

		const forward = item.dir === "forward";
		const question = forward ? card.front : card.back;
		const answer = forward ? card.back : card.front;

		const box = wrap.createDiv({ cls: "vocab-card" });
		box.createDiv({
			text: forward ? `${deck.frontLabel} → ${deck.backLabel}` : `${deck.backLabel} → ${deck.frontLabel}`,
			cls: "vocab-card-dir vocab-muted",
		});
		this.renderMarkdown(box, question, "vocab-card-question");

		const footer = wrap.createDiv({ cls: "vocab-study-footer" });
		const editBtn = top.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Karte bearbeiten" } });
		setIcon(editBtn, "pencil");
		editBtn.onclick = () => this.openCardModal(card);

		if (!s.revealed) {
			const reveal = footer.createEl("button", { text: "Aufdecken (Leertaste)", cls: "mod-cta vocab-reveal" });
			reveal.onclick = () => this.reveal();
			return;
		}

		box.createEl("hr");
		this.renderMarkdown(box, answer, "vocab-card-answer");
		if (card.example) this.renderMarkdown(box, card.example, "vocab-card-example");
		if (card.notes) this.renderMarkdown(box, card.notes, "vocab-card-notes vocab-muted");

		const p = card.progress[item.dir];
		const btns = footer.createDiv({ cls: "vocab-ratings" });
		for (const r of RATINGS) {
			const b = btns.createEl("button", { cls: `vocab-rate vocab-rate-${r.cls}` });
			b.createDiv({ text: formatInterval(nextInterval(p, r.rating)), cls: "vocab-rate-interval" });
			b.createDiv({ text: `${r.label} (${r.rating})` });
			b.onclick = () => this.rate(r.rating);
		}
	}

	/** Feldinhalt als Markdown rendern (inkl. HTML, Links und Bilder aus dem Vault). */
	private renderMarkdown(parent: HTMLElement, text: string, cls: string) {
		const el = parent.createDiv({ cls: cls + " vocab-md" });
		MarkdownRenderer.render(this.app, text, el, this.file?.path ?? "", this);
	}

	private reveal() {
		if (!this.session || this.session.revealed) return;
		this.session.revealed = true;
		this.render();
	}

	private rate(rating: Rating) {
		const s = this.session;
		if (!s || !s.revealed) return;
		const item = s.queue.shift();
		if (!item) return;
		const card = this.cardById(item.cardId);
		if (card) card.progress[item.dir] = schedule(card.progress[item.dir], rating);

		if (rating === 1) {
			// "Nochmal": in dieser Runde später erneut zeigen
			s.again++;
			const pos = Math.min(s.queue.length, 3 + Math.floor(Math.random() * 3));
			s.queue.splice(pos, 0, item);
		} else s.done++;

		s.revealed = false;
		this.persist();
		this.render();
		this.contentEl.focus();
	}

	private onKey(e: KeyboardEvent) {
		if (!this.session) return;
		const target = e.target as HTMLElement;
		if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
		if (!this.session.revealed && (e.key === " " || e.key === "Enter")) {
			e.preventDefault();
			this.reveal();
		} else if (this.session.revealed && ["1", "2", "3", "4"].includes(e.key)) {
			e.preventDefault();
			this.rate(Number(e.key) as Rating);
		} else if (this.session.revealed && (e.key === " " || e.key === "Enter")) {
			e.preventDefault();
			this.rate(3);
		}
	}
}

function cleanInput(i: CardInput): CardInput {
	const out: CardInput = { front: i.front.trim(), back: i.back.trim() };
	out.example = i.example?.trim() || undefined;
	out.notes = i.notes?.trim() || undefined;
	out.tags = i.tags?.length ? i.tags : undefined;
	return out;
}

function dueTooltip(p: Card["progress"][Direction]): string {
	if (p.state === "new") return "Noch nie gelernt";
	return [
		`Fällig: ${p.due ? new Date(p.due).toLocaleString() : "–"}`,
		`Zuletzt: ${p.lastReview ? new Date(p.lastReview).toLocaleString() : "–"}`,
		`Intervall: ${p.interval} T · Ease: ${p.ease} · Wdh.: ${p.reps} · Vergessen: ${p.lapses}`,
	].join("\n");
}
