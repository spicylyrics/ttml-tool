<div align=center>

<img src="./public/logo.svg" align="center" width="256">

# Spicy Lyrics TTML Tool

一个逐词歌词编辑器的分支，专为 [Spicy Lyrics 生态](https://spicylyrics.org/)制作。

[English](./README.md) | 简体中文

</div>

## 使用

> [!WARNING]
> 不建议在手机或小屏幕设备上使用本工具，操作会非常繁琐。

- 网页版：访问 [https://tool.spicylyrics.org/](https://tool.spicylyrics.org/)。
- 桌面版（Tauri，由 GitHub Actions 构建）：从 [最新发布](https://github.com/spicylyrics/ttml-tool/releases/latest) 下载。

## 主要功能

- **打轴与编辑**：逐词编辑、拆分和组合单词，在时间模式中直接修改单词和罗马音。
- **歌词导入**：从纯文本、LRCLIB 或 Genius 导入歌词，自动清理 Genius 标签和空行，并保留 `[Chorus]`、`[Verse]` 等段落信息。
- **智能拆分**：为英语、波兰语、西班牙语、法语、德语、印尼语、意大利语、葡萄牙语、俄语、日语和中日韩歌词提供专用的音节拆分引擎，并记住你手动拆分过的单词。
- **自动注音**：为日语、普通话和韩语生成逐词罗马音，支持混合语言的歌词行。
- **Spicy Lyrics 预览**：高还原度的 Spicy Lyrics 渲染器，支持动态、自定义和封面背景，以及逐词、简易和逐行布局。
- **时间工具**：吸附到播放头、复制行和单词的时间、按新的歌曲时长整体缩放时间轴。
- **导出前检查**：保存前检查未打轴或重叠的歌词。
- **项目文件夹（桌面版，可选）**：把歌词和音频放在同一个项目文件夹中，支持最近项目和 Ctrl+S 保存。
- **TTML 待办清单**：在本地记录要打轴的歌曲、备注和进度。
- **新手引导**：用你自己的歌曲一步步学习导入、打轴、导出和测试。
- **备份与恢复**：导出和恢复设置、快捷键、外观、项目和历史记录。
- **Discord 动态（桌面版，可选）**：在 Discord 上显示当前歌曲、模式和进度，网页版可通过 PreMiD 显示。
- **外观与多语言**：可调整编辑器外观，并提供社区翻译的多语言界面。

完整功能列表见 [英文 README](./README.md)。

## 贡献

欢迎提交代码、翻译、问题报告和建议。请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。翻译文件位于 [`src/i18n/locales/`](./src/i18n/locales/)。

有问题或想法，也可以在 [Spicy Lyrics Discord](https://discord.com/invite/uqgXU5wh8j) 的 [#ttml-tool](https://discord.com/channels/1369992682214264993/1558259984318603334) 频道发帖（先加入服务器，频道链接才能打开）。
