'use strict';
/* =====================================================================
   Bank (loans & savings) and Taxes (honest, creative or offshore —
   the risky route: lower tax bills, but audits can bring big fines)
   ===================================================================== */
const LOAN_RATE = 0.0012;     // per day
const SAVINGS_RATE = 0.00025; // per day
const TAX_CATS = ['Restaurants', 'Factories', 'Scrapyard', 'Real Estate', 'Racing', 'Wages', 'Marketing', 'Rent', 'Utilities', 'Insurance', 'Contracts', 'AI', 'Ventures', 'Legal', 'Space'];
const TAX_MODES = {
  honest: { name: 'Honest', icon: '😇', rate: 0.2, risk: -6, desc: 'Pay the full 20%. Audit risk slowly falls.' },
  creative: { name: 'Creative accounting', icon: '🤫', rate: 0.12, risk: 7, desc: 'Fudge the books and pay 12%. Audit risk builds every week.' },
  offshore: { name: 'Offshore shell company', icon: '🏝️', rate: 0.03, risk: 14, desc: 'Funnel profits abroad and pay 3%. Very high audit risk.' },
};
const SHELL_COST = 75000;
const ACCOUNTANT_WAGE = 400;

const loanLimit = () => Math.max(15000, (netWorth() + S.bank.loan) * 0.5);
function addRisk(n) {
  if (n > 0 && S.legal && S.legal.staff.compliance) n *= 0.7;
  S.tax.risk = clamp(S.tax.risk + (n > 0 && S.tax.accountant ? n * 0.5 : n), 0, 100);
}
function bankAmount(max) {
  return UI.bankAmt === 'max' ? max : Math.min(UI.bankAmt, max);
}

function runAudit() {
  const T = S.tax;
  T.audits++;
  if (T.evaded > 1) {
    const fine = Math.round((T.evaded * 2.5 + 10000) * (T.accountant ? 0.7 : 1) * legalFineMult());
    spend(fine, 'Fines');
    log(`🕵️ TAX AUDIT! Investigators found ${money(T.evaded)} in unpaid taxes. Fine: ${money(fine)}.`, 'bad');
    showModal({
      title: '🕵️ Tax audit!', cls: 'danger',
      body: `<p>Tax investigators went through your books and found <b>${money(T.evaded)}</b> in evaded taxes.</p>
        <p>You must pay back taxes plus penalties: <b class="bad">${money(fine)}</b>.${T.accountant ? ' (Your accountant negotiated it down 30%.)' : ''}</p>
        ${S.cash < 0 ? '<p class="bad">You couldn\'t cover it in cash. The rest goes on your bank loan.</p>' : ''}`,
    });
    T.evaded = 0;
    T.risk = Math.max(0, T.risk - 40);
    stat('auditsFailed');
  } else {
    log('🕵️ Tax audit: your books were clean. No penalties.', 'good');
    toast('Tax audit passed. Clean books!', 'good');
    T.risk = Math.max(0, T.risk - 20);
  }
}

