'use strict';
/* =====================================================================
   Garage & Hangar: buy personal cars and private aircraft (or take your
   own designs off the production line). They cost upkeep, but bring
   prestige, comfort, getaways and faster business travel.
   ===================================================================== */
const CAR_CATALOG = [
  // id, name, icon, price, prestige, comfort (max energy), value change per day
  ['hatch', 'Used Hatchback', '🚗', 8000, 1, 0, -0.0006],
  ['sedan', 'Family Sedan', '🚙', 28000, 2, 2, -0.0006],
  ['suv', 'Luxury SUV', '🚙', 85000, 5, 5, -0.0006],
  ['ev', 'Electric Super-Sedan', '🔋', 120000, 7, 6, -0.0007],
  ['sport', 'German Sports Car', '🏎️', 140000, 8, 6, -0.0005],
  ['gt', 'British Grand Tourer', '🏎️', 260000, 13, 10, -0.0004],
  ['super', 'Italian Supercar', '🏎️', 320000, 15, 8, -0.0003],
  ['classic', 'Vintage Classic', '🚗', 450000, 18, 4, 0.0004],
  ['limo', 'Armored Limousine', '🚘', 600000, 20, 15, -0.0004],
  ['hyper', 'Limited Hypercar', '🚀', 2500000, 30, 10, 0.0001],
].map(([id, name, icon, price, prestige, comfort, rate]) => ({ id, name, icon, price, prestige, comfort, rate }));
const PLANE_CATALOG = [
  // id, name, icon, price, prestige, size (hangar space & licence needed)
  ['ultra', 'Ultralight', '🪂', 45000, 3, 1],
  ['prop', 'Single-engine Prop (4 seats)', '🛩️', 350000, 8, 1],
  ['turbo', 'Twin Turboprop', '🛩️', 2500000, 20, 2],
  ['light', 'Light Jet', '✈️', 7000000, 35, 2],
  ['mid', 'Midsize Jet', '✈️', 18000000, 50, 3],
  ['long', 'Long-range Business Jet', '✈️', 55000000, 80, 3],
  ['vip', 'VIP Airliner', '🛫', 95000000, 120, 4],
].map(([id, name, icon, price, prestige, size]) => ({ id, name, icon, price, prestige, size }));
const HANGAR_TYPES = [
  { id: 'small', name: 'Small T-hangar', icon: '🛖', cap: 4, rent: 60, equip: 5000 },
  { id: 'jet', name: 'Jet hangar', icon: '🏚️', cap: 9, rent: 600, equip: 60000 },
  { id: 'grand', name: 'Grand hangar', icon: '🏟️', cap: 24, rent: 3000, equip: 500000 },
];
const HGT = Object.fromEntries(HANGAR_TYPES.map((h) => [h.id, h]));
const HOME_SLOTS = { parents: 1, studio: 1, apartment: 2, house: 4, mansion: 10 };
const LICENSES = [
  { level: 1, name: 'Private pilot license', cost: 15000, days: 20, size: 2 },
  { level: 2, name: 'Jet type rating', cost: 120000, days: 40, size: 3 },
];
const CREW_WAGE = [0, 300, 1500, 4000, 9000];   // per day, by aircraft size
const SIZE_NAME = ['', 'light aircraft', 'turboprop / light jet', 'business jet', 'airliner'];
const VAULT_COST = 80000, VAULT_SLOTS = 6;

const F = () => S.fleet;
const carSlots = () => (HOME_SLOTS[S.life.tier] || 1) + F().vault * VAULT_SLOTS;
const carsOwned = () => F().vehicles.filter((v) => v.kind === 'car');
const planesOwned = () => F().vehicles.filter((v) => v.kind === 'plane');
const hangarCap = () => F().hangars.reduce((t, h) => t + HGT[h.type].cap, 0);
const hangarUsed = () => planesOwned().reduce((t, v) => t + v.size, 0);
const licSize = () => (F().license ? LICENSES[F().license - 1].size : 0);
const canFly = (v) => v.kind === 'plane' && (v.size <= licSize() || v.crew);
const prestige = () => F().vehicles.reduce((t, v) => t + v.prestige * (v.kind === 'plane' && !canFly(v) ? 0.5 : 1), 0);
const vehicleEnergyBonus = () => (S.fleet ? carsOwned().reduce((m, v) => Math.max(m, v.comfort), 0) : 0);
const hasJet = () => planesOwned().some((v) => v.size >= 2 && canFly(v));
const vehicleUpkeep = (v) => (v.kind === 'car' ? v.value * 0.0007 + 10 : v.value * 0.0005 + (v.crew ? CREW_WAGE[v.size] : 0));

