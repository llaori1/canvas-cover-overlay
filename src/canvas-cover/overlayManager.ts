import type { TFile } from "obsidian";
import type { CoverResolver } from "./coverResolver";
import type { CanvasCoverSettings } from "../settings";

const OVERLAY_ATTR = "data-canvas-cover-overlay";
const OVERLAY_TARGET_ATTR = "data-canvas-cover-target";

export class OverlayManager {
	private readonly debugLog: (message: string, ...details: unknown[]) => void;

	constructor(debugLog: (message: string, ...details: unknown[]) => void) {
		this.debugLog = debugLog;
	}

	async attachCoverOverlay(
		containerEl: HTMLElement,
		embeddedCanvasFile: TFile,
		resolver: CoverResolver,
		settingsProvider: () => CanvasCoverSettings,
	): Promise<void> {
		const settings = settingsProvider();
		if (!settings.enableOverlay) {
			this.clearInContainer(containerEl);
			return;
		}

		if (embeddedCanvasFile.extension !== "canvas") {
			this.clearInContainer(containerEl);
			return;
		}

		const coverUrl = await resolver.resolveCoverUrlForCanvas(embeddedCanvasFile);
		if (!coverUrl) {
			this.clearInContainer(containerEl);
			return;
		}

		let overlay = containerEl.querySelector<HTMLElement>(`[${OVERLAY_ATTR}]`);
		if (!overlay) {
			containerEl.classList.add("canvas-cover-overlay-host");
			overlay = document.createElement("div");
			overlay.setAttribute(OVERLAY_ATTR, "true");
			overlay.addClass("canvas-cover-overlay");
			containerEl.appendChild(overlay);
		}

		const opacity = Math.max(0, Math.min(1, settings.overlayOpacity));
		overlay.style.backgroundImage = `url("${coverUrl}")`;
		overlay.style.opacity = String(opacity);
		overlay.setAttribute(OVERLAY_TARGET_ATTR, embeddedCanvasFile.path);
		this.debugLog("Attached embed cover overlay", embeddedCanvasFile.path);
	}

	clearAll(): void {
		for (const overlay of Array.from(document.querySelectorAll<HTMLElement>(`[${OVERLAY_ATTR}]`))) {
			overlay.remove();
		}

		for (const host of Array.from(document.querySelectorAll<HTMLElement>(".canvas-cover-overlay-host"))) {
			host.removeClass("canvas-cover-overlay-host");
		}
	}

	private clearInContainer(containerEl: HTMLElement): void {
		for (const overlay of Array.from(containerEl.querySelectorAll<HTMLElement>(`[${OVERLAY_ATTR}]`))) {
			overlay.remove();
		}
		containerEl.classList.remove("canvas-cover-overlay-host");
	}
}
