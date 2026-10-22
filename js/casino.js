'use strict';
/* =====================================================================
   Casino: Plinko, Slots, Roulette, Blackjack, Crash, Dice, Lottery.
   This tab manages its own DOM so animations survive the daily tick.
   ===================================================================== */
const CZ_GAMES = [['plinko', '🔻 Plinko'], ['slots', '🎰 Slots'], ['roulette', '🎡 Roulette'], ['blackjack', '🃏 Blackjack'], ['crash', '📈 Crash'], ['dice', '🎲 Dice'], ['lottery', '🎟️ Lottery']];
UI.czGame = 'plinko'; UI.czBet = 100; UI.plRisk = 'med'; UI.rlBet = 'red'; UI.rlNum = 17; UI.diceTarget = 50;

function getBet() {
  const el = $('#cz-bet');
  const v = Math.floor(+(el ? el.value : UI.czBet));
  if (!(v > 0)) { toast('Enter a bet amount.', 'warn'); return 0; }
  if (v > S.cash) { toast('Not enough cash for that bet.', 'bad'); return 0; }
  UI.czBet = v;
  return v;
}
function placeBet(v) { spend(v, 'Gambling'); S.casino.wagered += v; S.casino.net -= v; stat('bets'); czRefresh(); }
function czPay(v) { if (v > 0) { earn(v, 'Gambling'); S.casino.net += v; } czRefresh(); }
function czRefresh() {
  renderTop();
  const el = $('#cz-stats');
  if (el) el.innerHTML = czStatsHtml();
}
function czMsg(html, type = '') { const el = $('#cz-msg'); if (el) { el.innerHTML = html; el.className = 'cz-msg ' + type; } }
const czStatsHtml = () => `Wagered <b>${money(S.casino.wagered)}</b> · Net <b class="${cls(S.casino.net)}">${signMoney(S.casino.net)}</b>`;
function bigWin(game, mult, amt) {
  if (mult >= 10) { log(`🎰 Big win at ${game}: ${mult}x for ${money(amt)}!`, 'good'); toast(`🎉 ${game}: ${mult}x! +${money(amt)}`, 'good'); }
  if (mult >= 100) stat('megaWins');
}

