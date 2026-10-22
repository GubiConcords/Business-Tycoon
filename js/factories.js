'use strict';
/* =====================================================================
   Factories & manufacturing chain: crude oil -> plastic -> ... -> airliners
   ===================================================================== */
const GOODS = {
  oil: { name: 'Crude Oil', icon: '🛢️', base: 40, tier: 0 },
  sand: { name: 'Silica Sand', icon: '⏳', base: 8, tier: 0 },
  ore: { name: 'Iron Ore', icon: '🪨', base: 25, tier: 0 },
  bauxite: { name: 'Bauxite', icon: '🟤', base: 30, tier: 0 },
  copper: { name: 'Copper Ore', icon: '🟠', base: 55, tier: 0 },
  plastic: { name: 'Plastic Pellets', icon: '🧴', base: 110, tier: 1 },
  steel: { name: 'Steel', icon: '🔩', base: 115, tier: 1 },
  alu: { name: 'Aluminum', icon: '🥫', base: 140, tier: 1 },
  wire: { name: 'Copper Wire', icon: '🧵', base: 160, tier: 1 },
  wafer: { name: 'Silicon Wafer', icon: '💿', base: 75, tier: 1 },
  cups: { name: 'Plastic Cups', icon: '🥤', base: 160, tier: 2 },
  toys: { name: 'Plastic Toys', icon: '🧸', base: 460, tier: 2 },
  chip: { name: 'Phone Chip', icon: '🔲', base: 460, tier: 2 },
  board: { name: 'Circuit Board', icon: '🟩', base: 2000, tier: 3 },
  cpu: { name: 'Processor', icon: '🧠', base: 3000, tier: 3 },
  phone: { name: 'Smartphone', icon: '📱', base: 7000, tier: 4 },
  car: { name: 'Electric Car', icon: '🚙', base: 28000, tier: 4 },
  engine: { name: 'Jet Engine', icon: '⚙️', base: 28000, tier: 4 },
  avionics: { name: 'Avionics Suite', icon: '🛰️', base: 56000, tier: 4 },
  airliner: { name: 'Airliner', icon: '✈️', base: 420000, tier: 5 },
};
const RECIPES = [
  { out: 'cups', name: 'Cup Workshop', cost: 8000, rate: 6, opex: 80, inputs: { plastic: 1 } },
  { out: 'plastic', name: 'Plastics Refinery', cost: 50000, rate: 50, opex: 300, inputs: { oil: 2 } },
  { out: 'steel', name: 'Steel Mill', cost: 50000, rate: 40, opex: 350, inputs: { ore: 3 } },
  { out: 'alu', name: 'Aluminum Smelter', cost: 55000, rate: 30, opex: 350, inputs: { bauxite: 3 } },
  { out: 'wire', name: 'Wire Plant', cost: 45000, rate: 25, opex: 250, inputs: { copper: 2 } },
  { out: 'wafer', name: 'Wafer Foundry', cost: 70000, rate: 40, opex: 400, inputs: { sand: 5 } },
  { out: 'toys', name: 'Toy Factory', cost: 40000, rate: 12, opex: 300, inputs: { plastic: 3 } },
  { out: 'chip', name: 'Chip Fab', cost: 120000, rate: 20, opex: 700, inputs: { wafer: 2, wire: 1 } },
  { out: 'board', name: 'PCB Assembly', cost: 180000, rate: 10, opex: 600, inputs: { plastic: 2, wire: 2, chip: 2 } },
  { out: 'cpu', name: 'Processor Fab', cost: 250000, rate: 8, opex: 1200, inputs: { wafer: 4, wire: 2, chip: 3 } },
  { out: 'phone', name: 'Phone Assembly Plant', cost: 450000, rate: 10, opex: 2500, inputs: { board: 1, cpu: 1, plastic: 2, alu: 1 } },
  { out: 'car', name: 'EV Car Factory', cost: 1800000, rate: 4, opex: 7000, inputs: { steel: 20, alu: 10, plastic: 10, board: 4, cpu: 2 } },
  { out: 'engine', name: 'Jet Engine Works', cost: 900000, rate: 2, opex: 3500, inputs: { alu: 30, steel: 20, cpu: 4 } },
  { out: 'avionics', name: 'Avionics Lab', cost: 750000, rate: 2, opex: 3000, inputs: { board: 10, cpu: 8 } },
  { out: 'airliner', name: 'Airliner Assembly Hangar', cost: 4000000, rate: 1 / 3, opex: 15000, inputs: { alu: 400, steel: 150, engine: 2, avionics: 1, plastic: 60 } },
];
const RCP = Object.fromEntries(RECIPES.map((r) => [r.out, r]));
const SPREAD = 0.05;
const MARKET_EVENTS = [
  { goods: ['oil', 'plastic'], d: 0.3, text: '🛢️ Oil supply shock! Crude and plastic prices spike.' },
  { goods: ['oil', 'plastic'], d: -0.25, text: '🛢️ Oil glut: crude prices collapse.' },
  { goods: ['chip', 'cpu', 'board'], d: 0.25, text: '🔲 Global chip shortage! Semiconductor prices soar.' },
  { goods: ['airliner', 'engine'], d: 0.2, text: '✈️ Airlines place record orders. Aircraft prices up.' },
  { goods: ['steel', 'ore'], d: 0.2, text: '🔩 New steel tariffs push metal prices up.' },
  { goods: ['phone'], d: -0.2, text: '📱 Smartphone market saturated. Phone prices slump.' },
  { goods: ['car'], d: 0.2, text: '🚙 EV tax credits boost car demand.' },
  { goods: ['toys', 'cups'], d: 0.25, text: '🧸 Holiday shopping frenzy! Consumer goods prices jump.' },
];

