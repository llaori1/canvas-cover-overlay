import { App, TFile, normalizePath } from "obsidian";
import type { CanvasCoverSettings } from "../settings";

interface CanvasNode {
	id: string;
	type: string;
	file?: string;
}

interface CanvasMetadata {
	frontmatter?: Record<string, unknown>;
}

interface CanvasPayload {
	metadata?: CanvasMetadata;
	nodes?: CanvasNode[];
}

export interface NodeCover {
	nodeId: string;
	coverUrl: string;
	targetCanvasPath: string;
}

interface CachedCover {
	mtime: number;
	url: string | null;
}

export class CoverResolver {
	private readonly app: App;
	private readonly settingsProvider: () => CanvasCoverSettings;
	private readonly debugLog: (message: string, ...details: unknown[]) => void;
	private cache = new Map<string, CachedCover>();

	constructor(app: App, settingsProvider: () => CanvasCoverSettings, debugLog: (message: string, ...details: unknown[]) => void) {
		this.app = app;
		this.settingsProvider = settingsProvider;
		this.debugLog = debugLog;
	}

	clearCache(): void {
		this.cache.clear();
	}

	invalidate(path: string): void {
		const normalizedPath = normalizePath(path);
		for (const cacheKey of Array.from(this.cache.keys())) {
			if (cacheKey === normalizedPath || cacheKey.startsWith(`${normalizedPath}::`)) {
				this.cache.delete(cacheKey);
			}
		}
	}

	async resolveNodeCovers(hostCanvasFile: TFile): Promise<NodeCover[]> {
		const payload = await this.readCanvasPayload(hostCanvasFile);
		if (!payload?.nodes?.length) {
			return [];
		}

		const results: NodeCover[] = [];
		const settings = this.settingsProvider();

		for (const node of payload.nodes) {
			if (node.type !== "file" || !node.file || !node.id) {
				continue;
			}

			const targetPath = this.resolveTargetCanvasPath(hostCanvasFile.path, node.file);
			if (!targetPath || !targetPath.toLowerCase().endsWith(".canvas")) {
				continue;
			}

			const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
			if (!(targetFile instanceof TFile)) {
				continue;
			}

			const coverUrl = await this.resolveCoverUrl(targetFile, settings.embedCoverKey);
			if (!coverUrl) {
				continue;
			}

			results.push({
				nodeId: node.id,
				coverUrl,
				targetCanvasPath: targetPath,
			});
		}

		return results;
	}

	async resolveCoverUrlForCanvas(targetCanvasFile: TFile, key: string): Promise<string | null> {
		return this.resolveCoverUrl(targetCanvasFile, key);
	}

	private async readCanvasPayload(canvasFile: TFile): Promise<CanvasPayload | null> {
		try {
			const raw = await this.app.vault.cachedRead(canvasFile);
			return JSON.parse(raw) as CanvasPayload;
		} catch (error) {
			this.debugLog("Failed to parse canvas file", canvasFile.path, error);
			return null;
		}
	}

	private resolveTargetCanvasPath(hostCanvasPath: string, linkedPath: string): string | null {
		const trimmedLinked = linkedPath.trim();
		if (!trimmedLinked) {
			return null;
		}

		const sourcePath = normalizePath(hostCanvasPath);
		const metadataResolved = this.app.metadataCache.getFirstLinkpathDest(trimmedLinked, sourcePath);
		if (metadataResolved instanceof TFile) {
			return normalizePath(metadataResolved.path);
		}

		const normalizedLinked = normalizePath(trimmedLinked.replace(/^\/+/, ""));
		if (!normalizedLinked) {
			return null;
		}

		if (this.app.vault.getAbstractFileByPath(normalizedLinked)) {
			return normalizedLinked;
		}

		const baseFolder = this.dirname(hostCanvasPath);
		return normalizePath(baseFolder ? `${baseFolder}/${normalizedLinked}` : normalizedLinked);
	}

	private normalizeCoverReference(rawValue: string): string {
		let value = rawValue.trim();
		if (!value) {
			return value;
		}

		// Support Markdown image/link syntax, for example: ![cover](assets/image.webp)
		// and full-width parenthesis variant: [封面]（assets/image.webp）
		const markdownLinkMatch = value.match(/^!?\[[^\]]*\][(（](.+)[)）]$/);
		const markdownDestination = markdownLinkMatch?.[1];
		if (markdownDestination) {
			value = markdownDestination.trim();
		}

		// Support wrapped destinations, for example: ![cover](<assets/image.webp>)
		if (value.startsWith("<") && value.endsWith(">")) {
			value = value.substring(1, value.length - 1).trim();
		}