function addVehicle(v) {
  F().vehicles.push({ id: uid(), crew: false, ...v });
  stat('vehiclesBought');
  log(`🔑 ${v.icon} You got a ${esc(v.name)}!`, 'good');
}
function roomFor(kind, size) {
  if (kind === 'car' && carsOwned().length >= carSlots()) { toast('Your garage is full. Move somewhere bigger or buy a car vault.', 'warn'); return false; }
  if (kind === 'plane' && hangarUsed() + size > hangarCap()) { toast(`Not enough hangar space (needs ${size}, you have ${hangarCap() - hangarUsed()} free). Rent a bigger hangar.`, 'warn'); return false; }
  return true;
}

registerModule({
  id: 'fleet',
  init(s) { s.fleet = { vehicles: [], hangars: [], vault: 0, license: 0, training: null, lastTrip: 0 }; },
  assets(a) { a.vehicles = F().vehicles.reduce((t, v) => t + v.value, 0) + F().hangars.reduce((t, h) => t + siteValue(h.site) + HGT[h.type].equip * 0.5, 0); },
  daily() {
    const fl = F();
    for (const v of fl.vehicles) {
      v.value *= 1 + v.rate;
      spend(vehicleUpkeep(v), 'Vehicles');
    }
    for (const h of fl.hangars) {
      h.bills = makeBills(h.site, { elec: 3 * HGT[h.type].cap, net: 5 }, {}, true, HGT[h.type].equip);
      payBills(h.bills);
    }
    if (fl.training && --fl.training.left <= 0) {
      fl.license = fl.training.level;
      log(`🎓 You earned your ${LICENSES[fl.license - 1].name}! You can now fly ${SIZE_NAME[licSize()]}s yourself.`, 'good');
      toast(`🎓 ${LICENSES[fl.license - 1].name} earned!`, 'good');
      fl.training = null;
    }
  },
  tabs: [{ id: 'fleet', name: 'Garage & Hangar', icon: '🛩️', render: renderFleet }],
  actions: {
    fleetView(a) { UI.fleetView = a; },
    buyCar(id) {
      const c = CAR_CATALOG.find((x) => x.id === id);
      if (!roomFor('car') || !pay(c.price, 'Vehicles', c.name)) return;
      addVehicle({ kind: 'car', name: c.name, icon: c.icon, value: c.price, prestige: c.prestige, comfort: c.comfort, rate: c.rate });
    },
    buyPlane(id) {
      const p = PLANE_CATALOG.find((x) => x.id === id);
      if (!roomFor('plane', p.size) || !pay(p.price, 'Vehicles', p.name)) return;
      addVehicle({ kind: 'plane', name: p.name, icon: p.icon, value: p.price, prestige: p.prestige, size: p.size, rate: -0.0003 });
    },
    takeOwn(did) {
      const d = dById(did);
      if (!d || d.stock < 1) return toast('None in stock. Produce one first!', 'warn');
      if (d.cat === 'car') {
        if (!roomFor('car') || !pay(500, 'Vehicles', 'registration')) return;
        d.stock--;
        addVehicle({ kind: 'car', name: `${d.name} (your design)`, icon: '🚙', value: d.price, prestige: clamp(Math.round(d.price / 10000), 1, 40), comfort: clamp(Math.round(d.price / 8000), 0, 15), rate: -0.0005, own: true });
      } else {
        const size = d.stats.seats <= 100 ? 3 : 4;
        if (!roomFor('plane', size) || !pay(25000, 'Vehicles', 'aircraft registration')) return;
        d.stock--;
        addVehicle({ kind: 'plane', name: `${d.name} (your design)`, icon: '🛫', value: d.price, prestige: Math.max(20, Math.round(d.price / 500000)), size, rate: -0.0003, own: true });
      }
    },
    sellVehicle(id) {
      const fl = F(), v = fl.vehicles.find((x) => x.id === +id), price = v.value * 0.9;
      showModal({
        title: `Sell your ${esc(v.name)}?`, body: `<p>A dealer offers <b>${money(price)}</b>.</p>`,
        buttons: [{ label: `Sell for ${money(price)}`, cls: 'danger', fn: () => { earn(price, 'Vehicles'); fl.vehicles.splice(fl.vehicles.indexOf(v), 1); } }, { label: 'Cancel' }],
      });
    },
    toggleCrew(id) { const v = F().vehicles.find((x) => x.id === +id); v.crew = !v.crew; },
    buyVault() {
      if (!pay(VAULT_COST * (F().vault + 1), 'Vehicles', 'the car vault')) return;
      F().vault++;
      toast(`🏗️ Car vault expanded: +${VAULT_SLOTS} garage slots.`, 'good');
    },
    openHangar(t) {
      const h = HGT[t];
      openBusiness({
        title: `a ${h.name}`, icon: h.icon, equipment: h.equip, permit: { name: 'Airport tenancy permit', cost: 1000 + h.cap * 500 }, rent: h.rent, price: h.rent * 600,
        extra: `<p class="small muted">Fits ${h.cap} units of aircraft (light aircraft = 1, turboprop/light jet = 2, business jet = 3, airliner = 4).</p>`,
        done(site) { F().hangars.push({ id: uid(), type: t, site, bills: null }); log(`${h.icon} You opened a ${h.name} at the airport.`, 'good'); },
      });
    },
    hangarBuySite(id) { buySite(F().hangars.find((h) => h.id === +id).site); },
    takeLicense(lv) {
      const fl = F(), L = LICENSES[+lv - 1];
      if (fl.training || fl.license >= L.level || fl.license < L.level - 1) return;
      if (!pay(L.cost, 'Vehicles', 'flight training')) return;
      fl.training = { level: L.level, left: L.days };
      toast(`🎓 Flight school started: ${L.name} in ${L.days} days.`, 'good');
    },
    getaway(id) {
      const fl = F(), v = fl.vehicles.find((x) => x.id === +id);
      if (fl.lastTrip === S.day) return toast('You already took a trip today.', 'warn');
      if (v.kind === 'plane' && !canFly(v)) return toast('You need a pilot license or a crew to fly this.', 'warn');
      const cost = v.kind === 'car' ? Math.max(40, v.value * 0.0003) : Math.max(500, v.value * 0.0008);
      if (!pay(cost, 'Vehicles', 'fuel')) return;
      const gain = v.kind === 'car' ? 10 : 35;
      S.energy = Math.min(energyMax(), S.energy + gain);
      fl.lastTrip = S.day;
      toast(v.kind === 'car' ? `🛣️ A drive in the ${esc(v.name)} clears your head. +${gain}⚡` : `🏝️ Weekend getaway in your ${esc(v.name)}! +${gain}⚡`, 'good');
    },
  },
});
UI.fleetView = 'mine';

