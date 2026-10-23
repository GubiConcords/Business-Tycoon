'use strict';
/* =====================================================================
   Deals & diplomacy: supply contracts with other companies, government
   tenders, joint ventures, trade missions and trade agreements.
   ===================================================================== */
const COUNTRIES = [
  { id: 'arc', name: 'Federation of Arcadia', flag: '🦅', wealth: 3, stability: 0.995 },
  { id: 'eld', name: 'Kingdom of Eldoria', flag: '👑', wealth: 1.5, stability: 0.997 },
  { id: 'qas', name: 'Sultanate of Qasir', flag: '🌙', wealth: 2.5, stability: 0.99 },
  { id: 'zan', name: "People's Republic of Zanthar", flag: '⭐', wealth: 2, stability: 0.985 },
  { id: 'nov', name: 'Republic of Novaria', flag: '🟦', wealth: 1, stability: 0.99 },
  { id: 'isl', name: 'United Isles', flag: '🏝️', wealth: 0.8, stability: 0.992 },
];
const CTRY = Object.fromEntries(COUNTRIES.map((c) => [c.id, c]));
const SUPPLY_GOODS = ['plastic', 'steel', 'alu', 'wire', 'wafer', 'glass', 'battery', 'cups', 'toys'];
// how often a design category is delivered and how many per delivery
const SUPPLY_CATS = {
  chip: { every: 1, qty: [10, 40] }, phone: { every: 1, qty: [5, 15] }, carEngine: { every: 7, qty: [10, 30] },
  car: { every: 7, qty: [5, 20] }, jetEngine: { every: 30, qty: [1, 2] }, aircraft: { every: 30, qty: [1, 1] },
};
const AI_JOBS = [
  ['Customer-service chatbots', 30], ['Fraud detection', 45], ['Logistics optimization', 50], ['Medical imaging analysis', 60],
  ['Tax-system automation', 55], ['Weather & climate forecasting', 65], ['National cyber defense', 75], ['Drug discovery', 80],
];
const DEAL_FAIL_LIMIT = 3;
const MAX_TRADE_DISCOUNT = 0.15;

const partyName = (o) => (o.ptype === 'gov' ? `${CTRY[o.party].flag} ${CTRY[o.party].name}` : `🏢 ${STOCKS.find((s) => s.sym === o.party).name}`);
const rel = (id) => S.deals.rel[id] || 0;
function addRel(id, d) { S.deals.rel[id] = clamp(rel(id) + d, 0, 100); }
const tradeDiscount = () => Math.min(MAX_TRADE_DISCOUNT, Object.keys(S.deals.trade).length * 0.03);
const catRefPrice = (cat) => {
  const own = S.designs.filter((d) => d.cat === cat && d.status === 'approved');
  return own.length ? own.reduce((t, d) => t + d.price, 0) / own.length * S.dmarket[cat] : evalDesign(cat, { ...DEFAULT_DZ[cat] }).price;
};
const itemName = (o) => (o.cat ? `${DCATS[o.cat].icon} ${DCATS[o.cat].name.toLowerCase()} (any of your designs)` : `${GOODS[o.item].icon} ${GOODS[o.item].name}`);
const contractValue = (o) => (o.kind === 'ai' ? o.daily * o.days : o.qty * o.price * o.deliveries);
const tenderChance = (o) => clamp(0.25 + rel(o.party) / 200 + S.deals.rep / 200, 0.1, 0.9);
const offerLocked = (o) => rel(o.party) < o.minRel;
function stockFor(o) {
  if (!o.cat) return S.goods[o.item].stock;
  return S.designs.filter((d) => d.cat === o.cat && d.status === 'approved').reduce((t, d) => t + d.stock, 0);
}
function takeFor(o, q) {
  if (!o.cat) { const t = Math.min(q, S.goods[o.item].stock); S.goods[o.item].stock -= t; return t; }
  let left = q;
  for (const d of S.designs.filter((x) => x.cat === o.cat && x.status === 'approved').sort((a, b) => b.stock - a.stock)) {
    const t = Math.min(left, Math.floor(d.stock));
    d.stock -= t; left -= t;
    if (!left) break;
  }
  return q - left;
}
// stock that auto-sell must leave alone: the next delivery of every active supply contract
function contractReserve() {
  const r = {};
  for (const c of S.deals.active) {
    if (c.kind !== 'supply') continue;
    if (c.cat) for (const d of S.designs.filter((x) => x.cat === c.cat)) r['d:' + d.id] = (r['d:' + d.id] || 0) + c.qty;
    else r[c.item] = (r[c.item] || 0) + c.qty;
  }
  return r;
}

