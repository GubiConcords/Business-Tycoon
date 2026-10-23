'use strict';
/* =====================================================================
   AI Lab: hire programmers & researchers, buy training data, build data
   centers full of GPU servers (or servers built from your own chips),
   train models, sell an AI product — and eventually let your AI replace
   your own employees.
   ===================================================================== */
const DC_TYPES = [
  { id: 'closet', name: 'Server room', icon: '🗄️', equip: 20000, rent: 40, cap: 4, permit: ['Business & electrical permit', 2000] },
  { id: 'colo', name: 'Colocation suite', icon: '🏢', equip: 250000, rent: 400, cap: 40, permit: ['Data center zoning permit', 25000] },
  { id: 'dc', name: 'Data center', icon: '🏭', equip: 3000000, rent: 4000, cap: 400, permit: ['Grid connection & zoning permit', 300000] },
  { id: 'hyper', name: 'Hyperscale campus', icon: '🌐', equip: 40000000, rent: 40000, cap: 5000, permit: ['Power plant & environmental permits', 4000000] },
];
const DCT = Object.fromEntries(DC_TYPES.map((d) => [d.id, d]));
const AI_STAFF = {
  swe: { name: 'Software engineer', icon: '👩‍💻', wage: 350, rp: 1, desc: '1 research point/day' },
  mle: { name: 'ML researcher', icon: '🧑‍🔬', wage: 900, rp: 3.5, desc: '3.5 research points/day' },
  data: { name: 'Data engineer', icon: '🗃️', wage: 400, rp: 0, data: 0.3, desc: '+0.3 data quality/day' },
  safety: { name: 'AI safety researcher', icon: '🛡️', wage: 700, rp: 0.5, desc: 'Makes AI incidents much rarer' },
};
const DATASETS = [
  { id: 'web', name: 'Public web crawl', icon: '🕸️', cost: 20000, data: 10 },
  { id: 'books', name: 'Licensed books & news archive', icon: '📚', cost: 250000, data: 20 },
  { id: 'code', name: 'Code repositories', icon: '💾', cost: 400000, data: 20 },
  { id: 'media', name: 'Video & image library', icon: '🎞️', cost: 1500000, data: 30 },
];
const MODEL_SIZES = [
  { id: 'tiny', name: 'Tiny (100M parameters)', pfd: 20, rp: 40, base: 15 },
  { id: 'small', name: 'Small (1B)', pfd: 250, rp: 200, base: 30 },
  { id: 'medium', name: 'Medium (10B)', pfd: 2500, rp: 800, base: 48 },
  { id: 'large', name: 'Large (100B)', pfd: 25000, rp: 3000, base: 64 },
  { id: 'frontier', name: 'Frontier (1T)', pfd: 250000, rp: 12000, base: 78 },
];
const AGENT_SECTORS = {
  job: { name: 'Your 9–5 job', icon: '💼', min: 35, desc: 'An AI clone of you works every shift you skip, at your pay. Promotions still count.' },
  resto: { name: 'Restaurant staff', icon: '🍽️', min: 50, desc: 'AI ordering, kitchen robots and scheduling replace paid staff.' },
  yard: { name: 'Scrapyard workers', icon: '🚗', min: 55, desc: 'Robotic dismantling guided by your AI.' },
  factory: { name: 'Factory workers', icon: '🏭', min: 60, desc: 'Lights-out manufacturing run by your AI.' },
  lab: { name: 'AI researchers', icon: '🧠', min: 70, desc: 'Your AI does AI research, multiplying research output.' },
};
const GPU_PRICE = 60000, CUSTOM_SERVER_COST = 12000, CUSTOM_CHIPS = 8, CUSTOM_MIN_PERF = 20;
const USERS_PER_PF = 100000, USER_REVENUE = 0.3, PF_PER_WORKER = 0.05;
const HQ = { equip: 50000, rent: 150, permit: ['Business license & office permit', 1500], staffPerLevel: 12 };

