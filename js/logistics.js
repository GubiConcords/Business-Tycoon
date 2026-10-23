'use strict';
/* =====================================================================
   Logistics & exports: build a fleet of trucks, freight trains, cargo
   ships and cargo planes, and export your goods to foreign markets for
   higher prices. Mind tariffs, transit times, port strikes and piracy.
   ===================================================================== */
const MODES = {
  truck: { name: 'Truck', icon: '🚛', cap: 40, cost: 150000, trip: 2000, days: 3, reach: 1, co2: 0.5 },
  train: { name: 'Freight train', icon: '🚂', cap: 400, cost: 3000000, trip: 10000, days: 5, reach: 2, co2: 3 },
  ship: { name: 'Cargo ship', icon: '🚢', cap: 4000, cost: 40000000, trip: 50000, days: 16, reach: 3, co2: 100 },
  plane: { name: 'Cargo plane', icon: '🛫', cap: 200, cost: 25000000, trip: 80000, days: 2, reach: 3, co2: 60 },
};
// how far each country is: 1 = next door, 2 = same continent, 3 = overseas
const DIST = { nov: 1, eld: 1, arc: 2, qas: 2, zan: 3, isl: 3 };
const PREMIUM = { nov: 1.12, eld: 1.18, arc: 1.3, qas: 1.35, zan: 1.4, isl: 1.25 };
// cargo space used by one unit of a designed product
const CARGO = { chip: 0.01, phone: 0.02, avionics: 0.2, radar: 0.5, carEngine: 0.5, armor: 1, rotor: 1, car: 2, jetEngine: 5, satellite: 5, helicopter: 20, fighter: 30, tank: 60, bomber: 100, aircraft: 150, rocketEngine: 10, rocket: 400, capsule: 15 };
const MILITARY = ['helicopter', 'tank', 'fighter', 'bomber'];

const LG = () => S.logi;
const freeVehicles = (m) => LG().fleet[m] - LG().trips.filter((t) => t.mode === m && t.back > S.day).length;
const tariff = (c) => (S.deals.trade[c] ? 0 : rel(c) < 20 ? 0.25 : 0.12);
const tripDays = (m, c) => Math.max(1, Math.round(MODES[m].days * (DIST[c] === 3 ? 1.6 : DIST[c] === 2 ? 1.2 : 1) * (1 - 0.2 * execSkill('logistics'))));
const itemValue = (ref) => (isD(ref) ? refD(ref).price * S.dmarket[refD(ref).cat] * worldMult('design') : gPrice(ref));
const itemCargo = (ref) => (isD(ref) ? CARGO[refD(ref).cat] || 1 : 1);
function exportables() {
  const goods = Object.keys(GOODS).filter((g) => S.goods[g].stock >= 1).map((g) => g);
  const des = S.designs.filter((d) => d.stock >= 1 && d.status === 'approved' && d.cat !== 'rocket').map((d) => 'd:' + d.id);
  return [...goods, ...des];
}

