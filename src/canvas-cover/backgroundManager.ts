import { App, TFile, WorkspaceLeaf } from "obsidian";
import type { CoverResolver } from "./coverResolver";
import type { CanvasCoverSettings } from "../settings";

const CANVAS_BACKGROUND_CLASS = "canvas-cover-view-background-host";
const CANVAS_BACKGROUND_TARGET_ATTR = "data-canvas-cover-background-target";
const CANVAS_BACKGROUND_LAYER_ATTR = "data-canvas-cover-background-layer";

interface CanvasViewLike {
	file?: TFile;
	containerEl?: HTMLElement;
}

export class BackgroundManager {
	private readonly app: App;
	private readonly debugLog: (message: string, ...details: unknown[]) => void;

	constructor(app: App, debugLog: (message: string, ...details: unknown[]) => void) {
		this.app = app;
		this.debugLog = debugLog;
	}

	async refreshForCanvasFile(
		canvasFile: TFile,
		resolver: CoverResolver,
		settingsProvider: () => CanvasCoverSettings,
	): Promise<void> {
		const settings = settingsProvider();
		const opacity = this.clampOpacity(settings.canvasBackgroundOpacity);
		const leaves = this.app.workspace.getLeavesOfType("canvas");
		const coverUrl = await resolver.resolveCoverUrlForCanvas(canvasFile, settings.canvasBackgroundCoverKey);

		for (const leaf of leaves) {
			const view = leaf.view as CanvasViewLike;
			if (!view.file || view.file.path !== canvasFile.path) {
				continue;
			}

			if (!settings.enableCanvasBackground) {
				this.clearLeafBackground(leaf);
				continue;
			}

			this.applyLeafBackground(leaf, canvasFile.path, coverUrl, opacity);
		}
	}

	async refreshAllOpenCanvases(
		resolver: CoverResolver,
		settingsProvider: () => CanvasCoverSettings,
	): Promise<void> {
		const settings = settingsProvider();
		const opacity = this.clampOpacity(settings.canvasBackgroundOpacity);
		const leaves = this.app.workspace.getLeavesOfType("canvas");
		const coverUrlCache = new Map<string, string | null>();

		for (const leaf of leaves) {
			const view = leaf.view as CanvasViewLike;
			if (!(view.file instanceof TFile) || view.file.extension !== "canvas") {
				this.clearLeafBackground(leaf);
				continue;
			}

			if (!settings.enableCanvasBackground) {
				this.clearLeafBackground(leaf);
				continue;
			}

			let coverUrl = coverUrlCache.get(view.file.path);
			if (coverUrl === undefined) {
				coverUrl = await resolver.resolveCoverUrlForCanvas(view.file, settings.canvasBackgroundCoverKey);
				coverUrlCache.set(view.file.path, coverUrl);
			}
			this.applyLeafBackground(leaf, view.file.path, coverUrl, opacity);
		}
	}

	clearAll(): void {
		for (const host of Array.from(document.querySelectorAll<HTMLElement>(`.${CANVAS_BACKGROUND_CLASS}`))) {
			host.removeAttribute(CANVAS_BACKGROUND_TARGET_ATTR);
			host.classList.remove(CANVAS_BACKGROUND_CLASS);
		}

		for (const legacyLayer of Array.from(document.querySelectorAll<HTMLElement>("[data-canvas-cover-background-layer]"))) {
			legacyLayer.remove();
		}
	}

	private clearLeafBackground(leaf: WorkspaceLeaf): void {
		const host = this.resolveLeafHostElement(leaf);
		if (!host) {
			return;
		}

		const legacyLayer = host.querySelector<HTMLElement>("[data-canvas-cover-background-layer]");
		legacyLayer?.remove();

		const backgroundTarget = this.resolveCanvasBackgroundTarget(host);
		if (backgroundTarget) {
			const layer = backgroundTarget.querySelector<HTMLElement>(`[${CANVAS_BACKGROUND_LAYER_ATTR}]`);
			layer?.remove();
			backgroundTarget.style.removeProperty("background-image");
			backgroundTarget.style.removeProperty("opacity");
			backgroundTarget.removeAttribute(CANVAS_BACKGROUND_TARGET_ATTR);
			backgroundTarget.classList.remove(CANVAS_BACKGROUND_CLASS);
		}

		host.removeAttribute(CANVAS_BACKGROUND_TARGET_ATTR);
		host.classList.remove(CANVAS_BACKGROUND_CLASS);
	}

	private applyLeafBackground(leaf: WorkspaceLeaf, targetPath: string, coverUrl: string | null, opacity: number): void {
		const host = this.resolveLeafHostElement(leaf);
		if (!host) {
			return;
		}

		if (!coverUrl) {
			this.clearLeafBackground(leaf);
			return;
		}

		const backgroundTarget = this.resolveCanvasBackgroundTarget(host);
		if (!backgroundTarget) {
			this.debugLog("Canvas background target unavailable", targetPath);
			return;
		}

		backgroundTarget.classList.add(CANVAS_BACKGROUND_CLASS);

		let layer = backgroundTarget.querySelector<HTMLElement>(`[${CANVAS_BACKGROUND_LAYER_ATTR}]`);
		if (!layer) {
			layer = document.createElement("div");
			layer.setAttribute(CANVAS_BACKGROUND_LAYER_ATTR, "true");
			layer.addClass("canvas-cover-view-background-layer");
			backgroundTarget.prepend(layer);
		}

		layer.style.backgroundImage = `url("${coverUrl}")`;
		layer.style.opacity = String(opacity);
		backgroundTarget.setAttribute(CANVAS_BACKGROUND_TARGET_ATTR, targetPath);
		this.debugLog("Applied canvas view background", targetPath);
	}

	private clampOpacity(value: number): number {
		if (!Number.isFinite(value)) {
			return 0.2;
		}

		return Math.max(0, Math.min(1, value));
	}

	private resolveCanvasBackgroundTarget(host: HTMLElement): HTMLElement | null {
		const canvasWrapper = host.querySelector<HTMLElement>(".view-content .canvas-wrapper");
		if (canvasWrapper instanceof HTMLElement) {
			return canvasWrapper;
		}

		const canvasViewContent = host.querySelector<HTMLElement>(".view-content");
		if (canvasViewContent instanceof HTMLElement) {
			return canvasViewContent;
		}

		return host;
	}

	private resolveLeafHostElement(leaf: WorkspaceLeaf): HTMLElement | null {
		const view = leaf.view as CanvasViewLike;
		if (view.containerEl instanceof HTMLElement) {
			return view.containerEl;
		}

		const maybeContainer = (leaf as unknown as { containerEl?: HTMLElement }).containerEl;
		if (maybeContainer instanceof HTMLElement) {
			return maybeContainer;
		}

		return null;
	}
}
