'use strict';
/* =====================================================================
   World & politics: global events (pandemics, wars, recessions…),
   your home country's ruling party and its policies, elections you can
   fund, foreign governments, and your own political career.
   ===================================================================== */
const PARTIES = {
  green: { name: 'Green Alliance', icon: '🌿', tax: 0.24, carbon: 80, wage: 1.1, subsidy: 30, defense: 0.7, ai: 0.85, permits: 1.2, desc: 'High carbon price, big renewable subsidies, strict AI rules.' },
  business: { name: 'Business Party', icon: '💼', tax: 0.15, carbon: 10, wage: 0.95, subsidy: 5, defense: 1, ai: 1.1, permits: 0.85, desc: 'Low taxes, light regulation, cheap permits.' },
  populist: { name: "People's Front", icon: '📢', tax: 0.22, carbon: 30, wage: 1.15, subsidy: 10, defense: 1, ai: 0.95, permits: 1, desc: 'Higher wages and higher taxes on the rich.' },
  hawk: { name: 'Security First', icon: '🛡️', tax: 0.18, carbon: 20, wage: 1, subsidy: 5, defense: 1.6, ai: 1.05, permits: 0.95, desc: 'Big defense budgets, moderate taxes.' },
};
const POLICY_LABELS = {
  tax: ['Corporate tax', (v) => pct(v, 0)], carbon: ['Carbon price', (v) => money(v) + '/t'], wage: ['Minimum wage level', (v) => pct(v, 0)],
  subsidy: ['Renewable subsidy', (v) => money(v) + '/MWh'], defense: ['Defense budget', (v) => pct(v, 0)], ai: ['AI regulation (demand)', (v) => pct(v, 0)], permits: ['Permit costs', (v) => pct(v, 0)],
};
const PRESIDENT_OPTIONS = {
  tax: [0.1, 0.15, 0.2, 0.25, 0.3], carbon: [0, 10, 30, 60, 100], wage: [0.9, 1, 1.1, 1.2], subsidy: [0, 10, 30, 50],
  defense: [0.7, 1, 1.5, 2], ai: [0.85, 1, 1.15], permits: [0.7, 0.85, 1, 1.2],
};
const OFFICES = [
  { id: 'council', name: 'City council member', icon: '🏛️', cost: 250000, rep: 20, infl: 0, salary: 300, permits: 0.9 },
  { id: 'mayor', name: 'Mayor', icon: '🏙️', cost: 5000000, rep: 35, infl: 10, salary: 600, permits: 0.8 },
  { id: 'governor', name: 'Governor', icon: '🗺️', cost: 50000000, rep: 50, infl: 25, salary: 900, permits: 0.75, tax: -0.02 },
  { id: 'president', name: 'President', icon: '🎖️', cost: 500000000, rep: 65, infl: 45, salary: 1500, permits: 0.7 },
];
const WORLD_EVENTS = {
  pandemic: { name: 'Global pandemic', icon: '🦠', days: 45, mult: { resto: 0.5, ai: 1.3, design: 0.9, power: 0.9, media: 1.3 }, stock: -0.12, text: 'A pandemic sweeps the globe. Restaurants empty out and everyone moves online.' },
  war: { name: 'Regional war', icon: '⚔️', days: 60, mult: { defense: 1.8, power: 1.4, design: 0.95 }, stock: -0.08, util: { gas: 0.5, elec: 0.3 }, text: 'War breaks out. Governments scramble for military hardware, and energy prices spike.' },
  recession: { name: 'Global recession', icon: '📉', days: 90, mult: { resto: 0.75, design: 0.8, bankDefault: 3, power: 0.9, media: 0.8 }, stock: -0.2, housing: -0.08, text: 'A global recession hits. Demand falls everywhere and loan defaults rise.' },
  oilshock: { name: 'Oil shock', icon: '🛢️', days: 30, mult: { power: 1.5, oil: 1.8 }, util: { gas: 0.6 }, goods: { oil: 0.8, plastic: 0.4 }, text: 'An oil embargo sends fuel prices through the roof.' },
  techboom: { name: 'Tech boom', icon: '🚀', days: 60, mult: { ai: 1.4, design: 1.15 }, stock: 0.08, text: 'A tech boom! Investors pour money into chips, AI and gadgets.' },
  housingcrash: { name: 'Housing crash', icon: '🏚️', days: 60, mult: { bankDefault: 2 }, housing: -0.25, text: 'The housing bubble bursts. Property values crater.' },
};
const ELECTION_EVERY = 360, CAMPAIGN_DAYS = 60, TERM_DAYS = 360;

