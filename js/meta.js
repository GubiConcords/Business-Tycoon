'use strict';
/* =====================================================================
   Meta: difficulty & scenarios, aging, heirs & legacy, timeline &
   statistics, quest chain & guided mode, inbox, "needs attention",
   save slots, export/import and sound.
   ===================================================================== */
const LEGACY_KEY = 'business-tycoon-legacy';
const YEAR_DAYS = 180;
const DIFFICULTY = {
  easy: { name: 'Easy', cash: 20000, desc: '$20K to start' },
  normal: { name: 'Normal', cash: 5000, desc: '$5K to start' },
  hard: { name: 'Hard', cash: 1000, desc: '$1K to start, in the middle of a recession' },
};
const SCENARIOS = {
  sandbox: { name: 'Sandbox', icon: '🏖️', desc: 'No goals, no deadline. Build whatever you like.' },
  billion: { name: 'Billion in 1,500 days', icon: '💰', desc: 'Reach a $1B net worth within 1,500 days.', days: 1500, win: () => netWorth() >= 1e9 },
  green: { name: 'Green Tycoon', icon: '🌿', desc: 'Reach $100M with an ESG score of 70+ within 1,200 days.', days: 1200, win: () => netWorth() >= 1e8 && S.co2.esg >= 70 },
  comeback: { name: 'The Comeback', icon: '🔥', desc: 'Start with $2M in cash but $3M of debt. Reach $50M within 600 days.', days: 600, win: () => netWorth() >= 5e7, setup: () => { S.cash = 2e6; S.bank.loan = 3e6; } },
  rivals: { name: 'King of the Hill', icon: '👑', desc: 'Be #1 on the rivals leaderboard within 900 days.', days: 900, win: () => TYCOONS.every((r) => RS()[r.id].acquired || RS()[r.id].nw < netWorth()) && netWorth() > 1e7 },
};
const HEIR_TRAITS = {
  prodigy: { name: 'Business prodigy', icon: '🧠', desc: '+15 max energy' },
  diplomat: { name: 'Born diplomat', icon: '🤝', desc: '+15 relations with every company and government' },
  engineer: { name: 'Engineer', icon: '🔧', desc: '+20% AI research' },
  frugal: { name: 'Frugal', icon: '🪙', desc: 'Living costs −50%' },
  charmer: { name: 'Charmer', icon: '😎', desc: '+15 business reputation' },
};
const QUESTS = [
  ['Do a quick hustle on the Dashboard', () => S.stats.hustles > 0, 100, 'dash'],
  ['Work 50 clicks at your 9–5 job', () => S.job.clicks >= 50, 100, 'job'],
  ['Open your first restaurant (a food truck is cheapest)', () => S.restaurants.length > 0, 500, 'resto'],
  ['Hire a cook', () => S.restaurants.some((r) => r.staff.cook > 0), 300, 'resto'],
  ['Buy your first stock', () => S.stats.trades > 0, 300, 'stocks'],
  ['Reach a $25K net worth', () => netWorth() >= 25000, 1000, 'dash'],
  ['Open a scrapyard or a factory', () => S.yard.owned || S.factories.length > 0, 2000, 'factories'],
  ['Buy a property', () => S.re.props.length > 0, 3000, 'realestate'],
  ['Reach a $250K net worth', () => netWorth() >= 250000, 5000, 'dash'],
  ['Design your first product in the Design Studio', () => S.stats.designs > 0, 10000, 'factories'],
  ['Hire a division chief', () => S.stats.execsHired > 0, 10000, 'people'],
  ['Build a power plant', () => S.power.plants.length > 0, 20000, 'energy'],
  ['Sign a supply contract', () => S.deals.done + S.deals.active.length > 0, 20000, 'deals'],
  ['Reach a $5M net worth', () => netWorth() >= 5e6, 50000, 'dash'],
  ['Found a holding company', () => S.corp.founded, 50000, 'corp'],
  ['Train an AI model', () => S.stats.aiModels > 0, 100000, 'ai'],
  ['Take your company public (IPO)', () => S.corp.public, 500000, 'corp'],
  ['Pass a rival on the leaderboard', () => TYCOONS.some((r) => netWorth() > RS()[r.id].nw), 1000000, 'rivals'],
  ['Found a space agency', () => S.space.founded, 5000000, 'space'],
  ['Become a billionaire', () => netWorth() >= 1e9, 50000000, 'dash'],
];
// guided mode: which tabs are visible when (quest index reached, or net worth)
const TAB_UNLOCK = {
  resto: [2], stocks: [4], crypto: [4], bank: [5], taxes: [5], casino: [5], startups: [5, 20000], yard: [6], factories: [6],
  realestate: [7], racing: [8, 100000], fleet: [8, 100000], legal: [9, 250000], deals: [9, 250000], people: [9, 250000], logistics: [9, 250000],
  energy: [9, 250000], co2: [9, 250000], politics: [9, 250000], ai: [13, 1e6], corp: [13, 1e6], media: [13, 1e6], rivals: [13, 1e6], space: [17, 5e7],
};
const TAB_GROUPS = [
  ['Overview', ['dash', 'inbox', 'stats', 'log', 'settings']],
  ['Earn & invest', ['job', 'stocks', 'crypto', 'startups', 'bank', 'corp']],
  ['Businesses', ['resto', 'factories', 'energy', 'yard', 'realestate', 'logistics', 'media']],
  ['Big ventures', ['ai', 'space', 'deals', 'rivals', 'people']],
  ['Government', ['politics', 'co2', 'taxes', 'legal']],
  ['Lifestyle & fun', ['fleet', 'racing', 'casino']],
];

