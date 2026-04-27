import { App, Plugin, TAbstractFile, TFile } from "obsidian";

interface WorkspaceLike {
	on(name: string, callback: (...args: unknown[]) => unknown, ctx?: unknown): { fn: (...args: unknown[]) => unknown };
}

export class EventBridge {
	private readonly plugin: Plugin;
	private readonly app: App;
	private readonly onRefresh: (reason: string) => void;
	private readonly debugLog: (message: string, ...details: unknown[]) => void;

	constructor(plugin: Plugin, app: App, onRefresh: (reason: string) => void, debugLog: (message: string, ...details: unknown[]) => void) {
		this.plugin = plugin;
		this.app = app;
		this.onRefresh = onRefresh;
		this.debugLog = debugLog;
	}

	register(): void {
		this.plugin.registerEvent(this.app.workspace.on("file-open", (file) => {
			if (file?.extension === "canvas") {
				this.onRefresh("workspace:file-open");
			}
		}));

		this.plugin.registerEvent(this.app.workspace.on("layout-change", () => {
			this.onRefresh("workspace:layout-change");
		}));

		this.plugin.registerEvent(this.app.vault.on("modify", (file) => {
			if (this.isCanvasFile(file)) {
				this.onRefresh("vault:modify");
			}
		}));

		this.plugin.registerEvent(this.app.vault.on("rename", (file) => {
			if (this.isCanvasFile(file)) {
				this.onRefresh("vault:rename");
			}
		}));

		this.plugin.registerEvent(this.app.vault.on("delete", (file) => {
			if (this.isCanvasFile(file)) {
				this.onRefresh("vault:delete");
			}
		}));

		this.registerAdvancedCanvasEvents();
	}

	private registerAdvancedCanvasEvents(): void {
		const pluginsApi = this.app as unknown as { plugins?: { enabledPlugins?: Set<string> } };
		const isAdvancedCanvasEnabled = pluginsApi.plugins?.enabledPlugins?.has("advanced-canvas") ?? false;
		if (!isAdvancedCanvasEnabled) {
			this.debugLog("Advanced Canvas plugin not enabled; custom events disabled.");
			return;
		}

		const workspace = this.app.workspace as unknown as WorkspaceLike;
		const customEvents = [
			"advanced-canvas:canvas-changed",
			"advanced-canvas:data-loaded:after",
			"advanced-canvas:node-added",
			"advanced-canvas:node-changed",
			"advanced-canvas:canvas-saved:after",
		] as const;

		for (const eventName of customEvents) {
			const ref = workspace.on(eventName, () => {
				this.onRefresh(`advanced:${eventName}`);
			});
			this.plugin.registerEvent(ref);
		}
	}

	private isCanvasFile(file: TAbstractFile): file is TFile {
		return file instanceof TFile && file.extension === "canvas";
	}
}
