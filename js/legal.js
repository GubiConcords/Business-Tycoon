'use strict';
/* =====================================================================
   Legal & advisors: law firms, in-house counsel and specialist advisors
   that cut fines, win lawsuits, speed approvals and unlock the defense
   manufacturing license.
   ===================================================================== */
const LAW_FIRMS = [
  { id: 'none', name: 'No outside counsel', icon: '🤷', fee: 0, power: 0, desc: 'You represent yourself. Good luck.' },
  { id: 'local', name: 'Local law firm', icon: '🏢', fee: 1500, power: 15, desc: 'Solid for small claims, leases and permits.' },
  { id: 'corp', name: 'Big corporate law firm', icon: '🏙️', fee: 8000, power: 35, desc: 'Hundreds of lawyers. Regulators take your calls.' },
  { id: 'elite', name: 'Elite white-shoe firm', icon: '🏛️', fee: 40000, power: 60, desc: 'The best money can buy. Opponents settle on sight.' },
];
const LF = Object.fromEntries(LAW_FIRMS.map((f) => [f.id, f]));
const ADVISORS = {
  inhouse: { name: 'In-house counsel', icon: '👩‍⚖️', fee: 600, desc: '+10 legal strength, contracts reviewed before you sign.' },
  compliance: { name: 'Compliance officer', icon: '📋', fee: 700, desc: 'Audit risk builds 30% slower, factory accidents 40% rarer.' },
  patent: { name: 'Patent attorney', icon: '📜', fee: 1200, desc: 'Patents your designs, so copycats get shut down.' },
  regulatory: { name: 'Regulatory affairs team', icon: '🗂️', fee: 2500, desc: '+10% certification pass chance, permits 20% cheaper.' },
  lobbyist: { name: 'Lobbyist', icon: '🤝', fee: 3000, desc: 'Slowly improves relations with every government.' },
  pr: { name: 'PR agency', icon: '📣', fee: 2000, desc: 'Business reputation and restaurant reputations slowly rise.' },
};
const DEFENSE_LICENSE = { cost: 25000000, days: 30, power: 25, rel: 40 };

const legalPower = () => (S.legal ? LF[S.legal.firm].power + (S.legal.staff.inhouse ? 10 : 0) : 0);
// fines, penalties and audit bills are cut by up to 40% with strong lawyers
const legalFineMult = () => Math.max(0.6, 1 - legalPower() / 175);
const lawsuitWin = () => Math.min(0.88, 0.45 + legalPower() / 160);
const regulatoryBonus = () => (S.legal && S.legal.staff.regulatory ? 0.1 : 0);
const permitMult = () => (S.legal && S.legal.staff.regulatory ? 0.8 : 1);
const legalFees = () => LF[S.legal.firm].fee + Object.entries(ADVISORS).reduce((t, [k, a]) => t + (S.legal.staff[k] ? a.fee : 0), 0);

registerModule({
  id: 'legal',
  init(s) {
    s.legal = { firm: 'none', staff: { inhouse: false, compliance: false, patent: false, regulatory: false, lobbyist: false, pr: false }, licenses: { defense: false }, pending: null, won: 0, lost: 0, blocked: 0 };
  },
  daily() {
    const L = S.legal;
    const fees = legalFees();
    if (fees) spend(fees, 'Legal');
    if (L.staff.lobbyist) for (const c of COUNTRIES) addRel(c.id, 0.12);
    if (L.staff.pr) {
      S.deals.rep = clamp(S.deals.rep + 0.05, 0, 100);
      for (const r of S.restaurants) r.rep = clamp(r.rep + 0.05, 0, 100);
    }
    if (L.pending && --L.pending.left <= 0) {
      L.licenses[L.pending.id] = true;
      L.pending = null;
      log('🎖️ Your Defense manufacturing license was approved! You can now design and build military hardware.', 'good');
      showModal({ title: '🎖️ Defense license approved', cls: 'good', body: '<p>You are now a licensed defense contractor. Design helicopters, tanks, fighter jets and bombers in the Design Studio, and governments will start sending you orders.</p>' });
    }
    // copycats rip off successful designs unless you hold patents
    const hits = S.designs.filter((d) => d.sold > 20);
    if (hits.length && chance(0.006)) {
      const d = pick(hits);
      if (L.staff.patent) { L.blocked++; log(`📜 A competitor tried to copy your ${esc(d.name)}. Your patent attorney shut them down.`, 'good'); }
      else {
        d.recent += DCATS[d.cat].K / d.price * 0.6;
        log(`🥸 A competitor launched a knock-off of your ${esc(d.name)}! Its price collapses for a while. (A patent attorney prevents this.)`, 'bad');
        toast(`🥸 Copycat! ${esc(d.name)} prices hit.`, 'bad');
      }
    }
  },
  tabs: [{ id: 'legal', name: 'Legal & Advisors', icon: '⚖️', render: renderLegal }],
  actions: {
    lawFirm(a) { S.legal.firm = a; toast(`${LF[a].icon} ${LF[a].name} is now on retainer.`, 'good'); },
    advisor(k) { S.legal.staff[k] = !S.legal.staff[k]; },
    applyDefense() {
      const L = S.legal;
      if (L.licenses.defense || L.pending) return;
      if (legalPower() < DEFENSE_LICENSE.power) return toast(`You need legal strength ${DEFENSE_LICENSE.power}+ to handle the paperwork.`, 'warn');
      if (!COUNTRIES.some((c) => rel(c.id) >= DEFENSE_LICENSE.rel)) return toast(`You need relations ${DEFENSE_LICENSE.rel}+ with at least one government.`, 'warn');
      if (!pay(DEFENSE_LICENSE.cost, 'Legal', 'the defense license application')) return;
      L.pending = { id: 'defense', left: DEFENSE_LICENSE.days };
      log(`🎖️ Applied for a Defense manufacturing license. Background checks take ${DEFENSE_LICENSE.days} days.`);
    },
  },
});

