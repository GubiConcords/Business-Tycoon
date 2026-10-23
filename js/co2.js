'use strict';
/* =====================================================================
   CO₂ emissions: every factory, plant, launch, jet and kitchen emits.
   Weekly carbon bill above your free allowance, a carbon credit market,
   offsets (forests, direct air capture) and an ESG score.
   ===================================================================== */
const CO2_ALLOWANCE = 300;        // free tonnes per week
const FOREST = { cost: 3000000, absorb: 27, grow: 100, name: 'Reforestation plot (1,000 ha)' };
const DAC = { cost: 20000000, capture: 100, opex: 5000, mwh: 50, name: 'Direct air capture plant' };
const LIFESTYLE_CO2 = { parents: 0.01, studio: 0.02, apartment: 0.04, house: 0.08, mansion: 0.4 };
// direct process emissions per unit of each commodity (t CO₂)
const GOOD_CO2 = { plastic: 0.09, steel: 0.15, alu: 0.06, wire: 0.03, wafer: 0.01, glass: 0.025, battery: 0.03, cups: 0.005, toys: 0.015 };
const DESIGN_CO2 = 0.25 / 1000;   // t CO₂ per $ of product value

const C2 = () => S.co2;
function addCO2(source, t) {
  if (!S.co2 || !t) return;
  S.co2.today[source] = (S.co2.today[source] || 0) + t;
}
const creditPrice = () => C2().creditPrice;
const weekEstimate = () => Math.max(0, C2().week - CO2_ALLOWANCE - C2().credits) * policy('carbon');
function esgScore() {
  const c = C2();
  const rev = Object.values(S.lastLedger).filter((v) => v > 0).reduce((a, b) => a + b, 0) || 1;
  const intensity = c.lastNet / (rev / 1e6);       // t per $1M of revenue
  const P = S.power && S.power.last;
  const renewShare = P && P.demand ? Math.min(1, (P.renew || 0) / Math.max(P.demand, P.gen || 1)) : 0;
  return clamp(Math.round(85 - 18 * Math.log10(1 + Math.max(0, intensity)) + 15 * renewShare + (c.lastNet <= 0 && c.lastGross > 10 ? 10 : 0)), 0, 100);
}

registerModule({
  id: 'co2',
  init(s) {
    s.co2 = { today: {}, last: {}, lastGross: 0, lastNet: 0, lastRemoved: 0, week: 0, hist: [], credits: 0, creditPrice: 8, priceHist: [], forests: [], dac: 0, lifetime: 0, taxPaid: 0, esg: 70 };
  },
  assets(a) { a.carbon = C2().credits * C2().creditPrice + C2().forests.length * FOREST.cost * 0.5 + C2().dac * DAC.cost * 0.5; },
  daily() {
    const c = C2();
    addCO2('🏠 Your lifestyle', LIFESTYLE_CO2[S.life.tier] || 0.02);
    for (const v of S.fleet.vehicles) if (v.kind === 'car') addCO2('🚗 Your cars', 0.01);
    if (c.dac) { spend(c.dac * DAC.opex, 'Carbon'); S.power.extraMWh += c.dac * DAC.mwh; }
  },
  late() {
    const c = C2();
    const target = Math.max(2, policy('carbon') * 0.85);
    c.creditPrice = clamp(c.creditPrice + (target - c.creditPrice) * 0.05 + gauss() * c.creditPrice * 0.03, 1, 500);
    c.priceHist.push(c.creditPrice);
    if (c.priceHist.length > 90) c.priceHist.shift();
    // removals
    let removed = 0;
    for (const f of c.forests) { f.age++; removed += FOREST.absorb * Math.min(1, f.age / FOREST.grow); }
    removed += c.dac * DAC.capture;
    const gross = Object.values(c.today).reduce((a, b) => a + Math.max(0, b), 0);
    const credit = -Object.values(c.today).reduce((a, b) => a + Math.min(0, b), 0);
    const net = gross - credit - removed;
    c.last = c.today; c.today = {};
    c.lastGross = gross; c.lastRemoved = removed + credit; c.lastNet = net;
    c.week += net; c.lifetime += net;
    c.hist.push(net);
    if (c.hist.length > 120) c.hist.shift();
    c.esg = esgScore();
    if (dayName() !== 'Sun') return;
    // weekly settlement: allowance first, then credits, then pay the carbon price
    const over = c.week - CO2_ALLOWANCE;
    if (over > 0) {
      const use = Math.min(c.credits, over);
      c.credits -= use;
      const bill = (over - use) * policy('carbon');
      if (bill > 0) { spend(bill, 'Carbon tax'); c.taxPaid += bill; }
      log(`🌫️ Weekly carbon bill: ${fmtInt(c.week)} t emitted, ${fmtInt(use)} t covered by credits, ${money(bill)} carbon tax at ${money(policy('carbon'))}/t.`, bill > 0 ? 'warn' : '');
    } else {
      const spare = -over;
      c.credits += spare;
      log(`🌿 You stayed ${fmtInt(spare)} t under your carbon allowance this week. Those tonnes became carbon credits you can sell.`, 'good');
    }
    if (c.week <= 0 && c.lastGross > 50) stat('netZeroWeeks');
    c.week = 0;
  },
  tabs: [{ id: 'co2', name: 'CO₂ Emissions', icon: '🌱', render: renderCO2 }],
  actions: {
    buyCredits(n) {
      n = +n;
      if (!pay(n * creditPrice() * 1.02, 'Carbon', 'carbon credits')) return;
      C2().credits += n;
      toast(`Bought ${fmtInt(n)} t of carbon credits.`, 'good');
    },
    sellCredits(n) {
      const c = C2(); n = Math.min(+n, c.credits);
      if (n <= 0) return;
      earn(n * creditPrice() * 0.98, 'Carbon');
      c.credits -= n;
      toast(`Sold ${fmtInt(n)} t of carbon credits.`, 'good');
    },
    plantForest() {
      if (!pay(FOREST.cost, 'Carbon', 'reforestation')) return;
      C2().forests.push({ age: 0 });
      toast('🌳 Trees planted! They absorb more CO₂ as they grow.', 'good');
    },
    buildDAC() {
      if (!pay(DAC.cost, 'Carbon', 'the capture plant')) return;
      C2().dac++;
      toast('🌀 Direct air capture plant online.', 'good');
    },
  },
});