registerModule({
  id: 'logistics',
  init(s) { s.logi = { fleet: { truck: 0, train: 0, ship: 0, plane: 0 }, trips: [], delivered: 0, revenue: 0 }; },
  assets(a) {
    const L = LG();
    a.logistics = Object.entries(L.fleet).reduce((t, [m, n]) => t + n * MODES[m].cost * 0.6, 0) + L.trips.filter((t) => !t.done).reduce((t, x) => t + x.value * 0.9, 0);
  },
  daily() {
    const L = LG();
    for (const [m, n] of Object.entries(L.fleet)) if (n) spend(n * MODES[m].cost * 0.0004, 'Logistics');
    for (const t of L.trips) {
      if (t.done || S.day < t.arrive) continue;
      if (t.mode === 'ship' && chance(0.01)) {
        t.done = true;
        if (t.insured) earn(t.value * 0.9, 'Logistics');
        log(`🏴‍☠️ Pirates seized your cargo ship bound for ${CTRY[t.to].name}!${t.insured ? ' Insurance paid out.' : ' The cargo is lost.'}`, 'bad');
        continue;
      }
      if (t.mode === 'ship' && !t.delayed && chance(0.05)) { t.delayed = true; t.arrive += 7; t.back += 7; log(`⚓ Port strike in ${CTRY[t.to].name}: your shipment is delayed a week.`, 'warn'); continue; }
      t.done = true;
      earn(t.value, 'Logistics');
      L.delivered++; L.revenue += t.value;
      addRel(t.to, 0.5);
      log(`📦 Delivered ${t.label} to ${CTRY[t.to].flag} ${CTRY[t.to].name}: ${money(t.value)} after ${pct(tariff(t.to), 0)} tariff.`, 'good');
    }
    L.trips = L.trips.filter((t) => !t.done || t.back > S.day);
  },
  tabs: [{ id: 'logistics', name: 'Logistics & Exports', icon: '🚢', render: renderLogistics }],
  actions: {
    buyVehicle(m) {
      if (!pay(MODES[m].cost, 'Investments', MODES[m].name)) return;
      LG().fleet[m]++;
      toast(`${MODES[m].icon} New ${MODES[m].name.toLowerCase()} added to your fleet.`, 'good');
    },
    sellVehicle2(m) {
      if (freeVehicles(m) < 1) return toast('All of them are on the road.', 'warn');
      LG().fleet[m]--;
      earn(MODES[m].cost * 0.6, 'Investments');
    },
    lgSet(k, v) { UI.lg[k] = k === 'qty' ? +v : k === 'insure' ? v === '1' : v; },
    ship() {
      const L = LG(), o = UI.lg, m = MODES[o.mode], ref = o.item;
      if (!ref || (!isD(ref) && !GOODS[ref]) || (isD(ref) && !refD(ref))) return toast('Pick something to export.', 'warn');
      if (DIST[o.to] > m.reach) return toast(`${m.name}s can't reach ${CTRY[o.to].name}.`, 'warn');
      if (isD(ref) && MILITARY.includes(refD(ref).cat) && (!hasDefenseLicense() || rel(o.to) < 40)) return toast('Arms exports need a defense license and relations 40+ with the buyer.', 'warn');
      const nVeh = freeVehicles(o.mode);
      if (nVeh < 1) return toast(`No free ${m.name.toLowerCase()}s. Buy more or wait for them to return.`, 'warn');
      const maxUnits = Math.floor(nVeh * m.cap / itemCargo(ref));
      const qty = Math.min(o.qty === 0 ? Infinity : o.qty, Math.floor(stockOf(ref)), maxUnits);
      if (qty < 1) return toast(maxUnits < 1 ? 'Too big for this vehicle.' : 'Nothing in stock.', 'warn');
      const veh = Math.ceil(qty * itemCargo(ref) / m.cap);
      const cost = veh * m.trip * (1 - 0.3 * execSkill('logistics'));
      const value = qty * itemValue(ref) * PREMIUM[o.to] * (1 - tariff(o.to));
      const prem = o.insure ? value * 0.02 : 0;
      if (!pay(cost + prem, 'Logistics', 'shipping')) return;
      addStock(ref, -qty);
      const days = tripDays(o.mode, o.to);
      for (let i = 0; i < veh; i++) L.trips.push({ id: uid(), mode: o.mode, to: o.to, arrive: S.day + days, back: S.day + days * 2, value: i === 0 ? value : 0, label: `${fmtInt(qty)} × ${refName(ref)}`, insured: o.insure, done: i > 0 });
      addCO2('🚢 Shipping', veh * m.co2);
      stat('shipments');
      toast(`${m.icon} Shipped ${fmtInt(qty)} × ${esc(refName(ref))} to ${CTRY[o.to].name}. Arrives in ${days} days.`, 'good');
    },
  },
});
UI.lg = { item: '', qty: 0, to: 'nov', mode: 'truck', insure: true };

