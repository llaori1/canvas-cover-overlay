# Canvas Cover Overlay

Canvas Cover Overlay is an Obsidian plugin that enhances .canvas embeds.

It lets you customize each canvas with its own embedded canvas thumbnail and canvas view background.

中文说明文档: [README.zh-CN.md](README.zh-CN.md)

## What it does

- Only affects file nodes that point to `.canvas` files.
- Supports per-canvas cover configuration through frontmatter metadata.
- Reads cover path from `metadata.frontmatter` of the target `.canvas` file.
- Keeps original behavior by adding an overlay layer (`pointer-events: none`) instead of replacing native rendering.
- Uses internal `embedRegistry` hook wrapping for `.canvas` embed creators.

## Requirements

- Obsidian
- Advanced Canvas plugin (required dependency)
- Desktop app (mobile is not supported)

This plugin is an extension built on top of Advanced Canvas. Install and enable Advanced Canvas before using Canvas Cover Overlay.

If `embedRegistry` is unavailable in your Obsidian build, the plugin stays idle.

## Cover metadata format

Use the canvas Properties panel to configure cover fields. The plugin reads those values from the target canvas frontmatter.

You can still inspect the underlying JSON structure (reference only):

```json
{
    "metadata": {
        "version": "1.0-1.0",
        "frontmatter": {
			"cover": "assets/canvas-cover.png"
        }
    },
    "nodes": [],
    "edges": []
}
```

## Settings

- `Enable overlay`: master switch.
- `Embed cover key`: frontmatter key for embedded canvas thumbnails, default is `cover`.
- `Canvas background key`: frontmatter key for canvas view backgrounds, default is `cover`.
- `Overlay opacity`: transparency of the cover layer.
- `Debug mode`: console logs.

## Detailed usage

### 1) Install and enable

1. Install and enable Advanced Canvas.
2. Install and enable Canvas Cover Overlay.
3. Open plugin settings and confirm `Enable overlay` and `Enable canvas background` are configured as needed.

### 2) Configure cover fields from canvas Properties (recommended)

1. Open the target `.canvas` file.
2. Open the Properties panel.
3. Add or edit fields. The default key is `cover`.
4. Save the canvas. Embedded thumbnails and canvas backgrounds will update from these fields.

Simple setup (same field for thumbnail and background):

- Field name: `cover`
- Field value: `assets/canvas-cover.png`

Underlying JSON looks like this (for reference only):

```json
{
    "metadata": {
        "version": "1.0-1.0",
        "frontmatter": {
            "cover": "assets/canvas-cover.png"
        }
    },
    "nodes": [],
    "edges": []
}
```

### 3) Use different keys for thumbnail and background

If you want different images:

1. In plugin settings, set:
   - `Embed cover key` (for embedded thumbnails), for example `embedCover`
   - `Canvas background key` (for canvas view background), for example `bgCover`
2. In the target canvas Properties panel, add matching fields:
   - `embedCover: assets/embed-thumb.png`
   - `bgCover: assets/background.png`

Underlying JSON (reference only):

```json
{
    "metadata": {
        "version": "1.0-1.0",
        "frontmatter": {
            "embedCover": "assets/embed-thumb.png",
            "bgCover": "assets/background.png"
        }
    },
    "nodes": [],
    "edges": []
}
```

### 4) Path recommendations

1. Prefer vault-relative paths or wiki links.
2. Only `https` is supported for network images.
3. Local absolute paths are not supported (for example `C:\\...` or `file:///...`).

### 5) Refresh and debugging

1. After changing fields, run `Reload embed cover hooks` to refresh immediately.
2. If it does not update, enable `Debug mode` and check Developer Console logs.
3. Check these items first:
   - Key names match plugin settings.
   - Image paths exist.
   - Files are inside the vault.

## Commands

- `Reload embed cover hooks`: re-registers the `.canvas` embed hook.

## Build

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Limitations

- The plugin uses internal Obsidian API (`embedRegistry`). Future Obsidian updates can break the hook path.
- If internal API changes, the plugin will disable cover enhancement and keep native embedding behavior.
