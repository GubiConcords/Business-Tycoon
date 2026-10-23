'use strict';
/* =====================================================================
   Corporate: found a holding company, take it public (IPO), manage your
   share price, dividends, buybacks and shareholder meetings, launch
   takeovers of listed companies, and found your own bank.
   ===================================================================== */
const SHARES = { APXL: 20e6, NVLT: 10e6, CLDN: 15e6, PMRT: 25e6, KCKZ: 30e6, BKHS: 30e6, MDCR: 15e6, GNMX: 20e6, PTRX: 30e6, GRBX: 20e6, VLTR: 10e6, SKWD: 12e6, FDDX: 25e6, GLDM: 25e6 };
const HOLDING_COST = 1000000, IPO_MIN_NW = 50000000, IPO_FEE = 0.05, CORP_SHARES = 100e6;
const BANK = { license: 50000000, legal: 35, nw: 200000000, depRate: 0.02 / 365 };
const LENDING = {
  conservative: { name: 'Conservative', ratio: 0.6, yield: 0.06, loss: 0.01 },
  balanced: { name: 'Balanced', ratio: 0.8, yield: 0.085, loss: 0.025 },
  aggressive: { name: 'Aggressive', ratio: 0.95, yield: 0.12, loss: 0.06 },
};

const CO = () => S.corp;
// cash flows that are not operating profit (buying assets, trading, prizes…)
const NON_OPERATING = ['Investments', 'Quests', 'Inheritance tax', 'Startups', 'Stocks', 'Crypto', 'Gambling', 'Dividends paid'];
const mcap = (sym) => S.stocks[sym].price * SHARES[sym];
const stake = (sym) => S.stocks[sym].qty / SHARES[sym];
const sharePrice = () => CO().mcap / CORP_SHARES;
const avgProfit = () => { const h = CO().profitHist; return h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0; };
function fundamental(gross) {
  const esgF = 0.85 + 0.3 * (S.co2 ? S.co2.esg : 50) / 100;
  return Math.max(1e6, (gross + Math.max(0, avgProfit()) * 365 * 6) * esgF);
}
const takeoverCost = (sym) => Math.max(0, (0.51 * SHARES[sym] - S.stocks[sym].qty)) * S.stocks[sym].price * 1.3;

