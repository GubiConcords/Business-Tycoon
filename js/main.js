'use strict';
/* =====================================================================
   Main: dashboard, log & awards, random events, day loop, rendering
   ===================================================================== */
const TAB_ORDER = ['dash', 'job', 'stocks', 'crypto', 'startups', 'resto', 'factories', 'deals', 'ai', 'yard', 'realestate', 'fleet', 'space', 'racing', 'casino', 'bank', 'taxes', 'legal', 'log'];
const HUSTLES = [
  { id: 'odd', name: 'Odd jobs', icon: '🧹', energy: 30, pay: [90, 160] },
  { id: 'deliver', name: 'Deliver food', icon: '🛵', energy: 40, pay: [140, 230] },
  { id: 'freelance', name: 'Freelance gig', icon: '💻', energy: 60, pay: [200, 420] },
];

const ACH = [
  ['trade', '📈', 'First Trade', 'Buy your first stock or coin', () => S.stats.trades > 0],
  ['div', '💌', 'Dividend Collector', 'Receive a dividend payment', () => S.stats.divs > 0],
  ['whale', '🐳', 'Crypto Whale', 'Hold $250K worth of crypto', () => assets().crypto >= 250000],
  ['unicorn', '🦄', 'Unicorn Hunter', 'Get a 12x+ startup exit', () => S.stats.unicorns > 0],
  ['resto', '🍽️', 'Restaurateur', 'Open your first restaurant', () => S.restaurants.length > 0],
  ['resto3', '🏙️', 'Food Empire', 'Own 3 restaurants at once', () => S.restaurants.length >= 3],
  ['meals', '🥘', 'Fed the City', 'Serve 25,000 meals', () => S.stats.meals >= 25000],
  ['factory', '🏭', 'Industrialist', 'Build your first factory', () => S.stats.factoriesBuilt > 0],
  ['designer', '📐', 'Designer', 'Complete your first R&D project', () => S.stats.designs > 0],
  ['chips', '🔲', 'Silicon Valley', 'Produce 1,000 of your own chips', () => (S.stats.made_chip || 0) >= 1000],
  ['engines', '🔧', 'Engine Builder', 'Produce 100 of your own engines', () => (S.stats.made_carEngine || 0) + (S.stats.made_jetEngine || 0) >= 100],
  ['carmaker', '🚙', 'Automaker', 'Produce 100 of your own cars', () => (S.stats.made_car || 0) >= 100],
  ['faa', '📋', 'FAA Certified', 'Get an FAA type certificate for an aircraft', () => S.stats.faa > 0],
  ['airliner', '✈️', 'Cleared for Takeoff', 'Build your own aircraft', () => S.stats.made_aircraft > 0],
  ['yard', '🐕', 'Junkyard Dog', 'Buy a scrapyard', () => S.yard.owned],
  ['scrap25', '🗜️', 'Crusher', 'Scrap 25 cars', () => S.stats.scrapped >= 25],
  ['flip', '🔁', 'Flipper', 'Repair & sell 5 cars', () => S.stats.flipped >= 5],
  ['landlord', '🔑', 'Landlord', 'Own a property', () => S.re.props.length > 0],
  ['mogul', '🏙️', 'Property Mogul', 'Own 10 properties', () => S.re.props.length >= 10],
  ['developer', '🏗️', 'Developer', 'Build a property from scratch', () => S.stats.developed > 0],
  ['race', '🏁', 'Checkered Flag', 'Win a race', () => S.stats.raceWins > 0],
  ['champ', '🏆', 'Champion', 'Win 25 races', () => S.stats.raceWins >= 25],
  ['plinko', '🔻', 'High Roller', 'Hit a 100x+ casino win', () => S.stats.megaWins > 0],
  ['jackpot', '🎰', 'Triple Sevens', 'Hit the slots jackpot', () => S.stats.jackpots > 0],
  ['lotto', '🎟️', 'Lottery Winner', 'Win the lottery jackpot', () => S.stats.lotteryJackpots > 0],
  ['audit', '🕵️', 'Caught Cooking the Books', 'Fail a tax audit', () => S.stats.auditsFailed > 0],
  ['nw25k', '🌱', 'Getting Started', 'Net worth of $25K', () => netWorth() >= 25000],
  ['nw100k', '💵', 'Six Figures', 'Net worth of $100K', () => netWorth() >= 1e5],
  ['nw1m', '💰', 'Millionaire', 'Net worth of $1M', () => netWorth() >= 1e6],
  ['nw10m', '🏦', 'Multi-Millionaire', 'Net worth of $10M', () => netWorth() >= 1e7],
  ['nw100m', '👑', 'Tycoon', 'Net worth of $100M', () => netWorth() >= 1e8],
  ['nw1b', '🚀', 'Billionaire', 'Net worth of $1B', () => netWorth() >= 1e9],
  ['contract', '✍️', 'Signed & Sealed', 'Complete a supply contract', () => S.deals.done > 0],
  ['gov', '🏛️', 'Government Contractor', 'Win a government tender', () => S.stats.govContracts > 0],
  ['tradedeal', '📜', 'Free Trader', 'Sign a trade agreement with a country', () => S.stats.tradeDeals > 0],
  ['aimodel', '🤖', 'Hello, World', 'Train your first AI model', () => S.stats.aiModels > 0],
  ['agi', '🧠', 'Singularity', 'Deploy an AI with capability 85+', () => aiCap() >= 85],
  ['automate', '🦾', 'Lights Out', 'Let your AI replace human workers', () => Object.entries(S.ai.auto).some(([k, v]) => v && (S.ai.cover[k] || 0) > 0)],
  ['jetset', '🛩️', 'Jet Set', 'Own a private jet you can fly', () => hasJet()],
  ['collector', '🏎️', 'Collector', 'Own 10 cars and aircraft', () => S.fleet.vehicles.length >= 10],
  ['lawyered', '⚖️', 'Lawyered Up', 'Retain an elite law firm', () => S.legal.firm === 'elite'],
  ['defense', '🎖️', 'Defense Contractor', 'Build your own military vehicle', () => ['helicopter', 'tank', 'fighter', 'bomber'].some((k) => S.stats['made_' + k] > 0)],
  ['spaceagency', '🚀', 'Space Agency', 'Found your own space agency', () => S.space.founded],
  ['sorbit', '🛰️', 'To Orbit!', 'Put your first satellite in orbit', () => !!S.space.milestones.orbit],
  ['screw', '🧑‍🚀', 'Astronaut Airline', 'Fly your first crewed mission', () => !!S.space.milestones.crewed],
  ['station', '🛸', 'Home in Orbit', 'Complete your space station', () => !!S.space.milestones.station],
  ['moon', '🌕', 'One Small Step', 'Land a crew on the Moon', () => !!S.space.milestones.moon],
  ['mars', '🔴', 'Red Planet', 'Send a crew to Mars', () => !!S.space.milestones.mars],
  ['vp', '👔', 'Corner Office', 'Get promoted to Vice President at your 9–5', () => S.job.clicks >= 40000],
  ['honest', '😇', 'Honest Tycoon', 'Reach $1M having only ever paid taxes honestly', () => netWorth() >= 1e6 && !S.stats.dodgedTaxes],
];
function checkAch() {
  for (const [id, icon, name, , test] of ACH) {
    if (S.ach[id]) continue;
    let ok = false;
    try { ok = test(); } catch (e) { ok = false; }
    if (ok) {
      S.ach[id] = S.day;
      log(`🏅 Achievement unlocked: ${name}`, 'good');
      toast(`🏅 Achievement: <b>${icon} ${name}</b>`, 'good');
    }
  }
}

