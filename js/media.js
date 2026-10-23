'use strict';
/* =====================================================================
   Media empire: newspapers, radio, magazines, TV, a streaming service and
   a social network. They earn ad and subscription money and give you
   influence: reputation, election odds, political offices, investor mood,
   and free promotion for your own products.
   ===================================================================== */
const OUTLETS = {
  paper: { name: 'Local newspaper', icon: '📰', cost: 2000000, arpu: 0.05, aud: 150000, opex: 4000, infl: 3, grow: 0.01 },
  magazine: { name: 'Business magazine', icon: '📖', cost: 8000000, arpu: 0.08, aud: 300000, opex: 12000, infl: 4, grow: 0.015, rep: true },
  radio: { name: 'Radio network', icon: '📻', cost: 15000000, arpu: 0.04, aud: 1500000, opex: 25000, infl: 6, grow: 0.015 },
  tv: { name: 'TV channel', icon: '📺', cost: 120000000, arpu: 0.06, aud: 6000000, opex: 200000, infl: 15, grow: 0.02 },
  streaming: { name: 'Streaming service', icon: '🎬', cost: 400000000, arpu: 0.35, aud: 3000000, opex: 300000, infl: 10, grow: 0.03, content: true },
  social: { name: 'Social network', icon: '💬', cost: 1500000000, arpu: 0.03, aud: 150000000, opex: 1500000, infl: 25, grow: 0.04, needsAI: 40 },
};
const CONTENT = [[0, 'No new shows'], [100000, '$100K/day'], [1000000, '$1M/day'], [5000000, '$5M/day']];

const MD = () => S.media;
function mediaInfluence() {
  if (!S.media) return 0;
  return MD().outlets.reduce((t, o) => t + OUTLETS[o.type].infl * Math.min(1.5, o.aud / OUTLETS[o.type].aud) * (o.cred / 100), 0);
}
const outletValue = (o) => OUTLETS[o.type].cost * 0.6 * Math.min(2, o.aud / OUTLETS[o.type].aud);

registerModule({
  id: 'media',
  init(s) { s.media = { outlets: [], promote: false, lastRev: 0 }; },
  assets(a) { a.media = MD().outlets.reduce((t, o) => t + outletValue(o), 0); },
  daily() {
    const M = MD();
    let rev = 0;
    for (const o of M.outlets) {
      const t = OUTLETS[o.type];
      const contentF = t.content ? 0.4 + Math.log10(1 + o.budget / 10000) / 2 : 1;
      const aiF = t.needsAI ? (aiCap() >= t.needsAI ? 1 : 0.5) : 1;
      const target = t.aud * 1.6 * contentF * aiF * (o.cred / 100) * worldMult('media');
      o.aud = Math.max(1000, o.aud + (target - o.aud) * t.grow);
      if (M.promote) o.cred = clamp(o.cred - 0.1, 30, 100); else o.cred = clamp(o.cred + 0.05, 0, 100);
      const r = o.aud * t.arpu * worldMult('media');
      rev += r;
      spend(t.opex + (o.budget || 0), 'Media');
      if (t.needsAI && aiCap() < t.needsAI && chance(0.02)) { o.cred = clamp(o.cred - 10, 0, 100); log(`💬 A misinformation scandal hit your ${t.name}: you need an AI with capability ${t.needsAI}+ to moderate it.`, 'bad'); }
    }
    if (rev) earn(rev, 'Media');
    M.lastRev = rev;
    const infl = mediaInfluence();
    if (infl > 0) {
      S.deals.rep = clamp(S.deals.rep + Math.min(0.1, infl / 500), 0, 100);
      if (M.outlets.some((o) => OUTLETS[o.type].rep)) for (const r of S.restaurants) r.rep = clamp(r.rep + 0.03, 0, 100);
      if (M.promote) for (const d of S.designs) d.recent = Math.max(0, d.recent - infl / 50);
    }
  },
  tabs: [{ id: 'media', name: 'Media', icon: '📺', render: renderMedia }],
  actions: {
    buyOutlet(t) {
      const d = OUTLETS[t];
      if (!pay(d.cost, 'Investments', d.name)) return;
      MD().outlets.push({ id: uid(), type: t, aud: d.aud * 0.5, cred: 80, budget: d.content ? 100000 : 0 });
      stat('outlets');
      log(`${d.icon} You launched a ${d.name}.`, 'good');
    },
    sellOutlet(id) {
      const M = MD(), o = M.outlets.find((x) => x.id === +id), v = outletValue(o);
      earn(v, 'Investments');
      M.outlets.splice(M.outlets.indexOf(o), 1);
      toast(`Sold for ${money(v)}.`, 'good');
    },
    contentBudget(id, v) { MD().outlets.find((x) => x.id === +id).budget = +v; },
    togglePromote() { MD().promote = !MD().promote; },
  },
});

function renderMedia() {
  const M = MD();
  const mine = M.outlets.map((o) => {
    const t = OUTLETS[o.type];
    return `<div class="card tight"><div class="row between"><b>${t.icon} ${t.name}</b>${btn(`Sell ${money(outletValue(o))}`, 'sellOutlet', o.id, { cls: 'sm' })}</div>
      <div class="small">Audience <b>${fmtInt(o.aud)}</b> · ${money(o.aud * t.arpu)}/day revenue · ${money(t.opex + (o.budget || 0))}/day costs</div>
      ${barline('Credibility', o.cred, o.cred < 50 ? 'var(--bad)' : 'var(--good)')}
      ${t.content ? `<div class="row" style="margin-top:6px"><span class="small muted">Content budget</span><div class="seg">${CONTENT.map(([v, l]) => btn(l, 'contentBudget', o.id, { b: v, cls: 'sm ' + (o.budget === v ? 'on' : '') })).join('')}</div></div>` : ''}
      ${t.needsAI ? `<div class="small ${aiCap() >= t.needsAI ? 'good' : 'warn'}">AI moderation: ${aiCap() >= t.needsAI ? 'active' : `needs an AI with capability ${t.needsAI}+`}</div>` : ''}</div>`;
  }).join('');
  const shop = Object.entries(OUTLETS).map(([k, t]) => `<div class="card tight"><b>${t.icon} ${t.name}</b><div class="small muted">~${fmtInt(t.aud)} audience · influence +${t.infl}${t.content ? ' · needs a content budget' : ''}${t.needsAI ? ` · best with an AI (capability ${t.needsAI}+)` : ''}${t.rep ? ' · boosts restaurant reputations' : ''}</div>
    <div style="margin-top:6px">${btn(`Launch ${money(t.cost)}`, 'buyOutlet', k, { cls: 'sm buy', disabled: !canAfford(t.cost) })}</div></div>`).join('');
  return `<h2 class="section">📺 Media Empire</h2>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Influence</div><div class="val">${Math.round(mediaInfluence())}</div><div class="small muted">helps elections, offices and reputation</div></div>
    <div class="card kpi"><div class="lbl">Media revenue</div><div class="val good">${money(M.lastRev)}/day</div></div>
    <div class="card kpi"><div class="lbl">Outlets</div><div class="val">${M.outlets.length}</div></div>
    <div class="card"><div class="small muted">Promote your own products</div>${btn(M.promote ? '📣 Self-promotion ON' : 'Self-promotion OFF', 'togglePromote', '', { cls: 'sm ' + (M.promote ? 'on' : '') })}<div class="small muted">Props up your product prices, but slowly erodes credibility.</div></div>
  </div>
  ${mine ? `<div class="grid g3 section">${mine}</div>` : ''}
  <h4>Launch or buy an outlet</h4><div class="grid g3">${shop}</div>`;
}