const aiModel = () => S.ai.models.find((m) => m.id === S.ai.deployed);
const aiCap = () => (aiModel() ? aiModel().cap : 0);
const gpuPrice = () => GPU_PRICE * S.goods.chip.idx;
const dcPF = (c) => c.gpus + c.customPF;
const totalPF = () => S.ai.centers.reduce((t, c) => t + dcPF(c), 0);
const aiStaffCount = () => Object.values(S.ai.staff).reduce((a, b) => a + b, 0);
const aiWages = () => Object.entries(AI_STAFF).reduce((t, [k, r]) => t + (S.ai.staff[k] || 0) * r.wage, 0) * policy('wage');
const capLabel = (c) => (c < 35 ? 'Chatbot' : c < 50 ? 'Assistant' : c < 60 ? 'Agentic' : c < 70 ? 'Expert' : c < 85 ? 'Frontier' : 'Near-AGI');
const agentShare = (k) => (aiCap() < AGENT_SECTORS[k].min ? 0 : clamp(0.3 + (aiCap() - AGENT_SECTORS[k].min) / 30, 0, 1));
// wage multiplier other modules apply to their payroll (computed during the previous day)
const aiWageMult = (k) => (S.ai && S.ai.mult[k] !== undefined ? S.ai.mult[k] : 1);
const aiDoesJob = () => S.ai.auto.job && S.ai.cover.job >= 1 && agentShare('job') > 0;
const usersTarget = () => (aiModel() ? 120000 * Math.exp((aiCap() - 50) / 10) * (S.ai.mkt > 0 ? 1.3 : 1) * policy('ai') * worldMult('ai') * (S.ai.openRival > 0 ? 0.7 : 1) * (S.ai.trust || 1) : 0);
const rpPerDay = () => Object.entries(AI_STAFF).reduce((t, [k, r]) => t + (S.ai.staff[k] || 0) * r.rp, 0) * (1 + (S.ai.mult.labBoost || 0)) * (1 + 0.3 * execSkill('tech')) * (S.meta && S.meta.trait === 'engineer' ? 1.2 : 1);
const safetyCover = () => Math.min(0.9, (S.ai.staff.safety || 0) / 10 + 0.5 * execSkill('tech'));
const dcValue = (c) => DCT[c.type].equip * 0.5 + c.gpus * gpuPrice() * 0.5 + c.custom * CUSTOM_SERVER_COST * 0.5 + siteValue(c.site);
const dcById = (id) => S.ai.centers.find((c) => c.id === +id);
function sectorWorkers(k) {
  if (k === 'resto') return S.restaurants.reduce((t, r) => t + staffCount(r), 0);
  if (k === 'yard') return S.yard.owned ? S.yard.workers : 0;
  if (k === 'factory') return S.factories.reduce((t, f) => t + facOpex(f) / Math.max(0.05, aiWageMult('factory')) / 100, 0);
  if (k === 'job') return 4;
  if (k === 'lab') return aiStaffCount() * 2;
  return 0;
}
const sectorPF = (k) => sectorWorkers(k) * PF_PER_WORKER;

function aiBillsFor(c) {
  const d = DCT[c.type], n = c.gpus + c.custom;
  return makeBills(c.site, { elec: 6 * Math.sqrt(d.cap), net: 20 + d.cap, waste: 2 * Math.sqrt(d.cap) }, { elec: n * 40, water: n * 6 }, c.insured, d.equip + c.gpus * GPU_PRICE + c.custom * CUSTOM_SERVER_COST);
}