function renderLegal() {
  const L = S.legal, pw = legalPower();
  const firms = LAW_FIRMS.map((f) => `<div class="card tight ${L.firm === f.id ? 'hl' : ''}"><div class="row between"><b>${f.icon} ${f.name}</b><span class="pill">${f.fee ? money(f.fee) + '/day' : 'free'}</span></div>
    <div class="small muted" style="margin:6px 0">${f.desc} Legal strength +${f.power}.</div>
    ${L.firm === f.id ? '<span class="pill good">On retainer</span>' : btn(f.id === 'none' ? 'Drop counsel' : 'Retain', 'lawFirm', f.id, { cls: 'sm' })}</div>`).join('');
  const advisors = Object.entries(ADVISORS).map(([k, a]) => `<div class="list-item"><span class="big-ico">${a.icon}</span><div class="grow"><b>${a.name}</b> <span class="small muted">${money(a.fee)}/day</span><div class="small muted">${a.desc}</div></div>
    ${btn(L.staff[k] ? 'Let go' : 'Hire', 'advisor', k, { cls: 'sm ' + (L.staff[k] ? 'sell' : 'buy') })}</div>`).join('');
  const lic = L.licenses.defense ? '<span class="pill good">✅ Licensed defense contractor</span>'
    : L.pending ? `<span class="pill warn">Under review: ${L.pending.left} days left</span>`
    : btn(`Apply (${money(DEFENSE_LICENSE.cost)})`, 'applyDefense', '', { cls: 'sm primary', disabled: !canAfford(DEFENSE_LICENSE.cost) });
  return `<h2 class="section">⚖️ Legal &amp; Advisors</h2>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Legal strength</div><div class="val">${pw}</div>${bar(pw, 'var(--accent)', 70)}</div>
    <div class="card kpi"><div class="lbl">Lawsuit win chance</div><div class="val">${pct(lawsuitWin(), 0)}</div></div>
    <div class="card kpi"><div class="lbl">Fines &amp; penalties</div><div class="val good">−${pct(1 - legalFineMult(), 0)}</div><div class="small muted">audits, accidents, contract penalties, police fines</div></div>
    <div class="card kpi"><div class="lbl">Legal bills</div><div class="val">${money(legalFees())}/day</div><div class="small muted">${L.blocked} copycats blocked</div></div>
  </div>
  <h4>Law firm</h4><div class="grid g4 section">${firms}</div>
  <div class="grid g2">
    <div class="card"><h3>👔 Specialist advisors</h3>${advisors}</div>
    <div class="card"><h3>📄 Special licenses</h3>
      <div class="list-item"><span class="big-ico">🎖️</span><div class="grow"><b>Defense manufacturing license</b>
        <div class="small muted">Lets you build helicopters, tanks, fighter jets and bombers and sell them to governments. Needs legal strength ${DEFENSE_LICENSE.power}+ (you: ${pw}) and relations ${DEFENSE_LICENSE.rel}+ with one government. Approval takes ${DEFENSE_LICENSE.days} days.</div></div>${lic}</div>
      <p class="small muted" style="margin-top:8px">Spaceflight licenses come with founding your space agency in the 🚀 Space tab.</p></div>
  </div>`;
}
