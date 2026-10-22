'use strict';
/* =====================================================================
   Restaurants: open venues, hire & pay staff, set prices and quality
   ===================================================================== */
const REST_TYPES = [
  { id: 'truck', name: 'Food Truck', icon: '🚚', cost: 4000, rent: 35, seats: 80, basePrice: 9, ingr: 3.2, demand: 70, maxStaff: 3, noWaiters: true },
  { id: 'cafe', name: 'Coffee Shop', icon: '☕', cost: 15000, rent: 90, seats: 180, basePrice: 6, ingr: 1.6, demand: 160, maxStaff: 7, cookMult: 1.6 },
  { id: 'diner', name: 'Diner', icon: '🍔', cost: 40000, rent: 200, seats: 220, basePrice: 16, ingr: 5.5, demand: 180, maxStaff: 11 },
  { id: 'sushi', name: 'Sushi Bar', icon: '🍣', cost: 120000, rent: 520, seats: 260, basePrice: 38, ingr: 13, demand: 190, maxStaff: 14, wageMult: 1.3 },
  { id: 'fine', name: 'Fine Dining', icon: '🍷', cost: 450000, rent: 1600, seats: 240, basePrice: 110, ingr: 34, demand: 170, maxStaff: 20, wageMult: 1.8 },
  { id: 'chain', name: 'Burger Franchise', icon: '🏪', cost: 900000, rent: 3500, seats: 2200, basePrice: 12, ingr: 3.6, demand: 2000, maxStaff: 30, noWaiters: true, cookMult: 3 },
];
const RT = Object.fromEntries(REST_TYPES.map((t) => [t.id, t]));
const ROLES = {
  cook: { name: 'Cook', icon: '👨‍🍳', wage: 110, desc: 'prepares ~45 meals/day' },
  waiter: { name: 'Waiter', icon: '🧑‍💼', wage: 85, desc: 'serves ~50 guests/day' },
  cleaner: { name: 'Cleaner', icon: '🧹', wage: 65, desc: '1 needed per ~150 guests' },
  manager: { name: 'Manager', icon: '📋', wage: 240, desc: '+12% efficiency, +reputation' },
};
const QUALITY = {
  cheap: { name: 'Budget', mult: 0.7, rep: -15 },
  std: { name: 'Standard', mult: 1, rep: 0 },
  prem: { name: 'Premium', mult: 1.6, rep: 15 },
};
const REST_NAMES = ['Golden Fork', 'Blue Plate', 'The Rusty Spoon', "Mama Rosa's", 'Smoke & Salt', 'Urban Bites', 'Saffron House', 'Lucky Dragon', 'Harbor Grill', 'Velvet Table', 'The Hungry Moose', 'Copper Pot', 'Night Owl', 'Sunny Side', 'Ember & Oak'];
const SHIFT_ENERGY = 40;

const restoById = (id) => S.restaurants.find((r) => r.id === +id);
function restoValue(r) { return RT[r.type].cost * 0.55 * (0.6 + r.rep / 100) * (1 + 0.25 * (r.level - 1)); }
function restoWages(r) {
  const wm = RT[r.type].wageMult || 1;
  return Object.keys(ROLES).reduce((s, k) => s + r.staff[k] * ROLES[k].wage * wm, 0);
}
const staffCount = (r) => Object.values(r.staff).reduce((a, b) => a + b, 0);
const BOTTLENECK = {
  demand: 'Not enough customers: improve reputation, lower prices or run marketing',
  cooks: 'Kitchen is overwhelmed: hire more cooks',
  waiters: 'Guests waiting too long: hire more waiters',
  seats: 'Fully packed: renovate to expand capacity',
  closed: 'Closed today',
};