function makeDealOffer(ptype) {
  const gov = ptype === 'gov';
  const party = gov ? pick(COUNTRIES).id : pick(STOCKS).sym;
  const scale = gov ? CTRY[party].wealth : 1;
  const ownCats = Object.keys(SUPPLY_CATS).filter((c) => S.designs.some((d) => d.cat === c && d.status === 'approved'));
  const roll = Math.random();
  const o = { id: uid(), ptype, party, strikes: 0 };
  if (roll < (S.ai.deployed ? 0.25 : 0.1)) {
    const [job, minCap] = pick(AI_JOBS);
    Object.assign(o, {
      kind: 'ai', title: job, minCap, pf: +(minCap / 10 * rand(0.5, 1.5) * (gov ? 2 : 1)).toFixed(1),
      days: randInt(30, gov ? 120 : 60), daily: Math.round(minCap * minCap * rand(3, 6) * scale * (gov ? 1.5 : 1)),
    });
  } else {
    const useCat = ownCats.length && chance(0.6) ? pick(ownCats) : chance(0.15) ? pick(Object.keys(SUPPLY_CATS)) : null;
    if (useCat) {
      const sc = SUPPLY_CATS[useCat];
      Object.assign(o, { kind: 'supply', cat: useCat, every: sc.every, qty: Math.ceil(randInt(...sc.qty) * (gov ? 1.5 : 1)), price: Math.round(catRefPrice(useCat) * rand(1.1, 1.3) * (gov ? 1.15 : 1)) });
    } else {
      const g = pick(SUPPLY_GOODS);
      Object.assign(o, { kind: 'supply', item: g, every: 1, qty: Math.max(2, Math.round(RCP[g].rate * rand(0.3, 0.8) * (gov ? scale : 1))), price: Math.round(GOODS[g].base * rand(1.15, 1.35) * (gov ? 1.1 : 1) * 100) / 100 });
    }
    o.deliveries = o.every === 1 ? randInt(14, gov ? 90 : 45) : Math.max(2, Math.round(randInt(30, 120) / o.every));
  }
  const v = contractValue(o);
  o.minRel = gov ? clamp(Math.round(10 + Math.log10(v) * 6), 15, 70) : clamp(Math.round(Math.log10(v) * 6 - 20), 0, 50);
  o.fee = gov ? Math.round(Math.max(5000, v * 0.01)) : 0;
  o.title = o.title || `Supply ${o.qty} ${o.cat ? DCATS[o.cat].name.toLowerCase() : GOODS[o.item].name} every ${o.every === 1 ? 'day' : o.every + ' days'}`;
  return o;
}
function genDealOffers() {
  const D = S.deals;
  D.offers = [...Array.from({ length: 4 }, () => makeDealOffer('co')), ...Array.from({ length: 3 }, () => makeDealOffer('gov'))];
  D.nextOffers = S.day + 4;
}
function activate(o) {
  const c = { ...o, timer: o.kind === 'supply' ? o.every : 0, started: S.day, left: o.kind === 'ai' ? o.days : o.deliveries, earned: 0 };
  S.deals.active.push(c);
  stat(o.ptype === 'gov' ? 'govContracts' : 'contracts');
  log(`🤝 Contract signed with ${partyName(o)}: ${o.title}.`, 'good');
}
function endContract(c, ok, msg) {
  S.deals.active.splice(S.deals.active.indexOf(c), 1);
  if (ok) {
    addRel(c.party, c.ptype === 'gov' ? 8 : 5);
    S.deals.rep = clamp(S.deals.rep + 2, 0, 100);
    S.deals.done++;
    log(`✅ Contract completed with ${partyName(c)}: ${c.title}. Earned ${money(c.earned)}.`, 'good');
  } else {
    addRel(c.party, -15);
    S.deals.rep = clamp(S.deals.rep - 5, 0, 100);
    S.deals.failed++;
    log(`❌ ${msg}`, 'bad');
    toast(`❌ Contract lost: ${c.title}`, 'bad');
  }
}
function strike(c, penalty, what) {
  c.strikes++;
  if (penalty > 0) spend(penalty, 'Fines');
  addRel(c.party, -3);
  log(`⚠️ ${partyName(c)}: ${what}. Penalty ${money(penalty)} (strike ${c.strikes}/${DEAL_FAIL_LIMIT}).`, 'bad');
  if (c.strikes >= DEAL_FAIL_LIMIT) {
    const p = Math.round(contractValue(c) * 0.1);
    spend(p, 'Fines');
    endContract(c, false, `${partyName(c)} cancelled "${c.title}" after repeated failures. Cancellation penalty ${money(p)}.`);
  }
}

