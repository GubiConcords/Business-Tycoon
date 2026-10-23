'use strict';
/* =====================================================================
   Street & track racing: buy and tune cars, enter races, bet on yourself
   ===================================================================== */
const RACE_CARS = [
  { id: 'hatch', name: 'Used Hot Hatch', icon: '🚗', price: 6000, perf: 30 },
  { id: 'coupe', name: 'Tuned Coupe', icon: '🚘', price: 25000, perf: 44 },
  { id: 'muscle', name: 'Muscle Car', icon: '🏎️', price: 60000, perf: 56 },
  { id: 'sports', name: 'Sports Car', icon: '🏎️', price: 150000, perf: 68 },
  { id: 'super', name: 'Supercar', icon: '🏎️', price: 450000, perf: 80 },
  { id: 'hyper', name: 'Hypercar', icon: '🚀', price: 1500000, perf: 92 },
];
const RCAR = Object.fromEntries(RACE_CARS.map((c) => [c.id, c]));
const RACE_TYPES = [
  { id: 'track', name: 'Track Day', icon: '🏁', entry: 300, field: [22, 40], pool: 1.6, w: 3 },
  { id: 'club', name: 'Club Championship', icon: '🏆', entry: 2000, field: [36, 54], pool: 1.6, w: 3 },
  { id: 'pro', name: 'Pro Circuit Cup', icon: '🥇', entry: 15000, field: [50, 70], pool: 1.6, w: 2 },
  { id: 'gp', name: 'Grand Prix', icon: '🏟️', entry: 100000, field: [66, 90], pool: 1.6, w: 1 },
  { id: 'under', name: 'Underground Night Race', icon: '🌃', entry: 5000, field: [35, 75], pool: 2.4, w: 2, illegal: true },
];
const RTYPE = Object.fromEntries(RACE_TYPES.map((r) => [r.id, r]));
const PAYOUT = [0.5, 0.25, 0.12];
const DRIVE_ENERGY = 30;
const RIVALS = ['"Turbo" Tony', 'Mika Sprint', 'Lana Redline', 'Duke Nitro', 'Vex Kowalski', 'Rosa Apex', 'Jin Drift', 'Big Earl', 'Nadia Flash', 'Coop Gearhead', 'Ivy Throttle', 'Max Burnout'];
const PRO_SKILL = 75;

const carPerf = (c) => RCAR[c.model].perf + c.tune * 3;
const tuneCost = (c) => Math.round(RCAR[c.model].price * 0.15 * (c.tune + 1));
const carRepairCost = (c) => Math.round(RCAR[c.model].price * 0.004 * (100 - c.cond));
const raceCarUpkeep = (c) => 25 + RCAR[c.model].price * 0.0006;  // garage space, insurance, registration
const carValue = (c) => (RCAR[c.model].price + c.tune * RCAR[c.model].price * 0.1) * 0.7 * (0.5 + c.cond / 200);
const raceCar = () => S.race.cars.find((c) => c.id === UI.raceCar) || S.race.cars.find((c) => !c.impound);
const proFee = (ev) => Math.round(1000 + RTYPE[ev.type].entry * 0.4);
const driverSkill = () => (UI.racePro ? PRO_SKILL : S.race.skill);
const score = (perf, skill, cond = 100) => perf * 0.65 + skill * 0.35 - (100 - cond) * 0.1 + gauss() * 6;

function genRaces() {
  S.race.events = Array.from({ length: 4 }, () => {
    const t = weighted(RACE_TYPES);
    return {
      id: uid(), type: t.id,
      rivals: Array.from({ length: 5 }, () => ({ name: pick(RIVALS), perf: randInt(...t.field), skill: randInt(25, 85) })),
    };
  });
}
function winChance(ev, car) {
  let wins = 0;
  for (let i = 0; i < 400; i++) {
    const me = score(carPerf(car), driverSkill(), car.cond);
    if (ev.rivals.every((r) => score(r.perf, r.skill) < me)) wins++;
  }
  return clamp(wins / 400, 0.01, 0.99);
}
const betOdds = (p) => clamp(0.92 / p, 1.1, 25);