registerModule({
  id: 'restaurants',
  init(s) { s.restaurants = []; },
  assets(a) { a.restaurants = S.restaurants.reduce((t, r) => t + restoValue(r), 0); },
  daily() {
    const weekend = isWeekend();
    for (const r of S.restaurants) {
      const t = RT[r.type], st = r.staff, q = QUALITY[r.quality];
      let served = 0, demand = 0, revenue = 0, ingr = 0, bottleneck = 'closed';
      if (r.closed > 0) {
        r.closed--;
      } else {
        const repF = 0.4 + r.rep / 60;
        const priceF = clamp(Math.pow(t.basePrice / r.price, 1.6), 0.05, 2.5);
        demand = t.demand * repF * priceF * (r.marketing > 0 ? 1.35 : 1) * (weekend ? 1.3 : 1) * rand(0.85, 1.15);
        const mgr = 1 + 0.12 * Math.min(st.manager, 2);
        const mor = 0.6 + 0.4 * r.morale / 100;
        const self = r.selfShift ? 1 : 0;
        const cookCap = (st.cook + self) * 45 * (t.cookMult || 1) * mgr * mor;
        const serveCap = t.noWaiters ? Infinity : (st.waiter + self) * 50 * mgr * mor;
        const seatCap = t.seats * (1 + 0.3 * (r.level - 1));
        const m = Math.min(demand, cookCap, serveCap, seatCap);
        served = Math.floor(m);
        bottleneck = m === demand ? 'demand' : m === cookCap ? 'cooks' : m === serveCap ? 'waiters' : 'seats';
        revenue = served * r.price;
        ingr = served * t.ingr * q.mult;
        earn(revenue, 'Restaurants');
        spend(ingr, 'Restaurants');
        stat('meals', served);

        const needed = Math.floor(served / 150);
        r.clean = clamp(r.clean + (st.cleaner >= needed ? 5 : -8 * (needed - st.cleaner)), 0, 100);
        const ratio = demand > 0 ? served / demand : 1;
        const pr = r.price / t.basePrice;
        let target = 45 + q.rep + (r.clean - 60) / 3 + (st.manager > 0 ? 6 : 0) + (r.level - 1) * 3 + (r.marketing > 0 ? 4 : 0);
        if (ratio < 0.8) target -= (0.8 - ratio) * 40;
        if (pr > 1.2) target -= (pr - 1.2) * 40;
        else if (pr < 0.85) target += 5;
        r.rep = clamp(r.rep + (clamp(target, 0, 100) - r.rep) * 0.08 + gauss() * 0.8, 0, 100);
      }
      if (r.marketing > 0) r.marketing--;

      spend(t.rent, 'Restaurants');
      const wages = restoWages(r);
      if (wages > 0) {
        if (canAfford(wages)) {
          spend(wages, 'Wages');
          r.morale = clamp(r.morale + 3, 0, 100);
          r.unpaid = 0;
        } else {
          r.unpaid++;
          r.morale = clamp(r.morale - 20, 0, 100);
          log(`⚠️ ${esc(r.name)}: you couldn't pay ${money(wages)} in wages! Staff morale is falling.`, 'bad');
          toast(`Couldn't pay staff at ${esc(r.name)}!`, 'bad');
        }
      }
      if (r.morale < 25) {
        for (const k of Object.keys(ROLES)) {
          let quit = 0;
          for (let i = 0; i < r.staff[k]; i++) if (chance(0.25)) quit++;
          if (quit) { r.staff[k] -= quit; log(`😠 ${quit} ${ROLES[k].name.toLowerCase()}(s) quit ${esc(r.name)} over low morale.`, 'bad'); }
        }
      }
      const profit = revenue - ingr - t.rent - wages;
      r.last = { served, demand: Math.round(demand), revenue, profit, bottleneck };
      r.hist.push(profit);
      if (r.hist.length > 60) r.hist.shift();
      r.selfShift = false;
    }
  },
  tabs: [{ id: 'resto', name: 'Restaurants', icon: '🍽️', render: renderRestaurants }],
  actions: {
    openResto(a) {
      const t = RT[a];
      if (!pay(t.cost, 'Investments', t.name)) return;
      const used = S.restaurants.map((r) => r.name);
      const name = pick(REST_NAMES.filter((n) => !used.includes(n))) || `${t.name} #${S.restaurants.length + 1}`;
      S.restaurants.push({
        id: uid(), type: t.id, name, level: 1, price: t.basePrice, quality: 'std', rep: 30, clean: 80, morale: 80,
        marketing: 0, closed: 0, unpaid: 0, selfShift: false, staff: { cook: 0, waiter: 0, cleaner: 0, manager: 0 }, hist: [], last: null,
      });
      log(`🍽️ You opened ${t.icon} ${name} (${t.name}) for ${money(t.cost)}.`, 'good');
      toast(`Opened ${name}! Hire some staff.`, 'good');
    },
    hire(a, role) {
      const r = restoById(a), t = RT[r.type];
      if (staffCount(r) >= t.maxStaff) return toast(`${t.name} can hold at most ${t.maxStaff} staff. Renovate for more.`, 'warn');
      r.staff[role]++;
    },
    fire(a, role) { const r = restoById(a); if (r.staff[role] > 0) { r.staff[role]--; r.morale = clamp(r.morale - 4, 0, 100); } },
    restoPrice(a, d) {
      const r = restoById(a), t = RT[r.type];
      const step = Math.max(0.5, Math.round(t.basePrice * 0.05 * 2) / 2);
      r.price = clamp(Math.round((r.price + step * +d) * 2) / 2, step, t.basePrice * 4);
    },
    restoQuality(a, q) { restoById(a).quality = q; },
    restoShift(a) {
      const r = restoById(a);
      if (r.selfShift) return toast('You are already working a shift there today.', 'warn');
      if (!useEnergy(SHIFT_ENERGY)) return;
      r.selfShift = true;
      toast(`You'll work a shift at ${esc(r.name)} today (+1 cook/waiter).`, 'good');
    },
    restoMarketing(a) {
      const r = restoById(a), cost = RT[r.type].rent * 6 + 200;
      if (!pay(cost, 'Marketing', 'marketing')) return;
      r.marketing += 7;
      toast(`Marketing campaign running at ${esc(r.name)} for 7 days.`, 'good');
    },
    restoBonus(a) {
      const r = restoById(a), cost = Math.max(100, restoWages(r) * 2);
      if (!pay(cost, 'Wages', 'bonuses')) return;
      r.morale = clamp(r.morale + 30, 0, 100);
      toast('Staff love the bonus! Morale +30', 'good');
    },
    restoRenovate(a) {
      const r = restoById(a), t = RT[r.type];
      if (r.level >= 3) return;
      const cost = t.cost * 0.5 * r.level;
      if (!pay(cost, 'Investments', 'renovation')) return;
      r.level++; r.closed = Math.max(r.closed, 2);
      log(`🔨 ${esc(r.name)} renovated to level ${r.level}. Closed for 2 days.`);
    },
    restoRename(a) {
      const r = restoById(a);
      const n = prompt('New restaurant name:', r.name);
      if (n && n.trim()) r.name = n.trim().slice(0, 40);
    },
    restoSell(a) {
      const r = restoById(a), v = restoValue(r);
      showModal({
        title: `Sell ${esc(r.name)}?`, body: `<p>A buyer offers <b>${money(v)}</b>. All staff will be let go.</p>`,
        buttons: [
          { label: `Sell for ${money(v)}`, cls: 'danger', fn: () => {
            earn(v, 'Investments');
            S.restaurants.splice(S.restaurants.indexOf(r), 1);
            log(`💼 Sold ${esc(r.name)} for ${money(v)}.`);
          } },
          { label: 'Cancel' },
        ],
      });
    },
  },
});

