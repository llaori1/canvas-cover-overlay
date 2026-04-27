import { Notice, Plugin, TFile } from "obsidian";
import { CanvasCoverOverlaySettingTab, CanvasCoverSettings, DEFAULT_SETTINGS } from "./settings";
import { CoverResolver } from "./canvas-cover/coverResolver";
import { OverlayManager } from "./canvas-cover/overlayManager";
import { BackgroundManager } from "./canvas-cover/backgroundManager";

interface EmbedContextLike {
	containerEl: HTMLElement;
}

interface EmbedComponentLike {
	loadFile?: () => void;
}

type EmbedCreatorLike = (context: EmbedContextLike, file: TFile, subpath?: string) => EmbedComponentLike;

interface EmbedRegistryLike {
	embedByExtension?: Record<string, EmbedCreatorLike | undefined>;
	registerExtension(extension: string, creator: EmbedCreatorLike): void;
	unregisterExtension(extension: string): void;
}

interface AppWithEmbedRegistry {
	embedRegistry?: EmbedRegistryLike;
}

export default class CanvasCoverOverlayPlugin extends Plugin {
	settings: CanvasCoverSettings;
	private coverResolver!: CoverResolver;
	private overlayManager!: OverlayManager;
	private backgroundManager!: BackgroundManager;
	private originalCanvasCreator: EmbedCreatorLike | null = null;
	private embedHookInstalled = false;
	private didWarnEmbedRegistryUnavailable = false;
	private hookRetryTimer: number | null = null;
	private backgroundRefreshTimer: number | null = null;
	private backgroundRefreshAllQueued = false;
	private backgroundRefreshPaths = new Set<string>();
	private backgroundRefreshReason: string | null = null;
	private settingsSaveTimer: number | null = null;
	private lastCanvasFileOpenAt = 0;
	private readonly layoutRefreshCooldownMs = 250;

	async onload() {
		await this.loadSettings();
		this.coverResolver = new CoverResolver(this.app, () => this.settings, this.debugLog.bind(this));
		this.overlayManager = new OverlayManager(this.debugLog.bind(this));
		this.backgroundManager = new BackgroundManager(this.app, this.debugLog.bind(this));

		this.installEmbedHook();
		this.registerBackgroundRefreshEvents();
		this.scheduleCanvasBackgroundRefresh("startup", true);
		this.registerCommandRefresh();
		this.addSettingTab(new CanvasCoverOverlaySettingTab(this.app, this));
	}

	onunload() {
		if (this.hookRetryTimer !== null) {
			window.clearTimeout(this.hookRetryTimer);
			this.hookRetryTimer = null;
		}
		if (this.backgroundRefreshTimer !== null) {
			window.clearTimeout(this.backgroundRefreshTimer);
			this.backgroundRefreshTimer = null;
		}
		if (this.settingsSaveTimer !== null) {
			window.clearTimeout(this.settingsSaveTimer);
			this.settingsSaveTimer = null;
			void this.saveSettings();
		}
		this.restoreEmbedHook();
		this.overlayManager?.clearAll();
		this.backgroundManager?.clearAll();
	}

	private registerCommandRefresh(): void {
		this.addCommand({
			id: "reload-embed-cover-hooks",
			name: "Reload embed cover hooks",
			callback: () => {
				this.reloadEmbedHooks(true);
			}
		});
	}

	async onSettingsChanged(reason: string): Promise<void> {
		this.debugLog("Settings changed", reason);
		const isCanvasBackgroundOnlyChange = reason === "setting:canvas-background-opacity" || reason === "setting:enable-canvas-background";
		const shouldReloadEmbedHooks = !isCanvasBackgroundOnlyChange;

		if (!this.settings.enableOverlay) {
			this.overlayManager.clearAll();
		}
		if (!this.settings.enableCanvasBackground) {
			this.backgroundManager.clearAll();
		} else {
			this.scheduleCanvasBackgroundRefresh("settings-changed", true);
		}
		if (shouldReloadEmbedHooks) {
			this.reloadEmbedHooks(false);
		}
	}

