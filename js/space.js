'use strict';
/* =====================================================================
   Space agency: a spaceport with launch pads and mission control, then
   launch your own rockets: satellite constellations, commercial payloads,
   space tourism and the big milestones (station, Moon, Mars).
   ===================================================================== */
const SPACEPORT = { equip: 50000000, rent: 30000, permit: ['Launch site license', 5000000] };
const PAD_COST = 80000000, MAX_PADS = 4, PAD_TURNAROUND = 7;
const CONTROLLER_WAGE = 800, MAX_CONTROLLERS = 40;
const SPACE_TICKET = 3000000;
const MILESTONES = {
  orbit: { name: 'First satellite in orbit', icon: '🛰️', reward: 25000000 },
  crewed: { name: 'First crewed flight', icon: '🧑‍🚀', reward: 100000000 },
  station: { name: 'Space station complete', icon: '🛸', reward: 300000000 },
  moon: { name: 'Moon landing', icon: '🌕', reward: 2000000000 },
  mars: { name: 'Crewed Mars mission', icon: '🔴', reward: 10000000000 },
};
const STATION_MODULES = 3, MODULE_COST = 300000000, STATION_INCOME = 1500000;
const MISSIONS = {
  sats: { name: 'Deploy your satellites', icon: '🛰️' },
  contract: { name: 'Commercial payload', icon: '📦' },
  crew: { name: 'Space tourism flight', icon: '🧑‍🚀' },
  station: { name: `Station module (${STATION_MODULES} needed)`, icon: '🛸', minPayload: 30, extra: MODULE_COST, needs: 'crewed' },
  moon: { name: 'Moon landing', icon: '🌕', minPayload: 100, extra: 1000000000, needs: 'crewed', risk: 0.95 },
  mars: { name: 'Crewed Mars mission', icon: '🔴', minPayload: 100, extra: 5000000000, needs: 'moon', risk: 0.85 },
};

const SP = () => S.space;
const ctrlBonus = () => Math.min(0.05, SP().controllers * 0.00125);
const freePad = () => SP().padBusy.findIndex((d) => d <= 0);
const readyDesigns = (cat) => S.designs.filter((d) => d.cat === cat && d.status === 'approved' && d.stock >= 1);
const orbitIncome = () => SP().orbit.reduce((t, o) => t + o.income * o.count, 0) + (SP().milestones.station ? STATION_INCOME : 0);

function genSpaceOffers() {
  const sp = SP();
  sp.offers = Array.from({ length: 3 }, () => {
    const mass = pick([0.5, 1, 3, 8, 20, 60]);
    const who = chance(0.5) ? `🏢 ${pick(STOCKS).name}` : `${(() => { const c = pick(COUNTRIES); return `${c.flag} ${c.name}`; })()}`;
    return { id: uid(), who, mass, pay: Math.round(mass * rand(5, 9) * 1000000), what: pick(['a weather satellite', 'a science probe', 'a broadband satellite', 'a spy-proof comms satellite', 'a space telescope', 'a cargo resupply pod']) };
  });
  sp.nextOffers = S.day + 7;
}
function claimMilestone(k) {
  const sp = SP(), m = MILESTONES[k];
  if (sp.milestones[k]) return '';
  sp.milestones[k] = S.day;
  earn(m.reward, 'Space');
  S.deals.rep = clamp(S.deals.rep + 10, 0, 100);
  for (const c of COUNTRIES) addRel(c.id, 5);
  log(`${m.icon} HISTORIC: ${m.name}! Governments award you ${money(m.reward)} in prizes and contracts.`, 'good');
  return `<p class="good">${m.icon} <b>Milestone: ${m.name}!</b> ${money(m.reward)} in prizes, plus reputation and relations with every government.</p>`;
}