registerModule({
  id: 'ai',
  init(s) {
    s.ai = {
      hq: null, staff: { swe: 0, mle: 0, data: 0, safety: 0 }, rp: 0, data: 0, datasets: {},
      centers: [], models: [], training: null, deployed: null, users: 0, mkt: 0,
      auto: { job: false, resto: false, yard: false, factory: false, lab: false },
      mult: {}, cover: {}, contractOk: {}, trust: 1, openRival: 0, incidents: 0, alloc: { contracts: 0, agents: 0, serving: 0, training: 0 }, revenue: 0,
    };
  },
  assets(a) {
    const A = S.ai;
    a.ai = A.centers.reduce((t, c) => t + dcValue(c), 0) + (A.hq ? HQ.equip * 0.5 + siteValue(A.hq.site) : 0);
  },
  daily() {
    const A = S.ai;
    // lab: wages, research and data
    if (A.hq) {
      const w = aiWages();
      if (w) {
        if (canAfford(w)) { spend(w, 'Wages'); A.rp += rpPerDay(); A.data += S.ai.staff.data * AI_STAFF.data.data; }
        else log(`⚠️ AI Lab: couldn't pay ${money(w)} in salaries. No research today.`, 'bad');
      }
      A.hq.bills = makeBills(A.hq.site, { elec: 15 * A.hq.level, water: 3 * A.hq.level, net: 30 * A.hq.level, waste: 4 * A.hq.level }, {}, A.hq.insured, HQ.equip * A.hq.level);
      payBills(A.hq.bills);
    }
    for (const c of A.centers) { c.bills = aiBillsFor(c); payBills(c.bills); }

    // AI safety, public trust and open-source competition
    A.trust = Math.min(1, (A.trust || 1) + 0.005);
    if (A.openRival > 0) A.openRival--;
    if (aiModel() && aiCap() > 40 && chance(0.004 * aiCap() / 50 * (1 - safetyCover()))) {
      const fine = Math.round(1000000 * aiCap() / 50 * legalFineMult());
      spend(fine, 'Fines');
      A.users *= 0.7; A.trust *= 0.85; A.incidents = (A.incidents || 0) + 1;
      S.deals.rep = clamp(S.deals.rep - 5, 0, 100);
      log(`⚠️ AI INCIDENT: ${esc(aiModel().name)} ${pick(['leaked private user data', 'gave dangerously wrong advice that went viral', 'was tricked into insulting a world leader', 'made up fake legal citations for a client'])}. Fine ${money(fine)}, users −30%, trust down.`, 'bad');
      toast('⚠️ AI incident! Hire safety researchers.', 'bad');
    }
    if (aiModel() && !A.openRival && chance(0.003)) { A.openRival = 60; log('🔓 Sato Dynamics released a free open-source model. Your AI user growth is under pressure for 60 days.', 'warn'); }
    // compute allocation: government/business contracts → AI employees → serving users → training
    let free = totalPF();
    const alloc = { contracts: 0, agents: 0, serving: 0, training: 0 };
    A.contractOk = {};
    for (const k of S.deals.active.filter((x) => x.kind === 'ai')) {
      const ok = aiCap() >= k.minCap && free >= k.pf;
      A.contractOk[k.id] = ok;
      if (ok) { free -= k.pf; alloc.contracts += k.pf; }
    }
    A.mult = {};
    for (const k of Object.keys(AGENT_SECTORS)) {
      A.cover[k] = 0;
      const share = agentShare(k);
      if (!A.auto[k] || !share) continue;
      const need = Math.max(0.01, sectorPF(k));
      const give = Math.min(free, need);
      free -= give; alloc.agents += give;
      A.cover[k] = give / need;
      if (k === 'lab') A.mult.labBoost = A.cover[k] * aiCap() / 100;
      else if (k !== 'job') A.mult[k] = Math.max(0.05, 1 - share * A.cover[k]);
    }
    // the AI product
    if (A.mkt > 0) A.mkt--;
    const serveCap = free * USERS_PER_PF;
    const target = Math.min(usersTarget(), serveCap);
    A.users = Math.max(0, A.users + (target - A.users) * (target > A.users ? 0.08 : 0.25));
    const serving = A.users / USERS_PER_PF;
    free -= serving; alloc.serving = serving;
    A.revenue = A.users * USER_REVENUE;
    if (A.revenue >= 1) earn(A.revenue, 'AI');
    // training uses whatever is left
    const m = A.models.find((x) => x.id === A.training);
    if (m) {
      m.progress += Math.max(0, free); alloc.training = Math.max(0, free);
      if (m.progress >= m.need) {
        const size = MODEL_SIZES.find((x) => x.id === m.size);
        m.cap = clamp(Math.round(size.base + Math.min(15, A.data / 8) + rand(-3, 3)), 1, 99);
        m.status = 'ready';
        A.training = null;
        stat('aiModels');
        if (!A.deployed || m.cap > aiCap()) A.deployed = m.id;
        log(`🤖 Training complete: ${esc(m.name)} scores ${m.cap} capability (${capLabel(m.cap)}).`, 'good');
        showModal({ title: '🤖 Model trained!', cls: 'good', body: `<p><b>${esc(m.name)}</b> finished training with a capability score of <b>${m.cap}</b> (${capLabel(m.cap)}).</p>
          <p>${A.deployed === m.id ? 'It is now deployed: serving users, taking contracts and powering AI employees.' : 'Your current model is better, so it stays deployed.'}</p>` });
      }
    }
    A.alloc = alloc;
    A.freePF = Math.max(0, free - alloc.training);
  },
  tabs: [{ id: 'ai', name: 'AI Lab', icon: '🤖', render: renderAI }],
  actions: {
    aiView(a) { UI.aiView = a; },
    openLab() {
      openBusiness({
        title: 'an AI Lab HQ', icon: '🤖', equipment: HQ.equip, permit: { name: HQ.permit[0], cost: HQ.permit[1] }, rent: HQ.rent, price: HQ.rent * 600,
        extra: '<p class="small muted">An office for your engineers and researchers. Fits 12 staff per level.</p>',
        done(site) { S.ai.hq = { site, level: 1, insured: true, bills: null }; log('🤖 You opened an AI Lab. Time to hire some programmers!', 'good'); },
      });
    },
    labUpgrade() {
      const h = S.ai.hq, cost = 100000 * h.level * h.level;
      if (h.level >= 5 || !pay(cost, 'Investments', 'the office expansion')) return;
      h.level++;
      toast(`AI Lab expanded: room for ${h.level * HQ.staffPerLevel} staff.`, 'good');
    },
    labBuySite() { buySite(S.ai.hq.site); },
    aiHire(k) {
      if (aiStaffCount() >= S.ai.hq.level * HQ.staffPerLevel) return toast('The office is full. Expand the lab first.', 'warn');
      S.ai.staff[k]++;
    },
    aiFire(k) { if (S.ai.staff[k] > 0) S.ai.staff[k]--; },
    buyDataset(id) {
      const d = DATASETS.find((x) => x.id === id);
      if (S.ai.datasets[id] || !pay(d.cost, 'AI', d.name)) return;
      S.ai.datasets[id] = true; S.ai.data += d.data;
      toast(`${d.icon} Licensed ${d.name}: +${d.data} data quality.`, 'good');
    },
    openDC(t) {
      const d = DCT[t];
      openBusiness({
        title: `a ${d.name}`, icon: d.icon, equipment: d.equip, permit: { name: d.permit[0], cost: d.permit[1] }, rent: d.rent, price: d.rent * 600,
        extra: `<p class="small muted">Room for ${fmtInt(d.cap)} servers. Each server burns lots of electricity and cooling water.</p>`,
        done(site) { S.ai.centers.push({ id: uid(), type: t, site, gpus: 0, custom: 0, customPF: 0, insured: true, bills: null }); log(`${d.icon} You opened a ${d.name}.`, 'good'); stat('dataCenters'); },
      });
    },
    buyGPU(id, n) {
      const c = dcById(id), room = DCT[c.type].cap - c.gpus - c.custom;
      n = Math.min(+n, room);
      if (n <= 0) return toast('This data center is full.', 'warn');
      if (!pay(n * gpuPrice(), 'Investments', 'GPU servers')) return;
      c.gpus += n;
      toast(`Installed ${n} GPU server(s): +${n} PF.`, 'good');
    },
    buildCustom(id, did) {
      const c = dcById(id), d = dById(did);
      if (DCT[c.type].cap - c.gpus - c.custom <= 0) return toast('This data center is full.', 'warn');
      let n = 0;
      while (n < 10 && d.stock >= CUSTOM_CHIPS && DCT[c.type].cap - c.gpus - c.custom > 0 && canAfford(CUSTOM_SERVER_COST)) {
        d.stock -= CUSTOM_CHIPS; spend(CUSTOM_SERVER_COST, 'Investments');
        c.custom++; c.customPF += d.stats.perf / 25; n++;
      }
      if (!n) return toast(`Need ${CUSTOM_CHIPS}× ${esc(d.name)} in stock and ${money(CUSTOM_SERVER_COST)} per server.`, 'warn');
      toast(`Built ${n} server(s) from your ${esc(d.name)} chips: +${(n * d.stats.perf / 25).toFixed(1)} PF.`, 'good');
    },
    dcInsure(id) { const c = dcById(id); c.insured = !c.insured; },
    dcBuySite(id) { buySite(dcById(id).site); },
    dcSell(id) {
      const c = dcById(id), v = dcValue(c);
      showModal({
        title: `Sell this ${DCT[c.type].name}?`, body: `<p>You'll get <b>${money(v)}</b> for the building, servers${c.site.own ? ' and land' : ' and your deposit'}.</p>`,
        buttons: [{ label: `Sell for ${money(v)}`, cls: 'danger', fn: () => { earn(v, 'Investments'); S.ai.centers.splice(S.ai.centers.indexOf(c), 1); } }, { label: 'Cancel' }],
      });
    },
    trainModel(sz) {
      const A = S.ai, size = MODEL_SIZES.find((x) => x.id === sz);
      if (A.training) return toast('A model is already training.', 'warn');
      if (A.rp < size.rp) return toast(`Need ${fmtInt(size.rp)} research points.`, 'warn');
      const name = (prompt('Name your model:', `${pick(['Nova', 'Sage', 'Atlas', 'Echo', 'Orion', 'Lumen', 'Cortex', 'Iris'])}-${A.models.length + 1}`) || '').trim().slice(0, 30);
      if (!name) return;
      A.rp -= size.rp;
      const m = { id: uid(), name, size: sz, need: size.pfd, progress: 0, status: 'training', cap: 0 };
      A.models.push(m); A.training = m.id;
      log(`🤖 Started training ${esc(name)} (${size.name}).`);
    },
    deployModel(id) { S.ai.deployed = +id; },
    aiCampaign() {
      const cost = Math.round(50000 + S.ai.users * 0.5);
      if (!pay(cost, 'Marketing', 'the launch campaign')) return;
      S.ai.mkt = 14;
      toast('📣 Launch campaign running for 14 days: +30% user demand.', 'good');
    },
    toggleAgent(k) { S.ai.auto[k] = !S.ai.auto[k]; },
  },
});
UI.aiView = 'overview';

