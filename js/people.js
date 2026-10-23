'use strict';
/* =====================================================================
   People: hire named division chiefs with skills, salaries, loyalty and
   traits. Good chiefs run their division for you. Watch out for
   poaching, burnout and unions.
   ===================================================================== */
const DIVISIONS = {
  resto: { name: 'Restaurants', icon: '🍽️', effect: (s) => `+${pct(0.15 * s, 0)} demand, auto-hires to fix bottlenecks` },
  mfg: { name: 'Manufacturing', icon: '🏭', effect: (s) => `−${pct(0.2 * s, 0)} factory payroll, fewer strikes and accidents` },
  re: { name: 'Real Estate', icon: '🏘️', effect: (s) => `+${pct(0.1 * s, 0)} rent, happier tenants, auto-advertises vacancies` },
  energy: { name: 'Energy', icon: '⚡', effect: (s) => `+${pct(0.1 * s, 0)} power output` },
  tech: { name: 'AI & Tech', icon: '🤖', effect: (s) => `+${pct(0.3 * s, 0)} research, fewer AI incidents` },
  space: { name: 'Space & Defense', icon: '🚀', effect: (s) => `+${pct(0.03 * s, 1)} launch success, +${pct(0.1 * s, 0)} certification pass chance` },
  finance: { name: 'Finance (CFO)', icon: '💹', effect: (s) => `−${pct(0.3 * s, 0)} loan interest and audit risk, better bank returns` },
  logistics: { name: 'Logistics', icon: '🚢', effect: (s) => `−${pct(0.2 * s, 0)} shipping time, −${pct(0.3 * s, 0)} shipping costs` },
};
const TRAITS = {
  loyal: { name: 'Loyal', desc: 'Rarely leaves', decay: 0.03 },
  ambitious: { name: 'Ambitious', desc: 'Gets better every day but restless', decay: 0.2, grow: 0.04 },
  frugal: { name: 'Frugal', desc: 'Works for 20% less', decay: 0.1, pay: 0.8 },
  innovator: { name: 'Innovator', desc: 'Effect +15%', decay: 0.12, boost: 1.15 },
  greedy: { name: 'Greedy', desc: 'Effect +10%, demands raises', decay: 0.25, boost: 1.1 },
};
const FIRST = ['Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Omar', 'Priya', 'Chen', 'Sofia', 'Diego', 'Hana', 'Ivan', 'Grace', 'Malik', 'Elena', 'Kofi', 'Yuki', 'Lars', 'Amara', 'Theo'];
const LAST = ['Novak', 'Okoye', 'Lindqvist', 'Moreau', 'Tanaka', 'Haddad', 'Ramirez', 'Kowalski', 'Mensah', 'Park', 'Rossi', 'Fischer', 'Singh', 'Costa', 'Byrne', 'Abara'];

const PE = () => S.people;
// 0..~1.15 strength of the chief running a division (0 if vacant)
function execSkill(div) {
  const e = S.people && S.people.execs[div];
  return e ? e.skill / 100 * (TRAITS[e.trait].boost || 1) : 0;
}
function makeCandidate() {
  const skill = randInt(30, 95), trait = pick(Object.keys(TRAITS));
  return { id: uid(), name: `${pick(FIRST)} ${pick(LAST)}`, skill, trait, salary: Math.round((300 + skill * skill * 1.2) * (TRAITS[trait].pay || 1)), loyalty: 70 };
}
function genCandidates() { PE().pool = Array.from({ length: 6 }, makeCandidate); PE().nextPool = S.day + 7; }
const execPay = () => Object.values(PE().execs).reduce((t, e) => t + (e ? e.salary : 0), 0);

function unionEvent() {
  const fs = S.factories.filter((f) => !f.union && !f.paused);
  if (!fs.length) return;
  const f = pick(fs), name = facDef(f).name;
  showModal({
    title: '✊ Workers are unionizing', cls: 'danger',
    body: `<p>Workers at your <b>${name}</b> formed a union and demand 15% higher pay.</p>`,
    buttons: [
      { label: 'Accept (+15% payroll there)', fn: () => { f.union = true; log(`✊ You recognized the union at your ${name}.`); } },
      { label: 'Refuse (they strike for 5 days)', cls: 'danger', fn: () => { f.closed = Math.max(f.closed, 5); S.deals.rep = clamp(S.deals.rep - 3, 0, 100); log(`🪧 Workers at your ${name} went on strike!`, 'bad'); } },
    ],
  });
}

