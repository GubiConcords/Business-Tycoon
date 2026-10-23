'use strict';
/* =====================================================================
   Real estate: buy property, be a landlord, develop new buildings
   ===================================================================== */
const PROPS = [
  { id: 'studio', name: 'Studio Apartment', icon: '🏠', price: 60000, rent: 95, build: 12 },
  { id: 'house', name: 'Suburban House', icon: '🏡', price: 220000, rent: 330, build: 20 },
  { id: 'duplex', name: 'Duplex', icon: '🏘️', price: 480000, rent: 760, build: 28 },
  { id: 'strip', name: 'Retail Strip Mall', icon: '🏬', price: 1500000, rent: 2450, build: 45 },
  { id: 'apart', name: 'Apartment Block', icon: '🏢', price: 2400000, rent: 3900, build: 60 },
  { id: 'office', name: 'Office Building', icon: '🏦', price: 6000000, rent: 9800, build: 90 },
  { id: 'tower', name: 'Skyscraper', icon: '🌆', price: 40000000, rent: 66000, build: 150 },
];
const PT = Object.fromEntries(PROPS.map((p) => [p.id, p]));
const RENT_LVL = {
  low: { name: 'Low', mult: 0.8, find: 0.35, happy: 20 },
  fair: { name: 'Fair', mult: 1, find: 0.2, happy: 0 },
  high: { name: 'High', mult: 1.25, find: 0.08, happy: -25 },
};
const SELL_FEE = 0.06;
const STREETS = ['Maple St', 'Oak Ave', 'Harbor Rd', 'Elm Ct', 'Sunset Blvd', 'Pine Ln', 'Park Pl', 'River Dr', 'Hill St', 'Lakeview Ter', 'Market St', 'Cedar Way'];

const propValue = (p) => PT[p.type].price * S.re.housing * p.mult * (0.7 + 0.3 * p.cond / 100);
const propRent = (p) => PT[p.type].rent * Math.sqrt(S.re.housing) * RENT_LVL[p.rentLvl].mult * (0.6 + 0.4 * p.cond / 100);
const renovateCost = (p) => Math.round(PT[p.type].price * S.re.housing * 0.15 * (100 - p.cond) / 100);
const propById = (id) => S.re.props.find((p) => p.id === +id);
const address = () => `${randInt(1, 999)} ${pick(STREETS)}`;
const buildCost = (t) => Math.round(PT[t].price * S.re.housing * 0.75);

function genListings() {
  S.re.listings = Array.from({ length: 5 }, () => {
    const t = weighted(PROPS.map((p, i) => ({ p, w: [5, 4, 3, 2, 1.5, 1, 0.5][i] }))).p;
    const p = { id: uid(), type: t.id, cond: randInt(35, 100), mult: rand(0.85, 1.15), addr: address() };
    p.price = Math.round(propValue(p) * rand(0.92, 1.06) / 100) * 100;
    return p;
  });
  S.re.nextList = S.day + 2;
}