/* ---------------------------- Rendering ---------------------------- */
function renderAI() {
  const A = S.ai;
  const view = seg([['overview', '📊 Overview'], ['lab', '👩‍💻 Lab & staff'], ['dc', '🗄️ Data centers'], ['models', '🧠 Models'], ['agents', '🦾 AI employees']], UI.aiView, 'aiView');
  const body = { overview: aiOverview, lab: aiLab, dc: aiDataCenters, models: aiModels, agents: aiAgents }[UI.aiView]();
  return `<div class="row between section"><h2>🤖 AI Lab</h2><div style="overflow-x:auto;max-width:100%">${view}</div></div>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Deployed model</div><div class="val" style="font-size:18px">${aiModel() ? `${esc(aiModel().name)} · ${aiCap()}` : '—'}</div><div class="small muted">${aiModel() ? capLabel(aiCap()) : 'Train your first model'}</div></div>
    <div class="card kpi"><div class="lbl">Compute</div><div class="val">${totalPF().toFixed(1)} PF</div><div class="small muted">${A.centers.reduce((t, c) => t + c.gpus + c.custom, 0)} servers</div></div>
    <div class="card kpi"><div class="lbl">Research points</div><div class="val">${fmtInt(A.rp)}</div><div class="small muted">+${rpPerDay().toFixed(1)}/day · data quality ${A.data.toFixed(0)}</div></div>
    <div class="card kpi"><div class="lbl">Users · revenue/day</div><div class="val good">${fmtInt(A.users)}</div><div class="small muted">${money(A.revenue)}/day</div></div>
  </div>${body}`;
}