registerModule({
  id: 'finance',
  init(s) {
    s.bank = { loan: 0, savings: 0 };
    s.tax = { mode: 'honest', risk: 0, evaded: 0, week: 0, shell: false, accountant: false, paid: 0, audits: 0, lastBill: null };
  },
  assets(a) { a.savings = S.bank.savings; a.loan = -S.bank.loan; },
  daily() {
    const B = S.bank;
    if (B.loan > 0) { const i = B.loan * LOAN_RATE; B.loan += i; book('Interest', -i); }
    if (B.savings > 0) { const i = B.savings * SAVINGS_RATE; B.savings += i; book('Interest', i); }
    if (S.tax.accountant) spend(ACCOUNTANT_WAGE, 'Wages');
    S.tax.risk = Math.max(0, S.tax.risk - 0.15);
  },
  // runs after every other module so the whole day's business results are taxed
  late() {
    const T = S.tax;
    for (const c of TAX_CATS) T.week += S.ledger[c] || 0;
    if (dayName() !== 'Sun') return;
    const m = TAX_MODES[T.mode], profit = T.week;
    T.week = 0;
    if (profit > 0) {
      const bill = profit * m.rate;
      spend(bill, 'Taxes');
      T.paid += bill;
      T.evaded += profit * (0.2 - m.rate);
      T.lastBill = { profit, bill, mode: T.mode };
      log(`🧾 Weekly taxes: ${money(bill)} on ${money(profit)} business profit (${m.name}).`);
    } else T.lastBill = { profit, bill: 0, mode: T.mode };
    addRisk(m.risk);
    T.evaded *= 0.97;
    if (chance(T.risk / 100 * 0.6)) runAudit();
  },
  tabs: [
    { id: 'bank', name: 'Bank', icon: '🏦', render: renderBank },
    { id: 'taxes', name: 'Taxes & Risk', icon: '🧾', render: renderTaxes },
  ],
  actions: {
    bankAmt(a) { UI.bankAmt = a === 'max' ? a : +a; },
    borrow() {
      const amt = bankAmount(Math.max(0, loanLimit() - S.bank.loan));
      if (amt < 1) return toast("The bank won't lend you more right now.", 'warn');
      S.bank.loan += amt; S.cash += amt;
      toast(`Borrowed ${money(amt)}`, 'good');
    },
    repay() {
      const amt = bankAmount(Math.min(S.cash, S.bank.loan));
      if (amt < 0.01) return;
      S.bank.loan -= amt; S.cash -= amt;
      if (S.bank.loan < 0.01) S.bank.loan = 0;
      toast(`Repaid ${money(amt)}`, 'good');
    },
    deposit() {
      const amt = bankAmount(S.cash);
      if (amt < 0.01) return;
      S.bank.savings += amt; S.cash -= amt;
    },
    withdraw() {
      const amt = bankAmount(S.bank.savings);
      if (amt < 0.01) return;
      S.bank.savings -= amt; S.cash += amt;
    },
    taxMode(a) {
      if (a === 'offshore' && !S.tax.shell) return toast('Set up an offshore shell company first.', 'warn');
      S.tax.mode = a;
      log(`🧾 You switched your tax strategy to: ${TAX_MODES[a].name}.`, a === 'honest' ? '' : 'warn');
    },
    buyShell() {
      if (!pay(SHELL_COST, 'Taxes', 'the shell company')) return;
      S.tax.shell = true;
      addRisk(5);
      toast('🏝️ Shell company registered in a sunny tax haven.', 'good');
    },
    toggleAccountant() { S.tax.accountant = !S.tax.accountant; },
    donate() {
      const cost = Math.round(25000 + Math.max(0, netWorth()) * 0.01);
      if (!pay(cost, 'Taxes', 'the donation')) return;
      addRisk(-20);
      toast('Your generous "campaign donation" makes certain people look the other way.', 'good');
    },
  },
});
UI.bankAmt = 10000;

function renderBank() {
  const B = S.bank, lim = loanLimit();
  const amounts = seg([[1000, '$1K'], [10000, '$10K'], [100000, '$100K'], [1000000, '$1M'], [10000000, '$10M'], ['max', 'Max']], UI.bankAmt, 'bankAmt');
  return `<h2 class="section">🏦 First Tycoon Bank</h2>
  <div class="row section"><span class="small muted">Amount</span>${amounts}</div>
  <div class="grid g2">
    <div class="card"><h3>💳 Loan</h3>
      <div class="kpi"><div class="lbl">Outstanding</div><div class="val ${B.loan ? 'bad' : ''}">${money(B.loan)}</div></div>
      <p class="small muted">Interest ${pct(LOAN_RATE, 2)} per day (~${pct(LOAN_RATE * 30, 1)}/month). Credit limit ${money(lim)} (50% of your net worth). Overdrafts are added to your loan automatically.</p>
      ${bar(B.loan / lim * 100, B.loan > lim ? 'var(--bad)' : 'var(--warn)')}
      <div class="row" style="margin-top:10px">${btn('Borrow', 'borrow', '', { cls: 'buy', disabled: B.loan >= lim })}${btn('Repay', 'repay', '', { cls: 'sell', disabled: !B.loan || S.cash < 0.01 })}</div></div>
    <div class="card"><h3>🐷 Savings account</h3>
      <div class="kpi"><div class="lbl">Balance</div><div class="val good">${money(B.savings)}</div></div>
      <p class="small muted">Earns ${pct(SAVINGS_RATE, 3)} per day, risk-free. Savings can't be spent until you withdraw them.</p>
      <div class="row" style="margin-top:10px">${btn('Deposit', 'deposit', '', { cls: 'buy', disabled: S.cash < 0.01 })}${btn('Withdraw', 'withdraw', '', { cls: 'sell', disabled: !B.savings })}</div></div>
  </div>`;
}