const gPrice = (g) => GOODS[g].base * S.goods[g].idx;
const buyPrice = (g) => gPrice(g) * (1 + SPREAD);
const sellPrice = (g) => gPrice(g) * (1 - SPREAD);
const facById = (id) => S.factories.find((f) => f.id === +id);
const facRate = (f) => RCP[f.good].rate * (1 + 0.5 * (f.level - 1));
const facOpex = (f) => RCP[f.good].opex * (1 + 0.4 * (f.level - 1)) * (f.safety === 'cut' ? 0.7 : 1);
const facUpgradeCost = (f) => RCP[f.good].cost * 0.6 * f.level;
function facValue(f) {
  let v = RCP[f.good].cost;
  for (let l = 1; l < f.level; l++) v += RCP[f.good].cost * 0.6 * l;
  return v * 0.5;
}
function inputCost(r, buy = true) {
  return Object.entries(r.inputs).reduce((s, [g, q]) => s + q * (buy ? buyPrice(g) : gPrice(g)), 0);
}
function estMargin(r) { return (sellPrice(r.out) - inputCost(r)) * r.rate - r.opex; }
function dailyNeeds(except) {
  const need = {};
  for (const f of S.factories) {
    if (f.paused || f === except) continue;
    const r = RCP[f.good], n = Math.ceil(facRate(f));
    for (const [g, q] of Object.entries(r.inputs)) need[g] = (need[g] || 0) + q * n;
  }
  return need;
}
function tradeGood(g, qty) {
  const st = S.goods[g];
  if (qty > 0) {
    const cost = qty * buyPrice(g);
    if (!canAfford(cost)) return false;
    spend(cost, 'Factories');
    st.stock += qty;
  } else {
    const q = Math.min(-qty, st.stock);
    earn(q * sellPrice(g), 'Factories');
    st.stock -= q;
  }
  return true;
}

