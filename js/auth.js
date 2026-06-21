// ── Config ────────────────────────────────────────────────────────────────────
const YT_CLIENT_ID = '313644743413-g107qkugka7rc540qcpu818kdsikg2na.apps.googleusercontent.com';
const YT_SCOPE     = 'https://www.googleapis.com/auth/youtube.readonly';
const YT_API       = 'https://www.googleapis.com/youtube/v3';

// ── State ─────────────────────────────────────────────────────────────────────
let gisReady    = false;
let tokenClient = null;

// ── Token helpers ─────────────────────────────────────────────────────────────
function getToken() {
  const token  = sessionStorage.getItem('yt_token');
  const expiry = Number(sessionStorage.getItem('yt_token_expiry') || 0);
  if (token && Date.now() < expiry) return token;
  return null;
}

function cachedChannel() {
  try { return JSON.parse(localStorage.getItem('yt-channel-cache') || 'null'); } catch { return null; }
}

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function timeAgo(ts) {
  if (!ts) return 'never';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

// ── OAuth flow ────────────────────────────────────────────────────────────────
function connectYouTube() {
  if (!gisReady) { alert('Google Identity Services is still loading — please try again in a moment.'); return; }
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: YT_CLIENT_ID,
      scope: YT_SCOPE,
      callback: async (resp) => {
        if (resp.error) { console.error('OAuth error', resp); return; }
        const expiry = Date.now() + (resp.expires_in - 60) * 1000;
        sessionStorage.setItem('yt_token', resp.access_token);
        sessionStorage.setItem('yt_token_expiry', expiry);
        await fetchAndCacheChannel(resp.access_token);
        renderAuthState();
        renderChannelBanner();
        renderImportPanel();
      },
    });
  }
  tokenClient.requestAccessToken();
}

function disconnectYouTube() {
  const token = getToken();
  if (token) google.accounts.oauth2.revoke(token, () => {});
  sessionStorage.removeItem('yt_token');
  sessionStorage.removeItem('yt_token_expiry');
  localStorage.removeItem('yt-channel-cache');
  renderAuthState();
  renderChannelBanner();
  renderImportPanel();
}

async function fetchAndCacheChannel(token) {
  const url = `${YT_API}/channels?part=snippet,statistics,contentDetails&mine=true`;
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return;
  const json = await res.json();
  const ch   = json.items?.[0];
  if (!ch) return;
  const cache = {
    name:        ch.snippet.title,
    handle:      ch.snippet.customUrl || '',
    avatar:      ch.snippet.thumbnails?.default?.url || '',
    subscribers: Number(ch.statistics.subscriberCount || 0),
    views:       Number(ch.statistics.viewCount || 0),
    videoCount:  Number(ch.statistics.videoCount || 0),
    uploadsId:   ch.contentDetails?.relatedPlaylists?.uploads || '',
    updatedAt:   Date.now(),
  };
  localStorage.setItem('yt-channel-cache', JSON.stringify(cache));
}

// ── Auth UI ───────────────────────────────────────────────────────────────────
function renderAuthState() {
  const connected = !!getToken();
  const ch = cachedChannel();
  document.getElementById('yt-connect-btn').style.display   = connected ? 'none' : 'flex';
  document.getElementById('yt-channel-badge').style.display = connected ? 'flex'  : 'none';
  if (connected && ch) {
    document.getElementById('yt-avatar').src               = ch.avatar;
    document.getElementById('yt-channel-name').textContent = ch.name;
  }
}