/* ---------------------------- Rendering ---------------------------- */
function renderFleet() {
  const fl = F();
  const view = seg([['mine', '🔑 My vehicles'], ['cars', '🚗 Car dealer'], ['planes', '🛩️ Aircraft dealer'], ['airport', '🛫 Hangars & pilot']], UI.fleetView, 'fleetView');
  let body = '';
  if (UI.fleetView === 'cars') {
    const own = S.designs.filter((d) => d.cat === 'car' && d.status === 'approved');
    body = `${own.length ? `<h4>Your own designs (from factory stock)</h4><div class="grid g3 section">${own.map((d) => `<div class="card tight"><b>🚙 ${esc(d.name)}</b>
      <div class="small muted">${DCATS.car.statLine(d.stats)} · worth ${money(d.price)} · ${fmtInt(d.stock)} in stock</div>
      <div style="margin-top:8px">${btn('Take one ($500 registration)', 'takeOwn', d.id, { cls: 'sm buy', disabled: d.stock < 1 })}</div></div>`).join('')}</div>` : ''}
      <h4>Dealer</h4><div class="grid g3">${CAR_CATALOG.map((c) => `<div class="card tight"><div class="row"><span class="big-ico">${c.icon}</span><div class="grow"><b>${c.name}</b>
      <div class="small muted">Prestige ${c.prestige} · comfort +${c.comfort}⚡ · ${c.rate > 0 ? '📈 appreciates' : '📉 depreciates'}</div></div></div>
      <div style="margin-top:8px">${btn(`Buy ${money(c.price)}`, 'buyCar', c.id, { cls: 'sm buy', disabled: !canAfford(c.price) })}</div></div>`).join('')}</div>`;
  } else if (UI.fleetView === 'planes') {
    const own = S.designs.filter((d) => d.cat === 'aircraft' && d.status === 'approved');
    const card = (name, icon, sub, action) => `<div class="card tight"><div class="row"><span class="big-ico">${icon}</span><div class="grow"><b>${name}</b><div class="small muted">${sub}</div></div></div><div style="margin-top:8px">${action}</div></div>`;
    body = `${hangarCap() ? '' : '<div class="banner warn small">You need a hangar before you can own aircraft. See <b>Hangars &amp; pilot</b>.</div>'}
      ${own.length ? `<h4>Your own aircraft designs</h4><div class="grid g3 section">${own.map((d) => card(esc(d.name), '🛫', `${DCATS.aircraft.statLine(d.stats)} · worth ${money(d.price)} · ${fmtInt(d.stock)} in stock`,
        btn('Take one ($25K registration)', 'takeOwn', d.id, { cls: 'sm buy', disabled: d.stock < 1 }))).join('')}</div>` : ''}
      <h4>Aircraft dealer</h4><div class="grid g3">${PLANE_CATALOG.map((p) => card(p.name, p.icon, `Prestige ${p.prestige} · hangar space ${p.size} · ${p.size <= licSize() ? 'you can fly it' : `needs a crew (${money(CREW_WAGE[p.size])}/day) or a license`}`,
        btn(`Buy ${money(p.price)}`, 'buyPlane', p.id, { cls: 'sm buy', disabled: !canAfford(p.price) || hangarUsed() + p.size > hangarCap() }))).join('')}</div>`;
  } else if (UI.fleetView === 'airport') {
    const hangars = fl.hangars.map((h) => `<div class="card tight"><b>${HGT[h.type].icon} ${HGT[h.type].name}</b> <span class="small muted">space ${HGT[h.type].cap}</span>
      <div class="small">${siteLabel(h.site)}</div>${billsHtml(h.bills)}
      ${h.site.own ? '' : `<div style="margin-top:6px">${btn(`🔑 Buy it (${money(sitePrice(h.site))})`, 'hangarBuySite', h.id, { cls: 'sm', disabled: !canAfford(sitePrice(h.site)) })}</div>`}</div>`).join('');
    body = `<div class="grid g2 section">
      <div class="card"><h3>🎓 Pilot training</h3><p class="small muted">Fly your own aircraft instead of paying a crew. ${fl.license ? `You hold a <b>${LICENSES[fl.license - 1].name}</b>.` : 'You have no license yet.'}</p>
        ${fl.training ? `<p>In flight school: ${LICENSES[fl.training.level - 1].name}, ${fl.training.left} days left.</p>` : ''}
        ${LICENSES.map((L) => `<div class="list-item"><div class="grow"><b>${L.name}</b><div class="small muted">${L.days} days · lets you fly up to ${SIZE_NAME[L.size]}s</div></div>
          ${fl.license >= L.level ? '<span class="pill good">Earned</span>' : btn(`Enroll ${money(L.cost)}`, 'takeLicense', L.level, { cls: 'sm', disabled: !!fl.training || fl.license < L.level - 1 || !canAfford(L.cost) })}</div>`).join('')}</div>
      <div class="card"><h3>🛫 Your hangars (${hangarUsed()}/${hangarCap()} space used)</h3>${hangars || '<p class="muted">None yet.</p>'}</div></div>
      <h4>Rent or buy a hangar</h4><div class="grid g3">${HANGAR_TYPES.map((h) => {
        const up = h.equip + 1000 + h.cap * 500 + h.rent * DEPOSIT_DAYS;
        return `<div class="card tight"><b>${h.icon} ${h.name}</b><div class="small muted">Space ${h.cap} · rent ${money(rentNow(h.rent))}/day or buy</div>
          <div style="margin-top:8px">${btn(`Open from ${money(up)}`, 'openHangar', h.id, { cls: 'sm buy', disabled: !canAfford(up) })}</div></div>`;
      }).join('')}</div>`;
  } else {
    const row = (v) => `<div class="list-item"><span class="big-ico">${v.icon}</span><div class="grow"><b>${esc(v.name)}</b>
      <div class="small muted">Worth ${money(v.value)} · prestige ${v.prestige}${v.kind === 'car' ? ` · comfort +${v.comfort}⚡` : ` · size ${v.size}`} · upkeep ${money(vehicleUpkeep(v))}/day</div>
      ${v.kind === 'plane' && !canFly(v) ? '<div class="small warn">Grounded: no license for this size and no crew hired (half prestige)</div>' : ''}</div>
      <div class="row">${btn(v.kind === 'car' ? '🛣️ Drive (+10⚡)' : '🏝️ Getaway (+35⚡)', 'getaway', v.id, { cls: 'sm', disabled: fl.lastTrip === S.day || (v.kind === 'plane' && !canFly(v)) })}
      ${v.kind === 'plane' && (v.size > licSize() || v.crew) ? btn(v.crew ? `👨‍✈️ Crew hired (${money(CREW_WAGE[v.size])}/day)` : '👨‍✈️ Hire crew', 'toggleCrew', v.id, { cls: 'sm ' + (v.crew ? 'on' : '') }) : ''}
      ${btn('Sell', 'sellVehicle', v.id, { cls: 'sm' })}</div></div>`;
    body = `<div class="grid g2">
      <div class="card"><div class="row between"><h3>🚗 Garage (${carsOwned().length}/${carSlots()})</h3>${btn(`🏗️ Car vault +${VAULT_SLOTS} (${money(VAULT_COST * (fl.vault + 1))})`, 'buyVault', '', { cls: 'sm', disabled: !canAfford(VAULT_COST * (fl.vault + 1)) })}</div>
        <p class="small muted">Your home has room for ${HOME_SLOTS[S.life.tier] || 1} car(s). Bigger homes have bigger garages.</p>${carsOwned().map(row).join('') || '<p class="muted">No cars yet.</p>'}</div>
      <div class="card"><h3>🛩️ Hangar (${hangarUsed()}/${hangarCap()} space)</h3>${planesOwned().map(row).join('') || '<p class="muted">No aircraft yet.</p>'}</div></div>`;
  }
  return `<div class="row between section"><h2>🛩️ Garage &amp; Hangar</h2><div style="overflow-x:auto;max-width:100%">${view}</div></div>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Prestige</div><div class="val">${Math.round(prestige())}</div><div class="small muted">+${pct(Math.min(0.1, prestige() / 2000), 1)} tender win chance${prestige() >= 30 ? ' · better business lunches' : ''}</div></div>
    <div class="card kpi"><div class="lbl">Comfort bonus</div><div class="val">+${vehicleEnergyBonus()}⚡</div><div class="small muted">max energy from your best car</div></div>
    <div class="card kpi"><div class="lbl">Fleet value</div><div class="val">${money(fl.vehicles.reduce((t, v) => t + v.value, 0))}</div><div class="small muted">upkeep ${money(fl.vehicles.reduce((t, v) => t + vehicleUpkeep(v), 0))}/day</div></div>
    <div class="card kpi"><div class="lbl">Private jet</div><div class="val">${hasJet() ? '✅' : '—'}</div><div class="small muted">${hasJet() ? 'Trade missions 40% cheaper, every 2 days' : 'Own a flyable jet for faster trade missions'}</div></div>
  </div>${body}`;
}