function launch() {
  const sp = SP(), L = UI.sp, mt = MISSIONS[L.mission];
  const pad = freePad();
  if (pad < 0) return toast('All launch pads are being refurbished. Build another pad or wait.', 'warn');
  const rocket = dById(L.rocket);
  if (!rocket || rocket.stock < 1) return toast('Pick a rocket you have in stock.', 'warn');
  const cap = rocket.stats.payload;
  if (mt.needs && !sp.milestones[mt.needs]) return toast(`Achieve "${MILESTONES[mt.needs].name}" first.`, 'warn');
  if (mt.minPayload && cap < mt.minPayload) return toast(`This mission needs a rocket that lifts ${mt.minPayload}+ t.`, 'warn');
  if (L.mission === 'station' && sp.stationModules >= STATION_MODULES) return toast('Your station is already complete.', 'warn');
  let payload = null, count = 0, offer = null, payloadValue = 0, chanceMult = 1;
  if (L.mission === 'sats') {
    payload = dById(L.payload);
    if (!payload || payload.cat !== 'satellite' || payload.stock < 1) return toast('Pick satellites you have in stock.', 'warn');
    count = Math.min(Math.floor(payload.stock), Math.floor(cap / payload.stats.mass));
    if (count < 1) return toast('That satellite is too heavy for this rocket.', 'warn');
    payloadValue = payload.price * count;
  } else if (L.mission === 'contract') {
    offer = sp.offers.find((o) => o.id === L.contract);
    if (!offer) return toast('Pick a customer payload.', 'warn');
    if (offer.mass > cap) return toast(`That payload weighs ${offer.mass} t; this rocket lifts ${cap} t.`, 'warn');
    payloadValue = offer.pay;
  } else if (L.mission !== 'station') {
    if (sp.grounded > 0) return toast(`Crewed flights are grounded for ${sp.grounded} more days after the last accident.`, 'warn');
    payload = dById(L.payload);
    if (!payload || payload.cat !== 'capsule' || payload.stock < 1) return toast('Pick a crew capsule you have in stock.', 'warn');
    if (payload.stats.mass > cap) return toast('The capsule is too heavy for this rocket.', 'warn');
    count = 1; payloadValue = payload.price; chanceMult = payload.stats.rel * (mt.risk || 1);
  }
  const extra = mt.extra || 0;
  const premium = L.insure ? Math.round((payloadValue + extra) * 0.08) : 0;
  if (!pay(extra + premium, 'Space', 'the mission')) return;
  rocket.stock--;
  if (payload) payload.stock -= count;
  sp.padBusy[pad] = PAD_TURNAROUND;
  sp.launches++;
  stat('launches');
  addCO2('🚀 Rocket launches', rocket.stats.payload * 300);
  const pSuccess = Math.min(0.995, rocket.stats.rel + ctrlBonus() + 0.03 * execSkill('space')) * chanceMult;
  const ok = chance(pSuccess);
  let body = '';
  if (ok) {
    if (L.mission === 'sats') {
      sp.orbit.push({ id: uid(), name: payload.name, type: payload.stats.type, income: payload.stats.income, count, left: payload.stats.life });
      body = `<p>${count} × <b>${esc(payload.name)}</b> reached orbit. They'll earn ${money(payload.stats.income * count)}/day for ~${Math.round(payload.stats.life / 365)} years.</p>${claimMilestone('orbit')}`;
    } else if (L.mission === 'contract') {
      earn(offer.pay, 'Space');
      sp.offers.splice(sp.offers.indexOf(offer), 1);
      body = `<p>Delivered ${offer.what} for ${offer.who}. Paid <b>${money(offer.pay)}</b>.</p>`;
    } else if (L.mission === 'station') {
      sp.stationModules++;
      body = `<p>Station module ${sp.stationModules}/${STATION_MODULES} docked successfully.</p>${sp.stationModules >= STATION_MODULES ? claimMilestone('station') + `<p>Your station now earns ${money(STATION_INCOME)}/day from research leases, and tourist tickets are worth double.</p>` : ''}`;
    } else {
      const tickets = L.mission === 'crew' ? payload.stats.seats * SPACE_TICKET * (sp.milestones.station ? 2 : 1) : 0;
      if (tickets) earn(tickets, 'Space');
      if (payload.stats.reusable) payload.stock++;
      body = `<p>${L.mission === 'crew' ? `${payload.stats.seats} space tourists flew aboard <b>${esc(payload.name)}</b> and paid <b>${money(tickets)}</b>.` : `Your crew aboard <b>${esc(payload.name)}</b> made it to ${L.mission === 'moon' ? 'the Moon' : 'Mars'} and back!`}${payload.stats.reusable ? ' The capsule was recovered.' : ''}</p>
        ${claimMilestone('crewed')}${L.mission !== 'crew' ? claimMilestone(L.mission) : ''}`;
    }
    if (rocket.stats.reusable && chance(0.85)) {
      const refurb = Math.round(rocket.price * 0.03);
      spend(refurb, 'Space');
      rocket.stock++;
      body += `<p class="small">🔁 Booster landed and was recovered (refurbishment ${money(refurb)}).</p>`;
    }
    log(`🚀 Launch success: ${mt.name} on ${esc(rocket.name)}.`, 'good');
  } else {
    sp.fails++;
    S.deals.rep = clamp(S.deals.rep - 5, 0, 100);
    const refund = L.insure ? payloadValue * (L.mission === 'contract' ? 0 : 1) + extra : 0;
    if (refund) earn(refund, 'Space');
    if (L.mission === 'contract') { sp.offers.splice(sp.offers.indexOf(offer), 1); spend(Math.round(offer.pay * 0.2), 'Space'); }
    if (payload && payload.cat === 'capsule') { sp.grounded = 30; S.deals.rep = clamp(S.deals.rep - 10, 0, 100); }
    body = `<p>The ${esc(rocket.name)} was lost along with its payload.${payload && payload.cat === 'capsule' ? ' The launch-abort system saved the crew, but crewed flights are grounded for 30 days.' : ''}</p>
      ${L.mission === 'contract' ? `<p class="bad">The customer charges a ${money(Math.round(offer.pay * 0.2))} penalty.</p>` : ''}${refund ? `<p class="good">🛡️ Insurance paid out ${money(refund)}.</p>` : L.insure ? '' : '<p class="small muted">You launched without insurance.</p>'}`;
    log(`💥 Launch failure: ${mt.name} on ${esc(rocket.name)}.`, 'bad');
  }
  showModal({ title: ok ? `🚀 ${mt.icon} Mission success!` : '💥 Launch failure', cls: ok ? 'good' : 'danger', body: `<p class="small muted">Success chance was ${pct(pSuccess, 0)}.</p>${body}` });
}