function renderCO2() {
  const c = C2(), src = Object.entries(c.last).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...src.map(([, v]) => Math.abs(v)));
  const esg = c.esg;
  return `<h2 class="section">🌱 CO₂ Emissions</h2>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Net emissions yesterday</div><div class="val ${c.lastNet > 0 ? 'warn' : 'good'}">${fmtInt(c.lastNet)} t</div><div class="small muted">gross ${fmtInt(c.lastGross)} t · removed ${fmtInt(c.lastRemoved)} t</div></div>
    <div class="card kpi"><div class="lbl">This week</div><div class="val">${fmtInt(c.week)} t</div><div class="small muted">free allowance ${CO2_ALLOWANCE} t · est. bill ${money(weekEstimate())}</div></div>
    <div class="card kpi"><div class="lbl">Carbon price</div><div class="val">${money(policy('carbon'))}/t</div><div class="small muted">set by the ${PARTIES[S.world.party].name}${S.world.office && S.world.office.id === 'president' ? ' (by you)' : ''}</div></div>
    <div class="card kpi"><div class="lbl">ESG score</div><div class="val ${esg >= 70 ? 'good' : esg >= 40 ? 'warn' : 'bad'}">${esg}</div>${bar(esg, esg >= 70 ? 'var(--good)' : 'var(--warn)')}<div class="small muted">investors, green governments and customers watch this</div></div>
  </div>
  <div class="grid g2 section">
    <div class="card"><h3>Where your emissions come from (yesterday)</h3>${src.length ? src.map(([k, v]) => `<div class="barline" style="grid-template-columns:200px 1fr 80px"><span class="small">${k}</span>${bar(Math.abs(v) / max * 100, v < 0 ? 'var(--good)' : 'var(--warn)')}<span class="num right ${v < 0 ? 'good' : ''}">${v < 0 ? '−' : ''}${fmtInt(Math.abs(v))} t</span></div>`).join('') : '<p class="muted">Nothing measured yet.</p>'}
      <p class="small muted" style="margin-top:8px">Factories, fossil power plants, grid electricity, kitchens and heating, rocket launches, private jets, shipping and your own lifestyle all emit. Recycling cars and your own clean power help.</p></div>
    <div class="card"><h3>Net emissions per day</h3>${chart('co2', c.hist, 140, { color: '#ff7a1a', labels: true, fmt: (v) => fmtInt(v) + ' t', zero: true })}
      <p class="small muted">Lifetime ${fmtInt(c.lifetime)} t · carbon tax paid ${money(c.taxPaid)}</p></div>
  </div>
  <div class="grid g3">
    <div class="card"><h3>💱 Carbon credit market</h3><div class="kpi"><div class="val">${money(creditPrice())}/t</div></div>${chart('cred', c.priceHist, 40, { color: '#2ecc71' })}
      <p class="small">You hold <b>${fmtInt(c.credits)} t</b> (worth ${money(c.credits * creditPrice())}). Credits are used automatically before you pay the carbon price.</p>
      <div class="row">${[100, 1000, 10000].map((n) => btn(`Buy ${fmtInt(n)} t`, 'buyCredits', n, { cls: 'sm buy', disabled: !canAfford(n * creditPrice()) })).join('')}</div>
      <div class="row" style="margin-top:4px">${[100, 1000, 10000].map((n) => btn(`Sell ${fmtInt(n)} t`, 'sellCredits', n, { cls: 'sm sell', disabled: c.credits < n })).join('')}</div></div>
    <div class="card"><h3>🌳 Reforestation</h3><p class="small muted">${FOREST.name}: ${money(FOREST.cost)}. Absorbs up to ${FOREST.absorb} t/day once grown (${FOREST.grow} days).</p>
      <p>You have <b>${c.forests.length}</b> plot(s).</p>${btn(`Plant a forest (${money(FOREST.cost)})`, 'plantForest', '', { cls: 'sm buy', disabled: !canAfford(FOREST.cost) })}</div>
    <div class="card"><h3>🌀 Direct air capture</h3><p class="small muted">${DAC.name}: ${money(DAC.cost)}. Captures ${DAC.capture} t/day, uses ${DAC.mwh} MWh of electricity and ${money(DAC.opex)}/day to run.</p>
      <p>You have <b>${c.dac}</b> plant(s).</p>${btn(`Build (${money(DAC.cost)})`, 'buildDAC', '', { cls: 'sm buy', disabled: !canAfford(DAC.cost) })}</div>
  </div>`;
}