/* ---------------------------- Random events ---------------------------- */
const EVENTS = [
  { w: 3, ok: () => true, run() { const v = randInt(20, 400); earn(v, 'Other'); log(`🍀 You found ${money(v)} on the sidewalk!`, 'good'); } },
  { w: 0.4, ok: () => true, run() {
    const v = randInt(10, 60) * 1000; earn(v, 'Other');
    log(`📜 A distant relative left you ${money(v)} in their will.`, 'good');
    showModal({ title: '📜 Inheritance', cls: 'good', body: `<p>A great-aunt you never met left you <b>${money(v)}</b>.</p>` });
  } },
  { w: 3, ok: () => S.restaurants.some((r) => !r.closed), run() {
    const r = pick(S.restaurants.filter((x) => !x.closed)), t = RT[r.type];
    if (r.clean < 50) {
      const fine = 1000 + REST_SITE[r.type].size * 800;
      spend(fine, 'Fines'); r.rep = clamp(r.rep - 10, 0, 100); r.closed = 1;
      log(`🧑‍⚕️ Health inspector found ${esc(r.name)} filthy! Fined ${money(fine)} and closed for a day.`, 'bad');
      toast(`Health inspection failed at ${esc(r.name)}!`, 'bad');
    } else { r.rep = clamp(r.rep + 4, 0, 100); log(`🧑‍⚕️ ${esc(r.name)} passed its health inspection with flying colors.`, 'good'); }
  } },
  { w: 2, ok: () => S.restaurants.length, run() {
    const r = pick(S.restaurants);
    const good = chance(0.25 + r.rep / 150 + (r.quality === 'prem' ? 0.2 : r.quality === 'cheap' ? -0.15 : 0));
    r.rep = clamp(r.rep + (good ? 12 : -12), 0, 100);
    log(`📝 A food critic ${good ? 'raved about' : 'trashed'} ${esc(r.name)}! Reputation ${good ? '+12' : '−12'}.`, good ? 'good' : 'bad');
  } },
  { w: 1, ok: () => S.restaurants.length, run() {
    const r = pick(S.restaurants);
    r.rep = clamp(r.rep + 10, 0, 100); r.marketing += 3;
    log(`📱 A TikTok about ${esc(r.name)} went viral! Crowds are lining up.`, 'good');
    toast(`${esc(r.name)} went viral!`, 'good');
  } },
  { w: 0.4, ok: () => S.restaurants.some((r) => !r.closed), run() {
    const r = pick(S.restaurants.filter((x) => !x.closed)), full = Math.round(RT[r.type].cost * 0.3), cost = Math.round(full * (r.insured ? 0.1 : 1));
    spend(cost, 'Restaurants'); r.closed = 4;
    log(`🔥 Kitchen fire at ${esc(r.name)}! Repairs cost ${money(cost)}${r.insured ? ' after insurance' : ' (uninsured!)'} and it's closed for 4 days.`, 'bad');
    showModal({ title: '🔥 Kitchen fire!', cls: 'danger', body: `<p>A grease fire broke out at <b>${esc(r.name)}</b>. No one was hurt, but the damage is <b>${money(full)}</b>.</p>
      <p>${r.insured ? `🛡️ Insurance covers most of it. You pay the <b>${money(cost)}</b> deductible.` : `⚠️ You had no insurance. You pay the full <b>${money(cost)}</b>.`} It will be closed for 4 days.</p>` });
  } },
  { w: 0.8, ok: () => netWorth() > 500000, run() {
    const claim = Math.round(netWorth() * 0.02), lose = Math.round(netWorth() * 0.05);
    showModal({
      title: '⚖️ You are being sued!', cls: 'danger',
      body: `<p>A customer claims one of your businesses ruined their life and wants <b>${money(claim)}</b>.</p><p>You can settle, or fight in court (50/50 chance; losing costs ${money(lose)} plus legal fees).</p>`,
      buttons: [
        { label: `Settle for ${money(claim)}`, fn: () => { spend(claim, 'Fines'); log(`⚖️ You settled a lawsuit for ${money(claim)}.`); } },
        { label: `Fight it in court (${pct(lawsuitWin(), 0)} win chance)`, cls: 'danger', fn: () => {
          const fees = Math.round(claim * 0.2 * (S.legal.firm === 'none' ? 1 : 0.3));
          spend(fees, 'Fines');
          if (chance(lawsuitWin())) { log(`⚖️ You WON the lawsuit! Legal fees: ${money(fees)}.`, 'good'); toast('You won in court!', 'good'); }
          else { spend(lose, 'Fines'); log(`⚖️ You LOST the lawsuit and paid ${money(lose + fees)}.`, 'bad'); toast('You lost in court.', 'bad'); }
        } },
      ],
    });
  } },
  { w: 1, ok: () => S.yard.owned, run() {
    const up = chance(0.5);
    S.yard.metalPrice = clamp(S.yard.metalPrice * (up ? 1.3 : 0.75), 0.12, 0.8);
    log(up ? '🏗️ Construction boom: scrap metal prices jump!' : '📉 Scrap metal glut: prices fall.', up ? 'good' : 'bad');
  } },
];
function randomEvent() {
  if (!chance(0.2)) return;
  const ok = EVENTS.filter((e) => e.ok());
  if (ok.length) weighted(ok).run();
}

