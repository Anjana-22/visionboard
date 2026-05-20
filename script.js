/* ══════════════════════════════════════════════
   DATA & CONSTANTS
══════════════════════════════════════════════ */
const CAT_COLORS = {
  Career:   { bg: '#E8E0D5', dot: '#A8906E' },
  Health:   { bg: '#D9E8DE', dot: '#6E9E7A' },
  Travel:   { bg: '#D5DFE8', dot: '#6E88A8' },
  Learning: { bg: '#E8D5E0', dot: '#A86E8D' },
  Personal: { bg: '#E8E5D5', dot: '#A89D6E' },
  Finance:  { bg: '#D5E8E5', dot: '#6EA8A0' },
};
const CAT_COLORS_DARK = {
  Career:   { bg: '#2E2820', dot: '#C4A882' },
  Health:   { bg: '#1E2E22', dot: '#7EC48A' },
  Travel:   { bg: '#1E2530', dot: '#7EA0C4' },
  Learning: { bg: '#2E1E28', dot: '#C47EA0' },
  Personal: { bg: '#2E2C1E', dot: '#C4B87E' },
  Finance:  { bg: '#1E2E2C', dot: '#7EC4BC' },
};
const CATEGORIES = ['All', 'Career', 'Health', 'Travel', 'Learning', 'Personal', 'Finance'];
const EMPTY_QUOTES = [
  '"Your future self is watching you right now through memories."',
  '"A goal without a plan is just a wish. Start here."',
  '"The vision board doesn\'t work unless you do."',
  '"One year from now, you\'ll wish you started today."',
  '"Dream it. Pin it. Live it."',
  '"Future you is rooting for present you. Don\'t let them down."',
];

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let items = loadItems();
let activeFilter = 'All';
let searchQuery = '';
let editingId = null;
let currentType = 'goal';
let uploadedImage = null;
let checklistItems = [{ text: '', done: false }];
let emptyQuoteIdx = 0;