registerModule({
  id: 'people',
  init(s) { s.people = { execs: Object.fromEntries(Object.keys(DIVISIONS).map((k) => [k, null])), pool: [], nextPool: 1 }; },
  start() { genCandidates(); },
  daily() {
    const P = PE();
    if (S.day >= P.nextPool) genCandidates();
    const pay = execPay();
    if (pay) spend(pay, 'Wages');
    for (const [div, e] of Object.entries(P.execs)) {
      if (!e) continue;
      const t = TRAITS[e.trait];
      e.loyalty = clamp(e.loyalty - t.decay, 0, 100);
      if (t.grow) e.skill = Math.min(99, e.skill + t.grow);
      if (e.trait === 'greedy' && chance(0.01)) { e.salary = Math.round(e.salary * 1.1); log(`💸 ${esc(e.name)} demanded (and got) a 10% raise.`, 'warn'); }
      if (e.loyalty <= 5 && chance(0.05)) { P.execs[div] = null; log(`👋 ${esc(e.name)} quit as head of ${DIVISIONS[div].name}. Their loyalty ran out.`, 'bad'); }
    }
    // a restaurants chief keeps kitchens staffed
    if (P.execs.resto) for (const r of S.restaurants) {
      const L = r.last, t = RT[r.type];
      if (!L || staffCount(r) >= t.maxStaff || !canAfford(1000)) continue;
      if (L.bottleneck === 'cooks') r.staff.cook++;
      else if (L.bottleneck === 'waiters' && !t.noWaiters) r.staff.waiter++;
      else if (r.clean < 50) r.staff.cleaner++;
    }
    if (P.execs.re) for (const p of S.re.props) if (!p.tenant && !p.ad && canAfford(PT[p.type].rent * 4)) { spend(PT[p.type].rent * 4, 'Real Estate'); p.ad = 7; }
    if (S.factories.length >= 2 && chance(0.004 * (1 - 0.7 * execSkill('mfg')) * policy('wage'))) unionEvent();
  },
  tabs: [{ id: 'people', name: 'Executives', icon: '👔', render: renderPeople }],
  actions: {
    hireExec(id, div) {
      const P = PE(), c = P.pool.find((x) => x.id === +id);
      if (!c) return;
      if (P.execs[div]) return toast('Fire the current chief first.', 'warn');
      if (!pay(c.salary * 10, 'Wages', 'the signing bonus')) return;
      P.execs[div] = c;
      P.pool.splice(P.pool.indexOf(c), 1);
      stat('execsHired');
      log(`👔 ${esc(c.name)} is your new head of ${DIVISIONS[div].name}.`, 'good');
    },
    fireExec(div) {
      const e = PE().execs[div];
      if (!e) return;
      spend(e.salary * 20, 'Wages');
      PE().execs[div] = null;
      log(`📦 You fired ${esc(e.name)} (severance ${money(e.salary * 20)}).`);
    },
    bonusExec(div) {
      const e = PE().execs[div];
      if (!pay(e.salary * 15, 'Wages', 'the bonus')) return;
      e.loyalty = clamp(e.loyalty + 25, 0, 100);
      toast(`🎁 ${esc(e.name)} feels appreciated. Loyalty +25.`, 'good');
    },
    trainExec(div) {
      const e = PE().execs[div];
      if (e.skill >= 99 || !pay(e.salary * 20, 'Wages', 'executive training')) return;
      e.skill = Math.min(99, e.skill + 5);
      e.salary = Math.round(e.salary * 1.05);
      toast(`🎓 ${esc(e.name)} completed executive training: skill +5.`, 'good');
    },
    peopleDiv(a) { UI.peopleDiv = a; },
  },
});
UI.peopleDiv = 'resto';

function renderPeople() {
  const P = PE();
  const slots = Object.entries(DIVISIONS).map(([k, d]) => {
    const e = P.execs[k];
    return `<div class="card tight ${e ? 'hl' : ''}"><div class="row between"><b>${d.icon} ${d.name}</b>${e ? `<span class="pill good">${TRAITS[e.trait].name}</span>` : '<span class="pill">Vacant</span>'}</div>
      ${e ? `<div style="margin-top:6px"><b>${esc(e.name)}</b> <span class="small muted">skill ${Math.round(e.skill)} · ${money(e.salary)}/day</span></div>
        ${barline('Loyalty', e.loyalty, e.loyalty < 30 ? 'var(--bad)' : 'var(--good)')}
        <div class="small good">${d.effect(execSkill(k))}</div>
        <div class="row" style="margin-top:6px">${btn(`🎁 Bonus (${money(e.salary * 15)})`, 'bonusExec', k, { cls: 'sm' })}${btn(`🎓 Train (${money(e.salary * 20)})`, 'trainExec', k, { cls: 'sm', disabled: e.skill >= 99 })}${btn('Fire', 'fireExec', k, { cls: 'sm sell' })}</div>`
        : `<div class="small muted" style="margin-top:6px">A chief here would give: ${d.effect(0.7)} (at skill 70).</div>`}</div>`;
  }).join('');
  const pool = P.pool.map((c) => `<div class="list-item"><span class="big-ico">🧑‍💼</span><div class="grow"><b>${esc(c.name)}</b> <span class="small muted">skill ${c.skill} · ${TRAITS[c.trait].name}: ${TRAITS[c.trait].desc} · ${money(c.salary)}/day</span></div>
    <div class="seg wrap">${Object.entries(DIVISIONS).map(([k, d]) => btn(d.icon, 'hireExec', c.id, { b: k, cls: 'sm', disabled: !!P.execs[k] || !canAfford(c.salary * 10), title: `Hire as head of ${d.name}` })).join('')}</div></div>`).join('');
  return `<h2 class="section">👔 Executives</h2>
  <div class="banner info small">Put a chief in charge of each division. Their skill drives the bonus. Loyalty drops over time, and rivals try to poach unhappy chiefs. Executive payroll: <b>${money(execPay())}/day</b>.</div>
  <div class="grid g4 section">${slots}</div>
  <div class="card"><h3>🧑‍💼 Candidates (new shortlist on day ${P.nextPool})</h3><p class="small muted">Hiring costs a 10-day signing bonus. Click a division icon to hire.</p>${pool}</div>`;
}
