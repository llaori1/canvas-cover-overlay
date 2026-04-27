import { App, PluginSettingTab, Setting } from "obsidian";
import CanvasCoverOverlayPlugin from "./main";

export interface CanvasCoverSettings {
	enableOverlay: boolean;
	enableCanvasBackground: boolean;
	canvasBackgroundOpacity: number;
	embedCoverKey: string;
	canvasBackgroundCoverKey: string;
	overlayOpacity: number;
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: CanvasCoverSettings = {
	enableOverlay: true,
	enableCanvasBackground: true,
	canvasBackgroundOpacity: 0.2,
	embedCoverKey: "cover",
	canvasBackgroundCoverKey: "cover",
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
		const { containerEl } = this;

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
			.setName("Embed cover key")
			.setDesc("Frontmatter key for embedded canvas thumbnails. Example: cover")
			.addText(text => text
				.setPlaceholder("Cover")
				.setValue(this.plugin.settings.embedCoverKey)
				.onChange(async (value) => {
					this.plugin.settings.embedCoverKey = value.trim();
					this.plugin.queueSettingsSave();
					await this.plugin.onSettingsChanged("setting:embed-cover-key");
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
			.setName("Canvas background key")
			.setDesc("Frontmatter key for canvas view backgrounds. Example: cover")
			.addText((text) => text
				.setPlaceholder("Cover")
				.setValue(this.plugin.settings.canvasBackgroundCoverKey)
				.onChange(async (value) => {
					this.plugin.settings.canvasBackgroundCoverKey = value.trim();
					this.plugin.queueSettingsSave();
					await this.plugin.onSettingsChanged("setting:canvas-background-key");
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