function loadItems() {
  try { const r = localStorage.getItem('vb_items_v3'); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function save() { try { localStorage.setItem('vb_items_v3', JSON.stringify(items)); } catch {} }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function catColor(cat) { return (isDark() ? CAT_COLORS_DARK : CAT_COLORS)[cat] || { bg: '#F0EDE8', dot: '#9A8F82' }; }

/* ══════════════════════════════════════════════
   DARK MODE (init before render)
══════════════════════════════════════════════ */
(function () {
  const saved = localStorage.getItem('vb_theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme:dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

document.getElementById('themeToggle').addEventListener('click', () => {
  const isDk = isDark();
  document.documentElement.setAttribute('data-theme', isDk ? 'light' : 'dark');
  localStorage.setItem('vb_theme', isDk ? 'light' : 'dark');
  render();
});

/* ══════════════════════════════════════════════
   YEAR PROGRESS RING
══════════════════════════════════════════════ */
function updateYearRing() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  const pct = Math.round(((now - start) / (end - start)) * 100);
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (pct / 100) * circumference;

  const fill = document.getElementById('ringFill');
  if (fill) { fill.style.strokeDasharray = circumference; fill.style.strokeDashoffset = offset; }
  const pctEl = document.getElementById('ringPct');
  if (pctEl) pctEl.textContent = pct + '%';
  const daysEl = document.getElementById('ringDays');
  if (daysEl) daysEl.textContent = daysLeft + ' days left';
  const sub = document.getElementById('yearSubtitle');
  if (sub) sub.textContent = now.getFullYear() + ' · ' + pct + '% of the year gone';
}

/* ══════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════ */
function renderFilters() {
  const el = document.getElementById('filters');
  el.innerHTML = CATEGORIES.map(c => `
    <button class="filter-btn ${activeFilter === c ? 'active' : ''}" data-cat="${c}"
      aria-pressed="${activeFilter === c}">${c}</button>
  `).join('');
  el.querySelectorAll('.filter-btn').forEach(b =>
    b.addEventListener('click', () => { activeFilter = b.dataset.cat; render(); })
  );
}

function renderStats() {
  const total = items.length;
  const pinned = items.filter(i => i.pinned).length;
  const done = items.filter(i => i.type === 'checklist' && i.items && i.items.every(x => x.done)).length;
  document.getElementById('stats').innerHTML = [
    ['📋', total, 'Cards'],
    ['📌', pinned, 'Pinned'],
    ['✅', done, 'Completed'],
  ].map(([ic, v, l]) =>
    `<div class="stat-pill"><span class="stat-val">${ic} ${v}</span><span class="stat-lbl">${l}</span></div>`
  ).join('');
}

function deadlineLabel(dl) {
  if (!dl) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dl);
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: 'Overdue!', urgent: true };
  if (diff === 0) return { text: 'Due today!', urgent: true };
  if (diff <= 7) return { text: `${diff} days left`, urgent: true };
  return { text: `Due ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, urgent: false };
}

function checklistHTML(item) {
  if (!item.items || !item.items.length) return '';
  const total = item.items.length;
  const done = item.items.filter(x => x.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const rows = item.items.map((it, idx) => `
    <li class="${it.done ? 'checked' : ''}">
      <input type="checkbox" ${it.done ? 'checked' : ''} data-clid="${item.id}" data-idx="${idx}" aria-label="${esc(it.text)}"/>
      <span>${esc(it.text)}</span>
    </li>`).join('');
  return `<ul class="checklist" aria-label="Checklist">${rows}</ul>
    <div class="check-progress" aria-label="${done} of ${total} done">
      <div class="check-bar" style="width:${pct}%"></div>
    </div>`;
}

function deadlineHTML(item) {
  const dl = deadlineLabel(item.deadline);
  if (!dl) return '';
  return `<div class="deadline-info ${dl.urgent ? 'urgent' : ''}" role="status">
    <span class="dl-icon" aria-hidden="true">⏳</span>${esc(dl.text)}
  </div>`;
}

function cardHTML(item) {
  const cc = catColor(item.category);
  const isImageOnly = item.type === 'image' && item.image && !item.title && !item.note;
  const bgStyle = isImageOnly ? '' : `background:${cc.bg};`;

  let inner = '';

  if (item.image) {
    inner += `<img class="card-image ${item.type === 'image' ? 'tall' : 'short'}" src="${esc(item.image)}" alt="${esc(item.title || 'Vision image')}" loading="lazy"/>`;
  }

  if (item.title || item.note || item.type === 'checklist' || item.type === 'deadline') {
    inner += `<div class="card-body">
      ${item.pinned ? '<span class="pinned-badge" aria-label="Pinned">📌 Pinned</span>' : ''}
      <div class="card-category">
        <span class="cat-dot" style="background:${cc.dot}" aria-hidden="true"></span>
        <span class="cat-label" style="color:${cc.dot}">${esc(item.category)}</span>
      </div>
      ${item.title ? `<h3 class="card-title">${esc(item.title)}</h3>` : ''}
      ${item.note ? `<p class="card-note">${esc(item.note)}</p>` : ''}
      ${item.type === 'checklist' ? checklistHTML(item) : ''}
      ${item.type === 'deadline' && item.deadline ? deadlineHTML(item) : ''}
    </div>`;
  } else if (isImageOnly && item.pinned) {
    inner += `<span class="pinned-badge img-pin" aria-label="Pinned">📌 Pinned</span>`;
  }

  return `
    <div class="card-wrap" role="listitem">
      <div class="card ${item.pinned ? 'pinned' : ''}" style="${bgStyle}" data-id="${item.id}">
        <div class="card-actions" role="group" aria-label="Card actions">
          <button class="card-btn pin ${item.pinned ? 'active' : ''}" data-action="pin" data-id="${item.id}" aria-label="${item.pinned ? 'Unpin' : 'Pin'} card" title="${item.pinned ? 'Unpin' : 'Pin'}">📌</button>
          <button class="card-btn edit" data-action="edit" data-id="${item.id}" aria-label="Edit card" title="Edit">✏️</button>
          <button class="card-btn del" data-action="del" data-id="${item.id}" aria-label="Delete card" title="Delete">×</button>
        </div>
        ${inner}
      </div>
    </div>`;
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const list = items
    .filter(i => activeFilter === 'All' || i.category === activeFilter)
    .filter(i => !searchQuery ||
      (i.title || '').toLowerCase().includes(searchQuery) ||
      (i.note || '').toLowerCase().includes(searchQuery))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" role="status">
      <span class="empty-icon" aria-hidden="true"></span>
      <p class="empty-quote" id="emptyQuote">${EMPTY_QUOTES[emptyQuoteIdx]}</p>
      <p class="empty-hint">Your future self is waiting. Add a goal to get started.</p>
      <div class="empty-templates" aria-label="Quick start templates">
        <button class="tpl-btn" data-tpl="goal">🎯 Add a goal</button>
        <button class="tpl-btn" data-tpl="checklist">✅ Add a checklist</button>
        <button class="tpl-btn" data-tpl="deadline">⏳ Add a deadline</button>
        <button class="tpl-btn" data-tpl="image">🖼️ Add an image</button>
      </div>
    </div>`;
    grid.querySelectorAll('.tpl-btn').forEach(b =>
      b.addEventListener('click', () => openModalFresh(b.dataset.tpl))
    );
    return;
  }

  grid.innerHTML = list.map(cardHTML).join('');

  const actions = {
    pin: (id) => { items = items.map(i => i.id === id ? { ...i, pinned: !i.pinned } : i); save(); render(); },
    del: (id) => { if (!confirm('Remove this card from your board?')) return; items = items.filter(i => i.id !== id); save(); render(); },
    edit: (id) => { const item = items.find(i => i.id === id); if (item) openModalEdit(item); },
  };

  grid.querySelectorAll('.card-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (actions[action]) actions[action](id);
    });
  });

  grid.querySelectorAll('input[data-clid]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.clid;
      const idx = parseInt(cb.dataset.idx);
      const item = items.find(i => i.id === id);
      if (!item || !item.items) return;
      item.items[idx].done = cb.checked;
      if (item.items.every(x => x.done)) confetti();
      save(); render();
    });
  });
}