const W = () => S.world;
const worldMult = (k) => {
  const e = S.world && S.world.event && WORLD_EVENTS[S.world.event];
  return e && e.mult[k] !== undefined ? e.mult[k] : 1;
};
const office = () => (S.world && S.world.office ? OFFICES.find((o) => o.id === S.world.office.id) : null);
function policy(k) {
  const w = W();
  if (!w) return PARTIES.business[k];
  if (w.office && w.office.id === 'president' && w.myPolicy) return w.myPolicy[k];
  let v = PARTIES[w.party][k];
  const o = office();
  if (k === 'tax' && o && o.tax) v += o.tax;
  return v;
}
const officePermitMult = () => (office() ? office().permits : 1);
const influence = () => (typeof mediaInfluence === 'function' ? mediaInfluence() : 0) + (office() ? OFFICES.indexOf(office()) * 5 + 5 : 0);
const daysToElection = () => W().nextElection - S.day;

function startWorldEvent(id) {
  const w = W(), e = WORLD_EVENTS[id];
  w.event = id; w.eventLeft = e.days;
  if (e.stock) for (const d of STOCKS) S.stocks[d.sym].shock += e.stock * rand(0.6, 1.4) * (id === 'techboom' && d.sector !== 'Tech' ? 0.3 : 1);
  if (e.util) for (const [k, v] of Object.entries(e.util)) S.utilRates[k] = clamp(S.utilRates[k] + v, 0.6, 2.5);
  if (e.goods) for (const [k, v] of Object.entries(e.goods)) S.goods[k].idx = clamp(S.goods[k].idx + v, 0.4, 3);
  if (e.housing) S.re.housing *= 1 + e.housing;
  timeline(e.icon, e.name);
  log(`${e.icon} WORLD EVENT: ${e.text}`, 'bad');
  showModal({ title: `${e.icon} ${e.name}`, cls: id === 'techboom' ? 'good' : 'danger', body: `<p>${e.text}</p><p class="small muted">Lasts about ${e.days} days. Check the 🏛️ Politics &amp; World tab for its effects.</p>` });
}
function runElection() {
  const w = W(), pop = w.popularity;
  const entries = Object.entries(pop).map(([k, v]) => ({ k, w: Math.pow(Math.max(1, v), 2) }));
  const winner = weighted(entries).k, old = w.party;
  w.party = winner;
  w.nextElection = S.day + ELECTION_EVERY;
  w.donated = {};
  for (const k in pop) pop[k] = clamp(pop[k] + rand(-5, 5) + (k === winner ? -6 : 2), 5, 60);
  timeline(PARTIES[winner].icon, `${PARTIES[winner].name} won the election`);
  log(`🗳️ ELECTION: the ${PARTIES[winner].name} ${winner === old ? 'stays in power' : 'takes power'}! ${PARTIES[winner].desc}`, winner === 'business' ? 'good' : 'warn');
  showModal({ title: `🗳️ Election result: ${PARTIES[winner].icon} ${PARTIES[winner].name}`, body: `<p>${PARTIES[winner].desc}</p>${policyTable(PARTIES[winner])}` });
}
function policyTable(p) {
  return `<table class="small"><tbody>${Object.entries(POLICY_LABELS).map(([k, [l, f]]) => `<tr><td>${l}</td><td class="num">${f(p[k])}</td></tr>`).join('')}</tbody></table>`;
}
function scandal() {
  const w = W(), o = office();
  S.deals.rep = clamp(S.deals.rep - 10, 0, 100);
  const removed = o && OFFICES.indexOf(o) >= 2 && chance(0.3 * legalFineMult());
  timeline('📰', removed ? `Removed from office as ${o.name}` : 'Political scandal');
  if (removed) { w.office = null; w.myPolicy = null; }
  log(`📰 SCANDAL: reporters dug up conflicts of interest between your businesses and your office.${removed ? ` You were removed from office as ${o.name}!` : ' Reputation −10.'}`, 'bad');
  showModal({ title: '📰 Political scandal!', cls: 'danger', body: `<p>The press accuses you of using your office to help your own companies. Business reputation −10.</p>${removed ? `<p class="bad"><b>You were impeached and removed as ${o.name}.</b></p>` : '<p>You survived, this time. A blind trust makes scandals much rarer.</p>'}` });
}