		// Support wiki-style links, for example: [[image.webp]], ![[image.webp|alias]], [[image.webp#section]]
		if (value.startsWith("![[") && value.endsWith("]]")) {
			value = value.substring(3, value.length - 2);
		} else if (value.startsWith("[[") && value.endsWith("]]")) {
			value = value.substring(2, value.length - 2);
		}

		// Keep URL fragments/query untouched for supported external URLs.
		if (this.normalizeSupportedExternalUrl(value)) {
			return value;
		}

		const aliasSeparatorIndex = value.indexOf("|");
		if (aliasSeparatorIndex >= 0) {
			value = value.substring(0, aliasSeparatorIndex);
		}

		const subpathSeparatorIndex = value.indexOf("#");
		if (subpathSeparatorIndex >= 0) {
			value = value.substring(0, subpathSeparatorIndex);
		}

		return value.trim();
	}

	private normalizeSupportedExternalUrl(value: string): string | null {
		try {
			const url = new URL(value);
			if (url.protocol === "https:") {
				return url.href;
			}
		} catch {
			return null;
		}

		return null;
	}

	private isUnsupportedExternalUrl(value: string): boolean {
		try {
			const url = new URL(value);
			return url.protocol !== "https:";
		} catch {
			return false;
		}
	}

	private isWindowsAbsolutePath(value: string): boolean {
		return /^[a-zA-Z]:[\\/]/.test(value);
	}

	private buildCacheKey(path: string, key: string): string {
		return `${normalizePath(path)}::${key.trim().toLowerCase()}`;
	}

	private async resolveCoverUrl(targetCanvasFile: TFile, frontmatterKey: string): Promise<string | null> {
		const normalizedTargetPath = normalizePath(targetCanvasFile.path);
		const effectiveKey = frontmatterKey.trim() || this.settingsProvider().embedCoverKey;
		const cacheKey = this.buildCacheKey(normalizedTargetPath, effectiveKey);
		const cached = this.cache.get(cacheKey);
		if (cached && cached.mtime === targetCanvasFile.stat.mtime) {
			return cached.url;
		}

		const payload = await this.readCanvasPayload(targetCanvasFile);
		const frontmatter = payload?.metadata?.frontmatter;
		if (!frontmatter) {
			this.cache.set(cacheKey, { mtime: targetCanvasFile.stat.mtime, url: null });
			return null;
		}

		const value = frontmatter[effectiveKey];
		if (typeof value !== "string" || value.trim().length === 0) {
			this.cache.set(cacheKey, { mtime: targetCanvasFile.stat.mtime, url: null });
			return null;
		}

		const normalizedCoverReference = this.normalizeCoverReference(value);
		const externalUrl = this.normalizeSupportedExternalUrl(normalizedCoverReference);
		if (externalUrl) {
			this.cache.set(cacheKey, { mtime: targetCanvasFile.stat.mtime, url: externalUrl });
			return externalUrl;
		}

		if (this.isUnsupportedExternalUrl(normalizedCoverReference)) {
			this.debugLog("Unsupported cover URL protocol", normalizedCoverReference, "from", targetCanvasFile.path);
			this.cache.set(cacheKey, { mtime: targetCanvasFile.stat.mtime, url: null });
			return null;
		}

		if (this.isWindowsAbsolutePath(normalizedCoverReference)) {
			this.debugLog("Local absolute paths are unsupported. Use a vault path instead", normalizedCoverReference, "from", targetCanvasFile.path);
			this.cache.set(cacheKey, { mtime: targetCanvasFile.stat.mtime, url: null });
			return null;
		}

		const normalizedCoverPath = this.resolveTargetCanvasPath(targetCanvasFile.path, normalizedCoverReference);
		if (!normalizedCoverPath) {
			this.cache.set(cacheKey, { mtime: targetCanvasFile.stat.mtime, url: null });
			return null;
		}

		const coverFile = this.app.vault.getAbstractFileByPath(normalizedCoverPath);
		if (!(coverFile instanceof TFile)) {
			this.debugLog("Cover file missing", normalizedCoverPath, "from", targetCanvasFile.path);
			this.cache.set(cacheKey, { mtime: targetCanvasFile.stat.mtime, url: null });
			return null;
		}

		const url = this.app.vault.getResourcePath(coverFile);
		this.cache.set(cacheKey, { mtime: targetCanvasFile.stat.mtime, url });
		return url;
	}

	private dirname(path: string): string {
		const normalized = normalizePath(path);
		const idx = normalized.lastIndexOf("/");
		if (idx <= 0) {
			return "";
		}
		return normalized.substring(0, idx);
	}
}