registerModule({
  id: 'deals',
  init(s) {
    s.deals = { rel: {}, rep: 10, offers: [], active: [], tenders: [], ventures: [], trade: {}, offices: {}, nextOffers: 1, done: 0, failed: 0, cooldown: {} };
    for (const st of STOCKS) s.deals.rel[st.sym] = 25;
    for (const c of COUNTRIES) s.deals.rel[c.id] = 5;
  },
  start() { genDealOffers(); },
  assets(a) { a.ventures = S.deals.ventures.reduce((t, v) => t + v.amount * 0.9, 0); },
  daily() {
    const D = S.deals;
    // tenders being decided
    for (const t of D.tenders.slice()) {
      if (--t.decide > 0) continue;
      D.tenders.splice(D.tenders.indexOf(t), 1);
      if (chance(tenderChance(t))) {
        activate(t);
        showModal({ title: '🏛️ Tender won!', cls: 'good', body: `<p>${partyName(t)} awarded you the contract: <b>${t.title}</b>, worth ${money(contractValue(t))}.</p>` });
      } else { addRel(t.party, 2); log(`🏛️ You lost the tender "${t.title}" from ${partyName(t)}. Better relations improve your odds.`, 'warn'); }
    }
    // active contracts
    for (const c of D.active.slice()) {
      if (c.kind === 'ai') {
        if (S.ai.contractOk[c.id]) { earn(c.daily, 'Contracts'); c.earned += c.daily; addRel(c.party, 0.15); }
        else { strike(c, Math.round(c.daily * 0.5), `your AI couldn't deliver "${c.title}" (needs capability ${c.minCap} and ${c.pf} PF free)`); if (!D.active.includes(c)) continue; }
        if (--c.left <= 0) endContract(c, true);
        continue;
      }
      if (--c.timer > 0) continue;
      c.timer = c.every;
      const got = takeFor(c, Math.min(c.qty, Math.floor(stockFor(c))));
      if (got) { earn(got * c.price, 'Contracts'); c.earned += got * c.price; }
      if (got < c.qty) {
        strike(c, Math.round((c.qty - got) * c.price * 0.3), `you delivered only ${got}/${c.qty} ${c.cat ? DCATS[c.cat].name.toLowerCase() : GOODS[c.item].name}`);
        if (!D.active.includes(c)) continue;
      } else addRel(c.party, 0.3);
      if (--c.left <= 0) endContract(c, true);
    }
    // joint ventures follow their partner's stock
    for (const v of D.ventures.slice()) {
      const st = S.stocks[v.party];
      const r = 0.001 + dayChange(st.hist) * 0.5;
      const pay = v.amount * r;
      if (pay > 0) earn(pay, 'Ventures'); else spend(-pay, 'Ventures');
      v.earned += pay;
      if (chance(0.0015)) {
        const loss = v.amount * 0.6;
        v.amount -= loss;
        log(`💥 Your joint venture with ${partyName(v)} hit serious trouble. Its value dropped by ${money(loss)}.`, 'bad');
      }
    }
    // diplomacy: offices build relations, instability can void government deals
    for (const ctry of COUNTRIES) {
      if (D.offices[ctry.id]) addRel(ctry.id, 0.1);
      if (chance(1 - ctry.stability)) {
        const lost = D.active.filter((c) => c.party === ctry.id);
        D.active = D.active.filter((c) => c.party !== ctry.id);
        addRel(ctry.id, -20);
        delete D.trade[ctry.id];
        log(`🌍 Political crisis in ${ctry.flag} ${ctry.name}! A new government voided ${lost.length} contract(s) and any trade agreement.`, 'bad');
        if (lost.length) showModal({ title: `🌍 Crisis in ${ctry.name}`, cls: 'danger', body: `<p>A sudden change of government voided your contracts there: ${lost.map((c) => esc(c.title)).join(', ')}. No penalties, but the income is gone.</p>` });
      }
    }
    if (S.day >= D.nextOffers) genDealOffers();
  },
  tabs: [{ id: 'deals', name: 'Deals & Diplomacy', icon: '🤝', render: renderDeals }],
  actions: {
    dealView(a) { UI.dealView = a; },
    acceptOffer(id) {
      const D = S.deals, o = D.offers.find((x) => x.id === +id);
      if (!o || offerLocked(o)) return;
      if (o.ptype === 'gov') {
        if (!pay(o.fee, 'Contracts', 'the tender bid')) return;
        D.tenders.push({ ...o, decide: 3 });
        log(`🏛️ You submitted a bid to ${partyName(o)} for "${o.title}" (${money(o.fee)} bid fee). Decision in 3 days.`);
      } else activate(o);
      D.offers.splice(D.offers.indexOf(o), 1);
    },
    lunch(sym) {
      const D = S.deals;
      if ((D.cooldown[sym] || 0) > S.day) return toast('You met them recently. Give it a few days.', 'warn');
      if (!pay(2500, 'Contracts', 'the business lunch')) return;
      addRel(sym, 5); D.cooldown[sym] = S.day + 3;
      toast(`🍽️ Great lunch with ${STOCKS.find((s) => s.sym === sym).name}. Relations +5.`, 'good');
    },
    venture(sym, amt) {
      if (rel(sym) < 40) return toast('They need to trust you more first (relations 40+).', 'warn');
      amt = +amt;
      if (!pay(amt, 'Investments', 'the joint venture')) return;
      S.deals.ventures.push({ id: uid(), party: sym, ptype: 'co', amount: amt, earned: 0, day: S.day });
      addRel(sym, 5);
      stat('ventures');
      log(`🤝 You started a ${money(amt)} joint venture with ${STOCKS.find((s) => s.sym === sym).name}.`, 'good');
    },
    exitVenture(id) {
      const D = S.deals, v = D.ventures.find((x) => x.id === +id);
      earn(v.amount * 0.9, 'Investments');
      D.ventures.splice(D.ventures.indexOf(v), 1);
      toast(`Exited the venture for ${money(v.amount * 0.9)}.`, 'good');
    },
    tradeMission(cid) {
      const D = S.deals, c = CTRY[cid], cost = Math.round(50000 * c.wealth);
      if ((D.cooldown[cid] || 0) > S.day) return toast('Your last delegation just got back. Wait a few days.', 'warn');
      if (!pay(cost, 'Contracts', 'the trade mission')) return;
      addRel(cid, 6); D.cooldown[cid] = S.day + 5;
      toast(`✈️ Trade mission to ${c.name}: relations +6.`, 'good');
    },
    openOffice(cid) {
      const c = CTRY[cid], cost = Math.round(500000 * c.wealth);
      if (S.deals.offices[cid] || !pay(cost, 'Investments', 'the liaison office')) return;
      S.deals.offices[cid] = true; addRel(cid, 15);
      log(`🏛️ You opened a government liaison office in ${c.name}.`, 'good');
    },
    tradeDeal(cid) {
      const c = CTRY[cid], cost = Math.round(2000000 * c.wealth);
      if (S.deals.trade[cid] || rel(cid) < 60 || !pay(cost, 'Contracts', 'the trade agreement')) return;
      S.deals.trade[cid] = true;
      stat('tradeDeals');
      log(`📜 Trade agreement signed with ${c.name}! Commodity purchases are now ${pct(tradeDiscount(), 0)} cheaper.`, 'good');
    },
  },
});
UI.dealView = 'offers';

