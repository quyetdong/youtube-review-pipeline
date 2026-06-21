// ── Data ──────────────────────────────────────────────────────────────────────
const STAGES = ['Idea', 'Filming', 'Editing', 'Published'];
let data = load();

function load() {
  try {
    const raw = localStorage.getItem('yt-pipeline-v1');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { videos: [], products: [], nextId: 1 };
}

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  setSaveState('saving');
  saveTimer = setTimeout(() => {
    localStorage.setItem('yt-pipeline-v1', JSON.stringify(data));
    setSaveState('saved');
  }, 600);
}

function setSaveState(state) {
  const el = document.getElementById('save-indicator');
  el.className = state;
  el.textContent = state === 'saving' ? '●  saving…' : '●  all saved';
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
  if (name === 'stats') renderStats();
}

// ── Pipeline ──────────────────────────────────────────────────────────────────
function renderKanban() {
  const board = document.getElementById('kanban');
  board.innerHTML = '';
  STAGES.forEach((stage, si) => {
    const cards = data.videos.filter(v => v.stage === stage);
    const col = document.createElement('div');
    col.className = 'column';
    col.innerHTML = `
      <div class="column-header">
        <h3>${stage}</h3>
        <span class="col-count">${cards.length}</span>
      </div>
      ${cards.map(v => cardHTML(v, si)).join('')}
      ${si === 0 ? addCardFormHTML() : ''}
    `;
    board.appendChild(col);
  });
}

function cardHTML(v, si) {
  const productName = v.productId ? (data.products.find(p => p.id === v.productId)?.name || '') : '';
  const prevStage   = si > 0 ? STAGES[si - 1] : null;
  const nextStage   = si < STAGES.length - 1 ? STAGES[si + 1] : null;
  const ytLink      = v.ytVideoId
    ? `<div class="card-yt">▶ <a href="https://youtu.be/${escHtml(v.ytVideoId)}" target="_blank">Watch on YouTube</a></div>`
    : '';
  return `
    <div class="card" id="card-${v.id}">
      <div class="card-id">${v.id}</div>
      <div class="card-title">${escHtml(v.title)}</div>
      ${productName ? `<div class="card-product">📦 ${escHtml(productName)}</div>` : ''}
      ${ytLink}
      <textarea class="card-notes" placeholder="Script notes, hook ideas, links…"
        onchange="updateNotes('${v.id}', this.value)">${escHtml(v.notes || '')}</textarea>
      <div class="card-actions">
        ${prevStage ? `<button class="btn-move" onclick="moveCard('${v.id}', '${prevStage}')">← ${prevStage}</button>` : ''}
        ${nextStage ? `<button class="btn-move" onclick="moveCard('${v.id}', '${nextStage}')">${nextStage} →</button>` : ''}
        <button class="btn-del" onclick="deleteCard('${v.id}')" title="Delete">✕</button>
      </div>
    </div>`;
}

function addCardFormHTML() {
  const productOptions = data.products.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  return `
    <div class="add-card-form">
      <input id="new-title" placeholder="Video title or topic…" />
      <select id="new-product">
        <option value="">— link a product (optional) —</option>
        ${productOptions}
      </select>
      <button class="btn-add" onclick="addCard()">+ Add Video</button>
    </div>`;
}

function addCard() {
  const title = document.getElementById('new-title').value.trim();
  if (!title) return;
  const productId = document.getElementById('new-product').value || null;
  const id = 'REV-' + String(data.nextId++).padStart(3, '0');
  data.videos.push({ id, title, stage: 'Idea', notes: '', productId,
    publishedDate: null, views: 0, adRevenue: 0, affiliate: 0, sponsor: 0, ytVideoId: null });
  save();
  renderKanban();
}

function moveCard(id, stage) {
  const v = data.videos.find(v => v.id === id);
  if (!v) return;
  v.stage = stage;
  if (stage === 'Published' && !v.publishedDate) v.publishedDate = new Date().toISOString().slice(0, 10);
  save();
  renderKanban();
}

function updateNotes(id, val) {
  const v = data.videos.find(v => v.id === id);
  if (v) { v.notes = val; save(); }
}

