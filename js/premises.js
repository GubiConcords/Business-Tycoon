'use strict';
/* =====================================================================
   Premises & bills: every business needs a site (rented or bought),
   a permit to open, and pays utilities, insurance and property tax.
   Also your own living costs.
   ===================================================================== */
const BILL_LABELS = {
  rent: '🏢 Rent', ptax: '🏛️ Property tax', elec: '⚡ Electricity', water: '💧 Water', gas: '🔥 Gas',
  net: '🌐 Internet & phone', waste: '🗑️ Waste', ins: '🛡️ Insurance',
};
const BILL_CAT = { rent: 'Rent', ptax: 'Rent', ins: 'Insurance' };  // everything else is 'Utilities'
const DEPOSIT_DAYS = 30;
const PROPERTY_TAX = 0.00004;  // per day, of premises value
const UTIL_EVENTS = [
  ['elec', 0.35, '🥵 Heatwave! Air conditioners strain the grid. Electricity prices soar.'],
  ['elec', -0.2, '🌬️ Windy week: cheap renewable power floods the grid.'],
  ['water', 0.35, '🏜️ Drought declared. Water rates hiked.'],
  ['gas', 0.4, '🔥 Gas pipeline outage. Natural gas prices spike.'],
  ['gas', -0.2, '🔥 Mild weather pushes gas prices down.'],
];
const LIFESTYLES = [
  { id: 'parents', name: "Parents' basement", icon: '🛋️', cost: 0, energy: 80, desc: 'Free, but your mom keeps waking you up early.' },
  { id: 'studio', name: 'Rented studio', icon: '🏠', cost: 30, energy: 100, desc: 'Rent, utilities, groceries and a phone plan.' },
  { id: 'apartment', name: 'Downtown apartment', icon: '🏢', cost: 140, energy: 115, desc: 'Better sleep, nicer food, a gym membership.' },
  { id: 'house', name: 'Suburban house', icon: '🏡', cost: 450, energy: 130, desc: 'Space, a garden and a housekeeper.' },
  { id: 'mansion', name: 'Hilltop mansion', icon: '🏰', cost: 3500, energy: 160, desc: 'Private chef, personal trainer, butler. Peak productivity.' },
];
const LIFE = Object.fromEntries(LIFESTYLES.map((l) => [l.id, l]));
const energyMax = () => (LIFE[S.life.tier] || LIFE.studio).energy + vehicleEnergyBonus() + (S.meta ? (S.meta.legacyEnergy || 0) + (S.meta.trait === 'prodigy' ? 15 : 0) : 0);

/* ---------------------------- Sites ---------------------------- */
// a site is either rented (deposit held, daily rent) or owned (bought, appreciates with the housing market)
function makeSite(own, rent, price) {
  return own ? { own: true, rent, price, bought: price, deposit: 0 } : { own: false, rent, price, deposit: rent * DEPOSIT_DAYS };
}
const siteValue = (s) => (!s ? 0 : s.own ? s.bought * S.re.housing : s.deposit);
const sitePrice = (s) => s.price * S.re.housing;
const rentNow = (rent) => rent * Math.sqrt(S.re.housing);
function siteLabel(s) {
  return s.own ? `🔑 Owned premises (worth ${money(siteValue(s))})` : `🏢 Rented: ${money(rentNow(s.rent))}/day · ${money(s.deposit)} deposit held`;
}
function buySite(s) {
  const cost = sitePrice(s);
  if (!pay(cost, 'Investments', 'the premises')) return false;
  earn(s.deposit, 'Investments');  // landlord returns the deposit
  Object.assign(s, { own: true, bought: s.price, deposit: 0 });
  toast('You now own the premises. No more rent!', 'good');
  return true;
}