registerModule({
  id: 'factories',
  init(s) {
    s.factories = [];
    s.goods = {};
    for (const g in GOODS) {
      let idx = 1;
      const hist = [];
      for (let i = 0; i < 60; i++) { idx = clamp(idx + 0.08 * (1 - idx) + 0.02 * gauss(), 0.4, 2.5); hist.push(GOODS[g].base * idx); }
      s.goods[g] = { idx, stock: 0, hist };
    }
  },
  assets(a) {
    a.factories = S.factories.reduce((t, f) => t + facValue(f), 0);
    a.inventory = Object.keys(GOODS).reduce((t, g) => t + S.goods[g].stock * sellPrice(g), 0);
  },
  daily() {
    // commodity markets
    if (chance(0.06)) {
      const e = pick(MARKET_EVENTS);
      for (const g of e.goods) S.goods[g].idx = clamp(S.goods[g].idx + e.d, 0.4, 2.5);
      log(e.text, e.d > 0 ? 'good' : 'warn');
    }
    for (const g in GOODS) {
      const st = S.goods[g], vol = GOODS[g].tier === 0 ? 0.025 : 0.015;
      st.idx = clamp(st.idx + 0.06 * (1 - st.idx) + vol * gauss(), 0.4, 2.5);
      st.hist.push(gPrice(g));
      if (st.hist.length > 90) st.hist.shift();
    }

    // production, upstream first so outputs feed downstream plants the same day
    const sorted = S.factories.slice().sort((a, b) => GOODS[a.good].tier - GOODS[b.good].tier);
    for (const f of sorted) {
      const r = RCP[f.good];
      f.last = { made: 0, note: '' };
      if (f.paused) {
        const m = r.opex * 0.15;
        spend(m, 'Factories');
        f.last.note = 'Paused (maintenance only)';
        continue;
      }
      if (f.closed > 0) { f.closed--; f.last.note = 'Shut down after accident'; continue; }
      const opex = facOpex(f);
      if (!canAfford(opex)) {
        f.last.note = 'Could not pay workers. Production halted!';
        log(`⚠️ ${r.name}: you couldn't pay ${money(opex)} in operating costs. No production.`, 'bad');
        continue;
      }
      spend(opex, 'Factories');
      const target = facRate(f) + f.progress;
      const units = Math.floor(target);
      f.progress = target - units;
      let made = 0, starved = '';
      for (let i = 0; i < units && !starved; i++) {
        for (const [g, q] of Object.entries(r.inputs)) {
          const missing = q - S.goods[g].stock;
          if (missing > 0 && (!f.autoBuy || !tradeGood(g, missing))) { starved = GOODS[g].name; break; }
        }
        if (starved) break;
        for (const [g, q] of Object.entries(r.inputs)) S.goods[g].stock -= q;
        S.goods[f.good].stock++;
        made++;
      }
      if (starved) { f.progress = 0; f.last.note = `Out of ${starved}${f.autoBuy ? ' (not enough cash to buy more)' : ''}`; }
      f.last.made = made;
      stat('produced_' + f.good, made);
      if (f.good === 'airliner' && made) { stat('airliners', made); log(`✈️ Your hangar rolled out ${made} brand-new airliner(s)!`, 'good'); }

      if (f.safety === 'cut') {
        addRisk(0.25);
        if (chance(0.007)) {
          const fine = Math.round(r.cost * 0.06);
          spend(fine, 'Fines');
          f.closed = 3;
          addRisk(10);
          log(`🔥 Workplace accident at your ${r.name}! Safety regulators fined you ${money(fine)} and closed it for 3 days.`, 'bad');
          showModal({ title: '🔥 Factory accident', cls: 'danger', body: `<p>Cutting corners on safety caught up with you at the <b>${r.name}</b>.</p><p>Fine: <b>${money(fine)}</b>. The plant is closed for 3 days.</p>` });
        }
      }
    }
    // auto-sell output, keeping what other plants need tomorrow
    for (const f of S.factories) {
      if (!f.autoSell) continue;
      const keep = dailyNeeds()[f.good] || 0;
      const extra = S.goods[f.good].stock - keep;
      if (extra > 0) tradeGood(f.good, -extra);
    }
  },
  tabs: [{ id: 'factories', name: 'Factories', icon: '🏭', render: renderFactories }],
  actions: {
    buildFactory(a) {
      const r = RCP[a];
      if (!pay(r.cost, 'Investments', r.name)) return;
      S.factories.push({ id: uid(), good: a, level: 1, progress: 0, autoBuy: true, autoSell: true, paused: false, safety: 'full', closed: 0, last: null });
      log(`🏭 You built a ${r.name} for ${money(r.cost)}.`, 'good');
      toast(`${r.name} built!`, 'good');
      stat('factoriesBuilt');
    },
    facToggle(a, key) { const f = facById(a); f[key] = !f[key]; },
    facSafety(a) { const f = facById(a); f.safety = f.safety === 'full' ? 'cut' : 'full'; },
    facUpgrade(a) {
      const f = facById(a);
      if (f.level >= 5) return;
      if (!pay(facUpgradeCost(f), 'Investments', 'the upgrade')) return;
      f.level++;
      toast(`${RCP[f.good].name} upgraded to level ${f.level}.`, 'good');
    },
    facSell(a) {
      const f = facById(a), v = facValue(f), r = RCP[f.good];
      showModal({
        title: `Sell ${r.name}?`, body: `<p>You'll get <b>${money(v)}</b> for the plant and equipment.</p>`,
        buttons: [{ label: `Sell for ${money(v)}`, cls: 'danger', fn: () => { earn(v, 'Investments'); S.factories.splice(S.factories.indexOf(f), 1); log(`💼 Sold your ${r.name} for ${money(v)}.`); } }, { label: 'Cancel' }],
      });
    },
    goodsQty(a) { UI.goodsQty = a === 'all' ? a : +a; },
    buyGood(g) {
      const q = UI.goodsQty === 'all' ? Math.floor(S.cash / buyPrice(g)) : UI.goodsQty;
      if (q <= 0 || !tradeGood(g, q)) return toast('Not enough cash.', 'bad');
      toast(`Bought ${fmtInt(q)} ${GOODS[g].name}`, 'good');
    },
    sellGood(g) {
      const st = S.goods[g];
      const q = UI.goodsQty === 'all' ? st.stock : Math.min(st.stock, UI.goodsQty);
      if (q <= 0) return toast('Nothing to sell.', 'warn');
      tradeGood(g, -q);
      toast(`Sold ${fmtInt(q)} ${GOODS[g].name} for ${money(q * sellPrice(g))}`, 'good');
    },
    facView(a) { UI.facView = a; },
  },
});
UI.goodsQty = 10; UI.facView = 'plants';