/* ---------------------------- Rendering ---------------------------- */
function offerCard(o, active) {
  const locked = !active && offerLocked(o);
  const terms = o.kind === 'ai'
    ? `🤖 Needs AI capability <b>${o.minCap}+</b> and <b>${o.pf} PF</b> of compute · pays <b>${money(o.daily)}/day</b> for ${o.days} days`
    : `${itemName(o)} · <b>${o.qty}</b> every ${o.every === 1 ? 'day' : o.every + ' days'} @ <b>${money(o.price)}</b> each · ${o.deliveries} deliveries`;
  let status = '';
  if (active) {
    const have = o.kind === 'ai' ? (aiCap() >= o.minCap ? `capability OK, ${(S.ai.freePF || 0).toFixed(1)} PF spare` : `<span class="bad">your AI is too weak (${aiCap()})</span>`) : `${fmtInt(stockFor(o))} in stock`;
    status = `<div class="small" style="margin-top:6px">${o.kind === 'ai' ? `${o.left} days left` : `${o.left} deliveries left · next in ${o.timer} day(s)`} · ${have} · earned ${money(o.earned)}
      ${o.strikes ? ` · <span class="bad">${o.strikes}/${DEAL_FAIL_LIMIT} strikes</span>` : ''}</div>${bar((o.kind === 'ai' ? (o.days - o.left) / o.days : (o.deliveries - o.left) / o.deliveries) * 100, 'var(--good)')}`;
  }
  return `<div class="card tight ${o.ptype === 'gov' ? 'hl' : ''}"><div class="row between"><b>${partyName(o)}</b><span class="pill ${o.ptype === 'gov' ? 'warn' : ''}">${o.ptype === 'gov' ? 'Government' : 'Company'}</span></div>
    <div style="margin:6px 0"><b>${esc(o.title)}</b></div><div class="small">${terms}</div>
    <div class="small muted">Total value ${money(contractValue(o))} · missing a delivery costs a penalty, ${DEAL_FAIL_LIMIT} strikes cancels it</div>
    ${status}
    ${active ? '' : `<div class="row" style="margin-top:8px">${locked ? `<span class="pill">🔒 Needs relations ${o.minRel} (you have ${Math.round(rel(o.party))})</span>`
      : o.ptype === 'gov' ? btn(`🏛️ Submit bid (${money(o.fee)} fee, ${pct(tenderChance(o), 0)} win chance)`, 'acceptOffer', o.id, { cls: 'sm primary', disabled: !canAfford(o.fee) })
      : btn('✍️ Sign contract', 'acceptOffer', o.id, { cls: 'sm primary' })}</div>`}</div>`;
}