/* ---------------------------- Plinko ---------------------------- */
const PL_ROWS = 12, PL_STEP = 130;
const PL_MULT = {
  low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
  med: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
  high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
};
const plBalls = [], plFlash = {};
let plRaf = 0;
function plColor(m) { return m >= 10 ? '#ff5a5f' : m >= 3 ? '#ff7a1a' : m >= 1.5 ? '#f5a623' : m >= 1 ? '#c9b037' : '#4f6fa8'; }
function plGeom(c) {
  const W = c.clientWidth, s = W / (PL_ROWS + 2), top = s * 0.9;
  return { W, s, top, slotY: top + PL_ROWS * s * 0.85 + s * 0.2, H: top + PL_ROWS * s * 0.85 + s * 0.95 };
}
function plPos(G, ball, i) {
  let r = 0;
  for (let k = 0; k < i && k < PL_ROWS; k++) if (ball.path[k]) r++;
  const x = G.W / 2 + (r - Math.min(i, PL_ROWS) / 2) * G.s;
  const y = i >= PL_ROWS ? G.slotY : G.top + i * G.s * 0.85 - G.s * 0.28;
  return [x, y];
}
function plDraw(now = performance.now()) {
  const c = $('#pl-canvas');
  if (!c) return;
  const G = plGeom(c), dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(G.W * dpr)) { c.width = G.W * dpr; c.height = G.H * dpr; c.style.height = G.H + 'px'; }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, G.W, G.H);
  g.fillStyle = '#cfd6e3';
  for (let i = 0; i < PL_ROWS; i++) {
    for (let j = 0; j < i + 3; j++) {
      g.beginPath();
      g.arc(G.W / 2 + (j - 1 - i / 2) * G.s, G.top + i * G.s * 0.85, Math.max(2, G.s * 0.08), 0, Math.PI * 2);
      g.fill();
    }
  }
  const mults = PL_MULT[UI.plRisk];
  g.font = `600 ${Math.max(9, Math.min(13, G.s * 0.32))}px system-ui`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  mults.forEach((m, k) => {
    const x = G.W / 2 + (k - PL_ROWS / 2) * G.s, w = G.s * 0.92, h = G.s * 0.6;
    const fl = plFlash[k] && now - plFlash[k] < 400 ? 1 - (now - plFlash[k]) / 400 : 0;
    g.fillStyle = plColor(m);
    g.globalAlpha = 0.75 + fl * 0.25;
    g.fillRect(x - w / 2, G.slotY + G.s * 0.15 - fl * 5, w, h);
    g.globalAlpha = 1;
    g.fillStyle = '#0e1117';
    g.fillText(m + '×', x, G.slotY + G.s * 0.15 + h / 2 - fl * 5);
  });
  g.fillStyle = '#ff3fa4';
  for (const b of plBalls) {
    const st = Math.min((now - b.t0) / PL_STEP, PL_ROWS);
    const i = Math.floor(st), f = st - i;
    const [x0, y0] = plPos(G, b, i), [x1, y1] = plPos(G, b, Math.min(i + 1, PL_ROWS));
    const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f * f - Math.sin(Math.PI * f) * G.s * 0.25;
    g.beginPath(); g.arc(x, y, Math.max(3, G.s * 0.16), 0, Math.PI * 2); g.fill();
  }
}
function plTick(now) {
  for (const b of plBalls.slice()) {
    if (now - b.t0 >= PL_STEP * PL_ROWS) {
      plBalls.splice(plBalls.indexOf(b), 1);
      const slot = b.path.filter(Boolean).length, m = PL_MULT[b.risk][slot], win = b.bet * m;
      czPay(win);
      plFlash[slot] = now;
      czMsg(`Landed on <b>${m}×</b>: ${win >= b.bet ? '<span class="good">won' : '<span class="bad">got back'} ${money(win)}</span>`);
      bigWin('Plinko', m, win);
    }
  }
  plDraw(now);
  const flashing = Object.values(plFlash).some((t) => now - t < 400);
  plRaf = plBalls.length || flashing ? requestAnimationFrame(plTick) : 0;
}
function plDrop() {
  const bet = getBet();
  if (!bet) return;
  placeBet(bet);
  plBalls.push({ path: Array.from({ length: PL_ROWS }, () => chance(0.5)), bet, risk: UI.plRisk, t0: performance.now() });
  if (!plRaf) plRaf = requestAnimationFrame(plTick);
}

/* ---------------------------- Slots ---------------------------- */
const SLOT_SYMS = [
  { s: '🍒', w: 30, three: 8, two: 0.5 }, { s: '🍋', w: 25, three: 6, two: 0.5 }, { s: '🍊', w: 20, three: 12, two: 1.5 },
  { s: '🔔', w: 12, three: 25, two: 2 }, { s: '⭐', w: 8, three: 60, two: 3 }, { s: '💎', w: 4, three: 200, two: 5 }, { s: '7️⃣', w: 1, three: 2000, two: 10 },
];
let slotSpinning = false;
function slotSpin() {
  if (slotSpinning) return;
  const bet = getBet();
  if (!bet) return;
  placeBet(bet);
  slotSpinning = true;
  const res = [0, 1, 2].map(() => weighted(SLOT_SYMS));
  const reels = [0, 1, 2].map((i) => $('#reel' + i));
  const iv = setInterval(() => reels.forEach((r, i) => { if (r && !r.dataset.stop) r.textContent = pick(SLOT_SYMS).s; }), 70);
  reels.forEach((r) => r && delete r.dataset.stop);
  [0, 1, 2].forEach((i) => setTimeout(() => {
    const r = $('#reel' + i);
    if (r) { r.dataset.stop = '1'; r.textContent = res[i].s; }
    if (i === 2) {
      clearInterval(iv);
      slotSpinning = false;
      const counts = {};
      res.forEach((x) => counts[x.s] = (counts[x.s] || 0) + 1);
      let mult = 0;
      for (const sym of SLOT_SYMS) {
        if (counts[sym.s] === 3) mult = sym.three;
        else if (counts[sym.s] === 2) mult = Math.max(mult, sym.two);
      }
      const win = bet * mult;
      czPay(win);
      czMsg(mult ? `${res.map((x) => x.s).join(' ')}: <b class="good">${mult}× → ${money(win)}</b>` : `${res.map((x) => x.s).join(' ')}: no win`, mult >= 1 ? 'good' : '');
      if (mult >= 2000) stat('jackpots');
      bigWin('Slots', mult, win);
    }
  }, 600 + i * 350));
}

