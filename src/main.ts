import { Notice, Plugin, TFolder, normalizePath } from "obsidian";
import { DeckView, VIEW_TYPE_DECK } from "./view";
import { createDeck, serializeDeck } from "./deck";
import { PromptModal } from "./modals";

export default class VocabDecksPlugin extends Plugin {
	async onload() {
		this.registerView(VIEW_TYPE_DECK, (leaf) => new DeckView(leaf));
		this.registerExtensions(["deck"], VIEW_TYPE_DECK);

		this.addRibbonIcon("layers", "Neuen Vokabelstapel erstellen", () => this.promptNewDeck());

		this.addCommand({
			id: "create-deck",
			name: "Neuen Vokabelstapel erstellen",
			callback: () => this.promptNewDeck(),
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFolder)) return;
				menu.addItem((item) =>
					item
						.setTitle("Neuer Vokabelstapel")
						.setIcon("layers")
						.onClick(() => this.promptNewDeck(file)),
				);
			}),
		);
	}

	private promptNewDeck(folder?: TFolder) {
		new PromptModal(this.app, "Neuer Vokabelstapel", "Name, z. B. Englisch Unit 3", (name) =>
			this.createDeckFile(name, folder),
		).open();
	}

	private async createDeckFile(name: string, folder?: TFolder) {
		const target =
			folder ?? this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? "");
		const safe = name.replace(/[\\/:*?"<>|]/g, "-");
		let path = normalizePath(`${target.path}/${safe}.deck`);
		let n = 1;
		while (this.app.vault.getAbstractFileByPath(path))
			path = normalizePath(`${target.path}/${safe} ${n++}.deck`);
		try {
			const file = await this.app.vault.create(path, serializeDeck(createDeck(name)));
			await this.app.workspace.getLeaf(true).openFile(file);
		} catch (e) {
			new Notice("Stapel konnte nicht erstellt werden: " + (e instanceof Error ? e.message : e));
		}
	}
}
