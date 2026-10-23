'use strict';
/* =====================================================================
   Rival tycoons: AI competitors who grow their empires, launch rival
   products, open restaurants next to yours, poach your executives, bid
   on the same tenders, sue you and make buyout offers. Beat them on the
   leaderboard, make peace, sue them back or buy them out.
   ===================================================================== */
const TYCOONS = [
  { id: 'kane', name: 'Victoria Kane', company: 'Kane Industries', icon: '👩‍💼', style: 'industrial', cats: ['car', 'carEngine', 'jetEngine', 'aircraft', 'tank', 'helicopter'], start: 3e6 },
  { id: 'reed', name: 'Marcus Reed', company: 'Reed Capital', icon: '🧔', style: 'finance', cats: ['phone', 'satellite'], start: 5e6 },
  { id: 'sato', name: 'Lena Sato', company: 'Sato Dynamics', icon: '👩‍🔬', style: 'tech', cats: ['chip', 'phone', 'avionics', 'radar', 'rocket'], start: 2e6 },
  { id: 'okafor', name: '"Big" Bob Okafor', company: 'Okafor Foods & Energy', icon: '🤠', style: 'consumer', cats: ['car', 'phone'], resto: true, start: 1e6 },
];
const RV = Object.fromEntries(TYCOONS.map((r) => [r.id, r]));
const RIVAL_EVENTS = ['product', 'resto', 'poach', 'lawsuit', 'buyout', 'tender'];

const RS = () => S.rivals;
const activeRivals = () => TYCOONS.filter((r) => !RS()[r.id].acquired);
const rivalTenderPenalty = () => (S.rivals ? activeRivals().filter((r) => RS()[r.id].nw > 2e7).length * 0.03 : 0);
const acquirePrice = (id) => RS()[id].nw * 1.3;

function rivalEvent(r) {
  const st = RS()[r.id], hostile = st.rel < 0, kind = pick(RIVAL_EVENTS);
  if (kind === 'product') {
    const mine = S.designs.filter((d) => r.cats.includes(d.cat) && d.status === 'approved' && d.made > 0);
    if (!mine.length) return;
    const d = pick(mine);
    d.recent += DCATS[d.cat].K / d.price * 0.35;
    log(`${r.icon} ${r.company} launched a rival to your ${esc(d.name)}. Your prices take a hit for a while.`, 'warn');
  } else if (kind === 'resto' && r.resto && S.restaurants.length) {
    const x = pick(S.restaurants);
    x.competition = 20;
    log(`${r.icon} ${r.company} opened a competing restaurant across the street from ${esc(x.name)}. Demand −15% for 20 days.`, 'warn');
  } else if (kind === 'poach' && hostile) {
    const ex = Object.entries(S.people.execs).filter(([, e]) => e && e.loyalty < 60);
    if (!ex.length) return;
    const [div, e] = pick(ex), raise = Math.round(e.salary * 0.4);
    showModal({
      title: `${r.icon} ${r.company} wants your ${DIVISIONS[div].name} chief`, cls: 'danger',
      body: `<p>${esc(e.name)} (skill ${e.skill}) got an offer from ${r.name}. Match it with a ${money(raise)}/day raise, or let them go.</p>`,
      buttons: [
        { label: `Counter-offer (+${money(raise)}/day)`, cls: 'primary', fn: () => { e.salary += raise; e.loyalty = clamp(e.loyalty + 30, 0, 100); log(`🤝 ${esc(e.name)} stayed after a raise.`, 'good'); } },
        { label: 'Let them go', fn: () => { S.people.execs[div] = null; log(`👋 ${esc(e.name)} left for ${r.company}.`, 'bad'); } },
      ],
    });
  } else if (kind === 'lawsuit' && hostile && netWorth() > 1e6) {
    const claim = Math.round(Math.min(netWorth() * 0.02, st.nw * 0.05));
    showModal({
      title: `${r.icon} ${r.company} is suing you`, cls: 'danger',
      body: `<p>${r.name} claims you stole trade secrets and wants <b>${money(claim)}</b>.</p>`,
      buttons: [
        { label: `Settle (${money(claim * 0.6)})`, fn: () => { spend(claim * 0.6, 'Fines'); } },
        { label: `Fight it (${pct(lawsuitWin(), 0)} win chance)`, cls: 'danger', fn: () => {
          spend(claim * 0.1, 'Legal');
          if (chance(lawsuitWin())) { st.rel += 5; log(`⚖️ You beat ${r.company} in court.`, 'good'); } else { spend(claim, 'Fines'); log(`⚖️ You lost to ${r.company} in court and paid ${money(claim)}.`, 'bad'); }
        } },
      ],
    });
  } else if (kind === 'buyout') {
    const pool = [...S.restaurants.map((x) => ['resto', x, restoValue(x), x.name]), ...S.factories.map((f) => ['fac', f, facValue(f), facDef(f).name])];
    if (!pool.length) return;
    const [t, obj, val, name] = pick(pool), offer = Math.round(val * rand(1.4, 2));
    showModal({
      title: `${r.icon} Buyout offer from ${r.company}`,
      body: `<p>${r.name} offers <b>${money(offer)}</b> for your ${esc(name)} (worth about ${money(val)}).</p>`,
      buttons: [
        { label: `Sell for ${money(offer)}`, cls: 'buy', fn: () => { earn(offer, 'Investments'); (t === 'resto' ? S.restaurants : S.factories).splice((t === 'resto' ? S.restaurants : S.factories).indexOf(obj), 1); st.nw += val; st.rel += 5; log(`🤝 Sold ${esc(name)} to ${r.company} for ${money(offer)}.`, 'good'); } },
        { label: 'No thanks' },
      ],
    });
  }
}