function render() { renderFilters(); renderStats(); renderGrid(); }

/* ══════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════ */
document.getElementById('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value.toLowerCase(); render();
});

/* ══════════════════════════════════════════════
   CONFETTI
══════════════════════════════════════════════ */
function confetti() {
  const colors = ['#A89060', '#D4B896', '#6E9E7A', '#6E88A8', '#A86E8D', '#F0EBE2', '#3C3228'];
  for (let i = 0; i < 55; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left:${Math.random() * 100}vw;
      width:${6 + Math.random() * 8}px;
      height:${6 + Math.random() * 8}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration:${1.2 + Math.random() * 1.6}s;
      animation-delay:${Math.random() * .4}s;
      transform:rotate(${Math.random() * 360}deg);
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

/* ══════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════ */
const overlay = document.getElementById('modalOverlay');

function openModalFresh(type = 'goal') {
  editingId = null;
  uploadedImage = null;
  checklistItems = [{ text: '', done: false }];
  setType(type);
  document.getElementById('modalTitle').textContent = 'Add to Board';
  overlay.classList.remove('hidden');
  setTimeout(() => document.querySelector('.field')?.focus(), 80);
}

function openModalEdit(item) {
  editingId = item.id;
  uploadedImage = item.image || null;
  checklistItems = item.items ? JSON.parse(JSON.stringify(item.items)) : [{ text: '', done: false }];
  document.getElementById('modalTitle').textContent = 'Edit Card';
  setType(item.type, item);
  overlay.classList.remove('hidden');
}

function closeModal() { overlay.classList.add('hidden'); editingId = null; }

document.getElementById('openModal').addEventListener('click', () => openModalFresh());
document.getElementById('closeModal').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

document.querySelectorAll('.type-tab').forEach(tab => {
  tab.addEventListener('click', () => setType(tab.dataset.type));
});

function setType(type, prefill = null) {
  currentType = type;
  document.querySelectorAll('.type-tab').forEach(t => {
    const active = t.dataset.type === type;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active);
  });
  renderForm(prefill);
}

/* ══════════════════════════════════════════════
   FORM RENDERING
══════════════════════════════════════════════ */
function categorySelect(val = 'Personal') {
  return `<select class="field" id="fCategory" aria-label="Category">
    ${Object.keys(CAT_COLORS).map(c => `<option ${c === val ? 'selected' : ''}>${c}</option>`).join('')}
  </select>`;
}

function renderForm(prefill = null) {
  const fg = document.getElementById('formGroup');
  const p = prefill || {};
  let html = '';

  if (currentType === 'goal') {
    html = `
      <input class="field" id="fTitle" placeholder="Goal title *" value="${esc(p.title || '')}" aria-label="Goal title" aria-required="true"/>
      <textarea class="field" id="fNote" placeholder="Add a note or intention…" aria-label="Note">${esc(p.note || '')}</textarea>
      ${categorySelect(p.category)}`;

  } else if (currentType === 'image') {
    html = `
      <div class="upload-zone" id="uploadZone" role="button" tabindex="0" aria-label="Upload image">
        <span id="uploadLabel">📁 Click to upload an image</span>
        <img id="uploadPreview" class="upload-preview-img" alt="preview" ${uploadedImage ? `src="${uploadedImage}" style="display:block"` : ''}/>
        <input type="file" id="fileInput" accept="image/*" style="display:none" aria-hidden="true"/>
      </div>
      <div class="divider-text">— or paste a URL —</div>
      <input class="field" id="fUrl" placeholder="https://…" value="${esc(p.image && !p.image.startsWith('data:') ? p.image : '')}" aria-label="Image URL"/>
      <input class="field" id="fTitle" placeholder="Caption (optional)" value="${esc(p.title || '')}" aria-label="Caption"/>
      ${categorySelect(p.category)}`;

  } else if (currentType === 'checklist') {
    html = `
      <input class="field" id="fTitle" placeholder="Checklist title *" value="${esc(p.title || '')}" aria-label="Checklist title" aria-required="true"/>
      <div class="checklist-builder" id="clBuilder" aria-label="Checklist items">
        ${checklistItems.map((it, i) => checkItemRow(it.text, i)).join('')}
      </div>
      <button class="btn-add-item" id="addItemBtn" type="button" aria-label="Add checklist item">+ Add item</button>
      ${categorySelect(p.category)}`;

  } else if (currentType === 'deadline') {
    html = `
      <input class="field" id="fTitle" placeholder="Goal title *" value="${esc(p.title || '')}" aria-label="Goal title" aria-required="true"/>
      <textarea class="field" id="fNote" placeholder="Notes (optional)" aria-label="Notes">${esc(p.note || '')}</textarea>
      <div>
        <div class="field-label">Deadline</div>
        <input class="field" id="fDeadline" type="date" value="${p.deadline || ''}" aria-label="Deadline date"/>
      </div>
      ${categorySelect(p.category)}`;
  }

  html += `<button class="btn-submit" id="submitCard">${editingId ? 'Save Changes' : 'Pin to Board '}</button>`;
  fg.innerHTML = html;

  if (currentType === 'image') {
    const zone = document.getElementById('uploadZone');
    const fi = document.getElementById('fileInput');
    const prev = document.getElementById('uploadPreview');
    const lbl = document.getElementById('uploadLabel');
    if (uploadedImage) { lbl.style.display = 'none'; prev.style.display = 'block'; }
    zone.addEventListener('click', () => fi.click());
    zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fi.click(); });
    fi.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => { uploadedImage = ev.target.result; prev.src = uploadedImage; prev.style.display = 'block'; lbl.style.display = 'none'; };
      reader.readAsDataURL(f);
    });
  }

  if (currentType === 'checklist') {
    bindChecklistBuilder();
    document.getElementById('addItemBtn').addEventListener('click', () => {
      checklistItems.push({ text: '', done: false });
      document.getElementById('clBuilder').insertAdjacentHTML('beforeend', checkItemRow('', checklistItems.length - 1));
      bindChecklistBuilder();
    });
  }

  document.getElementById('submitCard').addEventListener('click', submitCard);
}