/* ---------------------------- Roulette ---------------------------- */
const RL_RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const RL_BETS = {
  red: ['Red', 2, (n) => RL_RED.includes(n)], black: ['Black', 2, (n) => n > 0 && !RL_RED.includes(n)],
  odd: ['Odd', 2, (n) => n % 2 === 1], even: ['Even', 2, (n) => n > 0 && n % 2 === 0],
  low: ['1–18', 2, (n) => n >= 1 && n <= 18], high: ['19–36', 2, (n) => n >= 19],
  d1: ['1st 12', 3, (n) => n >= 1 && n <= 12], d2: ['2nd 12', 3, (n) => n >= 13 && n <= 24], d3: ['3rd 12', 3, (n) => n >= 25],
  num: ['Single number', 36, (n) => n === UI.rlNum],
};
const rlColor = (n) => (n === 0 ? '#1f9d55' : RL_RED.includes(n) ? '#d63a3a' : '#222');
let rlSpinning = false;
function rlSpin() {
  if (rlSpinning) return;
  const bet = getBet();
  if (!bet) return;
  placeBet(bet);
  rlSpinning = true;
  const result = randInt(0, 36), kind = UI.rlBet, num = UI.rlNum;
  let k = 0;
  const ball = $('#rl-ball');
  const step = () => {
    const n = k < 22 ? randInt(0, 36) : result;
    const b = $('#rl-ball');
    if (b) { b.textContent = n; b.style.background = rlColor(n); }
    if (k++ < 22) setTimeout(step, 40 + k * k * 0.6);
    else {
      rlSpinning = false;
      const [name, mult, test] = RL_BETS[kind];
      const won = kind === 'num' ? result === num : test(result);
      const win = won ? bet * mult : 0;
      czPay(win);
      czMsg(`The ball lands on <b style="color:${result === 0 ? '#2ecc71' : RL_RED.includes(result) ? '#ff5a5f' : '#e6e9ef'}">${result}</b>. ${won ? `<b class="good">${name} wins ${money(win)}!</b>` : `${name} loses.`}`, won ? 'good' : '');
      bigWin('Roulette', won ? mult : 0, win);
    }
  };
  if (ball) step();
}