function renderRestaurants() {
  const shop = REST_TYPES.map((t) => `<div class="card tight">
    <div class="row"><span class="big-ico">${t.icon}</span><div class="grow"><b>${t.name}</b>
    <div class="small muted">${money(t.cost)} · rent ${money(t.rent)}/day · up to ${t.maxStaff} staff</div>
    <div class="small muted">~${t.demand} guests/day · menu ~${money(t.basePrice)}</div></div></div>
    <div style="margin-top:8px">${btn('Open', 'openResto', t.id, { cls: 'buy sm', disabled: !canAfford(t.cost) })}</div></div>`).join('');

  const cards = S.restaurants.map((r) => {
    const t = RT[r.type], L = r.last;
    const wm = t.wageMult || 1;
    const staff = Object.entries(ROLES).filter(([k]) => !(t.noWaiters && k === 'waiter')).map(([k, ro]) => `<div class="staff-row">
      <span>${ro.icon} ${ro.name} <b>×${r.staff[k]}</b> <span class="small muted">${money(ro.wage * wm)}/day · ${ro.desc}</span></span>
      ${btn('Hire', 'hire', r.id, { b: k, cls: 'sm buy', disabled: staffCount(r) >= t.maxStaff })}
      ${btn('Fire', 'fire', r.id, { b: k, cls: 'sm sell', disabled: !r.staff[k] })}</div>`).join('');
    const renoCost = t.cost * 0.5 * r.level;
    const mktCost = t.rent * 6 + 200;
    return `<div class="card ${r.unpaid ? 'danger' : ''}">
      <div class="row between"><div class="row"><span class="big-ico">${t.icon}</span><div>
        <h3 style="margin:0">${esc(r.name)} <button class="btn sm" data-act="restoRename" data-a="${r.id}" title="Rename">✏️</button></h3>
        <div class="small muted">${t.name} · Level ${r.level} · ${staffCount(r)}/${t.maxStaff} staff · wages ${money(restoWages(r))}/day + rent ${money(t.rent)}</div></div></div>
        <div class="row">${r.closed ? `<span class="pill bad">Closed ${r.closed}d</span>` : '<span class="pill good">Open</span>'}
        ${r.marketing ? `<span class="pill good">📣 ${r.marketing}d</span>` : ''}${btn('Sell', 'restoSell', r.id, { cls: 'sm' })}</div></div>
      <div class="grid g2" style="margin-top:10px">
        <div>
          ${barline('Reputation', r.rep, 'var(--accent)')}${barline('Cleanliness', r.clean, '#36c2b4')}${barline('Morale', r.morale, r.morale < 30 ? 'var(--bad)' : 'var(--good)')}
          ${L ? `<p class="small" style="margin-top:8px">Yesterday: <b>${L.served}</b> served / ${L.demand} wanted · revenue ${money(L.revenue)} · profit <b class="${cls(L.profit)}">${signMoney(L.profit)}</b></p>
          <p class="small ${L.bottleneck === 'demand' ? 'muted' : 'warn'}">🔎 ${BOTTLENECK[L.bottleneck]}</p>` : '<p class="small muted">No results yet. Hire staff, then wait for the day to end.</p>'}
          ${r.hist.length > 1 ? chart('resto' + r.id, r.hist, 60, { zero: true }) : ''}
        </div>
        <div>
          <div class="row" style="margin-bottom:8px"><span class="small muted">Menu price</span>
            ${btn('−', 'restoPrice', r.id, { b: -1, cls: 'sm' })}<b class="num">${money(r.price)}</b>${btn('+', 'restoPrice', r.id, { b: 1, cls: 'sm' })}
            <span class="small muted">(typical ${money(t.basePrice)})</span></div>
          <div class="row" style="margin-bottom:8px"><span class="small muted">Ingredients</span>
            <div class="seg">${Object.entries(QUALITY).map(([k, q]) => btn(q.name, 'restoQuality', r.id, { b: k, cls: 'sm ' + (r.quality === k ? 'on' : '') })).join('')}</div></div>
          ${staff}
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        ${btn(`👨‍🍳 Work a shift (${SHIFT_ENERGY}⚡)`, 'restoShift', r.id, { cls: 'sm', disabled: r.selfShift || S.energy < SHIFT_ENERGY })}
        ${btn(`📣 Marketing 7d (${money(mktCost)})`, 'restoMarketing', r.id, { cls: 'sm', disabled: !canAfford(mktCost) })}
        ${btn(`🎁 Staff bonus (${money(Math.max(100, restoWages(r) * 2))})`, 'restoBonus', r.id, { cls: 'sm' })}
        ${r.level < 3 ? btn(`🔨 Renovate (${money(renoCost)})`, 'restoRenovate', r.id, { cls: 'sm', disabled: !canAfford(renoCost) }) : '<span class="pill">Max level</span>'}
      </div></div>`;
  }).join('');

  return `<h2 class="section">🍽️ Restaurants</h2>
  ${S.restaurants.length ? '' : '<div class="banner info">Start small: a <b>Food Truck</b> costs $4,000. You can even run it yourself by working shifts before you hire anyone.</div>'}
  <div class="grid section">${cards}</div>
  <h4>Open a new venue</h4><div class="grid g3">${shop}</div>`;
}