const MT = () => S.meta;
const age = () => MT().age0 + (S.day - MT().born) / YEAR_DAYS;
const heirTrait = (k) => MT().trait === k;
function timeline(icon, text) {
  if (!S.meta) return;
  MT().timeline.unshift({ d: S.day, icon, text });
  if (MT().timeline.length > 300) MT().timeline.length = 300;
}
function tabUnlocked(id) {
  if (!S.meta || !MT().guided) return true;
  const r = TAB_UNLOCK[id];
  if (!r) return true;
  return MT().quest >= r[0] || (r[1] !== undefined && netWorth() >= r[1]);
}
function legacy() {
  try { return JSON.parse(localStorage.getItem(LEGACY_KEY)) || { points: 0, runs: 0, best: 0 }; } catch (e) { return { points: 0, runs: 0, best: 0 }; }
}
function addLegacy(nw) {
  const L = legacy();
  L.points += Math.max(0, Math.floor(Math.log10(Math.max(1, nw))) - 3);
  L.runs++; L.best = Math.max(L.best, nw);
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(L)); } catch (e) { /* ignore */ }
  return L;
}

/* ---------------------------- Sound ---------------------------- */
let audioCtx = null;
function playSound(type) {
  if (!S || !S.meta || !MT().sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    const f = type === 'good' ? [660, 880] : type === 'bad' ? [300, 200] : [520, 520];
    o.frequency.setValueAtTime(f[0], audioCtx.currentTime);
    o.frequency.linearRampToValueAtTime(f[1], audioCtx.currentTime + 0.12);
    g.gain.setValueAtTime(0.05, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.25);
  } catch (e) { /* audio unavailable */ }
}