/* ---------------------------- Blackjack ---------------------------- */
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const card = () => ({ r: pick(RANKS), s: pick(SUITS) });
function handVal(h) {
  let t = 0, aces = 0;
  for (const c of h) { if (c.r === 'A') { aces++; t += 11; } else t += ['J', 'Q', 'K'].includes(c.r) ? 10 : +c.r; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return t;
}
const cardHtml = (c, hidden) => hidden ? '<span class="pcard back">🂠</span>' : `<span class="pcard ${'♥♦'.includes(c.s) ? 'red' : ''}">${c.r}${c.s}</span>`;
function bjDraw() {
  const el = $('#bj-area'), bj = UI.bj;
  if (!el) return;
  if (!bj) { el.innerHTML = `<p class="muted">Place a bet and deal to start. Blackjack pays 3:2, dealer stands on 17.</p>${btn('🃏 Deal', 'bjDeal', '', { cls: 'primary' })}`; return; }
  const hide = !bj.done;
  el.innerHTML = `<div class="small muted">Dealer ${hide ? '' : '(' + handVal(bj.dealer) + ')'}</div><div class="hand">${bj.dealer.map((c, i) => cardHtml(c, hide && i === 1)).join('')}</div>
    <div class="small muted" style="margin-top:10px">You (${handVal(bj.player)}) · bet ${money(bj.bet)}</div><div class="hand">${bj.player.map((c) => cardHtml(c)).join('')}</div>
    <div class="row" style="margin-top:12px">${bj.done ? btn('Deal again', 'bjDeal', '', { cls: 'primary' }) :
      btn('Hit', 'bjHit', '', { cls: 'primary' }) + btn('Stand', 'bjStand') + (bj.player.length === 2 ? btn('Double', 'bjDouble', '', { disabled: S.cash < bj.bet }) : '')}</div>`;
}
function bjFinish(msg) {
  const bj = UI.bj;
  bj.done = true;
  const p = handVal(bj.player);
  if (!msg) {
    while (handVal(bj.dealer) < 17) bj.dealer.push(card());
    const d = handVal(bj.dealer);
    if (d > 21 || p > d) { czPay(bj.bet * 2); msg = `<b class="good">You win ${money(bj.bet * 2)}!</b>${d > 21 ? ' Dealer busts.' : ''}`; }
    else if (p === d) { czPay(bj.bet); msg = 'Push. Bet returned.'; }
    else msg = `<b class="bad">Dealer wins with ${d}.</b>`;
  }
  czMsg(msg);
  bjDraw();
}
const BJ = {
  bjDeal() {
    const bet = getBet();
    if (!bet) return false;
    placeBet(bet);
    UI.bj = { bet, player: [card(), card()], dealer: [card(), card()], done: false };
    czMsg('');
    const p = handVal(UI.bj.player), d = handVal(UI.bj.dealer);
    if (p === 21 || d === 21) {
      if (p === 21 && d !== 21) { czPay(bet * 2.5); stat('blackjacks'); bjFinish(`<b class="good">BLACKJACK! You win ${money(bet * 2.5)}</b>`); }
      else if (p === 21) { czPay(bet); bjFinish('Both have blackjack. Push.'); }
      else bjFinish('<b class="bad">Dealer has blackjack.</b>');
    } else bjDraw();
    return false;
  },
  bjHit() {
    const bj = UI.bj;
    if (!bj || bj.done) return false;
    bj.player.push(card());
    if (handVal(bj.player) > 21) bjFinish(`<b class="bad">Bust with ${handVal(bj.player)}!</b>`);
    else if (handVal(bj.player) === 21) bjFinish();
    else bjDraw();
    return false;
  },
  bjStand() { if (UI.bj && !UI.bj.done) bjFinish(); return false; },
  bjDouble() {
    const bj = UI.bj;
    if (!bj || bj.done || S.cash < bj.bet) return false;
    placeBet(bj.bet);
    bj.bet *= 2;
    bj.player.push(card());
    if (handVal(bj.player) > 21) bjFinish(`<b class="bad">Bust with ${handVal(bj.player)}!</b>`);
    else bjFinish();
    return false;
  },
};

/* ---------------------------- Crash ---------------------------- */
const CR_SPEED = 0.13;
let cr = { state: 'idle' };
const crMult = (t) => Math.exp(CR_SPEED * t);
function crStart() {
  if (cr.state === 'running') return;
  const bet = getBet();
  if (!bet) return;
  placeBet(bet);
  const auto = +($('#cr-auto') || {}).value || 0;
  cr = { state: 'running', bet, auto: auto >= 1.01 ? auto : 0, crash: Math.max(1, Math.floor(0.99 / (1 - Math.random()) * 100) / 100), t0: performance.now(), pts: [] };
  czMsg('');
  crButtons();
  requestAnimationFrame(crTick);
}
function crCash(m) {
  if (cr.state !== 'running') return;
  m = m || crMult((performance.now() - cr.t0) / 1000);
  if (m >= cr.crash) return;
  cr.state = 'cashed';
  const win = cr.bet * m;
  czPay(win);
  czMsg(`Cashed out at <b class="good">${m.toFixed(2)}×</b> for ${money(win)}!`, 'good');
  bigWin('Crash', Math.floor(m), win);
  crButtons();
}
function crTick(now) {
  if (cr.state === 'idle') return;
  const t = (now - cr.t0) / 1000;
  let m = crMult(t);
  const ended = m >= cr.crash;
  if (ended) m = cr.crash;
  if (cr.state === 'running' && cr.auto && m >= cr.auto && cr.auto < cr.crash) crCash(cr.auto);
  cr.pts.push(m);
  const el = $('#cr-mult');
  if (el) { el.textContent = m.toFixed(2) + '×'; el.className = 'cr-mult ' + (ended ? 'bad' : cr.state === 'cashed' ? 'good' : ''); }
  const c = $('#cr-canvas');
  if (c) drawLine(c, cr.pts.length > 1 ? cr.pts : [1, 1], { color: ended ? '#ff5a5f' : '#2ecc71' });
  if (ended) {
    if (cr.state === 'running') czMsg(`💥 Crashed at <b class="bad">${cr.crash.toFixed(2)}×</b>. You lost ${money(cr.bet)}.`);
    else czMsg(($('#cz-msg') || {}).innerHTML + ` <span class="muted">(It crashed at ${cr.crash.toFixed(2)}×)</span>`);
    cr.state = 'idle';
    crButtons();
    return;
  }
  requestAnimationFrame(crTick);
}
function crButtons() {
  const el = $('#cr-btns');
  if (el) el.innerHTML = cr.state === 'running' ? btn('💰 Cash out', 'crCash', '', { cls: 'primary' }) : btn('🚀 Start round', 'crStart', '', { cls: 'primary', disabled: cr.state === 'cashed' });
}

/* ---------------------------- Dice ---------------------------- */
const diceMult = (t) => 0.98 * 100 / t;
function diceRoll() {
  const bet = getBet();
  if (!bet) return;
  placeBet(bet);
  const t = UI.diceTarget, roll = Math.floor(Math.random() * 10000) / 100;
  const won = roll < t, win = won ? bet * diceMult(t) : 0;
  czPay(win);
  const el = $('#dice-roll');
  if (el) { el.textContent = roll.toFixed(2); el.className = 'dice-roll ' + (won ? 'good' : 'bad'); }
  czMsg(won ? `Rolled ${roll.toFixed(2)} &lt; ${t}: <b class="good">won ${money(win)}</b>` : `Rolled ${roll.toFixed(2)}: <span class="bad">lost</span>`);
  bigWin('Dice', won ? Math.floor(diceMult(t)) : 0, win);
}
document.addEventListener('input', (e) => {
  if (e.target.id !== 'dice-target') return;
  UI.diceTarget = +e.target.value;
  const el = $('#dice-info');
  if (el) el.innerHTML = diceInfo();
});
const diceInfo = () => `Win if roll &lt; <b>${UI.diceTarget}</b> · chance ${UI.diceTarget}% · pays <b>${diceMult(UI.diceTarget).toFixed(2)}×</b>`;

/* ---------------------------- Lottery ---------------------------- */
const TICKET = 20;
function lotteryDraw() {
  const L = S.casino.lottery, n = L.tickets;
  if (!n) { L.jackpot += 50000; return; }
  let won = 0, jackpot = false;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (r < 1 / 300000) jackpot = true;
    else if (r < 1 / 3000) won += 5000;
    else if (r < 1 / 80) won += 100;
    else if (r < 1 / 10) won += 20;
  }
  if (jackpot) { won += L.jackpot; stat('lotteryJackpots'); }
  if (won) { earn(won, 'Gambling'); S.casino.net += won; }
  log(jackpot ? `🎟️🎉 YOU WON THE LOTTERY JACKPOT! ${money(L.jackpot)}!` : `🎟️ Lottery draw: your ${fmtInt(n)} ticket(s) won ${money(won)}.`, jackpot ? 'good' : won ? '' : 'muted');
  if (jackpot) showModal({ title: '🎉 LOTTERY JACKPOT!', cls: 'good', body: `<p>You hit the jackpot of <b>${money(L.jackpot)}</b>!</p>` });
  L.jackpot = jackpot ? 1000000 : L.jackpot + 50000;
  L.tickets = 0;
}