registerModule({
  id: 'world',
  init(s) {
    s.world = {
      party: 'business', popularity: { green: 25, business: 30, populist: 25, hawk: 20 }, nextElection: ELECTION_EVERY, donated: {},
      event: null, eventLeft: 0, office: null, campaign: null, myPolicy: null, blindTrust: false,
      foreign: Object.fromEntries(COUNTRIES_IDS.map((c) => [c, pick(Object.keys(PARTIES))])), foreignNext: 200,
    };
  },
  daily() {
    const w = W();
    // global events
    if (w.event) {
      if (--w.eventLeft <= 0) { log(`${WORLD_EVENTS[w.event].icon} The ${WORLD_EVENTS[w.event].name.toLowerCase()} is over.`, 'good'); w.event = null; }
    } else if (S.day > 30 && chance(0.008)) startWorldEvent(pick(Object.keys(WORLD_EVENTS)));
    // public opinion drifts
    for (const k in w.popularity) w.popularity[k] = clamp(w.popularity[k] + gauss() * 0.4, 5, 60);
    if (S.day >= w.nextElection) runElection();
    // foreign elections
    if (S.day >= w.foreignNext) {
      const c = pick(COUNTRIES_IDS);
      w.foreign[c] = pick(Object.keys(PARTIES));
      w.foreignNext = S.day + randInt(60, 140);
      log(`🌍 ${CTRY[c].flag} ${CTRY[c].name} elected the ${PARTIES[w.foreign[c]].name}.`);
    }
    // your campaign for office
    if (w.campaign && --w.campaign.left <= 0) {
      const o = OFFICES.find((x) => x.id === w.campaign.id), p = w.campaign.p;
      w.campaign = null;
      if (chance(p)) {
        w.office = { id: o.id, termEnds: S.day + TERM_DAYS };
        if (o.id === 'president') w.myPolicy = { ...PARTIES[w.party] };
        stat('officesWon');
        timeline(o.icon, `Elected ${o.name}`);
        log(`🎉 You won the race and are now ${o.name}!`, 'good');
        showModal({ title: `🎉 You are now ${o.name}!`, cls: 'good', body: `<p>${o.id === 'president' ? 'You set national policy now. Use it wisely… or profitably.' : `Permits are ${pct(1 - o.permits, 0)} cheaper for you, and you gain political influence.`}</p>` });
      } else log(`🗳️ You lost the race for ${o.name}.`, 'bad');
    }
    if (w.office) {
      const o = office();
      earn(o.salary, 'Salary');
      if (S.day >= w.office.termEnds) { log(`🏛️ Your term as ${o.name} ended.`); w.office = null; w.myPolicy = null; }
      else if (chance(0.0025 * (1 + S.factories.length / 10 + S.restaurants.length / 20) * (w.blindTrust ? 0.3 : 1))) scandal();
    }
  },
  tabs: [{ id: 'politics', name: 'Politics & World', icon: '🏛️', render: renderPolitics }],
  actions: {
    donate(party, amt) {
      const w = W();
      if (daysToElection() > CAMPAIGN_DAYS) return toast(`Campaign donations open ${CAMPAIGN_DAYS} days before the election.`, 'warn');
      amt = +amt;
      if (!pay(amt, 'Politics', 'the donation')) return;
      w.donated[party] = (w.donated[party] || 0) + amt;
      w.popularity[party] = clamp(w.popularity[party] + 3 * Math.log10(amt / 10000 + 1) * (1 + influence() / 50), 5, 80);
      addRisk(1);
      toast(`🗳️ Donated ${money(amt)} to the ${PARTIES[party].name}.`, 'good');
    },
    runOffice(id) {
      const w = W(), o = OFFICES.find((x) => x.id === id), i = OFFICES.indexOf(o);
      if (w.campaign || (w.office && OFFICES.findIndex((x) => x.id === w.office.id) >= i)) return;
      if (i > 0 && !(S.stats.officesWon > 0) && !w.office) return toast('Start your political career lower down.', 'warn');
      if (S.deals.rep < o.rep) return toast(`You need business reputation ${o.rep}+.`, 'warn');
      if (influence() < o.infl) return toast(`You need influence ${o.infl}+ (buy media outlets).`, 'warn');
      if (!pay(o.cost, 'Politics', 'the campaign')) return;
      const p = clamp(0.35 + (S.deals.rep - o.rep) / 100 + (influence() - o.infl) / 100, 0.1, 0.85);
      w.campaign = { id, left: 30, p };
      log(`🗳️ You launched a campaign for ${o.name} (${pct(p, 0)} chance). Result in 30 days.`);
    },
    blindTrust() {
      const cost = Math.round(2000000 + Math.max(0, netWorth()) * 0.005);
      if (W().blindTrust || !pay(cost, 'Legal', 'the blind trust')) return;
      W().blindTrust = true;
      toast('🔒 Your assets are now in a blind trust. Scandals are much less likely.', 'good');
    },
    setPolicy(k, v) { if (W().myPolicy) W().myPolicy[k] = +v; },
  },
});
const COUNTRIES_IDS = ['arc', 'eld', 'qas', 'zan', 'nov', 'isl'];
UI.donateAmt = 100000;