function checkItemRow(text, i) {
  return `<div class="check-item-row" data-row="${i}">
    <input class="field cl-text" placeholder="Item ${i + 1}" value="${esc(text)}" data-idx="${i}" aria-label="Checklist item ${i + 1}"/>
    <button class="btn-remove-item" data-del="${i}" aria-label="Remove item ${i + 1}" type="button">×</button>
  </div>`;
}

function bindChecklistBuilder() {
  const builder = document.getElementById('clBuilder');
  if (!builder) return;
  builder.querySelectorAll('.cl-text').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.dataset.idx);
      if (checklistItems[idx]) checklistItems[idx].text = inp.value;
    });
  });
  builder.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.del);
      checklistItems.splice(idx, 1);
      if (!checklistItems.length) checklistItems = [{ text: '', done: false }];
      builder.innerHTML = checklistItems.map((it, i) => checkItemRow(it.text, i)).join('');
      bindChecklistBuilder();
    });
  });
}

/* ══════════════════════════════════════════════
   SUBMIT
══════════════════════════════════════════════ */
function submitCard() {
  const title = (document.getElementById('fTitle')?.value || '').trim();
  const note = (document.getElementById('fNote')?.value || '').trim();
  const category = document.getElementById('fCategory')?.value || 'Personal';
  const url = (document.getElementById('fUrl')?.value || '').trim();
  const deadline = document.getElementById('fDeadline')?.value || '';
  const image = uploadedImage || url || null;

  if (!title && currentType !== 'image') { shake(document.getElementById('fTitle')); return; }
  if (currentType === 'image' && !image) { shake(document.getElementById('uploadZone')); return; }

  const newItem = {
    id: editingId || Date.now().toString(),
    type: currentType, title, note, category, image,
    pinned: editingId ? (items.find(i => i.id === editingId)?.pinned || false) : false,
    ...(currentType === 'checklist' ? { items: checklistItems.filter(i => i.text.trim()) } : {}),
    ...(currentType === 'deadline' ? { deadline } : {}),
  };

  if (editingId) {
    items = items.map(i => i.id === editingId ? newItem : i);
  } else {
    items.unshift(newItem);
  }
  save(); closeModal(); render();
}

/* ══════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════ */
function shake(el) {
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = 'shake .3s ease';
}

/* rotating empty quote */
setInterval(() => {
  const q = document.getElementById('emptyQuote');
  if (!q) return;
  emptyQuoteIdx = (emptyQuoteIdx + 1) % EMPTY_QUOTES.length;
  q.style.opacity = '0';
  setTimeout(() => { if (q) { q.textContent = EMPTY_QUOTES[emptyQuoteIdx]; q.style.opacity = '1'; } }, 400);
}, 4000);

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
updateYearRing();
render();
