'use strict';
/* =====================================================================
   Utilities: math, formatting, toasts, modals, charts, module registry
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function weighted(items, w = (x) => x.w) {
  const total = items.reduce((s, x) => s + w(x), 0);
  let r = Math.random() * total;
  for (const x of items) { r -= w(x); if (r <= 0) return x; }
  return items[items.length - 1];
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n, short = true) {
  const neg = n < 0; n = Math.abs(n);
  let s;
  if (short && n >= 1e12) s = (n / 1e12).toFixed(2) + 'T';
  else if (short && n >= 1e9) s = (n / 1e9).toFixed(2) + 'B';
  else if (short && n >= 1e6) s = (n / 1e6).toFixed(2) + 'M';
  else if (n < 100 && Math.round(n * 100) % 100 !== 0) s = n.toFixed(2);
  else s = Math.round(n).toLocaleString('en-US');
  return (neg ? '-$' : '$') + s;
}
function price(n) {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  return '$' + n.toPrecision(3);
}
const pct = (n, d = 1) => (n * 100).toFixed(d) + '%';
const signPct = (n) => (n >= 0 ? '+' : '') + pct(n, 2);
const signMoney = (n) => (n > 0 ? '+' : '') + money(n);
const cls = (n) => (n > 0.0001 ? 'good' : n < -0.0001 ? 'bad' : 'muted');
const fmtQty = (n) => (n >= 1000 ? Math.round(n).toLocaleString('en-US') : n >= 1 ? +n.toFixed(3) + '' : n > 0 ? n.toPrecision(4) : '0');
const fmtInt = (n) => Math.floor(n).toLocaleString('en-US');
function bar(v, color = 'var(--accent)', max = 100) {
  return `<div class="bar"><div style="width:${clamp(v / max * 100, 0, 100)}%;background:${color}"></div></div>`;
}
function barline(label, v, color) {
  return `<div class="barline"><span class="muted">${label}</span>${bar(v, color)}<span class="num right">${Math.round(v)}</span></div>`;
}
function btn(label, act, a = '', opts = {}) {
  const attrs = [`class="btn ${opts.cls || ''}"`, `data-act="${act}"`];
  if (a !== '') attrs.push(`data-a="${esc(a)}"`);
  if (opts.b !== undefined) attrs.push(`data-b="${esc(opts.b)}"`);
  if (opts.disabled) attrs.push('disabled');
  if (opts.title) attrs.push(`title="${esc(opts.title)}"`);
  return `<button ${attrs.join(' ')}>${label}</button>`;
}
function seg(options, current, act) {
  return `<div class="seg">${options.map(([v, l]) => btn(l, act, v, { cls: 'sm ' + (String(v) === String(current) ? 'on' : '') })).join('')}</div>`;
}

/* ---------------------------- Module registry ---------------------------- */
const ACT = {};          // action name -> handler(a, b, el)
const MODS = [];         // simulation modules, run in order each day
const TABS = [];         // navigation tabs
function registerModule(m) {
  MODS.push(m);
  if (m.actions) Object.assign(ACT, m.actions);
  if (m.tabs) TABS.push(...m.tabs);
}

/* ---------------------------- Toasts ---------------------------- */
function toast(msg, type = '') {
  const box = $('#toasts');
  if (!box) return;
  const mode = typeof S !== 'undefined' && S && S.meta ? S.meta.notify : 'all';
  if ((mode === 'important' && !type) || (mode === 'off' && type !== 'bad')) return;
  if (typeof playSound === 'function') playSound(type);
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = msg;
  box.appendChild(el);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => el.remove(), 4500);
}

/* ---------------------------- Modals ---------------------------- */
const modalQ = [];
function showModal(m) {
  modalQ.push(m);
  if (modalQ.length === 1) drawModal();
}
function drawModal() {
  const el = $('#modal');
  if (!modalQ.length) { el.hidden = true; el.innerHTML = ''; return; }
  const m = modalQ[0];
  const buttons = m.buttons || [{ label: 'OK', cls: 'primary' }];
  el.hidden = false;
  el.innerHTML = `<div class="modal-box ${m.cls || ''}" role="dialog" aria-modal="true">
    <h2>${m.title}</h2><div class="modal-body">${m.body || ''}</div>
    <div class="modal-btns">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-mi="${i}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('')}</div></div>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mi]');
  if (!b || !modalQ.length) return;
  const m = modalQ.shift();
  const def = (m.buttons || [{}])[+b.dataset.mi];
  drawModal();
  if (def && def.fn) def.fn();
  if (typeof render === 'function') render(true);
});

/* ---------------------------- Charts ---------------------------- */
function chart(key, data, h = 120, opts = {}) {
  UI.charts[key] = { data: data.slice(), opts };
  return `<canvas class="chart" data-chart="${key}" style="height:${h}px"></canvas>`;
}
function drawCharts(root = document) {
  root.querySelectorAll('canvas[data-chart]').forEach((c) => {
    const d = UI.charts[c.dataset.chart];
    if (d) drawLine(c, d.data, d.opts);
  });
}
function drawLine(c, data, opts = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);
  if (data.length < 2) {
    g.fillStyle = '#8b95a7'; g.font = '12px system-ui'; g.fillText('Not enough data yet', 8, h / 2);
    return;
  }
  let mn = Math.min(...data), mx = Math.max(...data);
  if (mx === mn) { mx += Math.abs(mx) * 0.01 + 1; mn -= Math.abs(mn) * 0.01 + 1; }
  const padR = opts.labels ? 64 : 2, padY = 6;
  const X = (i) => (i / (data.length - 1)) * (w - padR - 2) + 1;
  const Y = (v) => padY + (1 - (v - mn) / (mx - mn)) * (h - padY * 2);
  const up = data[data.length - 1] >= data[0];
  const col = opts.color || (up ? '#2ecc71' : '#ff5a5f');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, col + '55'); grad.addColorStop(1, col + '00');
  g.beginPath();
  data.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
  g.lineTo(X(data.length - 1), h); g.lineTo(X(0), h); g.closePath();
  g.fillStyle = grad; g.fill();
  g.beginPath();
  data.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
  g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
  if (opts.labels) {
    const f = opts.fmt || price;
    g.fillStyle = '#8b95a7'; g.font = '11px system-ui';
    g.fillText(f(mx), w - padR + 6, padY + 8);
    g.fillText(f(mn), w - padR + 6, h - padY);
    g.fillStyle = col;
    g.fillText(f(data[data.length - 1]), w - padR + 6, clamp(Y(data[data.length - 1]) + 4, 20, h - 18));
  }
  if (opts.zero && mn < 0 && mx > 0) {
    g.strokeStyle = '#2a3342'; g.setLineDash([4, 4]); g.beginPath();
    g.moveTo(0, Y(0)); g.lineTo(w - padR, Y(0)); g.stroke(); g.setLineDash([]);
  }
}