registerModule({
  id: 'space',
  init(s) {
    s.space = { founded: false, site: null, insured: true, bills: null, padBusy: [], controllers: 0, orbit: [], launches: 0, fails: 0, milestones: {}, offers: [], nextOffers: 0, stationModules: 0, grounded: 0 };
  },
  assets(a) {
    const sp = SP();
    a.space = sp.founded ? SPACEPORT.equip * 0.5 + (sp.padBusy.length - 1) * PAD_COST * 0.5 + siteValue(sp.site) + sp.orbit.reduce((t, o) => t + o.income * o.count * o.left * 0.2, 0) : 0;
  },
  daily() {
    const sp = SP();
    if (!sp.founded) return;
    sp.padBusy = sp.padBusy.map((d) => Math.max(0, d - 1));
    if (sp.grounded > 0) sp.grounded--;
    if (sp.controllers) spend(sp.controllers * CONTROLLER_WAGE, 'Wages');
    sp.bills = makeBills(sp.site, { elec: 500 * sp.padBusy.length, water: 200 * sp.padBusy.length, net: 300, waste: 200 }, {}, sp.insured, SPACEPORT.equip + (sp.padBusy.length - 1) * PAD_COST);
    payBills(sp.bills);
    const inc = orbitIncome();
    if (inc) earn(inc, 'Space');
    for (const o of sp.orbit.slice()) if (--o.left <= 0) { sp.orbit.splice(sp.orbit.indexOf(o), 1); log(`🛰️ Your ${esc(o.name)} satellites reached end of life and deorbited.`); }
    if (S.day >= sp.nextOffers) genSpaceOffers();
  },
  tabs: [{ id: 'space', name: 'Space Agency', icon: '🚀', render: renderSpace }],
  actions: {
    foundAgency() {
      openBusiness({
        title: 'your Space Agency', icon: '🚀', equipment: SPACEPORT.equip, permit: { name: SPACEPORT.permit[0], cost: SPACEPORT.permit[1] }, rent: SPACEPORT.rent, price: SPACEPORT.rent * 600,
        extra: '<p class="small muted">A coastal spaceport with one launch pad, a mission control center and a vehicle assembly area.</p>',
        done(site) {
          Object.assign(SP(), { founded: true, site, padBusy: [0] });
          genSpaceOffers();
          stat('spaceAgency');
          log('🚀 You founded your own space agency! Design rocket engines, rockets, satellites and capsules in the Design Studio.', 'good');
        },
      });
    },
    buildPad() {
      const sp = SP();
      if (sp.padBusy.length >= MAX_PADS || !pay(PAD_COST, 'Investments', 'the launch pad')) return;
      sp.padBusy.push(0);
      toast(`🏗️ Launch pad ${sp.padBusy.length} completed.`, 'good');
    },
    hireCtrl(n) { const sp = SP(); sp.controllers = clamp(sp.controllers + +n, 0, MAX_CONTROLLERS); },
    spSet(key, val) {
      UI.sp[key] = key === 'insure' ? val === '1' : key === 'mission' ? val : +val;
      if (key === 'mission') UI.sp.payload = 0;
    },
    spBuySite() { buySite(SP().site); },
    launch,
  },
});
UI.sp = { rocket: 0, mission: 'sats', payload: 0, contract: 0, insure: true };