registerModule({
  id: 'corp',
  init(s) {
    s.corp = {
      founded: false, name: '', ticker: '', public: false, float: 0, mcap: 0, sentiment: 1, hist: [], profitHist: [], payout: 0, nextMeeting: 0, approval: 60,
      controlled: {}, bank: { open: false, capital: 0, deposits: 0, loans: 0, policy: 'balanced', lastProfit: 0, run: false },
    };
  },
  assets(a) {
    const c = CO(), b = c.bank;
    if (b.open) a.bank = b.capital;
    // public shareholders own part of the company: their share is not yours
    if (c.public) {
      const gross = Object.entries(a).reduce((t, [k, v]) => t + (k === 'publicEquity' ? 0 : v), 0);
      a.publicEquity = -c.float * Math.max(0, gross);
    }
  },
  late() {
    const c = CO();
    // subsidiaries pay their share of earnings
    for (const sym of Object.keys(c.controlled)) {
      if (stake(sym) < 0.5) { delete c.controlled[sym]; log(`🏢 You lost control of ${STOCKS.find((s) => s.sym === sym).name}.`, 'warn'); continue; }
      earn(mcap(sym) * 0.0001, 'Subsidiaries');
    }
    // your bank
    const b = c.bank;
    if (b.open) {
      const L = LENDING[b.policy];
      const target = 2e7 * (1 + S.deals.rep / 25) * (b.run ? 0.5 : 1);
      b.deposits += (target - b.deposits) * 0.03;
      b.loans += (Math.min(b.deposits * L.ratio, (b.capital + b.deposits) * 0.95) - b.loans) * 0.05;
      const interest = b.loans * L.yield / 365, cost = b.deposits * BANK.depRate * (1 - 0.3 * execSkill('finance')) + 20000;
      const losses = b.loans * L.loss / 365 * worldMult('bankDefault') * (chance(0.02) ? 8 : 1);
      b.lastProfit = interest - cost - losses;
      b.capital += b.lastProfit;
      const ratio = b.capital / Math.max(1, b.loans);
      if (b.run) { if (chance(0.1)) { b.run = false; log('🏦 The run on your bank is over.', 'good'); } }
      else if (ratio < 0.08 && chance(0.05)) {
        b.run = true;
        const out = b.deposits * 0.3, fire = out * 0.1;
        b.deposits -= out; b.loans = Math.max(0, b.loans - out); b.capital -= fire;
        log(`🏃 BANK RUN! Depositors pulled ${money(out)} out of your bank. Fire-sale losses: ${money(fire)}.`, 'bad');
        showModal({ title: '🏃 Bank run!', cls: 'danger', body: `<p>Panicked depositors withdrew ${money(out)}. You had to sell loans at a loss of <b>${money(fire)}</b>. Add capital or lend more conservatively.</p>` });
      }
      if (b.capital <= 0) {
        b.open = false;
        timeline('💥', 'Your bank failed');
        log('💥 Your bank FAILED and regulators seized it. The capital is lost.', 'bad');
        showModal({ title: '💥 Bank failure', cls: 'danger', body: '<p>Losses wiped out your bank\'s capital. Regulators took it over and your license is gone.</p>' });
      }
    }
    // your listed company
    const net = Object.entries(S.ledger).reduce((t, [k, v]) => t + (NON_OPERATING.includes(k) ? 0 : v), 0);
    c.profitHist.push(net);
    if (c.profitHist.length > 30) c.profitHist.shift();
    if (!c.public) return;
    const a = assets(), gross = Object.entries(a).reduce((t, [k, v]) => t + (k === 'publicEquity' ? 0 : v), 0);
    c.sentiment = clamp(c.sentiment * Math.exp(gauss() * 0.02 + S.marketMood) + (1 - c.sentiment) * 0.02, 0.4, 2);
    c.mcap += (fundamental(gross) * c.sentiment - c.mcap) * 0.1;
    c.hist.push(sharePrice());
    if (c.hist.length > 180) c.hist.shift();
    if (dayName() === 'Sun' && c.payout > 0) {
      const week = c.profitHist.slice(-7).reduce((x, y) => x + y, 0);
      if (week > 0) { const div = week * c.payout * c.float; spend(div, 'Dividends paid'); c.sentiment += 0.02 * c.payout; log(`💌 Paid ${money(div)} in dividends to public shareholders.`); }
    }
    if (S.day >= c.nextMeeting) shareholderMeeting();
  },
  tabs: [{ id: 'corp', name: 'Corporate', icon: '🏛️', render: renderCorp }],
  actions: {
    corpView(a) { UI.corpView = a; },
    foundHolding() {
      const name = (prompt('Name your holding company:', 'Apex Holdings') || '').trim().slice(0, 30);
      if (!name || !pay(HOLDING_COST, 'Legal', 'incorporation')) return;
      Object.assign(CO(), { founded: true, name, ticker: name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'MINE' });
      timeline('🏛️', `Founded ${name}`);
      log(`🏛️ You incorporated ${esc(name)} to hold all your businesses.`, 'good');
    },
    ipo(f) {
      const c = CO(); f = +f;
      if (c.public || netWorth() < IPO_MIN_NW || legalPower() < 15) return;
      const a = assets(), gross = Object.entries(a).reduce((t, [k, v]) => t + (k === 'publicEquity' ? 0 : v), 0);
      c.mcap = fundamental(gross); c.sentiment = rand(0.95, 1.15);
      c.mcap *= c.sentiment;
      const raise = c.mcap * f * (1 - IPO_FEE);
      earn(raise, 'Investments');
      Object.assign(c, { public: true, float: f, hist: [sharePrice()], nextMeeting: S.day + 90, approval: 65 });
      stat('ipo');
      timeline('🔔', `${c.name} IPO raised ${money(raise)}`);
      log(`🔔 ${esc(c.name)} (${c.ticker}) went public! You sold ${pct(f, 0)} of the company and raised ${money(raise)}.`, 'good');
      showModal({ title: `🔔 ${esc(c.name)} is public!`, cls: 'good', body: `<p>Market cap: <b>${money(c.mcap)}</b> (${price(sharePrice())}/share). You raised <b>${money(raise)}</b> after underwriting fees and still own ${pct(1 - f, 0)}.</p><p class="small muted">Your share price now follows your net worth, profits, ESG score and market mood. Shareholders meet every 90 days.</p>` });
    },
    buyback() {
      const c = CO(), cost = c.mcap * 0.01 * 1.02;
      if (c.float < 0.011 || !pay(cost, 'Investments', 'the buyback')) return;
      c.float -= 0.01; c.sentiment += 0.01;
      toast(`Bought back 1% of ${c.ticker} for ${money(cost)}.`, 'good');
    },
    secondary() {
      const c = CO();
      if (c.float >= 0.49) return toast('You must keep at least 51% to stay in control.', 'warn');
      const add = Math.min(0.05, 0.49 - c.float), raise = c.mcap * add * 0.96;
      c.float += add; c.sentiment -= 0.03;
      earn(raise, 'Investments');
      toast(`Sold ${pct(add, 0)} more of ${c.ticker} for ${money(raise)}.`, 'good');
    },
    payout(a) { CO().payout = +a; },
    takeover(sym) {
      const c = CO(), cost = takeoverCost(sym), nm = STOCKS.find((s) => s.sym === sym).name;
      if (!c.founded) return toast('Found a holding company first.', 'warn');
      if (!pay(cost, 'Investments', 'the takeover bid')) return;
      const friendly = rel(sym) >= 50;
      if (chance(friendly ? 0.85 : 0.6)) {
        const need = Math.max(0, 0.51 * SHARES[sym] - S.stocks[sym].qty), st = S.stocks[sym];
        st.cost = (st.cost * st.qty + st.price * need) / (st.qty + need); st.qty += need;
        c.controlled[sym] = true;
        st.shock += 0.1;
        stat('takeovers');
        timeline('🦈', `Took over ${nm}`);
        log(`🦈 ${friendly ? 'Friendly' : 'Hostile'} takeover complete: you now control ${nm}!`, 'good');
      } else {
        earn(cost * 0.97, 'Investments');
        addRel(sym, -20);
        log(`🛡️ ${nm}'s board fought off your takeover bid. You lost ${money(cost * 0.03)} in fees.`, 'bad');
      }
    },
    openBank() {
      const b = CO().bank;
      if (legalPower() < BANK.legal || netWorth() < BANK.nw) return;
      if (!pay(BANK.license, 'Banking', 'the banking license')) return;
      Object.assign(b, { open: true, capital: BANK.license * 0.8, deposits: 0, loans: 0 });
      timeline('🏦', 'Opened your own bank');
      log('🏦 You founded your own bank! Deposits will flow in as your reputation grows.', 'good');
    },
    bankCapital(amt) {
      const b = CO().bank; amt = +amt;
      if (amt > 0) { if (!pay(amt, 'Banking', 'bank capital')) return; b.capital += amt; }
      else { const w = Math.min(-amt, b.capital - b.loans * 0.1); if (w <= 0) return toast('Regulators require you to keep 10% capital.', 'warn'); b.capital -= w; earn(w, 'Banking'); }
    },
    bankPolicy(a) { CO().bank.policy = a; },
  },
});
UI.corpView = 'company';