registerModule({
  id: 'realestate',
  init(s) {
    s.re = { housing: 1, hist: [], listings: [], props: [], projects: [], nextList: 1 };
    let h = 1;
    for (let i = 0; i < 60; i++) { h *= Math.exp(0.0002 + 0.004 * gauss()); s.re.hist.push(h); }
    s.re.housing = h;
  },
  start() { genListings(); },
  assets(a) {
    a.property = S.re.props.reduce((t, p) => t + propValue(p), 0)
      + S.re.projects.reduce((t, p) => t + p.cost * 0.7, 0);
  },
  daily() {
    const re = S.re;
    let shock = 0;
    if (chance(0.015)) {
      const boom = chance(0.55);
      shock = boom ? 0.04 : -0.05;
      log(boom ? '🏘️ Housing boom! Property prices jump.' : '🏚️ Housing market cools sharply.', boom ? 'good' : 'bad');
    }
    re.housing *= Math.exp(0.0003 + 0.004 * gauss() + shock);
    re.hist.push(re.housing);
    if (re.hist.length > 180) re.hist.shift();

    for (const p of re.props) {
      const t = PT[p.type], lvl = RENT_LVL[p.rentLvl];
      p.cond = clamp(p.cond - 0.12, 0, 100);
      // landlord costs: upkeep, property tax, and utilities while nobody is living there
      spend(t.rent * 0.12 + propValue(p) * PROPERTY_TAX + (p.tenant ? 0 : t.rent * 0.08 * (S.utilRates.elec + S.utilRates.water) / 2), 'Real Estate');
      if (p.ad > 0) p.ad--;
      if (p.tenant) {
        const tn = p.tenant;
        const target = 70 + lvl.happy + (p.cond - 70) / 2;
        tn.happy = clamp(tn.happy + (target - tn.happy) * 0.1, 0, 100);
        if (tn.late > 0) {
          tn.late--;
          if (!tn.late) log(`🏠 Tenant at ${p.addr} finally paid up.`);
        } else {
          if (chance(tn.happy < 40 ? 0.03 : 0.008)) { tn.late = randInt(3, 10); log(`🏠 Tenant at ${p.addr} is behind on rent.`, 'warn'); }
          else earn(propRent(p), 'Real Estate');
        }
        if (chance(0.006)) { p.cond = clamp(p.cond - 15, 0, 100); log(`🔨 Tenant damage at ${p.addr}! Condition −15%.`, 'warn'); }
        if (tn.happy < 25 && chance(0.12)) { p.tenant = null; p.vacant = 0; log(`📦 Unhappy tenant moved out of ${p.addr}.`, 'warn'); }
        else if (chance(0.004)) { p.tenant = null; p.vacant = 0; log(`📦 Tenant at ${p.addr} moved away.`); }
      } else {
        p.vacant++;
        const find = lvl.find * (p.ad > 0 ? 2 : 1) * (0.3 + p.cond / 100);
        if (chance(find)) { p.tenant = { happy: 65 + lvl.happy / 2, late: 0 }; log(`🔑 New tenant moved into ${p.addr}.`, 'good'); }
      }
    }
    for (const pr of re.projects.slice()) {
      pr.left--;
      if (pr.left <= 0) {
        re.projects.splice(re.projects.indexOf(pr), 1);
        re.props.push({ id: uid(), type: pr.type, cond: 100, mult: 1.05, addr: pr.addr, rentLvl: 'fair', tenant: null, vacant: 0, ad: 0 });
        stat('developed');
        log(`🏗️ Construction finished: your new ${PT[pr.type].name} at ${pr.addr} is ready for tenants!`, 'good');
        toast(`${PT[pr.type].icon} Construction complete!`, 'good');
      }
    }
    if (S.day >= re.nextList) genListings();
  },
  tabs: [{ id: 'realestate', name: 'Real Estate', icon: '🏘️', render: renderRealEstate }],
  actions: {
    buyProp(a) {
      const re = S.re, l = re.listings.find((x) => x.id === +a);
      if (!l || !pay(l.price, 'Investments', 'this property')) return;
      re.listings.splice(re.listings.indexOf(l), 1);
      re.props.push({ id: l.id, type: l.type, cond: l.cond, mult: l.mult, addr: l.addr, rentLvl: 'fair', tenant: chance(0.5) ? { happy: 60, late: 0 } : null, vacant: 0, ad: 0 });
      log(`🔑 You bought a ${PT[l.type].name} at ${l.addr} for ${money(l.price)}.`, 'good');
    },
    propRent(a, lvl) { propById(a).rentLvl = lvl; },
    propRenovate(a) {
      const p = propById(a), c = renovateCost(p);
      if (!pay(c, 'Real Estate', 'renovation')) return;
      p.cond = 100;
      if (p.tenant) p.tenant.happy = clamp(p.tenant.happy + 20, 0, 100);
      toast('Renovated to 100% condition.', 'good');
    },
    propAdvertise(a) {
      const p = propById(a), c = Math.round(PT[p.type].rent * 4);
      if (!pay(c, 'Real Estate', 'advertising')) return;
      p.ad = 7;
      toast('Listing advertised for 7 days.', 'good');
    },
    propEvict(a) {
      const p = propById(a), c = Math.round(PT[p.type].rent * 8);
      if (!p.tenant) return;
      if (!pay(c, 'Real Estate', 'legal fees')) return;
      p.tenant = null; p.vacant = 0;
      log(`⚖️ You evicted the tenant at ${p.addr} (${money(c)} in legal fees).`);
    },
    propSell(a) {
      const p = propById(a), v = propValue(p) * (1 - SELL_FEE);
      showModal({
        title: `Sell ${p.addr}?`, body: `<p>Sale price after ${pct(SELL_FEE, 0)} agent fees: <b>${money(v)}</b>.</p>`,
        buttons: [{ label: `Sell for ${money(v)}`, cls: 'danger', fn: () => { earn(v, 'Investments'); S.re.props.splice(S.re.props.indexOf(p), 1); log(`💼 Sold ${p.addr} for ${money(v)}.`); } }, { label: 'Cancel' }],
      });
    },
    develop(t) {
      const c = buildCost(t);
      if (!pay(c, 'Investments', 'construction')) return;
      const addr = address();
      S.re.projects.push({ id: uid(), type: t, left: PT[t].build, total: PT[t].build, cost: c, addr });
      log(`🏗️ Construction started on a ${PT[t].name} at ${addr} (${PT[t].build} days).`);
    },
    reView(a) { UI.reView = a; },
  },
});
UI.reView = 'owned';