function aiOverview() {
  const A = S.ai, al = A.alloc, tot = totalPF() || 1;
  const steps = [
    [!!A.hq, 'Open an AI Lab HQ and hire programmers & ML researchers', 'lab'],
    [Object.keys(A.datasets).length > 0, 'License training data (raises model quality)', 'lab'],
    [A.centers.length > 0, 'Open a data center and install GPU servers', 'dc'],
    [A.models.length > 0, 'Train your first model', 'models'],
    [aiCap() >= 35, 'Reach capability 35+ to start using your AI as employees', 'agents'],
  ];
  const row = (label, v, color) => `<div class="barline" style="grid-template-columns:150px 1fr 80px"><span class="muted">${label}</span>${bar(v / tot * 100, color)}<span class="num right">${v.toFixed(1)} PF</span></div>`;
  return `<div class="grid g2">
    <div class="card"><h3>🗺️ Road to your own AI</h3>${steps.map(([done, t, v]) => `<div class="list-item"><span>${done ? '✅' : '⬜'}</span><div class="grow">${t}</div>${done ? '' : btn('Go', 'aiView', v, { cls: 'sm' })}</div>`).join('')}</div>
    <div class="card"><h3>⚡ Compute usage (yesterday)</h3>
      ${row('🤝 Contracts', al.contracts, 'var(--warn)')}${row('🦾 AI employees', al.agents, '#36c2b4')}${row('👥 Serving users', al.serving, 'var(--good)')}${row('🧠 Training', al.training, 'var(--accent)')}
      <p class="small muted" style="margin-top:8px">Priority: contracts → AI employees → users → training. More servers = faster training and more users.</p>
      <div class="row">${btn(`📣 Launch campaign (${money(50000 + A.users * 0.5)})`, 'aiCampaign', '', { cls: 'sm', disabled: !aiModel() || A.mkt > 0 })}${A.mkt ? `<span class="pill good">Campaign ${A.mkt}d</span>` : ''}</div>
      <p class="small muted">Users wanted at current capability: ${fmtInt(usersTarget())} (${USERS_PER_PF.toLocaleString()} users per PF of serving).</p></div>
  </div>`;
}