/* ---------------------------- Day loop ---------------------------- */
function nextDay() {
  if (modalQ.length || UI.gameOver) return;
  for (const m of MODS) if (m.daily) m.daily();
  randomEvent();
  for (const m of MODS) if (m.late) m.late();
  if (S.tax.mode !== 'honest') S.stats.dodgedTaxes = 1;

  if (S.cash < 0) {
    S.bank.loan += -S.cash;
    log(`🏦 Overdraft of ${money(-S.cash)} was added to your bank loan.`, 'bad');
    toast(`Overdraft! ${money(-S.cash)} added to your loan.`, 'bad');
    S.cash = 0;
  }
  S.lastLedger = S.ledger;
  S.ledger = {};
  S.day++;
  S.energy = energyMax();

  const nw = netWorth();
  S.history.push(nw);
  if (S.history.length > 365) S.history.shift();
  checkAch();
  if (nw < -50000 && S.cash < 100) gameOver();
  save();
  render();
}

function gameOver() {
  UI.gameOver = true;
  showModal({
    title: '💀 Bankrupt', cls: 'danger',
    body: `<p>Your debts have buried you. Net worth: <b class="bad">${money(netWorth())}</b> on day ${S.day}.</p><p>The bank has seized everything. Time to start over.</p>`,
    buttons: [{ label: 'Start a new game', cls: 'primary', fn: newGame }],
  });
}
function newGame() {
  wipeSave();
  S = newState();
  for (const m of MODS) if (m.start) m.start();
  UI.gameOver = false;
  UI.tab = 'dash';
  save();
  showIntro();
}
function showIntro() {
  showModal({
    title: '💼 Welcome to Business Tycoon',
    body: `<p>You start with <b>${money(START_CASH)}</b>. How you get rich is up to you:</p>
      <ul>
        <li>📈 <b>Stocks, crypto and startups</b>: invest and ride the markets</li>
        <li>🍽️ <b>Restaurants</b>: from food trucks to burger franchises. Hire, pay and manage staff.</li>
        <li>🏭 <b>Factories &amp; R&amp;D</b>: make raw materials, then design your own chips, engines, cars, phones and aircraft. Pay for R&amp;D and certification (like an FAA type certificate), then mass-produce them</li>
        <li>🚗 <b>Scrapyard</b>: crush junk cars for metal, or fix and flip them</li>
        <li>🏘️ <b>Real estate</b>: buy, rent out, renovate and develop property</li>
        <li>🏎️ <b>Racing</b>: tune cars, win prize money, bet on yourself (underground races pay more, but the police might show up)</li>
        <li>🎰 <b>Casino</b>: Plinko, slots, roulette, blackjack, crash, dice and the lottery</li>
        <li>🧾 <b>Taxes</b>: pay honestly, or cook the books and risk an audit</li>
        <li>🤝 <b>Deals &amp; diplomacy</b>: supply contracts with companies, government tenders, joint ventures and trade agreements</li>
        <li>🤖 <b>AI Lab</b>: hire programmers, build data centers, train your own AI, sell it, and let it replace your employees</li>
        <li>🛩️ <b>Garage &amp; hangar</b>: buy cars and private aircraft, or take your own designs for a spin</li>
        <li>🎖️ <b>Defense</b>: design and build helicopters, tanks, fighter jets and bombers, plus all their parts</li>
        <li>🚀 <b>Space agency</b>: rockets, satellites, space tourism, a space station, the Moon and Mars</li>
        <li>⚖️ <b>Legal &amp; advisors</b>: hire better lawyers and specialists to cut fines and win lawsuits</li>
        <li>💼 <b>A 9–5 job</b>: click to work, starting at 1¢ per click. Get promoted up to 40¢.</li>
        <li>🏢 <b>Running costs</b>: every business needs premises (rent or buy), a permit, and pays for electricity, water, gas, internet, waste and insurance. You also pay your own living costs.</li>
      </ul>
      <p class="small muted">Each day lasts a few seconds. Use the speed controls or <b>Space</b> to pause. You have 100⚡ energy per day for hands-on work. Your game saves automatically.</p>`,
    buttons: [{ label: "Let's make money! 💸", cls: 'primary', fn: () => { S.seenIntro = true; save(); } }],
  });
}

