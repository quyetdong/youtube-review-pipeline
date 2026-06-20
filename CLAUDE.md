# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A personal YouTube product review pipeline tracker. No build step, no framework, no dependencies — open `index.html` directly in a browser or serve via GitHub Pages.

**Live URL:** `https://quyetdong.github.io/youtube-review-pipeline`
**YouTube channel:** Newworld (@newworld6476) — Chrome profile: Quyết (Profile 3)

## Running locally

```bash
open index.html          # macOS — opens in default browser
python3 -m http.server   # serve on localhost:8000 (needed for OAuth testing)
```

OAuth will not work from `file://` — use the http.server approach when testing the YouTube login flow.

## Architecture

Two standalone HTML files. No module system, no bundler.

### `index.html` — the app

Single-file app with all CSS, HTML, and JS inlined. Structure inside `<script>`:

- **Data layer** — `data` object (`{ videos, products, nextId }`) loaded from / saved to `localStorage` key `yt-pipeline-v1`. All mutations call `save()` which debounces writes by 600ms.
- **Pipeline tab** — full re-render on every mutation (`renderKanban()`). Kanban columns are the `STAGES` array (`['Idea','Filming','Editing','Published']`). Cards store `{ id, title, stage, notes, productId, publishedDate, views, adRevenue, affiliate, sponsor }`.
- **Products tab** — `renderProducts()` re-renders the table; a product's status ("Reviewed"/"Pending") is derived live by checking whether any video references its `productId`.
- **Stats tab** — `renderStats()` is called lazily on tab switch. Earnings are entered manually via inline `<input type=number>` fields that call `updateStat()`.
- **`escHtml()`** — used on all user-supplied strings before injecting into innerHTML.

### `notes.html` — static strategy reference

No JS data layer. Has a single free-text `<textarea>` persisted to `localStorage` key `yt-strategy-notes`. Everything else is hardcoded content.

## Planned feature: YouTube OAuth

Design spec: `Obsidian/youtube-review-pipeline/decisions/2026-06-20-youtube-oauth-design.md`

- Google Identity Services token flow (`youtube.readonly` scope)
- Config constant `YT_CLIENT_ID` at top of script block
- Stats tab: live channel stats banner via `channels.list` API
- Pipeline tab: "Import from YouTube" via `playlistItems.list` (last 50 uploads)
- Token → `sessionStorage`; channel display cache → `localStorage`
- Cards will gain a `ytVideoId` field for imported videos

Before implementing: GitHub Pages must be enabled and a Google Cloud OAuth client ID created with `https://quyetdong.github.io` as the authorized JS origin.