/* ---------------------------- Aging & succession ---------------------------- */
function succession(reason) {
  const heirs = Array.from({ length: 3 }, () => ({ name: `${pick(FIRST)} ${pick(['Jr.', 'II', 'III', ''])}`.trim(), age: randInt(24, 35), trait: pick(Object.keys(HEIR_TRAITS)) }));
  const nw = Math.max(0, netWorth()), tax = nw * (MT().trust ? 0.05 : 0.2);
  showModal({
    title: reason === 'death' ? '🕯️ The founder has passed away' : '🌅 Time to retire',
    cls: reason === 'death' ? 'danger' : '',
    body: `<p>${reason === 'death' ? `At ${Math.floor(age())}, you passed away. ` : ''}Your empire goes to an heir. Inheritance tax: <b>${money(tax)}</b> (${MT().trust ? '5% thanks to your family trust' : '20%. A family trust would cut it to 5%'}).</p><p>Choose your successor:</p>`,
    buttons: heirs.map((h) => ({ label: `${HEIR_TRAITS[h.trait].icon} ${esc(h.name)}, age ${h.age}: ${HEIR_TRAITS[h.trait].name} (${HEIR_TRAITS[h.trait].desc})`, cls: 'primary', fn: () => inherit(h, tax, nw) })),
  });
}
function inherit(h, tax, nw) {
  const m = MT();
  spend(tax, 'Inheritance tax');
  const L = addLegacy(nw);
  m.generation++; m.age0 = h.age; m.born = S.day; m.trait = h.trait; m.heirName = h.name;
  if (h.trait === 'diplomat') for (const k in S.deals.rel) S.deals.rel[k] = clamp(S.deals.rel[k] + 15, 0, 100);
  if (h.trait === 'charmer') S.deals.rep = clamp(S.deals.rep + 15, 0, 100);
  timeline('👑', `${h.name} took over (generation ${m.generation})`);
  log(`👑 ${esc(h.name)} inherits the empire. Generation ${m.generation} begins. (+${L.points} legacy points in total)`, 'good');
}