/* ---------------------------- Dashboard ---------------------------- */
function renderDash() {
  const a = assets(), nw = netWorth();
  const led = Object.entries(S.lastLedger).filter(([, v]) => Math.abs(v) >= 0.5).sort((x, y) => y[1] - x[1]);
  const net = led.reduce((s, [, v]) => s + v, 0);
  const alloc = Object.entries(a).filter(([, v]) => Math.abs(v) >= 1).sort((x, y) => y[1] - x[1]);
  const gross = alloc.reduce((s, [, v]) => s + Math.max(0, v), 0) || 1;
  const hustles = HUSTLES.map((h) => btn(`${h.icon} ${h.name} <span class="muted">${h.energy}⚡ · ${money(h.pay[0])}–${money(h.pay[1])}</span>`, 'hustle', h.id, { disabled: S.energy < h.energy })).join('');
  const got = Object.keys(S.ach).length;
  return `<h2 class="section">📊 Dashboard <span class="muted small">Day ${S.day} · ${dayName()}${isWeekend() ? ' (weekend rush 🍔)' : ''}</span></h2>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Net worth</div><div class="val">${money(nw)}</div></div>
    <div class="card kpi"><div class="lbl">Cash</div><div class="val">${money(S.cash)}</div></div>
    <div class="card kpi"><div class="lbl">Yesterday's net income</div><div class="val ${cls(net)}">${signMoney(net)}</div></div>
    <div class="card kpi"><div class="lbl">Achievements</div><div class="val">${got}/${ACH.length}</div></div>
  </div>
  <div class="card section"><h3>Net worth</h3>${chart('nw', S.history, 170, { labels: true, fmt: (v) => money(v) })}</div>
  <div class="grid g2 section">
    <div class="card"><h3>💪 Hustle (uses energy)</h3><p class="small muted">Short on cash? Earn a little with your own two hands.</p>
      <div class="grid" style="gap:8px">${hustles}</div>
      <div style="margin-top:10px">${barline(`Energy ${S.energy}/${energyMax()}⚡`, S.energy / energyMax() * 100, 'var(--energy)')}</div></div>
    <div class="card"><h3>Yesterday's cash flow</h3>${led.length ? `<table><tbody>${led.map(([k, v]) => `<tr><td>${k}</td><td class="num ${cls(v)}">${signMoney(v)}</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td class="num ${cls(net)}"><b>${signMoney(net)}</b></td></tr></tbody></table>` : '<p class="muted">Nothing yet. Wait for the day to end.</p>'}</div>
  </div>
  <div class="grid g2 section">${renderLiving()}</div>
  <div class="grid g2">
    <div class="card"><h3>Assets</h3>${alloc.map(([k, v]) => `<div class="barline" style="grid-template-columns:100px 1fr 90px"><span class="muted">${ASSET_LABELS[k] || k}</span>${bar(Math.max(0, v) / gross * 100, v < 0 ? 'var(--bad)' : 'var(--accent)')}<span class="num right ${v < 0 ? 'bad' : ''}">${money(v)}</span></div>`).join('')}</div>
    <div class="card"><h3>Latest news</h3><div class="log" style="max-height:280px">${S.log.slice(0, 14).map(logLine).join('') || '<p class="muted">Quiet so far…</p>'}</div></div>
  </div>`;
}
function renderLiving() {
  const cur = LIFE[S.life.tier], L = S.lastLedger;
  const fixed = ['Rent', 'Utilities', 'Insurance', 'Wages', 'Living costs'].map((k) => [k, -(L[k] || 0)]).filter(([, v]) => v > 0.5);
  const rate = (k, label) => `<div class="barline" style="grid-template-columns:110px 1fr 60px"><span class="muted">${label}</span>${bar(S.utilRates[k] / 2.2 * 100, S.utilRates[k] > 1.15 ? 'var(--bad)' : S.utilRates[k] < 0.9 ? 'var(--good)' : 'var(--warn)')}<span class="num right">${pct(S.utilRates[k], 0)}</span></div>`;
  return `<div class="card"><h3>🏠 Where you live</h3><p class="small muted">${cur.icon} <b>${cur.name}</b>: ${money(cur.cost)}/day · ${cur.energy}⚡ max energy. ${cur.desc}</p>
    <div class="grid" style="gap:6px">${LIFESTYLES.map((l) => btn(`${l.icon} ${l.name} <span class="muted">${money(l.cost)}/day · ${l.energy}⚡</span>`, 'lifestyle', l.id, { cls: l.id === S.life.tier ? 'on' : '', disabled: l.id === S.life.tier })).join('')}</div></div>
  <div class="card"><h3>🧾 Running costs</h3>
    ${fixed.length ? `<table><tbody>${fixed.map(([k, v]) => `<tr><td>${k}</td><td class="num bad">${money(v)}</td></tr>`).join('')}<tr><td><b>Yesterday's fixed costs</b></td><td class="num bad"><b>${money(fixed.reduce((s, [, v]) => s + v, 0))}</b></td></tr></tbody></table>` : '<p class="muted small">No bills yet.</p>'}
    <h4 style="margin-top:12px">Utility prices (100% = normal)</h4>${rate('elec', '⚡ Electricity')}${rate('water', '💧 Water')}${rate('gas', '🔥 Gas')}</div>`;
}
const logLine = (l) => `<div class="log-line ${l.type}"><span class="d">Day ${l.d}</span>${l.msg}</div>`;

function renderLog() {
  return `<h2 class="section">🏅 Achievements &amp; Log</h2>
  <div class="grid g3 section">${ACH.map(([id, icon, name, desc]) => `<div class="ach ${S.ach[id] ? 'got' : ''}"><span class="big-ico">${icon}</span><div><b>${name}</b><div class="small muted">${desc}${S.ach[id] ? ` · day ${S.ach[id]}` : ''}</div></div></div>`).join('')}</div>
  <div class="card"><h3>Event log</h3><div class="log">${S.log.map(logLine).join('')}</div></div>
  <div class="card section" style="margin-top:14px"><h3>⚙️ Game</h3><div class="row">${btn('💾 Save now', 'saveGame')}${btn('🔄 New game', 'askNewGame', '', { cls: 'danger' })}</div></div>`;
}

registerModule({
  id: 'core',
  tabs: [
    { id: 'dash', name: 'Dashboard', icon: '📊', render: renderDash },
    { id: 'log', name: 'Awards & Log', icon: '🏅', render: renderLog },
  ],
  actions: {
    tab(a) { UI.tab = a; window.scrollTo(0, 0); },
    speed(a) { S.speed = +a; },
    nextDay() { nextDay(); return false; },
    hustle(a) {
      const h = HUSTLES.find((x) => x.id === a);
      if (!useEnergy(h.energy)) return;
      const v = randInt(...h.pay);
      earn(v, 'Hustles');
      toast(`${h.icon} You earned ${money(v)}.`, 'good');
    },
    saveGame() { save(); toast('Game saved.', 'good'); },
    askNewGame() {
      showModal({
        title: 'Start a new game?', body: '<p>This erases your current progress.</p>',
        buttons: [{ label: 'Yes, start over', cls: 'danger', fn: newGame }, { label: 'Cancel' }],
      });
    },
  },
});

/* ---------------------------- Rendering ---------------------------- */
function renderTop() {
  const nw = netWorth(), risk = S.tax.risk;
  $('#topbar').innerHTML = `<div class="brand">Business<span>Tycoon</span></div>
    <div class="stat"><span class="lbl">Day ${S.day}</span><span class="val">${dayName()}</span></div>
    <div class="stat"><span class="lbl">Cash</span><span class="val good">${money(S.cash)}</span></div>
    <div class="stat"><span class="lbl">Net worth</span><span class="val">${money(nw)}</span></div>
    <div class="stat"><span class="lbl">Energy ${S.energy}/${energyMax()}⚡</span><div class="meter"><div style="width:${S.energy / energyMax() * 100}%;background:var(--energy)"></div></div></div>
    <div class="stat"><span class="lbl">Audit risk ${Math.round(risk)}%</span><div class="meter"><div style="width:${risk}%;background:var(--heat)"></div></div></div>
    ${S.job.clockedIn ? `<span class="pill warn" data-act="tab" data-a="job" style="cursor:pointer">💼 At work: ${jobClock()}, time paused</span>` : ''}
    <div class="top-controls">${seg([[0, '⏸'], [1, '▶'], [2, '▶▶'], [3, '▶▶▶'], [4, '⚡']], S.speed, 'speed')}${btn('Next day ⏭', 'nextDay', '', { cls: 'sm' })}</div>`;
}
function renderNav() {
  $('#nav').innerHTML = TABS.map((t) => `<button class="${t.id === UI.tab ? 'active' : ''}" data-act="tab" data-a="${t.id}"><span class="ico">${t.icon}</span>${t.name}</button>`).join('');
}
function render(force = false) {
  if (UI.pointerDown) { UI.pending = true; return; }
  renderTop();
  renderNav();
  const tab = TABS.find((t) => t.id === UI.tab) || TABS[0];
  if (!force && tab.live === false && UI.shown === tab.id) { if (tab.tick) tab.tick(); return; }
  const main = $('#main');
  UI.charts = {};
  main.innerHTML = tab.render();
  UI.shown = tab.id;
  if (tab.after) tab.after();
  drawCharts(main);
}

/* ---------------------------- Input ---------------------------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (modalQ.length && !el.closest('#modal')) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  const r = fn(el.dataset.a, el.dataset.b, el, e);
  if (r !== false) render(true);
  else renderTop();
});
document.addEventListener('pointerdown', () => { UI.pointerDown = true; }, true);
const release = () => {
  UI.pointerDown = false;
  if (UI.pending) { UI.pending = false; setTimeout(() => render(), 60); }
};
document.addEventListener('pointerup', release, true);
document.addEventListener('pointercancel', release, true);
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea') || modalQ.length) return;
  if (e.code === 'Space') { e.preventDefault(); S.speed = S.speed ? 0 : 1; renderTop(); }
  if (e.key === 'n') nextDay();
});
window.addEventListener('resize', () => drawCharts($('#main')));

/* ---------------------------- Boot ---------------------------- */
TABS.sort((a, b) => TAB_ORDER.indexOf(a.id) - TAB_ORDER.indexOf(b.id));
S = load();
if (!S) {
  S = newState();
  for (const m of MODS) if (m.start) m.start();
}
render(true);
if (!S.seenIntro) showIntro();

let acc = 0, last = performance.now();
function loop(now) {
  const dt = Math.min(now - last, 1000);
  last = now;
  const len = SPEEDS[S.speed];
  if (len && !modalQ.length && !UI.gameOver && !S.job.clockedIn) {
    acc += dt;
    if (acc >= len) { acc = 0; nextDay(); }
  }
  $('#daybar-fill').style.width = len ? (acc / len * 100) + '%' : '0%';
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