function renderPolitics() {
  const w = W(), e = w.event && WORLD_EVENTS[w.event], o = office();
  const pres = w.office && w.office.id === 'president';
  const pop = Object.entries(w.popularity);
  const tot = pop.reduce((t, [, v]) => t + v * v, 0);
  const campaignOpen = daysToElection() <= CAMPAIGN_DAYS;
  const amounts = [100000, 1000000, 10000000, 100000000];
  return `<h2 class="section">🏛️ Politics &amp; World</h2>
  ${e ? `<div class="banner bad"><b>${e.icon} ${e.name}</b>: ${e.text} <span class="small">(${w.eventLeft} days left · effects: ${Object.entries(e.mult).map(([k, v]) => `${k} ×${v}`).join(', ')})</span></div>` : '<div class="banner info small">🌍 The world is calm… for now. Pandemics, wars, recessions, oil shocks, tech booms and housing crashes can strike at any time.</div>'}
  <div class="grid g2 section">
    <div class="card"><h3>${PARTIES[w.party].icon} Home government: ${PARTIES[w.party].name}</h3><p class="small muted">${PARTIES[w.party].desc}</p>
      <h4>Current policy${pres ? ' (set by you)' : ''}</h4>${pres ? Object.entries(POLICY_LABELS).map(([k, [l, f]]) => `<div class="dz-row"><span class="small muted">${l}</span><div class="seg wrap">${PRESIDENT_OPTIONS[k].map((v) => btn(f(v), 'setPolicy', k, { b: v, cls: 'sm ' + (w.myPolicy[k] === v ? 'on' : '') })).join('')}</div></div>`).join('') : policyTable(Object.fromEntries(Object.keys(POLICY_LABELS).map((k) => [k, policy(k)])))}</div>
    <div class="card"><h3>🗳️ Next election in ${daysToElection()} days</h3>
      ${pop.map(([k, v]) => `<div class="barline" style="grid-template-columns:150px 1fr 50px"><span>${PARTIES[k].icon} ${PARTIES[k].name}</span>${bar(v * v / tot * 100, k === w.party ? 'var(--good)' : 'var(--accent)')}<span class="num right">${pct(v * v / tot, 0)}</span></div>`).join('')}
      <p class="small muted" style="margin-top:8px">${campaignOpen ? 'Campaign season is open. Donations shift the odds (more with media influence), but raise your audit risk a little.' : `Donations open ${CAMPAIGN_DAYS} days before the vote.`}</p>
      ${campaignOpen ? Object.keys(PARTIES).map((k) => `<div class="row" style="margin:4px 0"><span class="small" style="width:150px">${PARTIES[k].icon} ${PARTIES[k].name}${w.donated[k] ? ` (${money(w.donated[k])})` : ''}</span>${amounts.map((a) => btn(money(a), 'donate', k, { b: a, cls: 'sm', disabled: !canAfford(a) })).join('')}</div>`).join('') : ''}</div>
  </div>
  <div class="grid g2 section">
    <div class="card"><h3>🎤 Your political career</h3>
      <p class="small">Influence <b>${Math.round(influence())}</b> (from media outlets and offices) · business reputation <b>${Math.round(S.deals.rep)}</b></p>
      ${o ? `<div class="banner info small">${o.icon} You are <b>${o.name}</b> until day ${w.office.termEnds}. Salary ${money(o.salary)}/day · permits −${pct(1 - o.permits, 0)}${o.tax ? ` · corporate tax ${pct(o.tax, 0)}` : ''}${pres ? ' · you set national policy' : ''}.</div>` : ''}
      ${w.campaign ? `<p class="warn">Campaigning for ${OFFICES.find((x) => x.id === w.campaign.id).name}: ${w.campaign.left} days to go (${pct(w.campaign.p, 0)} chance).</p>` : ''}
      ${OFFICES.map((x) => `<div class="list-item"><span class="big-ico">${x.icon}</span><div class="grow"><b>${x.name}</b><div class="small muted">Campaign ${money(x.cost)} · needs reputation ${x.rep}+ and influence ${x.infl}+</div></div>
        ${btn('Run', 'runOffice', x.id, { cls: 'sm', disabled: !!w.campaign || !canAfford(x.cost) })}</div>`).join('')}
      <div style="margin-top:8px">${w.blindTrust ? '<span class="pill good">🔒 Blind trust set up</span>' : btn(`🔒 Set up a blind trust (${money(2000000 + Math.max(0, netWorth()) * 0.005)})`, 'blindTrust', '', { cls: 'sm' })}</div></div>
    <div class="card"><h3>🌍 Foreign governments</h3>${COUNTRIES_IDS.map((c) => `<div class="list-item"><span>${CTRY[c].flag}</span><div class="grow"><b>${CTRY[c].name}</b><div class="small muted">${PARTIES[w.foreign[c]].icon} ${PARTIES[w.foreign[c]].name}${w.foreign[c] === 'hawk' ? ' · pays more for military hardware' : w.foreign[c] === 'green' ? ' · favors low-emission suppliers' : ''}</div></div></div>`).join('')}</div>
  </div>`;
}