function renderLogistics() {
  const L = LG(), o = UI.lg, list = exportables();
  if (!list.includes(o.item)) o.item = list[0] || '';
  const ref = o.item, m = MODES[o.mode];
  let quote = '';
  if (ref) {
    const nVeh = freeVehicles(o.mode), maxUnits = Math.floor(Math.max(0, nVeh) * m.cap / itemCargo(ref));
    const qty = Math.min(o.qty === 0 ? Infinity : o.qty, Math.floor(stockOf(ref)), maxUnits);
    const home = qty * itemValue(ref) * 0.95, abroad = qty * itemValue(ref) * PREMIUM[o.to] * (1 - tariff(o.to));
    const veh = Math.ceil(qty * itemCargo(ref) / m.cap), cost = veh * m.trip * (1 - 0.3 * execSkill('logistics'));
    quote = DIST[o.to] > m.reach ? `<p class="bad small">${m.name}s can't reach ${CTRY[o.to].name}.</p>` : qty < 1 ? `<p class="warn small">${nVeh < 1 ? `No free ${m.name.toLowerCase()}s.` : 'Nothing to ship.'}</p>`
      : `<p class="small">Ship <b>${fmtInt(qty)}</b> on ${veh} ${m.name.toLowerCase()}(s), arriving in ${tripDays(o.mode, o.to)} days. They earn <b class="good">${money(abroad)}</b> abroad (vs ${money(home)} selling at home), cost ${money(cost)} in shipping, and face a ${pct(tariff(o.to), 0)} tariff.</p>`;
  }
  const fleet = Object.entries(MODES).map(([k, md]) => `<div class="card tight"><b>${md.icon} ${md.name}s: ${L.fleet[k]}</b> <span class="small muted">(${Math.max(0, freeVehicles(k))} free)</span>
    <div class="small muted">Carries ${fmtInt(md.cap)} units · ${md.days}+ days · ${money(md.trip)}/trip · reaches ${['', 'neighbors', 'the continent', 'anywhere'][md.reach]}</div>
    <div class="row" style="margin-top:6px">${btn(`Buy ${money(md.cost)}`, 'buyVehicle', k, { cls: 'sm buy', disabled: !canAfford(md.cost) })}${btn('Sell', 'sellVehicle2', k, { cls: 'sm', disabled: L.fleet[k] < 1 })}</div></div>`).join('');
  const trips = L.trips.filter((t) => !t.done && t.value).map((t) => `<div class="list-item"><span class="big-ico">${MODES[t.mode].icon}</span><div class="grow"><b>${esc(t.label)}</b> → ${CTRY[t.to].flag} ${CTRY[t.to].name}<div class="small muted">Arrives day ${t.arrive} · worth ${money(t.value)}${t.insured ? ' · insured' : ''}</div></div></div>`).join('');
  return `<h2 class="section">🚢 Logistics &amp; Exports</h2>
  <div class="grid g4 section">${fleet}</div>
  <div class="grid g2">
    <div class="card hl"><h3>📦 New export shipment</h3>
      <div class="dz-row"><span class="small muted">Cargo</span>${list.length ? `<div class="seg wrap">${list.slice(0, 24).map((r) => btn(`${refIcon(r)} ${esc(refName(r))} (${fmtInt(stockOf(r))})`, 'lgSet', 'item', { b: r, cls: 'sm ' + (o.item === r ? 'on' : '') })).join('')}</div>` : '<span class="small muted">Your warehouse is empty.</span>'}</div>
      <div class="dz-row"><span class="small muted">Amount</span><div class="seg">${[[0, 'Max'], [10, '10'], [100, '100'], [1000, '1K']].map(([v, l]) => btn(l, 'lgSet', 'qty', { b: v, cls: 'sm ' + (o.qty === v ? 'on' : '') })).join('')}</div></div>
      <div class="dz-row"><span class="small muted">Destination</span><div class="seg wrap">${Object.keys(DIST).map((c) => btn(`${CTRY[c].flag} ${CTRY[c].name.replace(/^(Federation|Kingdom|Sultanate|People's Republic|Republic) of /, '')} ×${PREMIUM[c]}${tariff(c) ? ` −${pct(tariff(c), 0)}` : ''}`, 'lgSet', 'to', { b: c, cls: 'sm ' + (o.to === c ? 'on' : '') })).join('')}</div></div>
      <div class="dz-row"><span class="small muted">Transport</span><div class="seg wrap">${Object.entries(MODES).map(([k, md]) => btn(`${md.icon} ${md.name}`, 'lgSet', 'mode', { b: k, cls: 'sm ' + (o.mode === k ? 'on' : '') })).join('')}</div></div>
      <div class="dz-row"><span class="small muted">Cargo insurance</span><div class="seg">${btn('🛡️ 2%', 'lgSet', 'insure', { b: '1', cls: 'sm ' + (o.insure ? 'on' : '') })}${btn('None', 'lgSet', 'insure', { b: '0', cls: 'sm ' + (o.insure ? '' : 'on') })}</div></div>
      ${quote}${btn('🚚 Ship it', 'ship', '', { cls: 'primary', disabled: !ref })}</div>
    <div class="card"><h3>🧭 In transit</h3>${trips || '<p class="muted">Nothing on the way.</p>'}
      <p class="small muted" style="margin-top:8px">${L.delivered} shipments delivered · ${money(L.revenue)} export revenue. Trade agreements remove tariffs, and a Logistics chief speeds things up.</p></div>
  </div>`;
}