	private registerBackgroundRefreshEvents(): void {
		this.registerEvent(this.app.workspace.on("file-open", (file) => {
			if (!this.isCanvasFile(file)) {
				return;
			}

			this.lastCanvasFileOpenAt = Date.now();
			this.scheduleCanvasBackgroundRefresh("workspace:file-open", false, file);
		}));

		this.registerEvent(this.app.workspace.on("layout-change", () => {
			if (!this.hasOpenCanvasLeaf()) {
				return;
			}

			if (Date.now() - this.lastCanvasFileOpenAt < this.layoutRefreshCooldownMs) {
				return;
			}

			if (this.backgroundRefreshTimer !== null || this.backgroundRefreshPaths.size > 0 || this.backgroundRefreshAllQueued) {
				return;
			}

			this.scheduleCanvasBackgroundRefresh("workspace:layout-change", true);
		}));

		this.registerEvent(this.app.vault.on("modify", (file) => {
			if (!this.isCanvasFile(file)) {
				return;
			}

			this.coverResolver.invalidate(file.path);
			this.scheduleCanvasBackgroundRefresh("vault:modify", true);
		}));

		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			if (!this.isCanvasFile(file)) {
				return;
			}

			this.coverResolver.invalidate(file.path);
			if (typeof oldPath === "string" && oldPath.length > 0) {
				this.coverResolver.invalidate(oldPath);
			}
			this.scheduleCanvasBackgroundRefresh("vault:rename", true);
		}));

		this.registerEvent(this.app.vault.on("delete", (file) => {
			if (!this.isCanvasFile(file)) {
				return;
			}

			this.coverResolver.invalidate(file.path);
			this.scheduleCanvasBackgroundRefresh("vault:delete", true);
		}));
	}

	private async refreshCanvasBackgroundForFile(file: TFile, reason: string): Promise<void> {
		if (file.extension !== "canvas") {
			return;
		}

		this.debugLog("Refreshing canvas background for file", reason, file.path);
		await this.backgroundManager.refreshForCanvasFile(file, this.coverResolver, () => this.settings);
	}

	private async refreshAllCanvasBackgrounds(reason: string): Promise<void> {
		this.debugLog("Refreshing all canvas backgrounds", reason);
		await this.backgroundManager.refreshAllOpenCanvases(this.coverResolver, () => this.settings);
	}

	private scheduleCanvasBackgroundRefresh(reason: string, refreshAll: boolean, file?: TFile): void {
		if (refreshAll) {
			this.backgroundRefreshAllQueued = true;
			this.backgroundRefreshPaths.clear();
			this.backgroundRefreshReason = reason;
		} else if (file) {
			this.backgroundRefreshPaths.add(file.path);
			if (this.backgroundRefreshReason === null) {
				this.backgroundRefreshReason = reason;
			}
		}

		this.debugLog("Queued canvas background refresh", reason, refreshAll ? "all" : file?.path);
		if (this.backgroundRefreshTimer !== null) {
			return;
		}

		this.backgroundRefreshTimer = window.setTimeout(() => {
			this.backgroundRefreshTimer = null;
			void this.flushCanvasBackgroundRefreshQueue(reason);
		}, 0);
	}

	public queueSettingsSave(): void {
		if (this.settingsSaveTimer !== null) {
			window.clearTimeout(this.settingsSaveTimer);
		}

		this.settingsSaveTimer = window.setTimeout(() => {
			this.settingsSaveTimer = null;
			void this.saveSettings();
		}, 150);
	}

	private async flushCanvasBackgroundRefreshQueue(reason: string): Promise<void> {
		const effectiveReason = this.backgroundRefreshReason ?? reason;
		this.backgroundRefreshReason = null;

		if (this.backgroundRefreshAllQueued) {
			this.backgroundRefreshAllQueued = false;
			this.backgroundRefreshPaths.clear();
			await this.refreshAllCanvasBackgrounds(effectiveReason);
			return;
		}

		const paths = Array.from(this.backgroundRefreshPaths);
		this.backgroundRefreshPaths.clear();
		for (const path of paths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile) || file.extension !== "canvas") {
				continue;
			}

			await this.refreshCanvasBackgroundForFile(file, effectiveReason);
		}
	}

	private isCanvasFile(file: unknown): file is TFile {
		return file instanceof TFile && file.extension === "canvas";
	}

	private hasOpenCanvasLeaf(): boolean {
		return this.app.workspace.getLeavesOfType("canvas").length > 0;
	}

	private reloadEmbedHooks(withNotice: boolean): void {
		this.restoreEmbedHook();
		this.installEmbedHook();
		if (withNotice) {
			new Notice("Embed cover hooks reloaded");
		}
	}

	private installEmbedHook(): void {
		if (this.embedHookInstalled) {
			return;
		}

		const embedRegistry = this.getEmbedRegistry();
		if (!embedRegistry) {
			if (!this.didWarnEmbedRegistryUnavailable) {
				this.didWarnEmbedRegistryUnavailable = true;
				console.warn("[canvas-cover] embedRegistry is unavailable. Cover enhancement is disabled.");
			}
			this.scheduleInstallRetry();
			return;
		}

		const existingCanvasCreator = embedRegistry.embedByExtension?.canvas;
		if (!existingCanvasCreator) {
			this.debugLog("No .canvas embed creator found yet. Retrying hook installation.");
			this.scheduleInstallRetry();
			return;
		}

		this.originalCanvasCreator = existingCanvasCreator;
		const wrappedCreator: EmbedCreatorLike = (context, file, subpath) => {
			const component = existingCanvasCreator(context, file, subpath);
			let didAttach = this.hasEmbedOverlayForFile(context.containerEl, file.path);
			let attachInFlight: Promise<void> | null = null;

			const attachIfNeeded = () => {
				if (didAttach) {
					return;
				}

				if (attachInFlight) {
					return;
				}

				attachInFlight = this.overlayManager.attachCoverOverlay(
					context.containerEl,
					file,
					this.coverResolver,
					() => this.settings,
				).then(() => {
					didAttach = this.hasEmbedOverlayForFile(context.containerEl, file.path);
				}).finally(() => {
					attachInFlight = null;
				});
			};

			// Try once immediately and once after the next paint; different embed creators
			// finalize their DOM at different points in the lifecycle.
			attachIfNeeded();
			window.setTimeout(() => {
				attachIfNeeded();
			}, 0);

			const componentWithLoad = component;
			if (typeof componentWithLoad.loadFile === "function") {
				const originalLoadFile = componentWithLoad.loadFile.bind(componentWithLoad);
				componentWithLoad.loadFile = () => {
					originalLoadFile();
					attachIfNeeded();
				};
			}

			return component;
		};

		embedRegistry.unregisterExtension("canvas");
		embedRegistry.registerExtension("canvas", wrappedCreator);
		this.embedHookInstalled = true;
		if (this.hookRetryTimer !== null) {
			window.clearTimeout(this.hookRetryTimer);
			this.hookRetryTimer = null;
		}
		this.debugLog("Installed canvas embed hook");
	}

	private restoreEmbedHook(): void {
		if (!this.embedHookInstalled) {
			return;
		}

		const embedRegistry = this.getEmbedRegistry();
		if (embedRegistry && this.originalCanvasCreator) {
			embedRegistry.unregisterExtension("canvas");
			embedRegistry.registerExtension("canvas", this.originalCanvasCreator);
		}

		this.embedHookInstalled = false;
		this.originalCanvasCreator = null;
	}

	private getEmbedRegistry(): EmbedRegistryLike | null {
		const appWithEmbedRegistry = this.app as unknown as AppWithEmbedRegistry;
		return appWithEmbedRegistry.embedRegistry ?? null;
	}

	private scheduleInstallRetry(): void {
		if (this.hookRetryTimer !== null || this.embedHookInstalled) {
			return;
		}

		this.hookRetryTimer = window.setTimeout(() => {
			this.hookRetryTimer = null;
			this.installEmbedHook();
		}, 500);
	}

	private debugLog(message: string, ...details: unknown[]): void {
		if (!this.settings.debugMode) {
			return;
		}
		console.debug("[canvas-cover]", message, ...details);
	}

	private hasEmbedOverlayForFile(containerEl: HTMLElement, filePath: string): boolean {
		const overlay = containerEl.querySelector<HTMLElement>('[data-canvas-cover-overlay]');
		return overlay?.getAttribute('data-canvas-cover-target') === filePath;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<CanvasCoverSettings>);
		if (!this.settings.frontmatterCoverKey) {
			this.settings.frontmatterCoverKey = DEFAULT_SETTINGS.frontmatterCoverKey;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