function shareholderMeeting() {
  const c = CO();
  c.nextMeeting = S.day + 90;
  const h = c.hist, ret = h.length > 60 ? h[h.length - 1] / h[h.length - 61] - 1 : 0;
  c.approval = clamp(Math.round(55 + ret * 150 + c.payout * 30 + ((S.co2 ? S.co2.esg : 50) - 50) / 3), 0, 100);
  if (c.approval >= 40) { log(`📊 Shareholder meeting: ${c.approval}% approval. Investors are happy.`, 'good'); c.sentiment += 0.03; return; }
  const special = Math.round(c.mcap * 0.02 * c.float);
  showModal({
    title: '📢 Angry shareholders', cls: 'danger',
    body: `<p>Only <b>${c.approval}%</b> of shareholders approve of your leadership. An activist fund demands action.</p>`,
    buttons: [
      { label: `Pay a special dividend (${money(special)})`, fn: () => { spend(special, 'Dividends paid'); c.sentiment += 0.06; } },
      { label: 'Ignore them (share price −15%)', cls: 'danger', fn: () => { c.sentiment *= 0.85; S.deals.rep = clamp(S.deals.rep - 3, 0, 100); } },
    ],
  });
}

function renderCorp() {
  const c = CO(), b = c.bank, nw = netWorth();
  const view = seg([['company', '🏛️ Your company'], ['takeovers', '🦈 Takeovers'], ['bank', '🏦 Your bank']], UI.corpView, 'corpView');
  let body = '';
  if (UI.corpView === 'takeovers') {
    body = `<div class="banner info small">Own 51% of a listed company to control it: it pays you a share of its earnings every day on top of your stock. Bids pay a 30% premium. Good relations (Deals tab) make the board friendlier.</div>
      <div class="tbl-wrap"><table><thead><tr><th>Company</th><th class="num">Market cap</th><th class="num">Your stake</th><th class="num">Cost to control</th><th></th></tr></thead><tbody>${STOCKS.map((s) => `<tr><td><b>${s.sym}</b> ${s.name}</td><td class="num">${money(mcap(s.sym))}</td><td class="num">${pct(stake(s.sym), 1)}</td>
        <td class="num">${c.controlled[s.sym] ? '—' : money(takeoverCost(s.sym))}</td><td>${c.controlled[s.sym] ? '<span class="pill good">Controlled</span>' : btn(`Bid (${rel(s.sym) >= 50 ? '85' : '60'}%)`, 'takeover', s.sym, { cls: 'sm buy', disabled: !c.founded || !canAfford(takeoverCost(s.sym)) })}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (UI.corpView === 'bank') {
    const L = LENDING[b.policy];
    body = !b.open ? `<div class="card hl" style="max-width:600px"><h3>🏦 Found your own bank</h3><p>Take deposits from the public and lend them out. Profit from the spread, but loan defaults spike in recessions and thin capital invites bank runs.</p>
      <p class="small muted">Banking license ${money(BANK.license)} (80% becomes starting capital) · needs legal strength ${BANK.legal}+ (you: ${legalPower()}) and net worth ${money(BANK.nw)}+.</p>
      ${btn('Apply for a banking license', 'openBank', '', { cls: 'primary', disabled: legalPower() < BANK.legal || nw < BANK.nw || !canAfford(BANK.license) })}</div>`
      : `<div class="grid g4 section">
        <div class="card kpi"><div class="lbl">Capital</div><div class="val">${money(b.capital)}</div><div class="small muted">ratio ${pct(b.capital / Math.max(1, b.loans), 1)} (keep above 8%)</div></div>
        <div class="card kpi"><div class="lbl">Deposits</div><div class="val">${money(b.deposits)}</div><div class="small muted">grow with your reputation${b.run ? ' · <span class="bad">BANK RUN</span>' : ''}</div></div>
        <div class="card kpi"><div class="lbl">Loans</div><div class="val">${money(b.loans)}</div><div class="small muted">yield ${pct(L.yield, 1)}/yr</div></div>
        <div class="card kpi"><div class="lbl">Profit yesterday</div><div class="val ${cls(b.lastProfit)}">${signMoney(b.lastProfit)}</div></div></div>
        <div class="card"><div class="dz-row"><span class="small muted">Lending</span><div class="seg">${Object.entries(LENDING).map(([k, l]) => btn(`${l.name} (${pct(l.ratio, 0)} lent, ~${pct(l.loss, 1)} defaults)`, 'bankPolicy', k, { cls: 'sm ' + (b.policy === k ? 'on' : '') })).join('')}</div></div>
        <div class="dz-row"><span class="small muted">Capital</span><div class="row">${[10e6, 100e6, 1e9].map((v) => btn(`+${money(v)}`, 'bankCapital', v, { cls: 'sm buy', disabled: !canAfford(v) })).join('')}${[10e6, 100e6].map((v) => btn(`Withdraw ${money(v)}`, 'bankCapital', -v, { cls: 'sm sell' })).join('')}</div></div></div>`;
  } else if (!c.founded) {
    body = `<div class="card hl" style="max-width:600px"><h3>🏛️ Found a holding company</h3><p>Put all your businesses under one corporate roof. It's needed for takeovers and to go public.</p>${btn(`Incorporate (${money(HOLDING_COST)})`, 'foundHolding', '', { cls: 'primary', disabled: !canAfford(HOLDING_COST) })}</div>`;
  } else if (!c.public) {
    const ready = nw >= IPO_MIN_NW && legalPower() >= 15;
    body = `<div class="card hl" style="max-width:700px"><h3>🔔 Take ${esc(c.name)} public</h3><p>Sell part of your company on the stock market for a big pile of cash. Afterwards you answer to shareholders, and your net worth only counts your own share.</p>
      <p class="small muted">Requires net worth ${money(IPO_MIN_NW)}+ (you: ${money(nw)}) and legal strength 15+ (you: ${legalPower()}). Underwriters take ${pct(IPO_FEE, 0)}.</p>
      <div class="row">${[0.1, 0.2, 0.3, 0.4].map((f) => btn(`IPO ${pct(f, 0)} of the company`, 'ipo', f, { cls: 'sm primary', disabled: !ready })).join('')}</div></div>`;
  } else {
    body = `<div class="grid g4 section">
      <div class="card kpi"><div class="lbl">${c.ticker} share price</div><div class="val">${price(sharePrice())}</div>${chart('corp', c.hist, 50, {})}</div>
      <div class="card kpi"><div class="lbl">Market cap</div><div class="val">${money(c.mcap)}</div><div class="small muted">investor mood ${pct(c.sentiment, 0)}</div></div>
      <div class="card kpi"><div class="lbl">Public float</div><div class="val">${pct(c.float, 0)}</div><div class="small muted">you own ${pct(1 - c.float, 0)}</div></div>
      <div class="card kpi"><div class="lbl">Shareholder approval</div><div class="val ${c.approval < 40 ? 'bad' : 'good'}">${c.approval}%</div><div class="small muted">next meeting day ${c.nextMeeting}</div></div></div>
      <div class="card"><div class="dz-row"><span class="small muted">Dividend payout</span>${seg([[0, 'None'], [0.25, '25% of profit'], [0.5, '50%']], c.payout, 'payout')}</div>
      <div class="row" style="margin-top:8px">${btn(`Buy back 1% (${money(c.mcap * 0.0102)})`, 'buyback', '', { cls: 'sm buy', disabled: c.float < 0.011 })}${btn(`Sell 5% more (~${money(c.mcap * 0.048)})`, 'secondary', '', { cls: 'sm sell', disabled: c.float >= 0.49 })}</div>
      <p class="small muted" style="margin-top:8px">Your share price tracks your net worth, recent profits, ESG score and market mood. Dividends and buybacks please investors.</p></div>`;
  }
  return `<div class="row between section"><h2>🏛️ Corporate${c.founded ? `: ${esc(c.name)}` : ''}</h2>${view}</div>${body}`;
}