// ── Channel banner (Stats tab) ────────────────────────────────────────────────
function renderChannelBanner() {
  const banner = document.getElementById('channel-banner');
  const token  = getToken();
  const ch     = cachedChannel();

  if (!ch && !token) {
    banner.className = 'needs-connect';
    banner.innerHTML = `<div class="connect-prompt">
      <p>Connect your YouTube account to see live channel stats</p>
      <button id="banner-connect-btn" onclick="connectYouTube()">Connect YouTube</button>
    </div>`;
    return;
  }

  const ago = ch ? timeAgo(ch.updatedAt) : '—';
  banner.className = 'visible';
  banner.innerHTML = `
    <img id="ch-avatar" src="${escHtml(ch?.avatar || '')}" alt=""
      style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#2a2a2a" />
    <div class="ch-info">
      <div class="ch-name">${escHtml(ch?.name || '')}</div>
      <div class="ch-handle">${escHtml(ch?.handle || '')}</div>
      <div class="ch-stats">
        <div class="ch-stat"><div class="val">${fmtNum(ch?.subscribers || 0)}</div><div class="lbl">Subscribers</div></div>
        <div class="ch-stat"><div class="val">${fmtNum(ch?.views || 0)}</div><div class="lbl">Total Views</div></div>
        <div class="ch-stat"><div class="val">${fmtNum(ch?.videoCount || 0)}</div><div class="lbl">Videos</div></div>
      </div>
    </div>
    <div class="ch-actions">
      ${token
        ? `<button class="btn-refresh" onclick="refreshChannel()">↻ Refresh</button>`
        : `<button class="btn-refresh" onclick="connectYouTube()">Reconnect</button>`}
      <div class="ch-updated">Updated ${ago}</div>
    </div>`;
}

async function refreshChannel() {
  const token = getToken();
  if (!token) { connectYouTube(); return; }
  await fetchAndCacheChannel(token);
  renderChannelBanner();
}

// ── Import panel (Pipeline tab) ───────────────────────────────────────────────
function renderImportPanel() {
  const panel = document.getElementById('import-panel');
  panel.classList.toggle('visible', !!getToken());
  document.getElementById('import-list').classList.remove('open');
  document.getElementById('import-items').innerHTML = '';
  updateImportCount();
}

async function openImportList() {
  const token = getToken();
  if (!token) { connectYouTube(); return; }

  const list  = document.getElementById('import-list');
  const items = document.getElementById('import-items');
  list.classList.add('open');
  items.innerHTML = '<div class="import-loading">Loading your videos…</div>';

  const ch = cachedChannel();
  if (!ch?.uploadsId) {
    items.innerHTML = '<div class="import-loading">Could not find uploads playlist.</div>';
    return;
  }

  const url = `${YT_API}/playlistItems?part=snippet&playlistId=${encodeURIComponent(ch.uploadsId)}&maxResults=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    items.innerHTML = '<div class="import-loading">Error loading videos. Try reconnecting.</div>';
    return;
  }

  const json       = await res.json();
  const videos     = json.items || [];
  const existingIds = new Set(data.videos.filter(v => v.ytVideoId).map(v => v.ytVideoId));

  if (!videos.length) {
    items.innerHTML = '<div class="import-loading">No uploaded videos found.</div>';
    return;
  }

  items.innerHTML = videos.map(item => {
    const sn      = item.snippet;
    const ytId    = sn.resourceId?.videoId || '';
    const thumb   = sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || '';
    const date    = sn.publishedAt ? sn.publishedAt.slice(0, 10) : '';
    const already = existingIds.has(ytId);
    return `<label class="import-item${already ? ' already-added' : ''}">
      <input type="checkbox" data-ytid="${escHtml(ytId)}" data-title="${escHtml(sn.title)}" data-date="${date}"
        ${already ? 'disabled checked' : ''} onchange="updateImportCount()" />
      <img src="${escHtml(thumb)}" alt="" loading="lazy" />
      <div class="import-item-info">
        <div class="import-item-title">${escHtml(sn.title)}</div>
        <div class="import-item-meta">${date}</div>
      </div>
    </label>`;
  }).join('');

  updateImportCount();
}

function closeImportList() {
  document.getElementById('import-list').classList.remove('open');
}

function updateImportCount() {
  const checked = document.querySelectorAll('#import-items input[type=checkbox]:checked:not(:disabled)').length;
  document.getElementById('import-count').textContent = `${checked} selected`;
  document.getElementById('import-submit').disabled = checked === 0;
}

function importSelected() {
  document.querySelectorAll('#import-items input[type=checkbox]:checked:not(:disabled)').forEach(cb => {
    const id = 'REV-' + String(data.nextId++).padStart(3, '0');
    data.videos.push({
      id, title: cb.dataset.title, stage: 'Idea', notes: '', productId: null,
      publishedDate: null, views: 0, adRevenue: 0, affiliate: 0, sponsor: 0,
      ytVideoId: cb.dataset.ytid,
      ytPublishedDate: cb.dataset.date || null,
    });
  });
  save();
  renderKanban();
  closeImportList();
}
