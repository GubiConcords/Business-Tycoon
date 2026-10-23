'use strict';
/* =====================================================================
   9–5 job: clock in, click to work. Pay per click starts at 1¢ and
   rises with promotions as your career clicks add up, to 40¢.
   This tab manages its own DOM so fast clicking never gets interrupted.
   ===================================================================== */
const JOB_RANKS = [
  { at: 0, title: 'Intern', pay: 0.01 },
  { at: 200, title: 'Junior Clerk', pay: 0.02 },
  { at: 600, title: 'Clerk', pay: 0.04 },
  { at: 1500, title: 'Associate', pay: 0.07 },
  { at: 3000, title: 'Senior Associate', pay: 0.11 },
  { at: 6000, title: 'Team Lead', pay: 0.16 },
  { at: 10000, title: 'Manager', pay: 0.22 },
  { at: 16000, title: 'Senior Manager', pay: 0.29 },
  { at: 25000, title: 'Director', pay: 0.35 },
  { at: 40000, title: 'Vice President', pay: 0.4 },
];
const SHIFT_CLICKS = 480;  // 9 AM to 5 PM: each click is one minute of work
const CLOCK_IN_ENERGY = 30;
const JOB_COMPANY = 'Initech Holdings';

const jobRankIdx = () => JOB_RANKS.reduce((r, x, i) => (S.job.clicks >= x.at ? i : r), 0);
const jobRank = () => JOB_RANKS[jobRankIdx()];
const cents = (v) => Math.round(v * 100) + '¢';
function jobClock() {
  const mins = 9 * 60 + Math.floor(S.job.today / SHIFT_CLICKS * 480);
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function jobUpdate() {
  const J = S.job, rank = jobRank(), i = jobRankIdx(), next = JOB_RANKS[i + 1];
  const set = (id, html) => { const el = $('#' + id); if (el) el.innerHTML = html; };
  set('job-title', `${rank.title} <span class="muted small">at ${JOB_COMPANY}</span>`);
  set('job-rate', cents(rank.pay));
  set('job-career', fmtInt(J.clicks));
  set('job-total', money(J.total));
  set('job-next', next
    ? `Next promotion: <b>${next.title}</b> (${cents(next.pay)}/click) in ${fmtInt(next.at - J.clicks)} clicks${bar((J.clicks - rank.at) / (next.at - rank.at) * 100, 'var(--good)')}`
    : '<b class="good">Top of the ladder!</b> You earn the maximum 40¢ per click.');
  set('job-clock', jobClock());
  set('job-today', `${fmtInt(J.today)} / ${SHIFT_CLICKS} clicks · earned ${money(J.earnedToday)} today`);
  const sb = $('#job-shiftbar > div');
  if (sb) sb.style.width = (J.today / SHIFT_CLICKS * 100) + '%';
  const b = $('#job-btn');
  if (b) {
    const over = J.today >= SHIFT_CLICKS;
    b.disabled = !J.clockedIn || over;
    b.innerHTML = over ? '🌇 5:00 PM: shift over! Come back tomorrow' : !J.clockedIn ? 'Clock in first' : `🖱️ WORK <span class="small">(+${cents(rank.pay)})</span>`;
  }
  const c = $('#job-clockin');
  if (c) c.hidden = J.clockedIn || J.today >= SHIFT_CLICKS;
  const o = $('#job-clockout');
  if (o) o.hidden = !J.clockedIn;
  set('job-ladder', JOB_RANKS.map((r, k) => `<tr class="${k === i ? 'sel' : ''}"><td>${k < i ? '✅' : k === i ? '👉' : '🔒'} ${r.title}</td><td class="num">${fmtInt(r.at)}</td><td class="num">${cents(r.pay)}</td><td class="num">${money(r.pay * SHIFT_CLICKS)}</td></tr>`).join(''));
}

function jobPop(e, text) {
  const btnEl = $('#job-btn');
  if (!btnEl) return;
  const pop = document.createElement('span');
  pop.className = 'job-pop';
  pop.textContent = text;
  const r = btnEl.getBoundingClientRect();
  const x = e && e.clientX ? e.clientX - r.left : r.width / 2;
  pop.style.left = x + 'px';
  btnEl.appendChild(pop);
  setTimeout(() => pop.remove(), 700);
}

registerModule({
  id: 'job',
  init(s) { s.job = { clicks: 0, today: 0, earnedToday: 0, clockedIn: false, total: 0, days: 0 }; },
  daily() {
    const J = S.job;
    if (J.clockedIn) J.days++;
    // your AI clone finishes any part of the shift you didn't work
    if (aiDoesJob() && J.today < SHIFT_CLICKS) {
      let pay = 0;
      for (let i = J.today; i < SHIFT_CLICKS; i++) { pay += jobRank().pay; J.clicks++; }
      J.total += pay;
      earn(pay, 'Salary');
      stat('aiShifts');
    }
    J.today = 0; J.earnedToday = 0; J.clockedIn = false;
  },
  tabs: [{ id: 'job', name: '9–5 Job', icon: '💼', render: renderJob, after: jobUpdate, tick: jobUpdate, live: false }],
  actions: {
    clockIn() {
      if (S.job.clockedIn || S.job.today >= SHIFT_CLICKS) return false;
      if (!useEnergy(CLOCK_IN_ENERGY)) return false;
      S.job.clockedIn = true;
      toast(`💼 Clocked in at ${JOB_COMPANY}. Time stops while you're at work. Get clicking!`, 'good');
      jobUpdate();
      return false;
    },
    clockOut() {
      S.job.clockedIn = false;
      toast(`👋 Clocked out early with ${money(S.job.earnedToday)} earned. Time runs again.`);
      jobUpdate();
      return false;
    },
    work(a, b, el, e) {
      const J = S.job;
      if (!J.clockedIn || J.today >= SHIFT_CLICKS) return false;
      const before = jobRankIdx(), pay = jobRank().pay;
      J.clicks++; J.today++; J.earnedToday += pay; J.total += pay;
      earn(pay, 'Salary');
      jobPop(e, '+' + cents(pay));
      const after = jobRankIdx();
      if (after > before) {
        const r = JOB_RANKS[after];
        log(`🎉 Promoted to ${r.title} at ${JOB_COMPANY}! You now earn ${cents(r.pay)} per click.`, 'good');
        toast(`🎉 Promotion! You're now a <b>${r.title}</b> (${cents(r.pay)}/click)`, 'good');
      }
      if (J.today === SHIFT_CLICKS) {
        J.clockedIn = false;
        toast(`🌇 5:00 PM. Shift done! You earned ${money(J.earnedToday)} today. Time runs again.`, 'good');
      }
      jobUpdate();
      return false;
    },
  },
});

function renderJob() {
  return `<h2 class="section">💼 Your 9–5 Job</h2>
  <div class="banner info small">A steady paycheck. Clock in (${CLOCK_IN_ENERGY}⚡), then click <b>WORK</b>. Each click is one minute of work, and a shift runs from 9 AM to 5 PM (${SHIFT_CLICKS} clicks). <b>Time stops while you're at the office</b> and starts again when you clock out. You start at <b>1¢ per click</b>, and promotions raise it to <b>40¢</b> the longer you stay.</div>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Position</div><div class="val" id="job-title" style="font-size:18px"></div></div>
    <div class="card kpi"><div class="lbl">Pay per click</div><div class="val good" id="job-rate"></div></div>
    <div class="card kpi"><div class="lbl">Career clicks</div><div class="val" id="job-career"></div></div>
    <div class="card kpi"><div class="lbl">Lifetime salary</div><div class="val" id="job-total"></div></div>
  </div>
  <div class="card section job-desk">
    <div class="row between"><div><div class="small muted">🕘 Office clock</div><div class="job-clock" id="job-clock"></div></div>
      <div class="right small" id="job-today"></div></div>
    <div class="bar" id="job-shiftbar" style="margin:10px 0"><div style="width:0;background:var(--accent)"></div></div>
    <div class="row" style="justify-content:center;margin:16px 0">
      <button class="btn primary" id="job-clockin" data-act="clockIn">⏰ Clock in (${CLOCK_IN_ENERGY}⚡)</button>
      <button class="btn" id="job-clockout" data-act="clockOut" hidden>👋 Clock out early</button>
    </div>
    <button class="btn job-btn" id="job-btn" data-act="work"></button>
    <div class="small" id="job-next" style="margin-top:14px"></div>
  </div>
  <div class="card"><h3>📈 Career ladder</h3><div class="tbl-wrap"><table><thead><tr><th>Position</th><th class="num">Career clicks</th><th class="num">Per click</th><th class="num">Full shift</th></tr></thead><tbody id="job-ladder"></tbody></table></div></div>`;
}