function renderTaxes() {
  const T = S.tax, lb = T.lastBill;
  const donateCost = Math.round(25000 + Math.max(0, netWorth()) * 0.01);
  const modes = Object.entries(TAX_MODES).map(([k, m]) => `<div class="card tight ${T.mode === k ? 'hl' : ''}">
    <div class="row between"><b>${m.icon} ${m.name}</b><span class="pill ${k === 'honest' ? 'good' : 'bad'}">${pct(m.rate, 0)} tax</span></div>
    <p class="small muted" style="margin:6px 0">${m.desc}</p>
    ${T.mode === k ? '<span class="pill good">Active</span>' : btn('Switch', 'taxMode', k, { cls: 'sm', disabled: k === 'offshore' && !T.shell })}
    ${k === 'offshore' && !T.shell ? btn(`Set up shell company (${money(SHELL_COST)})`, 'buyShell', '', { cls: 'sm', disabled: !canAfford(SHELL_COST) }) : ''}</div>`).join('');
  return `<h2 class="section">🧾 Taxes &amp; Risk</h2>
  <div class="banner warn small">Business profits (restaurants, factories, scrapyard, rent, racing) are taxed every Sunday. You can choose to cheat, but the more you dodge, the likelier an audit. Audits charge <b>2.5×</b> the evaded tax plus a $10K penalty. Cutting corners on factory safety and underground racing raise your risk too.</div>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Audit risk</div><div class="val ${T.risk > 50 ? 'bad' : T.risk > 20 ? 'warn' : 'good'}">${Math.round(T.risk)}%</div>${bar(T.risk, T.risk > 50 ? 'var(--bad)' : 'var(--warn)')}<div class="small muted">~${pct(T.risk / 100 * 0.6, 0)} audit chance each Sunday</div></div>
    <div class="card kpi"><div class="lbl">Unpaid taxes on record</div><div class="val ${T.evaded > 0 ? 'bad' : ''}">${money(T.evaded)}</div><div class="small muted">Potential fine ${money(T.evaded > 1 ? T.evaded * 2.5 + 10000 : 0)}</div></div>
    <div class="card kpi"><div class="lbl">Profit this week so far</div><div class="val">${money(T.week)}</div><div class="small muted">Next bill on Sunday</div></div>
    <div class="card kpi"><div class="lbl">Last bill</div><div class="val">${lb ? money(lb.bill) : '—'}</div><div class="small muted">Total paid ${money(T.paid)} · ${T.audits} audit(s)</div></div>
  </div>
  <h4>Tax strategy</h4><div class="grid g3 section">${modes}</div>
  <div class="grid g2">
    <div class="card"><h3>👔 Accountant</h3><p class="small muted">${money(ACCOUNTANT_WAGE)}/day. Halves how fast audit risk builds and negotiates audit fines down 30%.</p>
      ${btn(T.accountant ? 'Fire accountant' : 'Hire accountant', 'toggleAccountant', '', { cls: T.accountant ? 'sell' : 'buy' })}</div>
    <div class="card"><h3>🤝 Political donation</h3><p class="small muted">Make friends in high places. Lowers audit risk by 20.</p>
      ${btn(`Donate ${money(donateCost)}`, 'donate', '', { disabled: !canAfford(donateCost) || T.risk <= 0 })}</div>
  </div>`;
}