function deleteCard(id) {
  if (!confirm('Delete this video card?')) return;
  data.videos = data.videos.filter(v => v.id !== id);
  save();
  renderKanban();
}

// ── Products ──────────────────────────────────────────────────────────────────
function toggleProductForm() {
  document.getElementById('product-form').classList.toggle('open');
}

function addProduct() {
  const name = document.getElementById('p-name').value.trim();
  if (!name) return alert('Product name is required.');
  const p = {
    id:       'P-' + Date.now(),
    name,
    platform: document.getElementById('p-platform').value,
    price:    document.getElementById('p-price').value.trim(),
    category: document.getElementById('p-category').value.trim(),
    link:     document.getElementById('p-link').value.trim(),
    notes:    document.getElementById('p-notes').value.trim(),
  };
  data.products.push(p);
  save();
  ['p-name', 'p-price', 'p-category', 'p-link', 'p-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('product-form').classList.remove('open');
  renderProducts();
}

function renderProducts() {
  const tbody = document.getElementById('products-body');
  if (!data.products.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No products yet. Add your first product above.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.products.map((p, i) => {
    const reviewed = data.videos.some(v => v.productId === p.id);
    return `<tr>
      <td style="color:#555;font-size:11px">${i + 1}</td>
      <td><strong>${escHtml(p.name)}</strong>${p.notes ? `<br><span style="font-size:11px;color:#666">${escHtml(p.notes)}</span>` : ''}</td>
      <td><span class="platform-tag">${escHtml(p.platform)}</span></td>
      <td>${escHtml(p.price)}</td>
      <td>${escHtml(p.category)}</td>
      <td><span class="badge ${reviewed ? 'badge-reviewed' : 'badge-pending'}">${reviewed ? 'Reviewed' : 'Pending'}</span></td>
      <td>${p.link ? `<a href="${escHtml(p.link)}" target="_blank">View ↗</a>` : '—'}</td>
      <td><button class="btn-del" onclick="deleteProduct('${p.id}')">✕</button></td>
    </tr>`;
  }).join('');
}

function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  data.products = data.products.filter(p => p.id !== id);
  save();
  renderProducts();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  renderChannelBanner();
  const published = data.videos.filter(v => v.stage === 'Published');
  let totalViews = 0, totalEarnings = 0;
  published.forEach(v => {
    totalViews    += Number(v.views) || 0;
    totalEarnings += (Number(v.adRevenue) || 0) + (Number(v.affiliate) || 0) + (Number(v.sponsor) || 0);
  });
  document.getElementById('stat-total').textContent    = published.length;
  document.getElementById('stat-views').textContent    = totalViews.toLocaleString();
  document.getElementById('stat-earnings').innerHTML   = `$${totalEarnings.toFixed(2)} <span>USD</span>`;

  const tbody = document.getElementById('stats-body');
  if (!published.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No published videos yet. Move a video to "Published" in the Pipeline tab.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = published.map(v => `<tr>
    <td style="color:#555;font-size:11px">${v.id}</td>
    <td>${escHtml(v.title)}${v.ytVideoId ? ` <a href="https://youtu.be/${escHtml(v.ytVideoId)}" target="_blank" style="font-size:11px">↗</a>` : ''}</td>
    <td style="color:#666;font-size:12px">${v.publishedDate || '—'}</td>
    <td><input type="number" min="0" value="${v.views || 0}" onchange="updateStat('${v.id}','views',this.value)" /></td>
    <td><input type="number" min="0" step="0.01" value="${v.adRevenue || 0}" onchange="updateStat('${v.id}','adRevenue',this.value)" /></td>
    <td><input type="number" min="0" step="0.01" value="${v.affiliate || 0}" onchange="updateStat('${v.id}','affiliate',this.value)" /></td>
    <td><input type="number" min="0" step="0.01" value="${v.sponsor || 0}" onchange="updateStat('${v.id}','sponsor',this.value)" /></td>
  </tr>`).join('');
}

function updateStat(id, field, val) {
  const v = data.videos.find(v => v.id === id);
  if (v) { v[field] = Number(val); save(); renderStats(); }
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderAuthState();
renderImportPanel();
renderKanban();
renderProducts();