function runRace(evId) {
  const R = S.race, ev = R.events.find((e) => e.id === +evId), car = raceCar();
  if (!ev) return;
  if (!car) return toast('You need a race car first.', 'warn');
  if (car.impound) return toast('That car is impounded.', 'bad');
  if (car.cond < 20) return toast('Your car is too damaged to race. Repair it first.', 'warn');
  const t = RTYPE[ev.type];
  const fee = UI.racePro ? proFee(ev) : 0;
  const bet = Math.min(UI.raceBet, S.cash);
  const p = winChance(ev, car), odds = betOdds(p);
  if (!canAfford(t.entry + fee + bet)) return toast(`You need ${money(t.entry + fee + bet)} for entry, driver and bet.`, 'bad');
  if (!UI.racePro && !useEnergy(DRIVE_ENERGY)) return;
  spend(t.entry, 'Racing');
  if (fee) spend(fee, 'Racing');
  if (bet) spend(bet, 'Gambling');
  R.events.splice(R.events.indexOf(ev), 1);
  stat('races');

  if (t.illegal && chance(0.12)) {
    const fine = Math.round((10000 + t.entry * 2) * legalFineMult());
    spend(fine, 'Fines');
    car.impound = 5;
    addRisk(5);
    if (bet) earn(bet, 'Gambling'); // bets are refunded when the race never happens
    log(`🚓 Police raided the underground race! Fined ${money(fine)}, and your ${RCAR[car.model].name} was impounded for 5 days.`, 'bad');
    showModal({ title: '🚓 Police raid!', cls: 'danger', body: `<p>Sirens everywhere. The underground race was shut down before the start.</p><p>Fine: <b>${money(fine)}</b>. Your car is impounded for <b>5 days</b>. Your bet was refunded.</p>` });
    return;
  }

  const crashP = 0.03 + (100 - car.cond) / 400 + (t.illegal ? 0.04 : 0) - (UI.racePro ? 0.015 : 0);
  const crashed = chance(crashP);
  const field = ev.rivals.map((r) => ({ name: r.name, s: score(r.perf, r.skill) }));
  const me = { name: UI.racePro ? 'Your pro driver' : 'You', s: crashed ? -999 : score(carPerf(car), driverSkill(), car.cond), me: true };
  field.push(me);
  field.sort((a, b) => b.s - a.s);
  const pos = field.indexOf(me);
  const pool = t.entry * 6 * t.pool;
  let prize = 0;
  if (!crashed && pos < 3) prize = pool * PAYOUT[pos];
  if (prize) earn(prize, 'Racing');
  let betWin = 0;
  if (bet && pos === 0 && !crashed) { betWin = bet * odds; earn(betWin, 'Gambling'); }
  car.cond = clamp(car.cond - (crashed ? randInt(40, 60) : randInt(6, 14)), 0, 100);
  if (!UI.racePro) R.skill = clamp(R.skill + 1.5 * (1 - R.skill / 100) * (crashed ? 0.3 : 1), 0, 99);
  if (pos === 0 && !crashed) stat('raceWins');

  const msg = crashed ? `💥 Crashed out of the ${t.name}!` : `${['🥇', '🥈', '🥉'][pos] || '🏁'} Finished P${pos + 1} in the ${t.name}${prize ? ` and won ${money(prize)}` : ''}${betWin ? ` + ${money(betWin)} from your bet` : ''}.`;
  log(msg, pos === 0 && !crashed ? 'good' : crashed ? 'bad' : '');
  showModal({
    title: crashed ? '💥 CRASH!' : pos === 0 ? '🏆 VICTORY!' : `🏁 Finished P${pos + 1}`, cls: crashed ? 'danger' : pos === 0 ? 'good' : '',
    body: `<ol>${field.map((f, i) => `<li ${f.me ? 'class="good"' : ''}>${f.me ? '<b>' : ''}${esc(f.name)}${f.me ? '</b>' : ''}${f.s === -999 ? ' (DNF)' : ''}${i < 3 && f.s !== -999 ? ` · ${money(pool * PAYOUT[i])}` : ''}</li>`).join('')}</ol>
      ${prize ? `<p>Prize money: <b class="good">${money(prize)}</b></p>` : ''}${bet ? `<p>Your ${money(bet)} bet: ${betWin ? `<b class="good">won ${money(betWin)}</b>` : '<b class="bad">lost</b>'}</p>` : ''}
      <p class="small muted">Car condition now ${Math.round(car.cond)}%.</p>`,
  });
}

registerModule({
  id: 'racing',
  init(s) { s.race = { cars: [], skill: 10, events: [] }; },
  start() { genRaces(); },
  assets(a) { a.racing = S.race.cars.reduce((t, c) => t + carValue(c), 0); },
  daily() {
    for (const c of S.race.cars) {
      spend(raceCarUpkeep(c), 'Racing');
      if (c.impound > 0 && !--c.impound) log(`🚗 Your ${RCAR[c.model].name} was released from the impound lot.`);
    }
    genRaces();
  },
  tabs: [{ id: 'racing', name: 'Racing', icon: '🏎️', render: renderRacing }],
  actions: {
    buyRaceCar(a) {
      const m = RCAR[a];
      if (!pay(m.price, 'Investments', m.name)) return;
      const c = { id: uid(), model: a, tune: 0, cond: 100, impound: 0 };
      S.race.cars.push(c);
      UI.raceCar = c.id;
      toast(`You bought a ${m.name}!`, 'good');
    },
    selRaceCar(a) { UI.raceCar = +a; },
    tuneCar(a) {
      const c = S.race.cars.find((x) => x.id === +a);
      if (c.tune >= 5 || !pay(tuneCost(c), 'Racing', 'tuning')) return;
      c.tune++;
      toast(`Tuned! Performance is now ${carPerf(c)}.`, 'good');
    },
    repairRaceCar(a) {
      const c = S.race.cars.find((x) => x.id === +a);
      if (!pay(carRepairCost(c), 'Racing', 'repairs')) return;
      c.cond = 100;
    },
    sellRaceCar(a) {
      const c = S.race.cars.find((x) => x.id === +a);
      if (c.impound) return toast("You can't sell an impounded car.", 'warn');
      const v = carValue(c);
      earn(v, 'Investments');
      S.race.cars.splice(S.race.cars.indexOf(c), 1);
      toast(`Sold for ${money(v)}`, 'good');
    },
    raceBet(a) { UI.raceBet = +a; },
    racePro(a) { UI.racePro = a === '1'; },
    race: runRace,
  },
});
UI.raceBet = 0; UI.racePro = false; UI.raceCar = 0;