function renderDeals() {
  const D = S.deals;
  const view = seg([['offers', '📨 Offers'], ['active', `📋 Active (${D.active.length + D.tenders.length})`], ['companies', '🏢 Companies'], ['countries', '🌍 Governments']], UI.dealView, 'dealView');
  let body = '';
  if (UI.dealView === 'offers') {
    body = `<div class="banner info small">Supply contracts pay above market but you must deliver on schedule from your warehouse. Government tenders need a bid and good relations. New offers on day ${D.nextOffers}.</div>
      <div class="grid g2">${D.offers.map((o) => offerCard(o)).join('') || '<p class="muted">No offers right now.</p>'}</div>`;
  } else if (UI.dealView === 'active') {
    body = `${D.tenders.length ? `<h4>Bids under review</h4><div class="grid g2 section">${D.tenders.map((t) => `<div class="card tight"><b>${partyName(t)}</b><div class="small">${esc(t.title)} · decision in ${t.decide} day(s) · ${pct(tenderChance(t), 0)} win chance</div></div>`).join('')}</div>` : ''}
      <div class="grid g2">${D.active.map((c) => offerCard(c, true)).join('') || '<p class="muted">No active contracts.</p>'}</div>
      ${D.ventures.length ? `<h4 style="margin-top:14px">Joint ventures</h4><div class="grid g2">${D.ventures.map((v) => `<div class="card tight"><b>${partyName(v)}</b>
        <div class="small">${money(v.amount)} invested · returns follow their stock · earned <span class="${cls(v.earned)}">${signMoney(v.earned)}</span></div>
        <div style="margin-top:6px">${btn(`Exit (${money(v.amount * 0.9)})`, 'exitVenture', v.id, { cls: 'sm' })}</div></div>`).join('')}</div>` : ''}`;
  } else if (UI.dealView === 'companies') {
    body = `<div class="grid g2">${STOCKS.map((s) => {
      const r = rel(s.sym);
      return `<div class="card tight"><div class="row between"><b>🏢 ${s.name}</b><span class="small muted">${s.sector}</span></div>
        ${barline('Relations', r, r >= 40 ? 'var(--good)' : 'var(--warn)')}
        <div class="row" style="margin-top:6px">${btn('🍽️ Business lunch ($2,500, +5)', 'lunch', s.sym, { cls: 'sm', disabled: (D.cooldown[s.sym] || 0) > S.day })}
        ${r >= 40 ? [100000, 1000000, 10000000].map((amt) => btn(`🤝 JV ${money(amt)}`, 'venture', s.sym, { b: amt, cls: 'sm buy', disabled: !canAfford(amt) })).join('') : '<span class="small muted">Joint ventures unlock at relations 40</span>'}</div></div>`;
    }).join('')}</div>`;
  } else {
    body = `<div class="banner info small">Trade agreements (relations 60+) make every commodity you buy ${pct(0.03, 0)} cheaper each, up to ${pct(MAX_TRADE_DISCOUNT, 0)} (now ${pct(tradeDiscount(), 0)}). Watch out for political crises, which can void deals overnight.</div>
      <div class="grid g2">${COUNTRIES.map((c) => {
      const r = rel(c.id), mission = Math.round(50000 * c.wealth), office = Math.round(500000 * c.wealth), trade = Math.round(2000000 * c.wealth);
      return `<div class="card tight"><div class="row between"><b>${c.flag} ${c.name}</b><span class="small muted">Wealth ${'💰'.repeat(Math.ceil(c.wealth))} · stability ${c.stability >= 0.993 ? 'high' : c.stability >= 0.988 ? 'medium' : 'low'}</span></div>
        ${barline('Relations', r, r >= 60 ? 'var(--good)' : r >= 30 ? 'var(--warn)' : 'var(--bad)')}
        <div class="row" style="margin-top:6px">${btn(`✈️ Trade mission (${money(mission)}, +6)`, 'tradeMission', c.id, { cls: 'sm', disabled: (D.cooldown[c.id] || 0) > S.day || !canAfford(mission) })}
        ${D.offices[c.id] ? '<span class="pill good">🏛️ Liaison office</span>' : btn(`🏛️ Liaison office (${money(office)}, +15, slowly grows)`, 'openOffice', c.id, { cls: 'sm', disabled: !canAfford(office) })}
        ${D.trade[c.id] ? '<span class="pill good">📜 Trade agreement</span>' : btn(`📜 Trade agreement (${money(trade)})`, 'tradeDeal', c.id, { cls: 'sm buy', disabled: r < 60 || !canAfford(trade) })}</div></div>`;
    }).join('')}</div>`;
  }
  return `<div class="row between section"><h2>🤝 Deals &amp; Diplomacy</h2><div style="overflow-x:auto;max-width:100%">${view}</div></div>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Business reputation</div><div class="val">${Math.round(D.rep)}</div>${bar(D.rep)}</div>
    <div class="card kpi"><div class="lbl">Active contracts</div><div class="val">${D.active.length}</div><div class="small muted">${D.done} completed · ${D.failed} failed</div></div>
    <div class="card kpi"><div class="lbl">Joint ventures</div><div class="val">${money(D.ventures.reduce((t, v) => t + v.amount, 0))}</div></div>
    <div class="card kpi"><div class="lbl">Trade discount</div><div class="val good">${pct(tradeDiscount(), 0)}</div><div class="small muted">on commodity purchases</div></div>
  </div>${body}`;
}