registerModule({
  id: 'casino',
  init(s) { s.casino = { wagered: 0, net: 0, lottery: { tickets: 0, jackpot: 1000000 } }; },
  daily() { if (dayName() === 'Sun') lotteryDraw(); },
  tabs: [{ id: 'casino', name: 'Casino', icon: '🎰', render: renderCasino, after: casinoAfter, live: false }],
  actions: {
    czGame(a) { UI.czGame = a; },
    czChip(a) {
      const el = $('#cz-bet');
      let v = Math.floor(+el.value) || 0;
      v = a === 'half' ? Math.max(1, Math.floor(v / 2)) : a === 'x2' ? v * 2 : a === 'max' ? Math.floor(S.cash) : +a;
      el.value = UI.czBet = v;
      return false;
    },
    plRisk(a) { UI.plRisk = a; document.querySelectorAll('[data-act="plRisk"]').forEach((b) => b.classList.toggle('on', b.dataset.a === a)); plDraw(); return false; },
    plDrop() { plDrop(); return false; },
    slotSpin() { slotSpin(); return false; },
    rlBet(a) { UI.rlBet = a; document.querySelectorAll('[data-act="rlBet"]').forEach((b) => b.classList.toggle('on', b.dataset.a === a)); return false; },
    rlNum(a) {
      UI.rlNum = +a; UI.rlBet = 'num';
      document.querySelectorAll('[data-act="rlNum"]').forEach((b) => b.classList.toggle('on', b.dataset.a === a));
      document.querySelectorAll('[data-act="rlBet"]').forEach((b) => b.classList.toggle('on', b.dataset.a === 'num'));
      return false;
    },
    rlSpin() { rlSpin(); return false; },
    ...BJ,
    crStart() { crStart(); return false; },
    crCash() { crCash(); return false; },
    diceRoll() { diceRoll(); return false; },
    lottoBuy(a) {
      const n = +a, cost = n * TICKET, L = S.casino.lottery;
      if (L.tickets + n > 10000) { toast('Max 10,000 tickets per draw.', 'warn'); return false; }
      if (!pay(cost, 'Gambling', 'tickets')) return false;
      L.tickets += n; S.casino.wagered += cost; S.casino.net -= cost;
      L.jackpot += cost * 0.5;
      czRefresh();
      const el = $('#lotto-info');
      if (el) el.innerHTML = lottoInfo();
      return false;
    },
  },
});