function aiLab() {
  const A = S.ai;
  if (!A.hq) {
    const up = HQ.equip + HQ.permit[1] + HQ.rent * DEPOSIT_DAYS;
    return `<div class="card hl" style="max-width:560px"><h3>🤖 Open an AI Lab HQ</h3><p>An office for your programmers and researchers. They produce the research points you need to train models.</p>
      <p class="small muted">Equipment ${money(HQ.equip)} · ${HQ.permit[0]} ${money(HQ.permit[1])} · rent ${money(rentNow(HQ.rent))}/day or buy</p>${btn(`Open from ${money(up)}`, 'openLab', '', { cls: 'primary', disabled: !canAfford(up) })}</div>`;
  }
  const h = A.hq, room = h.level * HQ.staffPerLevel;
  const staff = Object.entries(AI_STAFF).map(([k, r]) => `<div class="staff-row"><span>${r.icon} ${r.name} <b>×${A.staff[k]}</b> <span class="small muted">${money(r.wage)}/day · ${r.desc}</span></span>
    ${btn('Hire', 'aiHire', k, { cls: 'sm buy', disabled: aiStaffCount() >= room })}${btn('Fire', 'aiFire', k, { cls: 'sm sell', disabled: !A.staff[k] })}</div>`).join('');
  return `<div class="grid g2">
    <div class="card"><h3>👩‍💻 Team (${aiStaffCount()}/${room})</h3>${staff}
      <p class="small muted" style="margin-top:8px">Salaries ${money(aiWages())}/day${A.auto.lab && A.mult.labBoost ? ` · 🧠 AI researchers boosting output ×${(1 + A.mult.labBoost).toFixed(2)}` : ''}</p>
      <div class="small" style="margin-top:6px">${siteLabel(h.site)}</div>${billsHtml(h.bills)}
      <div class="row" style="margin-top:8px">${h.level < 5 ? btn(`⬆ Expand office (${money(100000 * h.level * h.level)})`, 'labUpgrade', '', { cls: 'sm' }) : ''}
      ${h.site.own ? '' : btn(`🔑 Buy the office (${money(sitePrice(h.site))})`, 'labBuySite', '', { cls: 'sm', disabled: !canAfford(sitePrice(h.site)) })}</div></div>
    <div class="card"><h3>📦 Training data</h3><p class="small muted">Data quality adds up to +15 capability to every model you train. You have ${A.data.toFixed(0)} (max bonus at 120).</p>
      ${DATASETS.map((d) => `<div class="list-item"><span class="big-ico">${d.icon}</span><div class="grow"><b>${d.name}</b><div class="small muted">+${d.data} data quality</div></div>
        ${A.datasets[d.id] ? '<span class="pill good">Owned</span>' : btn(`License ${money(d.cost)}`, 'buyDataset', d.id, { cls: 'sm buy', disabled: !canAfford(d.cost) })}</div>`).join('')}</div>
  </div>`;
}