registerModule({
  id: 'rivals',
  init(s) { s.rivals = Object.fromEntries(TYCOONS.map((r) => [r.id, { nw: r.start, hist: [r.start], rel: 0, acquired: false, peace: 0 }])); },
  assets(a) { a.subsidiaries = TYCOONS.reduce((t, r) => t + (RS()[r.id].acquired ? RS()[r.id].nw * 0.8 : 0), 0); },
  daily() {
    const me = Math.max(1e5, netWorth());
    for (const r of TYCOONS) {
      const st = RS()[r.id];
      if (st.acquired) { st.nw *= 1 + 0.0008 + gauss() * 0.004; earn(st.nw * 0.0004, 'Subsidiaries'); continue; }
      // rubber band: rivals far behind you grow faster, rivals far ahead slow down
      const gap = clamp(Math.log10(me / st.nw), -1.5, 1.5);
      st.nw *= Math.exp(0.004 + 0.003 * gap + gauss() * 0.012 + S.marketMood * 0.5);
      st.hist.push(st.nw);
      if (st.hist.length > 180) st.hist.shift();
      if (st.peace > 0) st.peace--;
      st.rel = clamp(st.rel - 0.05, -100, 100);
      if (st.peace <= 0 && chance(0.015)) rivalEvent(r);
    }
    for (const x of S.restaurants) if (x.competition > 0) x.competition--;
  },
  tabs: [{ id: 'rivals', name: 'Rivals', icon: '🥊', render: renderRivals }],
  actions: {
    rivalPeace(id) {
      const st = RS()[id], cost = Math.round(Math.max(250000, st.nw * 0.002));
      if (!pay(cost, 'Contracts', 'the peace summit')) return;
      st.rel = clamp(st.rel + 25, -100, 100); st.peace = 60;
      toast(`🤝 ${RV[id].company} agrees to a 60-day truce.`, 'good');
    },
    rivalSue(id) {
      const st = RS()[id], fees = Math.round(500000 + st.nw * 0.002);
      if (!pay(fees, 'Legal', 'the lawsuit')) return;
      st.rel -= 20;
      if (chance(lawsuitWin() * 0.8)) { const won = Math.round(st.nw * 0.02); st.nw -= won; earn(won, 'Legal'); log(`⚖️ You won your lawsuit against ${RV[id].company}: ${money(won)}!`, 'good'); toast(`⚖️ You won ${money(won)}!`, 'good'); }
      else log(`⚖️ Your lawsuit against ${RV[id].company} failed.`, 'bad');
    },
    rivalAcquire(id) {
      const st = RS()[id], price = acquirePrice(id);
      if (netWorth() < st.nw) return toast('You must be bigger than them to swallow them.', 'warn');
      if (!pay(price, 'Investments', 'the acquisition')) return;
      st.acquired = true;
      stat('rivalsAcquired');
      timeline(RV[id].icon, `Acquired ${RV[id].company}`);
      log(`🦈 You acquired ${RV[id].company} for ${money(price)}! It now pays you dividends as a subsidiary.`, 'good');
      showModal({ title: `🦈 ${RV[id].company} is yours`, cls: 'good', body: `<p>${RV[id].name} hands over the keys. The company keeps operating as your subsidiary and stops competing with you.</p>` });
    },
  },
});

function renderRivals() {
  const me = netWorth();
  const board = [{ icon: '😎', name: 'You', company: S.corp && S.corp.founded ? S.corp.name : 'Your empire', nw: me, you: true }, ...TYCOONS.map((r) => ({ ...r, nw: RS()[r.id].nw, acquired: RS()[r.id].acquired }))].sort((a, b) => b.nw - a.nw);
  return `<h2 class="section">🥊 Rival Tycoons</h2>
  <div class="card section"><h3>🏆 Leaderboard</h3><table><tbody>${board.map((x, i) => `<tr ${x.you ? 'class="sel"' : ''}><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${x.icon} <b>${x.name}</b> <span class="small muted">${esc(x.company)}</span>${x.acquired ? ' <span class="pill good">your subsidiary</span>' : ''}</td><td class="num">${money(x.nw)}</td></tr>`).join('')}</tbody></table></div>
  <div class="grid g2">${TYCOONS.map((r) => {
    const st = RS()[r.id], peace = Math.round(Math.max(250000, st.nw * 0.002)), price = acquirePrice(r.id);
    return `<div class="card ${st.acquired ? 'hl' : ''}"><div class="row between"><b>${r.icon} ${r.name}</b><span class="small muted">${r.company} · ${r.style}</span></div>
      <div class="kpi"><div class="val">${money(st.nw)}</div></div>${chart('rv' + r.id, st.hist, 50, {})}
      ${st.acquired ? '<p class="good small">Acquired. Pays you dividends every day.</p>' : `${barline('Relations', 50 + st.rel / 2, st.rel < 0 ? 'var(--bad)' : 'var(--good)')}
      <p class="small muted">Competes with you in: ${r.cats.map((c) => DCATS[c].icon).join(' ')}${r.resto ? ' 🍽️' : ''}${st.peace ? ` · truce for ${st.peace} days` : ''}</p>
      <div class="row">${btn(`🕊️ Peace summit (${money(peace)})`, 'rivalPeace', r.id, { cls: 'sm' })}${btn(`⚖️ Sue (${money(500000 + st.nw * 0.002)})`, 'rivalSue', r.id, { cls: 'sm' })}
      ${btn(`🦈 Acquire (${money(price)})`, 'rivalAcquire', r.id, { cls: 'sm buy', disabled: me < st.nw || !canAfford(price) })}</div>`}</div>`;
  }).join('')}</div>`;
}