const lottoInfo = () => `<div class="kpi"><div class="lbl">Jackpot</div><div class="val good">${money(S.casino.lottery.jackpot)}</div></div>
  <p>Your tickets for this week's draw: <b>${fmtInt(S.casino.lottery.tickets)}</b></p>`;

function renderCasino() {
  const tabs = seg(CZ_GAMES, UI.czGame, 'czGame');
  const betBox = UI.czGame === 'lottery' ? '' : `<div class="row section"><span class="small muted">Bet</span>
    <input id="cz-bet" class="input" type="number" min="1" step="1" value="${UI.czBet}">
    ${[10, 100, 1000, 10000, 100000].map((v) => btn(money(v), 'czChip', v, { cls: 'sm' })).join('')}
    ${btn('½', 'czChip', 'half', { cls: 'sm' })}${btn('2×', 'czChip', 'x2', { cls: 'sm' })}${btn('Max', 'czChip', 'max', { cls: 'sm' })}</div>`;
  let game = '';
  switch (UI.czGame) {
    case 'plinko':
      game = `<div class="row between section"><div class="row"><span class="small muted">Risk</span>${seg([['low', 'Low'], ['med', 'Medium'], ['high', 'High']], UI.plRisk, 'plRisk')}</div>
        ${btn('🔻 Drop ball', 'plDrop', '', { cls: 'primary' })}</div><canvas id="pl-canvas" class="plinko"></canvas>`;
      break;
    case 'slots':
      game = `<div class="slots">${[0, 1, 2].map((i) => `<div class="reel" id="reel${i}">${SLOT_SYMS[i].s}</div>`).join('')}</div>
        <div class="row" style="justify-content:center;margin:12px 0">${btn('🎰 SPIN', 'slotSpin', '', { cls: 'primary' })}</div>
        <div class="paytable small">${SLOT_SYMS.map((x) => `<span>${x.s.repeat(3)} <b>${x.three}×</b></span><span>${x.s.repeat(2)} <b>${x.two}×</b></span>`).join('')}</div>`;
      break;
    case 'roulette':
      game = `<div class="row section" style="justify-content:center"><div id="rl-ball" class="rl-ball" style="background:#1f9d55">0</div></div>
        <div class="row section">${Object.entries(RL_BETS).filter(([k]) => k !== 'num').map(([k, [n, m]]) => btn(`${n} <span class="muted">${m}×</span>`, 'rlBet', k, { cls: 'sm ' + (UI.rlBet === k ? 'on' : '') })).join('')}
          ${btn(`Single number <span class="muted">36×</span>`, 'rlBet', 'num', { cls: 'sm ' + (UI.rlBet === 'num' ? 'on' : '') })}</div>
        <div class="rl-grid section">${Array.from({ length: 37 }, (_, n) => `<button class="btn sm rl-n ${UI.rlNum === n ? 'on' : ''}" data-act="rlNum" data-a="${n}" style="border-color:${rlColor(n)}">${n}</button>`).join('')}</div>
        ${btn('🎡 Spin the wheel', 'rlSpin', '', { cls: 'primary' })}`;
      break;
    case 'blackjack':
      game = '<div id="bj-area" class="bj"></div>';
      break;
    case 'crash':
      game = `<div class="cr-wrap"><div id="cr-mult" class="cr-mult">1.00×</div><canvas id="cr-canvas" class="chart" style="height:180px"></canvas></div>
        <div class="row" style="margin-top:10px"><span class="small muted">Auto cash-out at</span><input id="cr-auto" class="input" type="number" min="1.01" step="0.1" placeholder="off" style="width:90px">×
        <span id="cr-btns"></span></div>
        <p class="small muted" style="margin-top:8px">The multiplier climbs until it crashes at a random point. Cash out before it does!</p>`;
      break;
    case 'dice':
      game = `<div class="row section" style="justify-content:center"><div id="dice-roll" class="dice-roll">--.--</div></div>
        <input id="dice-target" type="range" min="2" max="95" value="${UI.diceTarget}" style="width:100%">
        <p id="dice-info" class="small">${diceInfo()}</p>${btn('🎲 Roll', 'diceRoll', '', { cls: 'primary' })}`;
      break;
    case 'lottery':
      game = `<div id="lotto-info">${lottoInfo()}</div>
        <p class="small muted">Tickets cost ${money(TICKET)}. The draw is every Sunday night. Prizes: jackpot (1 in 300,000), $5,000 (1 in 3,000), $100 (1 in 80), $20 (1 in 10).</p>
        <div class="row">${[1, 10, 100, 1000].map((n) => btn(`Buy ${n} (${money(n * TICKET)})`, 'lottoBuy', n, { cls: 'sm buy' })).join('')}</div>`;
      break;
  }
  return `<div class="row between section"><h2>🎰 Casino</h2><span id="cz-stats" class="small">${czStatsHtml()}</span></div>
  <div class="section" style="overflow-x:auto">${tabs}</div>
  <div class="card casino">${betBox}${game}<div id="cz-msg" class="cz-msg"></div></div>
  <p class="small muted" style="margin-top:10px">The house always has an edge. Gamble for fun, not as a business plan.</p>`;
}
function casinoAfter() {
  if (UI.czGame === 'plinko') plDraw();
  if (UI.czGame === 'blackjack') bjDraw();
  if (UI.czGame === 'crash') crButtons();
}