function renderRealEstate() {
  const re = S.re;
  const view = seg([['owned', '🔑 My properties'], ['market', '🏷️ For sale'], ['develop', '🏗️ Develop']], UI.reView, 'reView');
  let body = '';
  if (UI.reView === 'market') {
    body = `<div class="grid g3">${re.listings.map((l) => {
      const t = PT[l.type];
      return `<div class="card tight"><div class="row"><span class="big-ico">${t.icon}</span><div class="grow"><b>${t.name}</b><div class="small muted">${l.addr}</div></div></div>
        <div class="small" style="margin:6px 0">Condition ${l.cond}% · est. rent ~${money(t.rent * Math.sqrt(re.housing))}/day</div>
        ${btn(`Buy ${money(l.price)}`, 'buyProp', l.id, { cls: 'sm buy', disabled: !canAfford(l.price) })}</div>`;
    }).join('') || '<p class="muted">No listings right now.</p>'}</div><p class="small muted" style="margin-top:8px">New listings on day ${re.nextList}.</p>`;
  } else if (UI.reView === 'develop') {
    const projects = re.projects.map((p) => `<div class="list-item"><span class="big-ico">🏗️</span><div class="grow"><b>${PT[p.type].name}</b> <span class="small muted">${p.addr}</span>
      <div class="small muted">${p.left} days left</div>${bar((p.total - p.left) / p.total * 100, 'var(--warn)')}</div></div>`).join('');
    body = `<div class="banner info">Buy land and build from scratch for ~75% of the market price. New buildings start in perfect condition.</div>
      ${projects ? `<div class="card section"><h3>Under construction</h3>${projects}</div>` : ''}
      <div class="grid g3">${PROPS.map((t) => `<div class="card tight"><div class="row"><span class="big-ico">${t.icon}</span><div class="grow"><b>${t.name}</b>
        <div class="small muted">${t.build} days to build · market value ~${money(t.price * re.housing)}</div></div></div>
        <div style="margin-top:8px">${btn(`Build ${money(buildCost(t.id))}`, 'develop', t.id, { cls: 'sm buy', disabled: !canAfford(buildCost(t.id)) })}</div></div>`).join('')}</div>`;
  } else {
    body = re.props.length ? `<div class="grid g2">${re.props.map((p) => {
      const t = PT[p.type], tn = p.tenant;
      return `<div class="card"><div class="row between"><div class="row"><span class="big-ico">${t.icon}</span><div><b>${t.name}</b><div class="small muted">${p.addr} · worth ${money(propValue(p))}</div></div></div>
        ${tn ? (tn.late ? `<span class="pill warn">Rent late ${tn.late}d</span>` : '<span class="pill good">Occupied</span>') : `<span class="pill bad">Vacant ${p.vacant}d</span>`}</div>
        <div style="margin-top:8px">${barline('Condition', p.cond, p.cond < 40 ? 'var(--bad)' : '#36c2b4')}${tn ? barline('Tenant mood', tn.happy, tn.happy < 30 ? 'var(--bad)' : 'var(--good)') : ''}</div>
        <div class="small">Rent: <b>${money(propRent(p))}/day</b> · upkeep ${money(t.rent * 0.12)} + property tax ${money(propValue(p) * PROPERTY_TAX)}${tn ? '' : ` + vacant utilities ${money(t.rent * 0.08)}`}/day${p.ad ? ` · 📣 advertised ${p.ad}d` : ''}</div>
        <div class="row" style="margin-top:8px"><span class="small muted">Rent level</span>
          <div class="seg">${Object.entries(RENT_LVL).map(([k, l]) => btn(l.name, 'propRent', p.id, { b: k, cls: 'sm ' + (p.rentLvl === k ? 'on' : '') })).join('')}</div></div>
        <div class="row" style="margin-top:8px">
          ${btn(`🔨 Renovate (${money(renovateCost(p))})`, 'propRenovate', p.id, { cls: 'sm', disabled: p.cond >= 99 || !canAfford(renovateCost(p)) })}
          ${!tn ? btn(`📣 Advertise (${money(t.rent * 4)})`, 'propAdvertise', p.id, { cls: 'sm', disabled: p.ad > 0 }) : ''}
          ${tn ? btn(`⚖️ Evict (${money(t.rent * 8)})`, 'propEvict', p.id, { cls: 'sm' }) : ''}
          ${btn('Sell', 'propSell', p.id, { cls: 'sm' })}</div></div>`;
    }).join('')}</div>` : '<div class="banner info">You don\'t own any property yet. Check the <b>For sale</b> listings or <b>Develop</b> your own buildings.</div>';
  }
  const rentDay = re.props.reduce((t, p) => t + (p.tenant && !p.tenant.late ? propRent(p) : 0), 0);
  return `<div class="row between section"><h2>🏘️ Real Estate</h2>${view}</div>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Properties</div><div class="val">${re.props.length}</div></div>
    <div class="card kpi"><div class="lbl">Rent income / day</div><div class="val good">${money(rentDay)}</div></div>
    <div class="card kpi"><div class="lbl">Housing index</div><div class="val">${re.housing.toFixed(3)}</div>${chart('housing', re.hist, 40, { color: '#4f8cff' })}</div>
  </div>${body}`;
}