function recipeLine(r) {
  return Object.entries(r.inputs).map(([g, q]) => `${q}× ${GOODS[g].icon}`).join(' + ') + ` → ${GOODS[r.out].icon}`;
}

function renderFactories() {
  const view = seg([['plants', '🏭 My factories'], ['build', '🏗️ Build'], ['market', '📦 Warehouse & market']], UI.facView, 'facView');
  let body = '';
  if (UI.facView === 'build') {
    const tiers = [...new Set(RECIPES.map((r) => GOODS[r.out].tier))];
    body = tiers.map((t) => `<h4>Tier ${t}</h4><div class="grid g3 section">${RECIPES.filter((r) => GOODS[r.out].tier === t).map((r) => {
      const m = estMargin(r);
      return `<div class="card tight"><div class="row"><span class="big-ico">${GOODS[r.out].icon}</span><div class="grow"><b>${r.name}</b>
        <div class="small muted">Makes ${GOODS[r.out].name} · ${r.rate >= 1 ? r.rate + '/day' : '1 every ' + Math.round(1 / r.rate) + ' days'}</div></div></div>
        <div class="small" style="margin:6px 0">${recipeLine(r)}</div>
        <div class="small muted">Operating cost ${money(r.opex)}/day</div>
        <div class="small">Est. profit at today's prices (buying inputs): <b class="${cls(m)}">${signMoney(m)}/day</b></div>
        <div style="margin-top:8px">${btn(`Build ${money(r.cost)}`, 'buildFactory', r.out, { cls: 'buy sm', disabled: !canAfford(r.cost) })}</div></div>`;
    }).join('')}</div>`).join('');
  } else if (UI.facView === 'market') {
    const rows = Object.entries(GOODS).map(([g, d]) => {
      const st = S.goods[g], h = st.hist, ch = h.length > 1 ? h[h.length - 1] / h[h.length - 2] - 1 : 0;
      return `<tr><td>${d.icon} <b>${d.name}</b> <span class="small muted">T${d.tier}</span></td>
        <td class="num">${fmtInt(st.stock)}</td><td class="num">${money(buyPrice(g))}</td><td class="num">${money(sellPrice(g))}</td>
        <td class="num ${cls(ch)}">${signPct(ch)}</td><td class="num">${money(st.stock * sellPrice(g))}</td>
        <td class="nowrap">${btn('Buy', 'buyGood', g, { cls: 'sm buy' })} ${btn('Sell', 'sellGood', g, { cls: 'sm sell', disabled: !st.stock })}</td></tr>`;
    }).join('');
    body = `<div class="card"><div class="row between section"><h3>Commodity market</h3><div class="row"><span class="small muted">Units per trade</span>
      ${seg([[1, '1'], [10, '10'], [100, '100'], [1000, '1K'], ['all', 'Max']], UI.goodsQty, 'goodsQty')}</div></div>
      <p class="small muted">You buy at market +${pct(SPREAD, 0)} and sell at market −${pct(SPREAD, 0)}. Make your own inputs to skip the markup.</p>
      <div class="tbl-wrap"><table><thead><tr><th>Good</th><th class="num">In stock</th><th class="num">Buy</th><th class="num">Sell</th><th class="num">Today</th><th class="num">Stock value</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  } else {
    body = S.factories.length ? `<div class="grid g2">${S.factories.map((f) => {
      const r = RCP[f.good], L = f.last;
      return `<div class="card ${f.safety === 'cut' ? 'danger' : ''}">
        <div class="row between"><div class="row"><span class="big-ico">${GOODS[f.good].icon}</span><div><b>${r.name}</b>
          <div class="small muted">Level ${f.level} · ${facRate(f) >= 1 ? +facRate(f).toFixed(1) + '/day' : '1 every ' + (1 / facRate(f)).toFixed(1) + ' days'} · ${money(facOpex(f))}/day</div></div></div>
          ${f.closed ? `<span class="pill bad">Closed ${f.closed}d</span>` : f.paused ? '<span class="pill warn">Paused</span>' : '<span class="pill good">Running</span>'}</div>
        <div class="small" style="margin:8px 0">${recipeLine(r)}</div>
        <div class="small">In stock: <b>${fmtInt(S.goods[f.good].stock)}</b> ${GOODS[f.good].name} · sells for ${money(sellPrice(f.good))}</div>
        ${L ? `<div class="small ${L.note ? 'warn' : 'muted'}">Yesterday: made ${L.made}${L.note ? ' · ' + L.note : ''}</div>` : ''}
        <div class="row" style="margin-top:10px">
          ${btn(`Auto-buy inputs: ${f.autoBuy ? 'ON' : 'OFF'}`, 'facToggle', f.id, { b: 'autoBuy', cls: 'sm ' + (f.autoBuy ? 'on' : '') })}
          ${btn(`Auto-sell: ${f.autoSell ? 'ON' : 'OFF'}`, 'facToggle', f.id, { b: 'autoSell', cls: 'sm ' + (f.autoSell ? 'on' : '') })}
          ${btn(f.paused ? '▶ Resume' : '⏸ Pause', 'facToggle', f.id, { b: 'paused', cls: 'sm' })}
          ${btn(f.safety === 'cut' ? '⚠️ Safety: cutting corners' : '🦺 Safety: full', 'facSafety', f.id, { cls: 'sm', title: 'Cutting corners saves 30% on costs but risks accidents, fines and audits' })}
        </div>
        <div class="row" style="margin-top:8px">
          ${f.level < 5 ? btn(`⬆ Upgrade (${money(facUpgradeCost(f))})`, 'facUpgrade', f.id, { cls: 'sm', disabled: !canAfford(facUpgradeCost(f)) }) : '<span class="pill">Max level</span>'}
          ${btn('Sell', 'facSell', f.id, { cls: 'sm' })}</div></div>`;
    }).join('')}</div>` : `<div class="banner info">No factories yet. A <b>Cup Workshop</b> ($8K) is a cheap start. Build the whole chain, from refineries to chip fabs to jet engines, and assemble <b>airliners</b> ✈️.</div>`;
  }
  return `<div class="row between section"><h2>🏭 Manufacturing</h2>${view}</div>
  <div class="banner info small">Chain: 🛢️ Oil → 🧴 Plastic → 🥤🧸 · ⏳ Sand → 💿 Wafers → 🔲 Chips → 🟩 Boards / 🧠 Processors → 📱 Phones · 🚙 EVs · ⚙️ Jet engines + 🛰️ Avionics → ✈️ Airliners</div>
  ${body}`;
}