function aiDataCenters() {
  const A = S.ai;
  const chips = S.designs.filter((d) => d.cat === 'chip' && d.status === 'approved' && d.stats.perf >= CUSTOM_MIN_PERF);
  const centers = A.centers.map((c) => {
    const d = DCT[c.type], used = c.gpus + c.custom;
    return `<div class="card"><div class="row between"><div class="row"><span class="big-ico">${d.icon}</span><div><b>${d.name}</b>
      <div class="small muted">${used}/${fmtInt(d.cap)} servers · ${dcPF(c).toFixed(1)} PF</div></div></div>${btn('Sell', 'dcSell', c.id, { cls: 'sm' })}</div>
      ${bar(used / d.cap * 100)}
      <div class="small" style="margin-top:6px">🖥️ ${c.gpus} GPU servers${c.custom ? ` · 🔲 ${c.custom} custom servers (${c.customPF.toFixed(1)} PF)` : ''}</div>
      <div class="row" style="margin-top:8px"><span class="small muted">GPU server ${money(gpuPrice())} = 1 PF:</span>
        ${[1, 10, 100].map((n) => btn(`+${n}`, 'buyGPU', c.id, { b: n, cls: 'sm buy', disabled: used >= d.cap || !canAfford(gpuPrice()) })).join('')}</div>
      ${chips.length ? `<div class="row" style="margin-top:6px"><span class="small muted">Build from your chips (${CUSTOM_CHIPS} chips + ${money(CUSTOM_SERVER_COST)} each, up to 10):</span>
        ${chips.map((ch) => btn(`${esc(ch.name)} → ${(ch.stats.perf / 25).toFixed(1)} PF (${fmtInt(ch.stock)} in stock)`, 'buildCustom', c.id, { b: ch.id, cls: 'sm', disabled: ch.stock < CUSTOM_CHIPS })).join('')}</div>` : ''}
      <div class="small" style="margin-top:6px">${siteLabel(c.site)}</div>${billsHtml(c.bills)}
      <div class="row" style="margin-top:6px">${c.site.own ? '' : btn(`🔑 Buy the site (${money(sitePrice(c.site))})`, 'dcBuySite', c.id, { cls: 'sm', disabled: !canAfford(sitePrice(c.site)) })}
      ${btn(c.insured ? '🛡️ Insured' : '⚠️ Uninsured', 'dcInsure', c.id, { cls: 'sm ' + (c.insured ? 'on' : '') })}</div></div>`;
  }).join('');
  const shop = DC_TYPES.map((d) => {
    const up = d.equip + d.permit[1] + d.rent * DEPOSIT_DAYS;
    return `<div class="card tight"><div class="row"><span class="big-ico">${d.icon}</span><div class="grow"><b>${d.name}</b>
      <div class="small muted">Room for ${fmtInt(d.cap)} servers · ${d.permit[0]} ${money(d.permit[1])} · rent ${money(rentNow(d.rent))}/day or buy</div></div></div>
      <div style="margin-top:8px">${btn(`Open from ${money(up)}`, 'openDC', d.id, { cls: 'sm buy', disabled: !canAfford(up) })}</div></div>`;
  }).join('');
  return `${centers ? `<div class="grid g2 section">${centers}</div>` : ''}
    <div class="banner info small">Servers run on electricity and cooling water, so watch the utility prices. Design a chip with performance ${CUSTOM_MIN_PERF}+ (try 7nm or 3nm, Super chip, 16 cores) to build your own AI servers, which are cheaper and faster than buying GPUs.</div>
    <h4>Open a data center</h4><div class="grid g3">${shop}</div>`;
}

