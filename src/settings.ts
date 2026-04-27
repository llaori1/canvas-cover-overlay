import {App, PluginSettingTab, Setting} from "obsidian";
import CanvasCoverOverlayPlugin from "./main";

export interface CanvasCoverSettings {
	enableOverlay: boolean;
	enableCanvasBackground: boolean;
	canvasBackgroundOpacity: number;
	frontmatterCoverKey: string;
	fallbackCoverKeys: string;
	overlayOpacity: number;
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: CanvasCoverSettings = {
	enableOverlay: true,
	enableCanvasBackground: true,
	canvasBackgroundOpacity: 0.2,
	frontmatterCoverKey: "cover",
	fallbackCoverKeys: "thumbnail,image",
	overlayOpacity: 0.9,
	debugMode: false,
};

export class CanvasCoverOverlaySettingTab extends PluginSettingTab {
	plugin: CanvasCoverOverlayPlugin;

	constructor(app: App, plugin: CanvasCoverOverlayPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
			new Setting(containerEl)
			.setName("Overlay")
				.setHeading();

		new Setting(containerEl)
			.setName("Enable overlay")
			.setDesc("Only applies to .canvas embeds.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.enableOverlay)
				.onChange(async (value) => {
					this.plugin.settings.enableOverlay = value;
					this.plugin.queueSettingsSave();
					await this.plugin.onSettingsChanged("setting:enable-overlay");
				}));

		new Setting(containerEl)
			.setName("Enable canvas background")
			.setDesc("Apply resolved cover image to opened canvas views.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.enableCanvasBackground)
				.onChange(async (value) => {
					this.plugin.settings.enableCanvasBackground = value;
					this.plugin.queueSettingsSave();
					await this.plugin.onSettingsChanged("setting:enable-canvas-background");
				}));

		new Setting(containerEl)
			.setName("Canvas background opacity")
			.setDesc("Set transparency for the canvas background image.")
			.addSlider((slider) => {
				slider.setLimits(0, 100, 1);
				slider.setDynamicTooltip();
				slider.setValue(Math.round(this.plugin.settings.canvasBackgroundOpacity * 100));
				slider.onChange(async (value) => {
					this.plugin.settings.canvasBackgroundOpacity = value / 100;
					this.plugin.queueSettingsSave();
					await this.plugin.onSettingsChanged("setting:canvas-background-opacity");
				});
			});

		new Setting(containerEl)
			.setName("Cover key")
			.setDesc("Primary key in metadata.frontmatter, for example: cover")
			.addText(text => text
				.setPlaceholder("cover")
				.setValue(this.plugin.settings.frontmatterCoverKey)
				.onChange(async (value) => {
					this.plugin.settings.frontmatterCoverKey = value.trim();
					this.plugin.queueSettingsSave();
					await this.plugin.onSettingsChanged("setting:cover-key");
				}));

		new Setting(containerEl)
			.setName("Fallback keys")
			.setDesc("Comma-separated keys, for example: cover, thumbnail.")
			.addText((text) => text
				.setPlaceholder("thumbnail,image")
				.setValue(this.plugin.settings.fallbackCoverKeys)
				.onChange(async (value) => {
					this.plugin.settings.fallbackCoverKeys = value;
					this.plugin.queueSettingsSave();
					await this.plugin.onSettingsChanged("setting:fallback-keys");
				}));

		new Setting(containerEl)
			.setName("Overlay opacity")
			.setDesc("Set transparency for the cover layer.")
			.addSlider((slider) => {
				slider.setLimits(0, 100, 1);
				slider.setDynamicTooltip();
				slider.setValue(Math.round(this.plugin.settings.overlayOpacity * 100));
				slider.onChange(async (value) => {
					this.plugin.settings.overlayOpacity = value / 100;
					this.plugin.queueSettingsSave();
					await this.plugin.onSettingsChanged("setting:overlay-opacity");
				});
			});

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc("Log selector and parsing diagnostics to console.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					this.plugin.queueSettingsSave();
					await this.plugin.onSettingsChanged("setting:debug");
				}));
	}
}