registerModule({
  id: 'meta',
  init(s) {
    s.meta = {
      difficulty: 'normal', scenario: 'sandbox', scenarioDone: false, guided: false, quest: 0, qdone: {}, unlocked: {},
      age0: 25, born: 1, generation: 1, trait: null, heirName: '', trust: false, timeline: [], snapshots: [],
      notify: 'all', sound: false, inboxSeen: 0,
    };
  },
  daily() {
    const m = MT();
    // goals can be completed in any order; the next open one is shown on the dashboard
    QUESTS.forEach(([text, check, reward], i) => {
      if (m.qdone[i] || !check()) return;
      m.qdone[i] = S.day;
      earn(reward, 'Quests');
      log(`🎯 Goal complete: ${text} (+${money(reward)})`, 'good');
      toast(`🎯 Goal complete! +${money(reward)}`, 'good');
    });
    m.quest = Object.keys(m.qdone).length;
    if (m.guided) for (const t of TABS) if (!m.unlocked[t.id] && tabUnlocked(t.id)) { m.unlocked[t.id] = true; if (TAB_UNLOCK[t.id]) toast(`🔓 New tab unlocked: ${t.icon} ${t.name}`, 'good'); }
    // weekly snapshot of where your money is
    if (S.day % 7 === 0) {
      m.snapshots.push({ d: S.day, a: assets() });
      if (m.snapshots.length > 104) m.snapshots.shift();
    }
    // scenario
    const sc = SCENARIOS[m.scenario];
    if (sc.days && !m.scenarioDone) {
      if (sc.win()) {
        m.scenarioDone = 'won'; stat('scenariosWon');
        timeline('🏆', `Scenario won: ${sc.name}`);
        showModal({ title: `🏆 Scenario complete: ${sc.name}!`, cls: 'good', body: `<p>You did it in ${S.day} days. Keep playing as long as you like.</p>` });
      } else if (S.day > sc.days) {
        m.scenarioDone = 'lost';
        showModal({ title: `⏰ Time's up: ${sc.name}`, cls: 'danger', body: '<p>You missed the deadline, but your empire lives on. Keep playing in sandbox mode.</p>' });
      }
    }
    // aging
    const a = age();
    if (a >= 65 && chance(0.0005 * Math.pow((a - 60) / 10, 2) * ({ mansion: 0.6, house: 0.8 }[S.life.tier] || 1))) succession('death');
  },
  tabs: [
    { id: 'inbox', name: 'Inbox', icon: '📬', render: renderInbox },
    { id: 'stats', name: 'Stats & History', icon: '📈', render: renderStats },
    { id: 'settings', name: 'Settings & Saves', icon: '⚙️', render: renderSettings },
  ],
  actions: {
    retire() { if (age() >= 50) succession('retire'); },
    familyTrust() {
      const cost = Math.round(5000000 + Math.max(0, netWorth()) * 0.01);
      if (MT().trust || !pay(cost, 'Legal', 'the family trust')) return;
      MT().trust = true;
      toast('🏰 Family trust set up: inheritance tax cut to 5%.', 'good');
    },
    setNotify(a) { MT().notify = a; },
    toggleSound() { MT().sound = !MT().sound; if (MT().sound) playSound('good'); },
    toggleGuided() { MT().guided = !MT().guided; },
    saveSlot(n) { saveToSlot(+n); },
    loadSlot(n) {
      showModal({ title: `Load slot ${n}?`, body: '<p>Unsaved progress in your current game will be lost.</p>', buttons: [{ label: 'Load', cls: 'danger', fn: () => loadFromSlot(+n) }, { label: 'Cancel' }] });
    },
    deleteSlot(n) { try { localStorage.removeItem(`${SAVE_KEY}-slot-${n}`); } catch (e) { /* ignore */ } },
    exportSave() {
      const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `business-tycoon-day-${S.day}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return false;
    },
    importSave() { $('#import-file').click(); return false; },
    markRead() { MT().inboxSeen = S.logCount || 0; },
    ngSet(k, v) { UI.ng[k] = v; if (modalQ.length) { modalQ[0].body = newGameBody(); drawModal(); } return false; },
    goQuest() { const q = nextQuest(); if (q && tabUnlocked(q[3])) UI.tab = q[3]; },
  },
});
UI.ng = { difficulty: 'normal', scenario: 'sandbox', guided: 'on' };

function slotInfo(n) {
  try { const r = localStorage.getItem(`${SAVE_KEY}-slot-${n}`); if (!r) return null; const d = JSON.parse(r); return { day: d.day, nw: d.history ? d.history[d.history.length - 1] : 0, gen: d.meta ? d.meta.generation : 1 }; } catch (e) { return null; }
}
function saveToSlot(n) {
  try { localStorage.setItem(`${SAVE_KEY}-slot-${n}`, JSON.stringify(S)); toast(`💾 Saved to slot ${n}.`, 'good'); } catch (e) { toast('Could not save (storage full or blocked).', 'bad'); }
}
function loadFromSlot(n) {
  try {
    const raw = localStorage.getItem(`${SAVE_KEY}-slot-${n}`);
    if (!raw) return;
    replaceState(JSON.parse(raw));
    toast(`📂 Loaded slot ${n}.`, 'good');
  } catch (e) { toast('That save is corrupted.', 'bad'); }
}
function replaceState(obj) {
  const s = deepMerge(newState(), obj);
  for (const m of MODS) if (m.migrate) m.migrate(s);
  S = s;
  UI.gameOver = false;
  save();
  render(true);
}
document.addEventListener('change', (e) => {
  if (e.target.id !== 'import-file' || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => { try { replaceState(JSON.parse(r.result)); toast('📥 Save imported!', 'good'); } catch (err) { toast('That file is not a valid save.', 'bad'); } };
  r.readAsText(e.target.files[0]);
  e.target.value = '';
});

function attentionItems() {
  const items = [];
  const add = (icon, text, tab) => items.push({ icon, text, tab });
  for (const r of S.restaurants) {
    if (r.unpaid) add('💸', `${esc(r.name)}: staff wages unpaid`, 'resto');
    else if (!r.staff.cook && !r.selfShift && r.closed <= 0) add('👨‍🍳', `${esc(r.name)} has no cooks`, 'resto');
  }
  const stuck = S.factories.filter((f) => f.last && /^(Out of|Idle|Could not)/.test(f.last.note));
  if (stuck.length) add('🏭', `${stuck.length} factor${stuck.length > 1 ? 'ies are' : 'y is'} stalled or idle`, 'factories');
  const unc = S.designs.filter((d) => d.status === 'uncertified');
  if (unc.length) add('📋', `${unc.length} design(s) waiting for certification`, 'factories');
  const struck = S.deals.active.filter((c) => c.strikes > 0);
  if (struck.length) add('⚠️', `${struck.length} contract(s) have missed deliveries`, 'deals');
  const vacant = S.re.props.filter((p) => !p.tenant && p.vacant > 10);
  if (vacant.length) add('🏚️', `${vacant.length} propert${vacant.length > 1 ? 'ies' : 'y'} vacant for 10+ days`, 'realestate');
  const fixed = ['Rent', 'Utilities', 'Insurance', 'Wages', 'Living costs', 'Legal', 'Media'].reduce((t, k) => t - (S.lastLedger[k] || 0), 0);
  if (fixed > 0 && S.cash < fixed * 2) add('🪫', `Cash (${money(S.cash)}) barely covers 2 days of fixed costs (${money(fixed)}/day)`, 'dash');
  if (S.bank.loan > loanLimit() * 0.8) add('🏦', 'Your loan is close to the credit limit', 'bank');
  if (S.tax.risk > 50) add('🕵️', `Audit risk is ${Math.round(S.tax.risk)}%`, 'taxes');
  if (weekEstimate() > 0) add('🌫️', `Carbon bill this week: ~${money(weekEstimate())}`, 'co2');
  if (S.ai.training && totalPF() - S.ai.alloc.contracts - S.ai.alloc.agents - S.ai.alloc.serving <= 0.01) add('🧠', 'Your AI model is training with no spare compute', 'ai');
  for (const [d, e] of Object.entries(S.people.execs)) if (e && e.loyalty < 25) add('👔', `${esc(e.name)} (${DIVISIONS[d].name}) is about to quit`, 'people');
  if (S.world.event) add(WORLD_EVENTS[S.world.event].icon, `${WORLD_EVENTS[S.world.event].name}: ${S.world.eventLeft} days left`, 'politics');
  if (daysToElection() <= CAMPAIGN_DAYS) add('🗳️', `Election in ${daysToElection()} days: campaign donations are open`, 'politics');
  if (S.corp.bank.open && S.corp.bank.capital / Math.max(1, S.corp.bank.loans) < 0.1) add('🏦', 'Your bank is thinly capitalized: bank run risk', 'corp');
  if (S.corp.public && S.corp.approval < 40) add('📢', 'Shareholders are unhappy', 'corp');
  if (age() >= 70) add('🧓', `You are ${Math.floor(age())}. Plan your succession (Settings).`, 'settings');
  return items;
}
function renderAttention() {
  const items = attentionItems();
  return `<div class="card"><h3>🔔 Needs attention</h3>${items.length ? items.slice(0, 8).map((i) => `<div class="list-item"><span>${i.icon}</span><div class="grow small">${i.text}</div>${btn('Go', 'tab', i.tab, { cls: 'sm' })}</div>`).join('') : '<p class="muted small">All good. Nothing urgent.</p>'}</div>`;
}
const nextQuest = () => QUESTS.find((q, i) => !MT().qdone[i]);
function renderQuest() {
  const q = nextQuest();
  return `<div class="card hl"><h3>🎯 Next goal (${MT().quest}/${QUESTS.length} done)</h3>${q ? `<p>${q[0]}</p><p class="small muted">Reward: ${money(q[2])}</p>${btn('Show me', 'goQuest', '', { cls: 'sm primary' })}` : '<p class="good">You completed every goal. Legendary!</p>'}
    <p class="small muted" style="margin-top:6px">${SCENARIOS[MT().scenario].icon} ${SCENARIOS[MT().scenario].name}${SCENARIOS[MT().scenario].days ? ` · ${MT().scenarioDone ? (MT().scenarioDone === 'won' ? '✅ won' : '❌ failed') : `${SCENARIOS[MT().scenario].days - S.day} days left`}` : ''} · ${DIFFICULTY[MT().difficulty].name} · Gen ${MT().generation}, age ${Math.floor(age())}</p></div>`;
}
const unreadCount = () => Math.min(99, Math.max(0, (S.logCount || 0) - MT().inboxSeen));

function renderInbox() {
  const n = unreadCount();
  const important = S.log.filter((l) => l.type === 'bad' || l.type === 'good' || l.type === 'warn');
  return `<div class="row between section"><h2>📬 Inbox</h2>${btn(`Mark all read (${n})`, 'markRead', '', { cls: 'sm' })}</div>
  <div class="grid g2">${renderAttention()}<div class="card"><h3>Important messages</h3><div class="log">${important.slice(0, 80).map((l, i) => `<div class="log-line ${l.type}">${i < n ? '🔵 ' : ''}<span class="d">Day ${l.d}</span>${l.msg}</div>`).join('') || '<p class="muted">Nothing yet.</p>'}</div></div></div>`;
}

function renderStats() {
  const m = MT(), snaps = m.snapshots, now = assets();
  const ago = (d) => { const s = snaps.filter((x) => x.d <= S.day - d); return s.length ? s[s.length - 1].a : null; };
  const a30 = ago(30), a90 = ago(90);
  const keys = Object.keys(now).filter((k) => Math.abs(now[k]) >= 1 || (a90 && Math.abs(a90[k] || 0) >= 1));
  const STAT_LABELS = { meals: 'Meals served', trades: 'Trades', races: 'Races', raceWins: 'Race wins', scrapped: 'Cars scrapped', launches: 'Rocket launches', designs: 'Designs completed', shipments: 'Export shipments', bets: 'Casino bets', aiModels: 'AI models trained', stars: 'Restaurant stars earned', officesWon: 'Elections won', takeovers: 'Takeovers', rivalsAcquired: 'Rivals acquired', plantsBuilt: 'Power plants built', execsHired: 'Executives hired' };
  return `<h2 class="section">📈 Stats &amp; History</h2>
  <div class="card section"><h3>Net worth</h3>${chart('nw2', S.history, 160, { labels: true, fmt: (v) => money(v) })}</div>
  <div class="grid g2 section">
    <div class="card"><h3>Where your wealth is</h3><div class="tbl-wrap"><table><thead><tr><th>Category</th><th class="num">Now</th><th class="num">30 days ago</th><th class="num">90 days ago</th></tr></thead><tbody>
      ${keys.map((k) => `<tr><td>${ASSET_LABELS[k] || k}</td><td class="num ${now[k] < 0 ? 'bad' : ''}">${money(now[k] || 0)}</td><td class="num muted">${a30 ? money(a30[k] || 0) : '—'}</td><td class="num muted">${a90 ? money(a90[k] || 0) : '—'}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3>Lifetime stats</h3><table><tbody>${Object.entries(STAT_LABELS).filter(([k]) => S.stats[k]).map(([k, l]) => `<tr><td>${l}</td><td class="num">${fmtInt(S.stats[k])}</td></tr>`).join('') || '<tr><td class="muted">Play a bit first!</td></tr>'}
      <tr><td>Days played</td><td class="num">${fmtInt(S.day)}</td></tr><tr><td>Generation</td><td class="num">${m.generation}</td></tr></tbody></table></div>
  </div>
  <div class="card"><h3>🗓️ Timeline</h3><div class="log">${m.timeline.map((t) => `<div class="log-line"><span class="d">Day ${t.d}</span>${t.icon} ${esc(t.text)}</div>`).join('') || '<p class="muted">Your story is just beginning.</p>'}</div></div>`;
}

function newGameBody() {
  const L = legacy();
  return `<div class="dz-row"><span class="small muted">Difficulty</span><div class="seg wrap">${Object.entries(DIFFICULTY).map(([k, d]) => btn(`${d.name}: ${d.desc}`, 'ngSet', 'difficulty', { b: k, cls: 'sm ' + (UI.ng.difficulty === k ? 'on' : '') })).join('')}</div></div>
    <div class="dz-row"><span class="small muted">Scenario</span><div class="seg wrap">${Object.entries(SCENARIOS).map(([k, s]) => btn(`${s.icon} ${s.name}`, 'ngSet', 'scenario', { b: k, cls: 'sm ' + (UI.ng.scenario === k ? 'on' : '') })).join('')}</div></div>
    <p class="small">${SCENARIOS[UI.ng.scenario].desc}</p>
    <div class="dz-row"><span class="small muted">Guided mode</span><div class="seg">${btn('On: unlock tabs as you go', 'ngSet', 'guided', { b: 'on', cls: 'sm ' + (UI.ng.guided === 'on' ? 'on' : '') })}${btn('Off: everything open', 'ngSet', 'guided', { b: 'off', cls: 'sm ' + (UI.ng.guided === 'off' ? 'on' : '') })}</div></div>
    ${L.points ? `<p class="small good">🏅 Legacy bonus from ${L.runs} past dynasties: +${money(L.points * 1000)} starting cash and +${Math.min(20, L.points)} max energy.</p>` : ''}`;
}
function askNewGameOptions() {
  showModal({ title: '🆕 New game', body: newGameBody(), buttons: [{ label: 'Start!', cls: 'primary', fn: () => newGame({ ...UI.ng }) }, { label: 'Cancel' }] });
}

function renderSettings() {
  const m = MT(), trustCost = Math.round(5000000 + Math.max(0, netWorth()) * 0.01), L = legacy();
  return `<h2 class="section">⚙️ Settings &amp; Saves</h2>
  <div class="grid g2 section">
    <div class="card"><h3>💾 Save slots</h3><p class="small muted">Your game autosaves every day. Slots let you keep extra snapshots.</p>
      ${[1, 2, 3].map((n) => { const i = slotInfo(n); return `<div class="list-item"><b>Slot ${n}</b><div class="grow small muted">${i ? `Day ${i.day} · ${money(i.nw)} · gen ${i.gen}` : 'Empty'}</div>
        ${btn('Save', 'saveSlot', n, { cls: 'sm' })}${btn('Load', 'loadSlot', n, { cls: 'sm', disabled: !i })}${btn('Delete', 'deleteSlot', n, { cls: 'sm sell', disabled: !i })}</div>`; }).join('')}
      <div class="row" style="margin-top:10px">${btn('📤 Export save file', 'exportSave', '', { cls: 'sm' })}${btn('📥 Import save file', 'importSave', '', { cls: 'sm' })}<input type="file" id="import-file" accept=".json,application/json" hidden></div></div>
    <div class="card"><h3>🔔 Notifications &amp; sound</h3>
      <div class="dz-row"><span class="small muted">Pop-ups</span>${seg([['all', 'All'], ['important', 'Important only'], ['off', 'Problems only']], m.notify, 'setNotify')}</div>
      <div class="dz-row"><span class="small muted">Sound</span>${btn(m.sound ? '🔊 On' : '🔇 Off', 'toggleSound', '', { cls: 'sm ' + (m.sound ? 'on' : '') })}</div>
      <div class="dz-row"><span class="small muted">Guided mode</span>${btn(m.guided ? '🧭 On: some tabs locked' : 'Off: all tabs visible', 'toggleGuided', '', { cls: 'sm ' + (m.guided ? 'on' : '') })}</div></div>
  </div>
  <div class="grid g2">
    <div class="card"><h3>👑 Dynasty</h3><p>Generation <b>${m.generation}</b>${m.heirName ? ` · ${esc(m.heirName)}` : ''}${m.trait ? ` · ${HEIR_TRAITS[m.trait].icon} ${HEIR_TRAITS[m.trait].name}` : ''} · age <b>${Math.floor(age())}</b> <span class="small muted">(1 year = ${YEAR_DAYS} days)</span></p>
      <p class="small muted">From 65 you may pass away. Your heir then inherits everything, minus inheritance tax. Each finished dynasty earns legacy points that boost future games (you have ${L.points}).</p>
      <div class="row">${m.trust ? '<span class="pill good">🏰 Family trust</span>' : btn(`🏰 Family trust (${money(trustCost)})`, 'familyTrust', '', { cls: 'sm', disabled: !canAfford(trustCost) })}${btn('🌅 Retire & pass it on', 'retire', '', { cls: 'sm', disabled: age() < 50 })}</div></div>
    <div class="card"><h3>🆕 Game</h3><p class="small muted">${SCENARIOS[m.scenario].icon} ${SCENARIOS[m.scenario].name} · ${DIFFICULTY[m.difficulty].name}</p>
      <div class="row">${btn('💾 Save now', 'saveGame')}${btn('🔄 New game…', 'askNewGame', '', { cls: 'danger' })}</div></div>
  </div>`;
}
