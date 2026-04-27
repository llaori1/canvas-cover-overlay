# Canvas Cover Overlay 中文说明

Canvas Cover Overlay 是一个用于 Obsidian 的插件，用来增强 .canvas 嵌入卡片和 Canvas 视图背景。

它支持为每一个 canvas 单独修改嵌入的 canvas 缩略图和 canvas 背景页面。

本插件是基于 Advanced Canvas 的扩展插件。使用前请先安装并启用 Advanced Canvas。

## 前置依赖

- Obsidian
- Advanced Canvas（必需）
- 桌面端 Obsidian（不支持移动端）

## 功能说明

- 只处理指向 .canvas 文件的 file 节点。
- 支持按 canvas 维度独立配置封面。
- 不替换 Obsidian 原生渲染，只添加一层不可点击的覆盖层。
- 支持嵌入卡片封面和打开的 Canvas 视图背景。

## 封面字段来源

推荐通过 Canvas 的属性面板（Properties）配置封面字段，插件会从该 canvas 的 frontmatter 中读取对应字段。

你也可以在底层 JSON 中看到对应数据结构（仅作为参考）：

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

字段名由插件设置中的 Embed cover key 和 Canvas background key 控制。

## 支持的图片引用格式

### 1) Vault 内相对路径

- assets/canvas-cover.png
- folder/sub/cover.webp

### 2) Wiki 链接

- [[cover.png]]
- ![[cover.png]]
- ![[cover.png|alias]]
- [[cover.png#section]]

### 3) Markdown 链接

- [图片名](assets/canvas-cover.png)
- ![图片名](assets/canvas-cover.png)
- [图片名]（assets/canvas-cover.png）
- ![图片名]（assets/canvas-cover.png）

说明：上面同时支持半角括号 () 与全角括号 （）。

### 4) 网络图片

- https://example.com/cover.png
- [图片名](https://example.com/cover.png)

说明：仅支持 https。

## 不支持的格式

- file:///C:/Users/YourName/Pictures/cover.png（本地绝对路径）
- http://example.com/cover.png（仅允许 https）
- javascript:... / data:... 等非白名单协议
- 直接写 Windows 绝对路径（例如 C:\\Users\\...）

## 设置项

- Enable overlay: 是否启用嵌入卡片覆盖层。
- Enable canvas background: 是否启用 Canvas 视图背景图。
- Canvas background opacity: Canvas 背景透明度。
- Embed cover key: 嵌入卡片缩略图使用的 frontmatter 字段名，默认 `cover`。
- Canvas background key: Canvas 背景图使用的 frontmatter 字段名，默认 `cover`。
- Overlay opacity: 覆盖层透明度。
- Debug mode: 输出调试日志到控制台。

## 详细用法

### 1) 安装并启用插件

1. 安装并启用 Advanced Canvas。
2. 安装并启用 Canvas Cover Overlay。
3. 打开插件设置，确认 `Enable overlay` 与 `Enable canvas background` 是否按需开启。

### 2) 在目标 canvas 的属性面板中配置封面字段（推荐）

1. 打开你要作为封面的目标 `.canvas` 文件。
2. 打开右侧属性面板（Properties）。
3. 新增字段并填写图片路径，默认字段名是 `cover`。
4. 保存后，嵌入卡片和背景图会按设置自动读取该字段。

最简单配置（缩略图和背景图使用同一字段）：

- 字段名：`cover`
- 字段值：`assets/canvas-cover.png`

对应的底层 JSON 结构如下（仅供理解，不要求手动编辑）：

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

### 3) 分别设置缩略图 key 和背景图 key

如果你想让“嵌入缩略图”和“Canvas 背景图”使用不同图片：

1. 在插件设置中修改：
   - `Embed cover key`，例如 `embedCover`
   - `Canvas background key`，例如 `bgCover`
2. 在目标 canvas 的属性面板中新增对应字段并填写路径：

- `embedCover: assets/embed-thumb.png`
- `bgCover: assets/background.png`

对应底层 JSON 结构如下（仅供参考）：

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

### 4) 引用路径建议

1. 推荐使用 Vault 内相对路径或 Wiki 链接。
2. 网络链接仅支持 `https`。
3. 不支持本地绝对路径（如 `C:\\...` 或 `file:///...`）。

### 5) 刷新与调试

1. 修改字段后，可执行命令 `Reload embed cover hooks` 立即刷新挂钩。
2. 若未生效，开启 `Debug mode`，到开发者控制台查看解析日志。
3. 重点检查：
   - key 名称是否与设置一致
   - 图片路径是否存在
   - 文件是否在 Vault 内

## 命令

- Reload embed cover hooks: 重新注册 .canvas 嵌入 hook。

## 构建

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 限制与说明

- 插件依赖 Obsidian 内部 API embedRegistry，Obsidian 版本变化可能导致 hook 失效。
- 若内部 API 不可用，插件会自动回退到原生行为，不会破坏原生嵌入。
- 外部图片地址若无法访问，封面不会显示。可开启 Debug mode 查看日志。