function aiModels() {
  const A = S.ai;
  const training = A.models.find((m) => m.id === A.training);
  const sizes = MODEL_SIZES.map((s) => {
    const eta = totalPF() > 0 ? Math.ceil(s.pfd / Math.max(0.1, totalPF() - A.alloc.contracts - A.alloc.agents - A.alloc.serving)) : Infinity;
    return `<div class="card tight"><b>${s.name}</b><div class="small muted">Needs ${fmtInt(s.rp)} research points · ${fmtInt(s.pfd)} PF-days of compute</div>
      <div class="small">Expected capability ~${s.base + Math.round(Math.min(15, A.data / 8))} (${capLabel(s.base + Math.min(15, A.data / 8))}) · ~${isFinite(eta) ? eta + ' days' : 'no compute yet'}</div>
      <div style="margin-top:8px">${btn('🧠 Train', 'trainModel', s.id, { cls: 'sm primary', disabled: !!A.training || A.rp < s.rp || !A.hq })}</div></div>`;
  }).join('');
  const list = A.models.map((m) => `<div class="list-item"><span class="big-ico">${m.status === 'training' ? '⏳' : '🤖'}</span><div class="grow"><b>${esc(m.name)}</b> <span class="small muted">${MODEL_SIZES.find((s) => s.id === m.size).name}</span>
    ${m.status === 'training' ? `<div class="small muted">Training: ${fmtInt(m.progress)}/${fmtInt(m.need)} PF-days</div>${bar(m.progress / m.need * 100)}` : `<div class="small">Capability <b>${m.cap}</b> · ${capLabel(m.cap)}</div>`}</div>
    ${m.status === 'ready' ? (A.deployed === m.id ? '<span class="pill good">Deployed</span>' : btn('Deploy', 'deployModel', m.id, { cls: 'sm' })) : ''}</div>`).join('');
  return `${training ? '' : '<div class="banner info small">Pick a model size. Bigger models need more research and much more compute, and they reach higher capability.</div>'}
    <div class="grid g3 section">${sizes}</div><div class="card"><h3>Your models</h3>${list || '<p class="muted">None yet.</p>'}</div>`;
}

function aiAgents() {
  const A = S.ai, cap = aiCap();
  return `<div class="banner info small">Once your AI is capable enough, it can replace your own employees. It saves their wages but uses compute (${PF_PER_WORKER} PF per worker). If compute runs short, only part of the work is automated.</div>
  <div class="grid g2">${Object.entries(AGENT_SECTORS).map(([k, s]) => {
    const share = agentShare(k), locked = cap < s.min;
    const effect = k === 'job' ? 'Works your skipped shifts' : k === 'lab' ? `Research ×${(1 + cap / 100).toFixed(2)} at full coverage` : `Up to ${pct(share, 0)} of wages saved`;
    return `<div class="card ${locked ? '' : A.auto[k] ? 'hl' : ''}"><div class="row between"><b>${s.icon} ${s.name}</b>${locked ? `<span class="pill">🔒 Capability ${s.min}+</span>` : A.auto[k] ? '<span class="pill good">AI working</span>' : '<span class="pill">Humans</span>'}</div>
      <p class="small muted" style="margin:6px 0">${s.desc}</p>
      ${locked ? '' : `<div class="small">${effect} · needs ~${sectorPF(k).toFixed(2)} PF${A.auto[k] ? ` · coverage ${pct(A.cover[k] || 0, 0)}` : ''}</div>
      <div style="margin-top:8px">${btn(A.auto[k] ? 'Switch back to humans' : '🦾 Hand it to the AI', 'toggleAgent', k, { cls: 'sm ' + (A.auto[k] ? '' : 'primary') })}</div>`}</div>`;
  }).join('')}</div>`;
}
