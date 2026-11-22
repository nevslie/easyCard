import { App, Modal, Notice, Setting } from "obsidian";
import { Card, Deck } from "./deck";

export interface CardInput {
	front: string;
	back: string;
	example?: string;
	notes?: string;
	tags?: string[];
}

/** Formular zum Anlegen oder Bearbeiten einer Karte. */
export class CardModal extends Modal {
	private values: CardInput;

	constructor(
		app: App,
		private deck: Deck,
		private onSubmit: (input: CardInput, keepOpen: boolean) => void,
		private existing?: Card,
	) {
		super(app);
		this.values = existing
			? {
					front: existing.front,
					back: existing.back,
					example: existing.example,
					notes: existing.notes,
					tags: existing.tags,
				}
			: { front: "", back: "" };
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("vocab-card-modal");
		this.titleEl.setText(this.existing ? "Karte bearbeiten" : "Karte hinzufügen");

		const inputs: HTMLInputElement[] = [];
		const text = (name: string, key: "front" | "back" | "example", placeholder = "") =>
			new Setting(contentEl).setName(name).addText((t) => {
				t.setPlaceholder(placeholder).setValue(this.values[key] ?? "");
				t.onChange((v) => (this.values[key] = v));
				t.inputEl.addClass("vocab-wide-input");
				inputs.push(t.inputEl);
			});

		text(this.deck.frontLabel, "front", "z. B. to persuade");
		text(this.deck.backLabel, "back", "z. B. überzeugen");
		text("Beispielsatz", "example", "optional");
		new Setting(contentEl).setName("Notiz").addTextArea((t) => {
			t.setPlaceholder("optional").setValue(this.values.notes ?? "");
			t.onChange((v) => (this.values.notes = v));
			t.inputEl.addClass("vocab-wide-input");
		});
		new Setting(contentEl).setName("Tags").setDesc("Mit Komma getrennt").addText((t) => {
			t.setPlaceholder("unit3, verben").setValue((this.values.tags ?? []).join(", "));
			t.onChange(
				(v) => (this.values.tags = v.split(",").map((s) => s.trim()).filter(Boolean)),
			);
			inputs.push(t.inputEl);
		});

		const submit = (keepOpen: boolean) => {
			if (!this.values.front.trim() || !this.values.back.trim()) {
				new Notice("Vorder- und Rückseite dürfen nicht leer sein.");
				return;
			}
			this.onSubmit({ ...this.values }, keepOpen);
			if (keepOpen) {
				this.values = { front: "", back: "", tags: this.values.tags };
				this.onOpen();
			} else this.close();
		};

		const buttons = new Setting(contentEl);
		if (!this.existing)
			buttons.addButton((b) => b.setButtonText("Speichern & nächste").onClick(() => submit(true)));
		buttons.addButton((b) => b.setButtonText("Speichern").setCta().onClick(() => submit(false)));

		for (const el of inputs)
			el.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					submit(!this.existing);
				}
			});
		inputs[0]?.focus();
	}

	onClose() {
		this.contentEl.empty();
	}
}

/** Rohes JSON der Datei bearbeiten. */
export class JsonModal extends Modal {
	constructor(
		app: App,
		private json: string,
		private onSubmit: (json: string) => boolean,
	) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText("JSON bearbeiten");
		const area = this.contentEl.createEl("textarea", { cls: "vocab-json-area" });
		area.value = this.json;
		new Setting(this.contentEl).addButton((b) =>
			b
				.setButtonText("Übernehmen")
				.setCta()
				.onClick(() => {
					if (this.onSubmit(area.value)) this.close();
				}),
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}

/** Einfacher Dialog mit einem Textfeld. */
export class PromptModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private placeholder: string,
		private onSubmit: (value: string) => void,
	) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText(this.title);
		let value = "";
		const submit = () => {
			if (!value.trim()) return;
			this.close();
			this.onSubmit(value.trim());
		};
		new Setting(this.contentEl).addText((t) => {
			t.setPlaceholder(this.placeholder).onChange((v) => (value = v));
			t.inputEl.addClass("vocab-wide-input");
			t.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") submit();
			});
			setTimeout(() => t.inputEl.focus(), 0);
		});
		new Setting(this.contentEl).addButton((b) => b.setButtonText("Erstellen").setCta().onClick(submit));
	}

	onClose() {
		this.contentEl.empty();
	}
}