function renderSpace() {
  const sp = SP();
  if (!sp.founded) {
    const up = SPACEPORT.equip + SPACEPORT.permit[1] + SPACEPORT.rent * DEPOSIT_DAYS;
    return `<h2 class="section">🚀 Space Agency</h2><div class="card hl" style="max-width:640px"><h3>Found your own space agency</h3>
      <p>Build a spaceport, design rockets and spacecraft, and launch satellites, paying customers, tourists and eventually crews to the Moon and Mars.</p>
      <ul class="small muted"><li>Spaceport equipment ${money(SPACEPORT.equip)} · ${SPACEPORT.permit[0]} ${money(SPACEPORT.permit[1])} · rent ${money(rentNow(SPACEPORT.rent))}/day or buy the land</li>
      <li>Then design rocket engines, rockets, satellites and crew capsules in Factories &amp; R&amp;D → Design Studio and build them on their own production lines.</li></ul>
      ${btn(`Found agency from ${money(up)}`, 'foundAgency', '', { cls: 'primary', disabled: !canAfford(up) })}</div>`;
  }
  const L = UI.sp, mt = MISSIONS[L.mission];
  const rockets = readyDesigns('rocket');
  if (!rockets.some((r) => r.id === L.rocket) && rockets.length) L.rocket = rockets[0].id;
  const rocket = dById(L.rocket);
  const payloadCat = L.mission === 'sats' ? 'satellite' : ['crew', 'moon', 'mars'].includes(L.mission) ? 'capsule' : null;
  const payloads = payloadCat ? readyDesigns(payloadCat) : [];
  if (payloadCat && !payloads.some((p) => p.id === L.payload) && payloads.length) L.payload = payloads[0].id;
  if (L.mission === 'contract' && !sp.offers.some((o) => o.id === L.contract) && sp.offers.length) L.contract = sp.offers[0].id;
  const pick1 = (list, key, label) => (list.length ? `<div class="seg wrap">${list.map((d) => btn(label(d), 'spSet', key, { b: d.id, cls: 'sm ' + (L[key] === d.id ? 'on' : '') })).join('')}</div>` : '');
  const pads = sp.padBusy.map((d, i) => `<span class="pill ${d ? 'warn' : 'good'}">Pad ${i + 1}: ${d ? `refurbishing ${d}d` : 'ready'}</span>`).join(' ');
  const planner = `<div class="card hl"><h3>🧑‍🚀 Mission planner</h3>
    <div class="dz-row"><span class="small muted">Mission</span><div class="seg wrap">${Object.entries(MISSIONS).map(([k, m]) => btn(`${m.icon} ${m.name}`, 'spSet', 'mission', { b: k, cls: 'sm ' + (L.mission === k ? 'on' : ''), disabled: !!m.needs && !sp.milestones[m.needs] })).join('')}</div></div>
    <div class="dz-row"><span class="small muted">Rocket</span>${pick1(rockets, 'rocket', (d) => `🚀 ${esc(d.name)} (${d.stats.payload} t, ${pct(d.stats.rel, 0)}, ×${fmtInt(d.stock)})`) || '<span class="small warn">No approved rockets in stock. Design and build some!</span>'}</div>
    ${payloadCat ? `<div class="dz-row"><span class="small muted">${payloadCat === 'satellite' ? 'Satellites' : 'Capsule'}</span>${pick1(payloads, 'payload', (d) => `${DCATS[d.cat].icon} ${esc(d.name)} (×${fmtInt(d.stock)})`) || `<span class="small warn">No approved ${DCATS[payloadCat].name.toLowerCase()} in stock.</span>`}</div>` : ''}
    ${L.mission === 'contract' ? `<div class="dz-row"><span class="small muted">Customer</span>${sp.offers.length ? `<div class="seg wrap">${sp.offers.map((o) => btn(`${o.who}: ${o.mass} t → ${money(o.pay)}`, 'spSet', 'contract', { b: o.id, cls: 'sm ' + (L.contract === o.id ? 'on' : '') })).join('')}</div>` : '<span class="small muted">No customers this week.</span>'}</div>` : ''}
    <div class="dz-row"><span class="small muted">Insurance</span><div class="seg">${btn('🛡️ Insure (8% premium)', 'spSet', 'insure', { b: '1', cls: 'sm ' + (L.insure ? 'on' : '') })}${btn('No insurance', 'spSet', 'insure', { b: '0', cls: 'sm ' + (L.insure ? '' : 'on') })}</div></div>
    ${mt.extra ? `<p class="small warn">This mission also costs ${money(mt.extra)} in ${L.mission === 'station' ? 'module hardware' : 'lander & mission hardware'}.</p>` : ''}
    ${rocket ? `<p class="small">Launch success chance ≈ <b>${pct(Math.min(0.995, rocket.stats.rel + ctrlBonus()) * (payloadCat === 'capsule' && dById(L.payload) ? dById(L.payload).stats.rel * (mt.risk || 1) : 1), 0)}</b>${rocket.stats.reusable ? ' · booster recovery 85%' : ''}</p>` : ''}
    <div style="margin-top:8px">${btn('🚀 LAUNCH', 'launch', '', { cls: 'primary', disabled: freePad() < 0 || !rocket })}</div></div>`;
  const orbit = sp.orbit.map((o) => `<div class="list-item"><span class="big-ico">🛰️</span><div class="grow"><b>${o.count} × ${esc(o.name)}</b><div class="small muted">${money(o.income * o.count)}/day · ${Math.round(o.left / 365 * 10) / 10} years left</div></div></div>`).join('');
  return `<h2 class="section">🚀 Space Agency</h2>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Launches</div><div class="val">${sp.launches}</div><div class="small muted">${sp.fails} failures</div></div>
    <div class="card kpi"><div class="lbl">In orbit</div><div class="val">${sp.orbit.reduce((t, o) => t + o.count, 0)} sats</div><div class="small muted">${money(orbitIncome())}/day</div></div>
    <div class="card kpi"><div class="lbl">Mission control</div><div class="val">${sp.controllers}</div><div class="small muted">+${pct(ctrlBonus(), 1)} launch success</div>
      <div class="row">${btn('+5', 'hireCtrl', 5, { cls: 'sm buy', disabled: sp.controllers >= MAX_CONTROLLERS })}${btn('−5', 'hireCtrl', -5, { cls: 'sm sell', disabled: !sp.controllers })}<span class="small muted">${money(CONTROLLER_WAGE)}/day each</span></div></div>
    <div class="card kpi"><div class="lbl">Launch pads</div><div class="val">${sp.padBusy.length}</div>${sp.padBusy.length < MAX_PADS ? btn(`Build pad (${money(PAD_COST)})`, 'buildPad', '', { cls: 'sm', disabled: !canAfford(PAD_COST) }) : ''}</div>
  </div>
  <div class="section">${pads}</div>
  <div class="grid g2 section">${planner}
    <div class="card"><h3>🏆 Milestones</h3>${Object.entries(MILESTONES).map(([k, m]) => `<div class="list-item"><span class="big-ico">${m.icon}</span><div class="grow"><b>${m.name}</b><div class="small muted">Reward ${money(m.reward)}${k === 'station' ? ` · modules ${sp.stationModules}/${STATION_MODULES}` : ''}</div></div>${sp.milestones[k] ? `<span class="pill good">Day ${sp.milestones[k]}</span>` : '<span class="pill">Open</span>'}</div>`).join('')}</div>
  </div>
  <div class="grid g2"><div class="card"><h3>🛰️ Your constellation</h3>${orbit || '<p class="muted">Nothing in orbit yet.</p>'}</div>
    <div class="card"><h3>🏗️ Spaceport</h3><div class="small">${siteLabel(sp.site)}</div>${billsHtml(sp.bills)}
      ${sp.site.own ? '' : `<div style="margin-top:6px">${btn(`🔑 Buy the land (${money(sitePrice(sp.site))})`, 'spBuySite', '', { cls: 'sm', disabled: !canAfford(sitePrice(sp.site)) })}</div>`}
      <p class="small muted" style="margin-top:8px">Commercial customers refresh on day ${sp.nextOffers}. ${sp.grounded ? `<span class="bad">Crewed flights grounded for ${sp.grounded} days.</span>` : ''}</p></div></div>`;
}