function renderRacing() {
  const R = S.race, car = raceCar();
  const garage = R.cars.map((c) => {
    const m = RCAR[c.model];
    return `<div class="list-item ${car === c ? 'sel' : ''}"><span class="big-ico">${m.icon}</span><div class="grow"><b>${m.name}</b> ${car === c ? '<span class="pill good">Selected</span>' : ''} ${c.impound ? `<span class="pill bad">Impounded ${c.impound}d</span>` : ''}
      <div class="small muted">Performance <b>${carPerf(c)}</b> · tune ${c.tune}/5 · garage, insurance &amp; registration ${money(raceCarUpkeep(c))}/day</div>${barline('Condition', c.cond, c.cond < 40 ? 'var(--bad)' : 'var(--good)')}</div>
      <div class="row">${car !== c ? btn('Select', 'selRaceCar', c.id, { cls: 'sm' }) : ''}
      ${c.tune < 5 ? btn(`Tune +3 (${money(tuneCost(c))})`, 'tuneCar', c.id, { cls: 'sm', disabled: !canAfford(tuneCost(c)) }) : ''}
      ${c.cond < 100 ? btn(`Repair (${money(carRepairCost(c))})`, 'repairRaceCar', c.id, { cls: 'sm', disabled: !canAfford(carRepairCost(c)) }) : ''}
      ${btn(`Sell ${money(carValue(c))}`, 'sellRaceCar', c.id, { cls: 'sm' })}</div></div>`;
  }).join('');
  const shop = RACE_CARS.map((m) => `<div class="card tight"><div class="row"><span class="big-ico">${m.icon}</span><div class="grow"><b>${m.name}</b><div class="small muted">Performance ${m.perf}</div></div></div>
    <div style="margin-top:8px">${btn(`Buy ${money(m.price)}`, 'buyRaceCar', m.id, { cls: 'sm buy', disabled: !canAfford(m.price) })}</div></div>`).join('');
  const events = R.events.map((ev) => {
    const t = RTYPE[ev.type], pool = t.entry * 6 * t.pool;
    const avg = Math.round(ev.rivals.reduce((s, r) => s + r.perf, 0) / ev.rivals.length);
    const p = car && !car.impound ? winChance(ev, car) : 0;
    return `<div class="card tight ${t.illegal ? 'danger' : ''}"><div class="row between"><b>${t.icon} ${t.name}</b>${t.illegal ? '<span class="pill bad">Illegal · police risk</span>' : ''}</div>
      <div class="small muted">Entry ${money(t.entry)} · prize pool ${money(pool)} · rivals avg perf ${avg}</div>
      ${car && !car.impound ? `<div class="small">Win chance ~<b>${pct(p, 0)}</b> · bet pays <b>${betOdds(p).toFixed(2)}x</b></div>` : ''}
      <div style="margin-top:8px">${btn('Race!', 'race', ev.id, { cls: 'sm primary', disabled: !car || car.impound || (!UI.racePro && S.energy < DRIVE_ENERGY) })}
      ${UI.racePro ? `<span class="small muted">Pro driver fee ${money(proFee(ev))}</span>` : ''}</div></div>`;
  }).join('');
  return `<h2 class="section">🏎️ Racing</h2>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Your driving skill</div><div class="val">${R.skill.toFixed(1)}</div><div class="small muted">Improves every race you drive</div></div>
    <div class="card kpi"><div class="lbl">Wins</div><div class="val">${S.stats.raceWins || 0}</div><div class="small muted">${S.stats.races || 0} races</div></div>
    <div class="card"><div class="small muted">Driver</div>${seg([['0', `You (${DRIVE_ENERGY}⚡)`], ['1', `Pro (skill ${PRO_SKILL})`]], UI.racePro ? '1' : '0', 'racePro')}</div>
    <div class="card"><div class="small muted">Bet on yourself to win</div>${seg([[0, 'None'], [1000, '$1K'], [10000, '$10K'], [100000, '$100K'], [1000000, '$1M']], UI.raceBet, 'raceBet')}</div>
  </div>
  <h4>Today's races</h4><div class="grid g2 section">${car ? events : '<div class="banner info">Buy a race car below to start racing.</div>'}</div>
  <div class="card section"><h3>Your garage</h3>${garage || '<p class="muted">No cars yet.</p>'}</div>
  <h4>Car dealer</h4><div class="grid g3">${shop}</div>`;
}
