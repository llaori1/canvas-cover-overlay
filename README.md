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

In your target canvas file, add frontmatter into advanced JSON canvas metadata:

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
- `Cover key`: primary key, default is `cover`.
- `Fallback keys`: comma-separated fallback keys, default is `thumbnail,image`.
- `Overlay opacity`: transparency of the cover layer.
- `Debug mode`: console logs.

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
