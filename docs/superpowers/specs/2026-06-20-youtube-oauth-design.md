# YouTube OAuth Login — Design Spec
**Date:** 2026-06-20  
**Project:** youtube-review-pipeline  
**Status:** Approved

---

## Goal

Add a "Connect YouTube" login flow to the static HTML pipeline app so the user can:
1. See live channel stats (subscribers, total views, video count) in the Stats tab
2. Import existing uploaded videos from YouTube directly into the Pipeline kanban

---

## Architecture

The app is a static HTML file with no backend. Authentication uses **Google OAuth 2.0 implicit/token flow** via the Google Identity Services (GIS) JS library, entirely client-side. The app will be served over HTTPS via **GitHub Pages** so OAuth redirect origins are valid.

```
Browser (GitHub Pages HTTPS)
  └── Google Identity Services JS lib
        └── OAuth popup → Google accounts.google.com
              └── Access token (1hr TTL) returned to app
                    ├── YouTube Data API v3 → channels.list  (stats)
                    └── YouTube Data API v3 → playlistItems.list (uploaded videos)
```

No backend. No server. No client secret stored anywhere.

---

## Components

### 1. Config block (top of `<script>`)
A single constant the user pastes their OAuth client ID into:
```js
const YT_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
```

### 2. "Connect YouTube" button (header)
- Shown when not authenticated
- On click: calls `google.accounts.oauth2.initTokenClient()` with scope `youtube.readonly`, triggers popup
- On success: stores token in `sessionStorage`, fetches channel info, caches display data in `localStorage`
- Replaced by channel avatar + name + "Disconnect" link once authenticated

### 3. Stats tab — Channel Stats banner
- Displayed at top of Stats tab when connected (or showing cached data when disconnected)
- Shows: channel thumbnail, channel name, subscriber count, total views, public video count
- "Refresh" button to re-fetch live data
- Subtle "last updated" timestamp

### 4. Pipeline tab — Import from YouTube panel
- "Import from YouTube" button appears in Pipeline tab when connected
- On click: fetches last 50 videos from the channel's uploads playlist (`playlistItems.list`)
- Renders a checklist: video thumbnail, title, published date
- Videos already in the pipeline are pre-checked/disabled (matched by YouTube video ID stored on the card)
- "Import Selected" button creates Pipeline cards for chosen videos (stage: Idea), with `ytVideoId` stored on the card

### 5. Token & session management
- Access token → `sessionStorage` (auto-cleared on tab close; expires in 1hr)
- Channel display info (name, avatar URL, stats) → `localStorage` (persists across sessions for display)
- On token expiry: Stats banner shows "Reconnect" prompt; Import button disabled
- "Disconnect" clears both sessionStorage token and localStorage channel cache

---

## Data Model Changes

Add `ytVideoId` field to video cards:
```js
{ id, title, stage, notes, productId, publishedDate, views, adRevenue, affiliate, sponsor, ytVideoId }
```
`ytVideoId` is `null` for manually created cards, a YouTube video ID string for imported ones.

---

## API Calls

| Purpose | Endpoint | Key params |
|---|---|---|
| Channel stats | `GET /youtube/v3/channels` | `part=snippet,statistics`, `mine=true` |
| Uploads playlist ID | Same response | `contentDetails.relatedPlaylists.uploads` |
| Video list | `GET /youtube/v3/playlistItems` | `part=snippet`, `playlistId=<uploads>`, `maxResults=50` |

All calls use the Bearer access token from sessionStorage.

---

## GitHub Pages Setup

Enable GitHub Pages on the `quyetdgroup/youtube-review-pipeline` repo (root of `main` branch).  
URL: `https://quyetdgroup.github.io/youtube-review-pipeline`

This URL must be added as:
- **Authorized JavaScript origin** in the Google Cloud OAuth client
- No redirect URI needed (token model returns inline, not via redirect)

---

## One-Time Google Cloud Setup (user steps)

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a new project
2. Enable **YouTube Data API v3** (APIs & Services → Library)
3. Configure OAuth consent screen (External, app name: "YT Review Pipeline", add your Gmail as test user)
4. Create credentials → OAuth 2.0 Client ID → Web application
5. Add authorized JS origin: `https://quyetdgroup.github.io`
6. Copy the Client ID → paste into `YT_CLIENT_ID` in `index.html`

---

## Scope

- `https://www.googleapis.com/auth/youtube.readonly` — read-only; no write access to the channel

---

## Out of Scope

- Uploading videos via the API
- Editing video metadata from the app
- Storing a refresh token (requires a backend; not needed for a personal tool)
- TikTok or Facebook login (future)