/* ---------------------------- Bills ---------------------------- */
const uRate = (k) => S.utilRates[k];
// base: fixed daily usage (kept on even when closed); use: activity-driven usage
function makeBills(site, base, use = {}, insured = true, insValue = 0) {
  const b = {};
  if (site) {
    if (site.own) b.ptax = siteValue(site) * PROPERTY_TAX;
    else b.rent = rentNow(site.rent);
  }
  for (const k of ['elec', 'water', 'gas']) {
    const v = ((base[k] || 0) + (use[k] || 0)) * uRate(k);
    if (v > 0) b[k] = v;
  }
  if (base.net) b.net = base.net;
  if (base.waste || use.waste) b.waste = (base.waste || 0) + (use.waste || 0);
  if (insured && insValue) b.ins = insValue * 0.0004;
  return b;
}
function payBills(b) {
  let total = 0;
  for (const [k, v] of Object.entries(b)) { spend(v, BILL_CAT[k] || 'Utilities'); total += v; }
  if (b.elec && S.power) S.power.elecSpend += b.elec;
  if (b.gas) addCO2('🔥 Gas for heating & kitchens', b.gas * 0.005);
  if (b.waste) addCO2('🗑️ Waste to landfill', b.waste * 0.003);
  return total;
}
const billsTotal = (b) => Object.values(b || {}).reduce((s, v) => s + v, 0);
function billsHtml(b) {
  if (!b) return '';
  const parts = Object.entries(b).filter(([, v]) => v >= 0.5).map(([k, v]) => `${BILL_LABELS[k]} ${money(v)}`);
  return parts.length ? `<div class="small muted bills">Bills yesterday: ${parts.join(' · ')} = <b>${money(billsTotal(b))}</b></div>` : '';
}

/* ---------------------------- Opening flow ---------------------------- */
// shows the rent-or-buy choice; done(site) runs after everything is paid
function openBusiness({ title, icon = '', equipment, permit, rent, price, extra = '', done }) {
  permit = { ...permit, cost: Math.round(permit.cost * permitMult()) };
  const rentUp = equipment + permit.cost + rent * DEPOSIT_DAYS;
  const buyUp = equipment + permit.cost + price * S.re.housing;
  const go = (own) => () => {
    const total = own ? buyUp : rentUp;
    if (!pay(total, 'Investments', title)) return;
    done(makeSite(own, rent, price));
  };
  showModal({
    title: `${icon} Open ${title}`,
    body: `<table class="small"><tbody>
      <tr><td>🛠️ Equipment &amp; fit-out</td><td class="num">${money(equipment)}</td></tr>
      <tr><td>📄 ${permit.name}</td><td class="num">${money(permit.cost)}</td></tr>
      <tr><td>🏢 Rent the premises: ${DEPOSIT_DAYS}-day deposit (refunded when you leave), then ${money(rentNow(rent))}/day</td><td class="num">${money(rent * DEPOSIT_DAYS)}</td></tr>
      <tr><td>🔑 …or buy the premises outright (no rent, small property tax, keeps its value)</td><td class="num">${money(price * S.re.housing)}</td></tr>
    </tbody></table>
    <p class="small muted" style="margin-top:8px">You'll also pay daily bills for electricity, water, gas, internet, waste and insurance.</p>${extra}`,
    buttons: [
      { label: `🏢 Rent: pay ${money(rentUp)} now`, cls: 'primary', disabled: !canAfford(rentUp), fn: go(false) },
      { label: `🔑 Buy: pay ${money(buyUp)} now`, cls: 'buy', disabled: !canAfford(buyUp), fn: go(true) },
      { label: 'Cancel' },
    ],
  });
}

registerModule({
  id: 'premises',
  init(s) {
    s.utilRates = { elec: 1, water: 1, gas: 1 };
    s.life = { tier: 'studio', last: 0 };
  },
  daily() {
    if (chance(0.04)) {
      const [k, d, text] = pick(UTIL_EVENTS);
      S.utilRates[k] = clamp(S.utilRates[k] + d, 0.6, 2.2);
      log(text, d > 0 ? 'warn' : 'good');
    }
    for (const k in S.utilRates) S.utilRates[k] = clamp(S.utilRates[k] + 0.07 * (1 - S.utilRates[k]) + 0.015 * gauss(), 0.6, 2.2);
    const l = LIFE[S.life.tier];
    S.life.last = l.cost * (0.85 + 0.15 * (S.utilRates.elec + S.utilRates.water + S.utilRates.gas) / 3) * (S.meta && S.meta.trait === 'frugal' ? 0.5 : 1);
    if (S.life.last) spend(S.life.last, 'Living costs');
  },
  actions: {
    lifestyle(a) {
      S.life.tier = a;
      S.energy = Math.min(S.energy, energyMax());
      toast(`${LIFE[a].icon} You moved: ${LIFE[a].name}. Max energy is now ${LIFE[a].energy}⚡.`, 'good');
    },
  },
});
