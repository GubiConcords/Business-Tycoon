'use strict';
/* =====================================================================
   Manufacturing: commodity plants, R&D design studio, certification,
   and product lines for your own chips, engines, cars, phones & aircraft
   ===================================================================== */
const GOODS = {
  oil: { name: 'Crude Oil', icon: '🛢️', base: 40, tier: 0 },
  sand: { name: 'Silica Sand', icon: '⏳', base: 8, tier: 0 },
  ore: { name: 'Iron Ore', icon: '🪨', base: 25, tier: 0 },
  bauxite: { name: 'Bauxite', icon: '🟤', base: 30, tier: 0 },
  copper: { name: 'Copper Ore', icon: '🟠', base: 55, tier: 0 },
  plastic: { name: 'Plastic Pellets', icon: '🧴', base: 110, tier: 1 },
  steel: { name: 'Steel', icon: '🔩', base: 115, tier: 1 },
  alu: { name: 'Aluminum', icon: '🥫', base: 140, tier: 1 },
  wire: { name: 'Copper Wire', icon: '🧵', base: 160, tier: 1 },
  wafer: { name: 'Silicon Wafer', icon: '💿', base: 75, tier: 1 },
  glass: { name: 'Glass', icon: '🪟', base: 45, tier: 1 },
  battery: { name: 'Battery Cells', icon: '🔋', base: 420, tier: 2 },
  cups: { name: 'Plastic Cups', icon: '🥤', base: 160, tier: 2 },
  toys: { name: 'Plastic Toys', icon: '🧸', base: 460, tier: 2 },
  // off-the-shelf components: you can buy these, but not manufacture them
  chip: { name: 'Generic Chip', icon: '🔲', base: 180, tier: 3, part: true, spec: { perf: 4, eff: 1 } },
  cpu: { name: 'Generic Processor', icon: '🧠', base: 700, tier: 3, part: true, spec: { perf: 16, eff: 1.2 } },
  gasengine: { name: 'Stock Gas Engine', icon: '🔧', base: 4800, tier: 3, part: true, spec: { hp: 200, eff: 1, ev: false } },
  emotor: { name: 'Stock Electric Motor', icon: '⚡', base: 6500, tier: 3, part: true, spec: { hp: 250, eff: 2, ev: true } },
  turbofan: { name: 'Licensed Turbofan (30k lbf)', icon: '🌀', base: 1200000, tier: 3, part: true, spec: { thrust: 30, eff: 1, rel: 0.95 } },
  turbofanL: { name: 'Licensed Heavy Turbofan (75k lbf)', icon: '🌀', base: 3500000, tier: 3, part: true, spec: { thrust: 75, eff: 1, rel: 0.95 } },
};
const RECIPES = [
  { out: 'cups', name: 'Cup Workshop', cost: 8000, rate: 6, opex: 60, inputs: { plastic: 1 } },
  { out: 'plastic', name: 'Plastics Refinery', cost: 50000, rate: 50, opex: 200, inputs: { oil: 2 } },
  { out: 'steel', name: 'Steel Mill', cost: 50000, rate: 40, opex: 240, inputs: { ore: 3 } },
  { out: 'alu', name: 'Aluminum Smelter', cost: 55000, rate: 30, opex: 220, inputs: { bauxite: 3 } },
  { out: 'wire', name: 'Wire Plant', cost: 45000, rate: 25, opex: 170, inputs: { copper: 2 } },
  { out: 'wafer', name: 'Wafer Foundry', cost: 70000, rate: 40, opex: 260, inputs: { sand: 5 } },
  { out: 'glass', name: 'Glass Works', cost: 30000, rate: 40, opex: 170, inputs: { sand: 3 } },
  { out: 'battery', name: 'Battery Plant', cost: 90000, rate: 25, opex: 340, inputs: { copper: 1, alu: 1, plastic: 1 } },
  { out: 'toys', name: 'Toy Factory', cost: 40000, rate: 12, opex: 200, inputs: { plastic: 3 } },
];
const RCP = Object.fromEntries(RECIPES.map((r) => [r.out, r]));
// electricity & water used per unit made (before utility price swings)
const PLANT_UTIL = {
  cups: [0.8, 0.1], plastic: [1.5, 0.5], steel: [3, 1], alu: [6, 0.5], wire: [2, 0.2],
  wafer: [2.5, 2], glass: [2, 0.3], battery: [3, 0.5], toys: [1.5, 0.2],
};
// product lines: share of each unit's value spent on power & water, and the permit needed to open
const LINE_UTIL = { chip: 0.03, carEngine: 0.008, jetEngine: 0.004, car: 0.006, phone: 0.008, aircraft: 0.003 };
const LINE_PERMIT = {
  chip: ['Cleanroom & hazardous materials permit', 50000], carEngine: ['Industrial emissions permit', 40000],
  jetEngine: ['FAA production certificate (engines)', 2000000], car: ['Vehicle manufacturer license', 300000],
  phone: ['Electronics manufacturing permit', 30000], aircraft: ['FAA production certificate (aircraft)', 5000000],
};
const facSiteRent = (cost) => cost * 0.0015;
const SPREAD = 0.05;
const MARKET_EVENTS = [
  { goods: ['oil', 'plastic'], d: 0.3, text: '🛢️ Oil supply shock! Crude and plastic prices spike.' },
  { goods: ['oil', 'plastic'], d: -0.25, text: '🛢️ Oil glut: crude prices collapse.' },
  { goods: ['chip', 'cpu', 'wafer'], d: 0.3, text: '🔲 Global chip shortage! Semiconductor prices soar.' },
  { goods: ['steel', 'ore'], d: 0.2, text: '🔩 New steel tariffs push metal prices up.' },
  { goods: ['alu', 'bauxite'], d: 0.2, text: '🥫 Aluminum smelter strikes send prices up.' },
  { goods: ['toys', 'cups'], d: 0.25, text: '🧸 Holiday shopping frenzy! Consumer goods prices jump.' },
  { goods: ['battery', 'copper'], d: 0.2, text: '🔋 EV boom drives up battery prices.' },
];
const DCAT_EVENTS = [
  ['chip', 0.25, '🔲 AI craze: chip buyers are paying record prices!'], ['chip', -0.2, '🔲 Chip glut hits semiconductor prices.'],
  ['car', 0.2, '🚙 Car sales boom on cheap financing.'], ['car', -0.2, '🚙 Car demand slumps as fuel prices spike.'],
  ['phone', -0.2, '📱 Smartphone market saturated. Phone prices slump.'], ['phone', 0.2, '📱 Everyone wants a new phone this season!'],
  ['aircraft', 0.2, '✈️ Airlines place record aircraft orders.'], ['aircraft', -0.15, '✈️ Travel downturn: airlines delay aircraft orders.'],
  ['jetEngine', 0.2, '🌀 Engine shortage grounds fleets. Turbine prices up.'], ['carEngine', 0.15, '🔧 Engine supply crunch lifts prices.'],
];

/* ---------------------------- Design categories ---------------------------- */
const pick2 = (o, k) => o[k];
const DCATS = {
  chip: {
    name: 'Chips', icon: '🔲', factory: 'Chip Fab', facCost: 250000, rate: 40, opex: 700, K: 600000, order: 1,
    params: [
      ['node', 'Process node', [['1', '28nm'], ['2', '14nm'], ['3', '7nm'], ['4', '3nm']]],
      ['focus', 'Design focus', [['eff', '⚡ Efficient'], ['bal', '⚖️ Balanced'], ['super', '🔥 Super chip']]],
      ['cores', 'Cores', [['2', '2'], ['4', '4'], ['8', '8'], ['16', '16']]],
    ],
    compute(p) {
      const n = +p.node, c = +p.cores;
      const perf = c * [1, 1.6, 2.5, 3.8][n - 1] * pick2({ eff: 0.7, bal: 1, super: 1.45 }, p.focus);
      const eff = [1, 1.5, 2.2, 3][n - 1] * pick2({ eff: 1.6, bal: 1, super: 0.6 }, p.focus);
      return {
        stats: { perf, eff }, valueAdd: (perf * 15 + eff * 40) * [1, 1.6, 2.6, 4][n - 1], minLevel: n,
        bom: { wafer: Math.max(1, c / 4) * (1 + 0.5 * (n - 1)) + (p.focus === 'super' ? 1 : 0), wire: 0.1 },
        rateMult: [1, 0.85, 0.7, 0.55][n - 1] * pick2({ eff: 1.1, bal: 1, super: 0.8 }, p.focus),
        opexMult: 1 + 0.6 * (n - 1), rnd: 10000 * n * n * Math.max(1, c / 4), days: Math.round(5 + 5 * n + c / 2),
      };
    },
    autoName: (p) => `${['Spark', 'Volt', 'Nova', 'Quantum'][+p.node - 1]} ${{ eff: 'E', bal: 'S', super: 'X' }[p.focus]}${p.cores}`,
    statLine: (s) => `Performance ${s.perf.toFixed(1)} · Efficiency ${s.eff.toFixed(2)}`,
  },
  carEngine: {
    name: 'Car Engines', icon: '🔧', factory: 'Engine Plant', facCost: 400000, rate: 6, opex: 2000, K: 400000, order: 2,
    params: [
      ['type', 'Engine type', [['i4', 'Inline-4'], ['v6', 'V6'], ['v8', 'V8'], ['ev', '⚡ Electric motor']]],
      ['tune', 'Tuning', [['eco', 'Economy'], ['std', 'Standard'], ['perf', 'Performance']]],
      ['chip', 'Control chip (ECU)', 'chips'],
    ],
    compute(p) {
      const t = { i4: [150, 1.2, 4, 2, 1, 1], v6: [280, 1, 6, 3, 1.5, 0.85], v8: [450, 0.7, 9, 4, 2, 0.7], ev: [300, 2, 1, 3, 2.5, 0.9] }[p.type];
      const u = { eco: [0.85, 1.25, 1], std: [1, 1, 1], perf: [1.3, 0.8, 1.4] }[p.tune];
      const cs = refSpec(p.chip);
      const hp = t[0] * u[0] * (1 + (cs.perf - 4) / 100), eff = t[1] * u[1] * (1 + (cs.eff - 1) * 0.15);
      const bom = { steel: t[2], alu: t[3], [p.chip]: 1 };
      if (p.type === 'ev') bom.wire = 4;
      return {
        stats: { hp, eff, ev: p.type === 'ev' }, valueAdd: hp * 8 + eff * 800, bom,
        rateMult: t[5], opexMult: 1, rnd: 150000 * t[4] * u[2], days: Math.round(12 + t[4] * 6),
      };
    },
    autoName: (p) => `${{ i4: 'Torq 2.0', v6: 'Torq V6', v8: 'Thunder V8', ev: 'Ion Drive' }[p.type]}${{ eco: ' Eco', std: '', perf: ' R' }[p.tune]}`,
    statLine: (s) => `${Math.round(s.hp)} hp · efficiency ${s.eff.toFixed(2)}${s.ev ? ' · electric' : ''}`,
  },
  jetEngine: {
    name: 'Jet Engines', icon: '🌀', factory: 'Turbine Works', facCost: 8000000, rate: 1, opex: 25000, K: 30000000, order: 2, cert: 'FAA engine certification',
    params: [
      ['thrust', 'Thrust class', [['15', '15k lbf'], ['30', '30k lbf'], ['60', '60k lbf'], ['100', '100k lbf']]],
      ['arch', 'Architecture', [['turbojet', 'Turbojet'], ['turbofan', 'Turbofan'], ['geared', 'Geared turbofan']]],
      ['chip', 'FADEC chip', 'chips'],
    ],
    compute(p) {
      const th = +p.thrust, a = { turbojet: [0.7, 0.97, 0.6], turbofan: [1, 0.95, 1], geared: [1.35, 0.93, 1.6] }[p.arch];
      const cs = refSpec(p.chip);
      const eff = a[0] * (1 + (cs.eff - 1) * 0.05), rel = Math.min(0.995, a[1] + Math.min(0.04, (cs.perf - 4) * 0.002));
      return {
        stats: { thrust: th, eff, rel }, valueAdd: th * 35000 * eff,
        bom: { alu: th * 6, steel: th * 4, wire: th * 2, [p.chip]: 4 },
        rateMult: 1 / (3 + th / 15), opexMult: th / 30, rnd: th * 150000 * a[2], days: Math.round(20 + th / 2),
        cert: { cost: 1000000 + th * 40000, days: 30, pass: clamp(0.5 + (rel - 0.9) * 8, 0.3, 0.95) },
      };
    },
    autoName: (p) => `${{ turbojet: 'Blaze', turbofan: 'Gale', geared: 'Zephyr' }[p.arch]} ${p.thrust}K`,
    statLine: (s) => `${s.thrust}k lbf · efficiency ${s.eff.toFixed(2)} · reliability ${pct(s.rel)}`,
  },
  car: {
    name: 'Cars', icon: '🚙', factory: 'Car Plant', facCost: 3000000, rate: 8, opex: 15000, K: 3000000, order: 3, cert: 'Safety & emissions certification',
    params: [
      ['body', 'Body style', [['compact', 'Compact'], ['sedan', 'Sedan'], ['suv', 'SUV'], ['pickup', 'Pickup'], ['sports', 'Sports car'], ['luxury', 'Luxury']]],
      ['engine', 'Engine', 'carEngines'],
      ['chip', 'Electronics chip', 'chips'],
      ['trim', 'Trim', [['base', 'Base'], ['premium', 'Premium']]],
    ],
    compute(p) {
      const b = {
        compact: [14000, 8, 3, 6, 1, 120, 1.2], sedan: [22000, 10, 4, 7, 1.2, 180, 1], suv: [30000, 14, 6, 9, 1.5, 250, 0.9],
        pickup: [32000, 16, 6, 8, 1.5, 280, 0.9], sports: [45000, 9, 8, 6, 2, 380, 0.6], luxury: [60000, 12, 8, 8, 2.5, 330, 0.6],
      }[p.body];
      const es = refSpec(p.engine), cs = refSpec(p.chip), prem = p.trim === 'premium';
      const vm = clamp(0.6 + 0.4 * es.hp / b[5], 0.6, 1.3);
      const bom = { steel: b[1], alu: b[2] + (prem ? 2 : 0), plastic: b[3] + (prem ? 3 : 0), glass: 4, [p.engine]: 1, [p.chip]: 2 };
      if (es.ev) bom.battery = 12;
      return {
        stats: { hp: es.hp, eff: es.eff, tech: cs.perf, ev: es.ev, fit: vm },
        valueAdd: b[0] * 0.6 * vm * (prem ? 1.35 : 1) * (1 + (es.eff - 1) * 0.1) * (1 + (cs.perf - 4) * 0.005), bom,
        rateMult: b[6], opexMult: 1, rnd: 400000 * b[4] * (prem ? 1.3 : 1), days: 25,
        cert: { cost: 150000 * b[4], days: 15, pass: prem ? 0.9 : 0.8 },
        warn: vm < 0.85 ? 'Underpowered for this body. Buyers will pay less.' : '',
      };
    },
    autoName: (p) => `${pick(['Aria', 'Bolt', 'Corsa', 'Drift', 'Echo', 'Falcon', 'Nomad', 'Rogue', 'Summit', 'Vista'])} ${{ compact: 'C', sedan: 'S', suv: 'X', pickup: 'T', sports: 'GT', luxury: 'L' }[p.body]}${p.trim === 'premium' ? ' Premium' : ''}`,
    statLine: (s) => `${Math.round(s.hp)} hp${s.ev ? ' electric' : ''} · efficiency ${s.eff.toFixed(2)} · tech ${s.tech.toFixed(0)}`,
  },
  phone: {
    name: 'Phones', icon: '📱', factory: 'Phone Plant', facCost: 450000, rate: 30, opex: 2500, K: 2000000, order: 3, cert: 'FCC radio certification',
    params: [
      ['tier', 'Market tier', [['budget', 'Budget'], ['mid', 'Mid-range'], ['flagship', 'Flagship']]],
      ['camera', 'Camera', [['single', 'Single'], ['dual', 'Dual'], ['triple', 'Triple']]],
      ['chip', 'Processor', 'chips'],
    ],
    compute(p) {
      const t = { budget: [200, 1, 1.2, 1], mid: [300, 1.5, 1, 1], flagship: [700, 2.5, 0.8, 2] }[p.tier];
      const cam = { single: 0, dual: 60, triple: 150 }[p.camera];
      const cs = refSpec(p.chip);
      return {
        stats: { speed: cs.perf, battery: cs.eff, camera: p.camera }, valueAdd: t[0] + cam + t[3] * (cs.perf * 10 + cs.eff * 20),
        bom: { plastic: 1, glass: 1, battery: 0.25, wire: 0.5, [p.chip]: t[3] },
        rateMult: t[2], opexMult: 1, rnd: 120000 * t[1] * (p.camera === 'triple' ? 1.3 : 1), days: 15,
        cert: { cost: 40000, days: 7, pass: 0.95 },
      };
    },
    autoName: (p) => `${pick(['Pulse', 'Orbit', 'Nimbus', 'Photon', 'Echo'])} ${{ budget: 'Lite', mid: '', flagship: 'Pro Max' }[p.tier]}`.trim(),
    statLine: (s) => `Speed ${s.speed.toFixed(1)} · battery ${s.battery.toFixed(2)} · ${s.camera} camera`,
  },
  aircraft: {
    name: 'Aircraft', icon: '✈️', factory: 'Aircraft Hangar', facCost: 10000000, rate: 1, opex: 200000, K: 400000000, order: 4, cert: 'FAA type certificate',
    params: [
      ['seats', 'Capacity', [['50', '50 seats'], ['100', '100'], ['180', '180'], ['250', '250'], ['400', '400'], ['600', '600']]],
      ['range', 'Range', [['short', 'Short-haul'], ['med', 'Medium-haul'], ['long', 'Long-haul']]],
      ['count', 'Engines', [['2', 'Twin-engine'], ['4', 'Four-engine']]],
      ['engine', 'Engine model', 'jetEngines'],
      ['chip', 'Avionics chip', 'chips'],
    ],
    compute(p) {
      const seats = +p.seats, n = +p.count, r = { short: [1, 1], med: [1.3, 1.2], long: [1.7, 1.5] }[p.range];
      const es = refSpec(p.engine), cs = refSpec(p.chip);
      const need = Math.round(seats * 0.25 * r[1]), have = n * es.thrust;
      let eff = es.eff * (n === 2 ? 1.05 : 0.95) * (1 + (cs.eff - 1) * 0.03);
      if (have > need * 2) eff *= 0.75;
      const rel = clamp(es.rel + (n === 4 ? 0.02 : 0) + Math.min(0.02, (cs.perf - 4) * 0.001), 0, 0.995);
      return {
        stats: { seats, range: p.range, eff, rel, thrust: have, need },
        valueAdd: seats * 90000 * r[0] * (0.7 + 0.3 * eff) * (0.5 + rel / 2),
        bom: { alu: seats * 12, steel: seats * 3, plastic: seats * 4, glass: seats, wire: seats * 2, [p.engine]: n, [p.chip]: 10 + Math.round(seats / 20) },
        rateMult: 1 / (10 + seats / 20), opexMult: 0.5 + seats / 360, rnd: seats * 150000 * r[0], days: Math.round(40 + seats / 10),
        cert: { cost: 3000000 + seats * 40000 * r[0], days: Math.round(60 + seats / 10), pass: clamp(0.4 + (rel - 0.9) * 6 + (cs.perf >= 16 ? 0.1 : 0), 0.2, 0.95) },
        error: have < need ? `Underpowered: needs ${need}k lbf of total thrust, but ${n} engines only give ${have}k lbf.` : '',
        warn: have > need * 2 ? 'Engines are far too big for this airframe. Efficiency −25%.' : '',
      };
    },
    autoName: (p) => `${pick(['SkyLiner', 'AeroStar', 'Condor', 'Albatross', 'Jetstream', 'Horizon'])} ${p.seats}${{ short: 'S', med: 'M', long: 'LR' }[p.range]}`,
    statLine: (s) => `${s.seats} seats · ${{ short: 'short', med: 'medium', long: 'long' }[s.range]}-haul · efficiency ${s.eff.toFixed(2)} · reliability ${pct(s.rel)}`,
  },
};
const COMPONENT_LISTS = { chips: ['chip', 'cpu'], carEngines: ['gasengine', 'emotor'], jetEngines: ['turbofan', 'turbofanL'] };
const COMPONENT_CAT = { chips: 'chip', carEngines: 'carEngine', jetEngines: 'jetEngine' };
const DEFAULT_DZ = {
  chip: { node: '1', focus: 'bal', cores: '4' },
  carEngine: { type: 'i4', tune: 'std', chip: 'chip' },
  jetEngine: { thrust: '30', arch: 'turbofan', chip: 'chip' },
  car: { body: 'sedan', engine: 'gasengine', chip: 'chip', trim: 'base' },
  phone: { tier: 'mid', camera: 'dual', chip: 'chip' },
  aircraft: { seats: '180', range: 'med', count: '2', engine: 'turbofan', chip: 'chip' },
};

/* ---------------------------- References & prices ---------------------------- */
const isD = (ref) => String(ref).startsWith('d:');
const dById = (id) => S.designs.find((d) => d.id === +id);
const refD = (ref) => dById(String(ref).slice(2));
const refName = (ref) => (isD(ref) ? (refD(ref) || { name: 'Deleted design' }).name : GOODS[ref].name);
const refIcon = (ref) => (isD(ref) ? (refD(ref) ? DCATS[refD(ref).cat].icon : '❔') : GOODS[ref].icon);
const refBase = (ref) => (isD(ref) ? (refD(ref) || { price: 0 }).price : GOODS[ref].base);
const refSpec = (ref) => (isD(ref) ? refD(ref).stats : GOODS[ref].spec);
const stockOf = (ref) => (isD(ref) ? (refD(ref) || { stock: 0 }).stock : S.goods[ref].stock);
function addStock(ref, q) { if (isD(ref)) refD(ref).stock += q; else S.goods[ref].stock += q; }
function componentOptions(list) {
  const own = S.designs.filter((d) => d.cat === COMPONENT_CAT[list] && d.status === 'approved').map((d) => 'd:' + d.id);
  return [...COMPONENT_LISTS[list], ...own];
}

const gPrice = (g) => GOODS[g].base * S.goods[g].idx;
const buyPrice = (g) => gPrice(g) * (1 + SPREAD);
const sellPrice = (g) => gPrice(g) * (1 - SPREAD);
const fmtU = (q) => (q % 1 ? q.toFixed(2) : fmtInt(q));
function tradeGood(g, qty) {
  const st = S.goods[g];
  if (qty > 0) {
    const cost = qty * buyPrice(g);
    if (!canAfford(cost)) return false;
    spend(cost, 'Factories');
    st.stock += qty;
  } else {
    const q = Math.min(-qty, st.stock);
    earn(q * sellPrice(g), 'Factories');
    st.stock -= q;
  }
  return true;
}

// designed products: the more of one design you sell recently, the lower its price
const dSat = (d, r = d.recent) => 1 / (1 + r * d.price / DCATS[d.cat].K);
const dSellPrice = (d) => d.price * S.dmarket[d.cat] * (1 - SPREAD) * dSat(d);
function sellDesign(d, q) {
  q = Math.min(q, d.stock);
  if (q <= 0) return 0;
  const a = d.price / DCATS[d.cat].K;
  const rev = S.dmarket[d.cat] * (1 - SPREAD) * DCATS[d.cat].K * Math.log((1 + a * (d.recent + q)) / (1 + a * d.recent));
  d.recent += q; d.stock -= q; d.sold += q; d.revenue += rev;
  earn(rev, 'Factories');
  return rev;
}

/* ---------------------------- Designs ---------------------------- */
function evalDesign(cat, p) {
  const r = DCATS[cat].compute(p);
  r.bomBase = Object.entries(r.bom).reduce((s, [ref, q]) => s + q * refBase(ref), 0);
  r.price = r.bomBase * 1.1 + r.valueAdd;
  r.unitCost = Object.entries(r.bom).reduce((s, [ref, q]) => s + q * (isD(ref) ? refBase(ref) * 0.7 : buyPrice(ref)), 0);
  for (const k in r.bom) if (!r.bom[k]) delete r.bom[k];
  return r;
}
function dzParams(cat) {
  const p = UI.dz[cat];
  for (const [key, , opts] of DCATS[cat].params) {
    if (typeof opts === 'string' && !componentOptions(opts).includes(p[key])) p[key] = COMPONENT_LISTS[opts][0];
  }
  return p;
}
const designUsedBy = (d) => [
  ...S.designs.filter((x) => x !== d && Object.keys(x.bom).includes('d:' + d.id)).map((x) => x.name),
  ...S.factories.filter((f) => f.designId === d.id).map(() => DCATS[d.cat].factory),
];

/* ---------------------------- Factories ---------------------------- */
const facById = (id) => S.factories.find((f) => f.id === +id);
const facDef = (f) => (f.kind === 'line' ? { name: DCATS[f.cat].factory, cost: DCATS[f.cat].facCost } : RCP[f.good]);
const facDesign = (f) => (f.kind === 'line' ? dById(f.designId) : null);
function facRate(f) {
  const lvl = 1 + 0.5 * (f.level - 1);
  if (f.kind !== 'line') return RCP[f.good].rate * lvl;
  const d = facDesign(f);
  return d ? DCATS[f.cat].rate * d.rateMult * lvl : 0;
}
function facOpex(f) {
  const lvl = 1 + 0.4 * (f.level - 1), cut = f.safety === 'cut' ? 0.7 : 1;
  if (f.kind !== 'line') return RCP[f.good].opex * lvl * cut;
  const d = facDesign(f);
  return DCATS[f.cat].opex * (d ? d.opexMult : 0.3) * lvl * cut;
}
const facUpgradeCost = (f) => facDef(f).cost * 0.6 * f.level;
function facEquipment(f) {
  let v = facDef(f).cost;
  for (let l = 1; l < f.level; l++) v += facDef(f).cost * 0.6 * l;
  return v;
}
const facValue = (f) => facEquipment(f) * 0.5 + siteValue(f.site);
// load: 1 = running, lower when paused/idle; made: units produced today
function facBills(f, load, made) {
  const o = facOpex(f) / (f.safety === 'cut' ? 0.7 : 1);
  const use = { elec: 0, water: 0 };
  if (made) {
    if (f.kind === 'line') {
      const d = facDesign(f), v = made * d.price * LINE_UTIL[f.cat];
      use.elec = v * 0.75; use.water = v * 0.25;
    } else {
      use.elec = made * PLANT_UTIL[f.good][0]; use.water = made * PLANT_UTIL[f.good][1];
    }
  }
  return makeBills(f.site, { elec: o * 0.04 * load, water: o * 0.01 * load, net: 5 + o * 0.005, waste: o * 0.02 * load }, use, f.insured, facEquipment(f));
}
function chargeFacBills(f, load, made) {
  f.bills = facBills(f, load, made);
  payBills(f.bills);
}
const facBom = (f) => (f.kind === 'line' ? (facDesign(f) || { bom: {} }).bom : RCP[f.good].inputs);
const facOut = (f) => (f.kind === 'line' ? 'd:' + f.designId : f.good);
const facOrder = (f) => (f.kind === 'line' ? 10 + DCATS[f.cat].order : GOODS[f.good].tier);
function inputCost(r) { return Object.entries(r.inputs).reduce((s, [g, q]) => s + q * buyPrice(g), 0); }
function estMargin(r) { return (sellPrice(r.out) - inputCost(r)) * r.rate - r.opex; }
function dailyNeeds() {
  const need = {};
  for (const f of S.factories) {
    if (f.paused || f.retool > 0 || (f.kind === 'line' && !facDesign(f))) continue;
    const n = Math.ceil(facRate(f));
    for (const [ref, q] of Object.entries(facBom(f))) need[ref] = (need[ref] || 0) + q * n;
  }
  return need;
}
function produce(f) {
  const bom = facBom(f), out = facOut(f);
  const target = facRate(f) + f.progress;
  const units = Math.floor(target);
  f.progress = target - units;
  let made = 0, starved = '';
  for (let i = 0; i < units && !starved; i++) {
    for (const [ref, q] of Object.entries(bom)) {
      const missing = q - stockOf(ref);
      if (missing > 1e-9 && (isD(ref) || !f.autoBuy || !tradeGood(ref, missing))) {
        starved = isD(ref) ? `${refName(ref)} (make more in your own plant)` : GOODS[ref].name + (f.autoBuy ? ' (not enough cash)' : '');
        break;
      }
    }
    if (starved) break;
    for (const [ref, q] of Object.entries(bom)) addStock(ref, -q);
    addStock(out, 1);
    made++;
  }
  if (starved) { f.progress = 0; f.last.note = `Out of ${starved}`; }
  return made;
}

registerModule({
  id: 'factories',
  init(s) {
    s.factories = [];
    s.designs = [];
    s.dmarket = Object.fromEntries(Object.keys(DCATS).map((c) => [c, 1]));
    s.goods = {};
    for (const g in GOODS) {
      let idx = 1;
      const hist = [];
      for (let i = 0; i < 60; i++) { idx = clamp(idx + 0.08 * (1 - idx) + 0.02 * gauss(), 0.4, 2.5); hist.push(GOODS[g].base * idx); }
      s.goods[g] = { idx, stock: 0, hist };
    }
  },
  migrate(s) {
    // saves from before the design system: refund plants for products that are now designed
    for (const g in s.goods) if (!GOODS[g]) delete s.goods[g];
    const OLD = { chip: 120000, board: 180000, cpu: 250000, phone: 450000, car: 1800000, engine: 900000, avionics: 750000, airliner: 4000000 };
    s.factories = s.factories.filter((f) => {
      if (!f.kind) f.kind = 'fixed';
      if (!f.site) f.site = { own: false, rent: facSiteRent(facDef(f) ? facDef(f).cost : 0), price: facSiteRent(facDef(f) ? facDef(f).cost : 0) * 600, deposit: 0 };
      if (f.insured === undefined) f.insured = true;
      if (f.kind === 'line' || RCP[f.good]) return true;
      const refund = (OLD[f.good] || 100000) * (1 + 0.6 * (f.level - 1));
      s.cash += refund;
      s.log.unshift({ d: s.day, msg: `🏭 Manufacturing was overhauled: your old ${f.good} plant was closed and refunded ${money(refund)}. Design your own products in the Design Studio!`, type: 'good' });
      return false;
    });
  },
  assets(a) {
    a.factories = S.factories.reduce((t, f) => t + facValue(f), 0);
    a.inventory = Object.keys(GOODS).reduce((t, g) => t + S.goods[g].stock * sellPrice(g), 0)
      + S.designs.reduce((t, d) => t + d.stock * dSellPrice(d) * 0.9, 0);
  },
  daily() {
    if (chance(0.06)) {
      const e = pick(MARKET_EVENTS);
      for (const g of e.goods) S.goods[g].idx = clamp(S.goods[g].idx + e.d, 0.4, 2.5);
      log(e.text, e.d > 0 ? 'good' : 'warn');
    }
    if (chance(0.05)) {
      const [c, dlt, text] = pick(DCAT_EVENTS);
      S.dmarket[c] = clamp(S.dmarket[c] + dlt, 0.5, 1.8);
      log(text, dlt > 0 ? 'good' : 'warn');
    }
    for (const g in GOODS) {
      const st = S.goods[g], vol = GOODS[g].tier === 0 ? 0.025 : 0.015;
      st.idx = clamp(st.idx + 0.06 * (1 - st.idx) + vol * gauss(), 0.4, 2.5);
      st.hist.push(gPrice(g));
      if (st.hist.length > 90) st.hist.shift();
    }
    for (const c in S.dmarket) S.dmarket[c] = clamp(S.dmarket[c] + 0.05 * (1 - S.dmarket[c]) + 0.012 * gauss(), 0.5, 1.8);

    // R&D and certification progress
    for (const d of S.designs) {
      d.recent *= 0.7;
      if (d.status !== 'rnd' && d.status !== 'certifying') continue;
      if (--d.left > 0) continue;
      if (d.status === 'rnd') {
        d.status = d.cert ? 'uncertified' : 'approved';
        stat('designs');
        log(`🧪 R&D complete: ${esc(d.name)} ${d.cert ? `is ready to apply for ${DCATS[d.cat].cert}.` : 'is ready for production!'}`, 'good');
        toast(`🧪 ${esc(d.name)} design complete!`, 'good');
      } else if (chance(d.cert.pass)) {
        d.status = 'approved';
        if (d.cat === 'aircraft') stat('faa');
        log(`✅ ${esc(d.name)} received its ${DCATS[d.cat].cert}! Production can begin.`, 'good');
        showModal({ title: '✅ Certified!', cls: 'good', body: `<p><b>${esc(d.name)}</b> passed and received its <b>${DCATS[d.cat].cert}</b>. Assign it to a ${DCATS[d.cat].factory} to start production.</p>` });
      } else {
        d.status = 'uncertified';
        log(`❌ ${esc(d.name)} FAILED ${DCATS[d.cat].cert}. You'll have to pay to apply again.`, 'bad');
        showModal({ title: '❌ Certification failed', cls: 'danger', body: `<p>Regulators rejected <b>${esc(d.name)}</b> for ${DCATS[d.cat].cert}. The fee is gone. You can re-apply (${pct(d.cert.pass, 0)} pass chance), or design something more reliable.</p>` });
      }
    }

    // production, upstream first so outputs feed downstream plants the same day
    const sorted = S.factories.slice().sort((a, b) => facOrder(a) - facOrder(b));
    for (const f of sorted) {
      const def = facDef(f);
      f.last = { made: 0, note: '' };
      if (f.paused) { spend(facOpex(f) * 0.15, 'Factories'); chargeFacBills(f, 0.2, 0); f.last.note = 'Paused (maintenance, rent and standby utilities only)'; continue; }
      if (f.closed > 0) { f.closed--; chargeFacBills(f, 0.3, 0); f.last.note = 'Shut down after accident'; continue; }
      if (f.retool > 0) { f.retool--; spend(facOpex(f) * 0.3, 'Factories'); chargeFacBills(f, 0.5, 0); f.last.note = `Retooling (${f.retool} more day${f.retool === 1 ? '' : 's'})`; continue; }
      const d = facDesign(f);
      if (f.kind === 'line' && (!d || d.status !== 'approved')) { spend(facOpex(f) * 0.15, 'Factories'); chargeFacBills(f, 0.2, 0); f.last.note = 'Idle: assign an approved design'; continue; }
      if (d && f.cat === 'chip' && f.level < d.minLevel) { spend(facOpex(f) * 0.15, 'Factories'); chargeFacBills(f, 0.2, 0); f.last.note = `Idle: ${esc(d.name)} needs fab level ${d.minLevel}`; continue; }
      const opex = facOpex(f);
      if (!canAfford(opex)) { chargeFacBills(f, 0.3, 0); f.last.note = 'Could not pay workers. Production halted!'; log(`⚠️ ${def.name}: couldn't pay ${money(opex)} in operating costs.`, 'bad'); continue; }
      spend(opex, 'Factories');
      const made = produce(f);
      chargeFacBills(f, 1, made);
      f.last.made = made;
      if (d) { d.made += made; stat('made_' + d.cat, made); }
      if (made && f.cat === 'aircraft') { log(`✈️ Your hangar rolled out ${made} ${esc(d.name)} aircraft!`, 'good'); toast(`✈️ New ${esc(d.name)} rolled out!`, 'good'); }

      if (f.safety === 'cut') {
        addRisk(0.25);
        if (chance(0.007)) {
          const fine = Math.round(def.cost * 0.06), repair = Math.round(def.cost * 0.1 * (f.insured ? 0.1 : 1));
          spend(fine, 'Fines');
          spend(repair, 'Factories');
          f.closed = 3;
          addRisk(10);
          log(`🔥 Workplace accident at your ${def.name}! Regulators fined you ${money(fine)}, repairs cost ${money(repair)}, and it's closed for 3 days.`, 'bad');
          showModal({ title: '🔥 Factory accident', cls: 'danger', body: `<p>Cutting corners on safety caught up with you at the <b>${def.name}</b>.</p><p>Fine: <b>${money(fine)}</b>. Repairs: <b>${money(repair)}</b> ${f.insured ? '(after insurance)' : '(uninsured!)'}. The plant is closed for 3 days.</p>` });
        }
      }
    }
    // auto-sell output, keeping what other plants need tomorrow
    const need = dailyNeeds();
    for (const f of S.factories) {
      if (!f.autoSell) continue;
      const out = facOut(f);
      if (isD(out) && !refD(out)) continue;
      const extra = Math.floor(stockOf(out) - (need[out] || 0));
      if (extra <= 0) continue;
      if (isD(out)) sellDesign(refD(out), extra); else tradeGood(out, -extra);
    }
  },
  tabs: [{ id: 'factories', name: 'Factories & R&D', icon: '🏭', render: renderFactories }],
  actions: {
    facView(a) { UI.facView = a; },
    buildFactory(a) {
      const r = RCP[a];
      openBusiness({
        title: r.name, icon: GOODS[a].icon, equipment: r.cost, permit: { name: 'Industrial zoning permit', cost: Math.max(1000, r.cost * 0.05) },
        rent: facSiteRent(r.cost), price: facSiteRent(r.cost) * 600,
        done(site) {
          S.factories.push({ id: uid(), kind: 'fixed', good: a, level: 1, progress: 0, autoBuy: true, autoSell: true, paused: false, safety: 'full', closed: 0, retool: 0, last: null, site, insured: true, bills: null });
          log(`🏭 You opened a ${r.name} on ${site.own ? 'land you bought' : 'a rented industrial lot'}.`, 'good');
          stat('factoriesBuilt');
        },
      });
    },
    buildLine(cat) {
      const c = DCATS[cat], pm = LINE_PERMIT[cat];
      openBusiness({
        title: c.factory, icon: c.icon, equipment: c.facCost, permit: { name: pm[0], cost: pm[1] },
        rent: facSiteRent(c.facCost), price: facSiteRent(c.facCost) * 600,
        done(site) {
          S.factories.push({ id: uid(), kind: 'line', cat, designId: null, level: 1, progress: 0, autoBuy: true, autoSell: true, paused: false, safety: 'full', closed: 0, retool: 0, last: null, site, insured: true, bills: null });
          log(`🏭 You opened a ${c.factory} on ${site.own ? 'land you bought' : 'a rented industrial site'}.`, 'good');
          stat('factoriesBuilt');
          UI.facView = 'plants';
        },
      });
    },
    assignDesign(a, did) {
      const f = facById(a), d = dById(did);
      if (!d || f.designId === d.id) return;
      if (f.designId) {
        const cost = Math.round(DCATS[f.cat].facCost * 0.1);
        if (!pay(cost, 'Factories', 'retooling')) return;
        f.retool = 3;
        toast(`Retooling for ${esc(d.name)}: 3 days, ${money(cost)}.`, 'warn');
      }
      f.designId = d.id; f.progress = 0;
    },
    facToggle(a, key) { const f = facById(a); f[key] = !f[key]; },
    facSafety(a) { const f = facById(a); f.safety = f.safety === 'full' ? 'cut' : 'full'; },
    facUpgrade(a) {
      const f = facById(a);
      if (f.level >= 5 || !pay(facUpgradeCost(f), 'Investments', 'the upgrade')) return;
      f.level++;
      toast(`${facDef(f).name} upgraded to level ${f.level}.`, 'good');
    },
    facBuySite(a) { buySite(facById(a).site); },
    facInsure(a) { const f = facById(a); f.insured = !f.insured; },
    facSell(a) {
      const f = facById(a), v = facValue(f), name = facDef(f).name;
      showModal({
        title: `Sell ${name}?`, body: `<p>You'll get <b>${money(v)}</b> for the equipment${f.site.own ? ' and the land' : ' plus your rent deposit back'}.</p>`,
        buttons: [{ label: `Sell for ${money(v)}`, cls: 'danger', fn: () => { earn(v, 'Investments'); S.factories.splice(S.factories.indexOf(f), 1); log(`💼 Sold your ${name} for ${money(v)}.`); } }, { label: 'Cancel' }],
      });
    },
    goodsQty(a) { UI.goodsQty = a === 'all' ? a : +a; },
    buyGood(g) {
      const q = UI.goodsQty === 'all' ? Math.floor(S.cash / buyPrice(g)) : UI.goodsQty;
      if (q <= 0 || !tradeGood(g, q)) return toast('Not enough cash.', 'bad');
      toast(`Bought ${fmtInt(q)} ${GOODS[g].name}`, 'good');
    },
    sellGood(g) {
      const st = S.goods[g];
      const q = UI.goodsQty === 'all' ? st.stock : Math.min(st.stock, UI.goodsQty);
      if (q <= 0) return toast('Nothing to sell.', 'warn');
      toast(`Sold ${fmtU(q)} ${GOODS[g].name} for ${money(q * sellPrice(g))}`, 'good');
      tradeGood(g, -q);
    },
    // design studio
    dzCat(a) { UI.dzCat = a; },
    dzSet(key, val) { UI.dz[UI.dzCat][key] = val; },
    startDesign() {
      const cat = UI.dzCat, p = { ...dzParams(cat) }, r = evalDesign(cat, p);
      if (r.error) return toast(r.error, 'bad');
      const name = (prompt(`Name your new ${DCATS[cat].name.replace(/s$/, '').toLowerCase()} design:`, DCATS[cat].autoName(p)) || '').trim().slice(0, 40);
      if (!name) return;
      if (!pay(r.rnd, 'R&D', 'R&D')) return;
      S.designs.push({
        id: uid(), cat, name, params: p, stats: r.stats, bom: r.bom, price: r.price, rateMult: r.rateMult, opexMult: r.opexMult,
        minLevel: r.minLevel || 1, cert: r.cert || null, status: 'rnd', left: r.days, total: r.days, stock: 0, recent: 0, made: 0, sold: 0, revenue: 0,
      });
      log(`🧪 R&D started on ${esc(name)} (${money(r.rnd)}, ${r.days} days).`);
      toast(`R&D started on ${esc(name)}`, 'good');
      UI.facView = 'designs';
    },
    applyCert(a) {
      const d = dById(a);
      if (!d || d.status !== 'uncertified' || !pay(d.cert.cost, 'R&D', DCATS[d.cat].cert)) return;
      d.status = 'certifying'; d.left = d.total = d.cert.days;
      log(`📋 Applied for ${DCATS[d.cat].cert} for ${esc(d.name)} (${money(d.cert.cost)}, ${d.cert.days} days).`);
    },
    sellDesignStock(a) {
      const d = dById(a);
      const q = Math.floor(d.stock - (dailyNeeds()['d:' + d.id] || 0));
      if (q <= 0) return toast('Nothing spare to sell. Your other plants need it.', 'warn');
      toast(`Sold ${fmtInt(q)} × ${esc(d.name)} for ${money(sellDesign(d, q))}`, 'good');
    },
    renameDesign(a) {
      const d = dById(a), n = prompt('New name:', d.name);
      if (n && n.trim()) d.name = n.trim().slice(0, 40);
    },
    deleteDesign(a) {
      const d = dById(a), used = designUsedBy(d);
      if (used.length) return toast(`In use by: ${used.join(', ')}`, 'warn');
      showModal({
        title: `Scrap ${esc(d.name)}?`, body: `<p>The design and the R&D spent on it are gone for good.${d.stock ? ` ${fmtInt(d.stock)} units in stock will be sold first.` : ''}</p>`,
        buttons: [{ label: 'Scrap design', cls: 'danger', fn: () => { if (d.stock) sellDesign(d, d.stock); S.designs.splice(S.designs.indexOf(d), 1); } }, { label: 'Cancel' }],
      });
    },
  },
});
UI.goodsQty = 10; UI.facView = 'plants'; UI.dzCat = 'chip';
UI.dz = JSON.parse(JSON.stringify(DEFAULT_DZ));

/* ---------------------------- Rendering ---------------------------- */
const recipeLine = (bom, out) => Object.entries(bom).map(([ref, q]) => `${fmtU(q)}× ${refIcon(ref)}${isD(ref) ? ' ' + esc(refName(ref)) : ''}`).join(' + ') + (out ? ` → ${out}` : '');
const rateText = (r) => (r >= 1 ? +r.toFixed(1) + '/day' : r > 0 ? '1 every ' + (1 / r).toFixed(1) + ' days' : '—');
const STATUS = {
  rnd: ['R&D', 'warn'], uncertified: ['Needs certification', 'bad'], certifying: ['Certifying', 'warn'], approved: ['Approved', 'good'],
};

function renderFactories() {
  const view = seg([['plants', '🏭 My factories'], ['build', '🏗️ Build'], ['studio', '🧪 Design Studio'], ['designs', '📐 My designs'], ['market', '📦 Market']], UI.facView, 'facView');
  const body = { plants: renderPlants, build: renderBuild, studio: renderStudio, designs: renderDesigns, market: renderGoodsMarket }[UI.facView]();
  return `<div class="row between section"><h2>🏭 Manufacturing &amp; R&amp;D</h2><div style="overflow-x:auto;max-width:100%">${view}</div></div>
  <div class="banner info small">Make commodities (plastic, steel, wafers, batteries…), then <b>design your own products</b>: chips → engines → cars, phones and aircraft. New designs need <b>R&amp;D</b>, most need <b>certification</b> (an FAA type certificate for aircraft), and each needs a dedicated product line.</div>
  ${body}`;
}

function renderPlants() {
  if (!S.factories.length) return '<div class="banner info">No factories yet. A <b>Cup Workshop</b> ($8K) is a cheap start. Head to <b>Build</b>.</div>';
  return `<div class="grid g2">${S.factories.map((f) => {
    const def = facDef(f), L = f.last, d = facDesign(f);
    let product;
    if (f.kind === 'line') {
      const approved = S.designs.filter((x) => x.cat === f.cat && x.status === 'approved');
      product = `<div class="small" style="margin:8px 0">Product: <b>${d ? esc(d.name) : '— none —'}</b>${d ? ` · sells for ~${money(dSellPrice(d))} · in stock ${fmtInt(d.stock)}` : ''}</div>
        ${d ? `<div class="small muted">${recipeLine(d.bom)}</div>` : ''}
        ${d && f.cat === 'chip' && f.level < d.minLevel ? `<div class="small bad">This node needs fab level ${d.minLevel}. Upgrade the fab!</div>` : ''}
        <div class="row" style="margin-top:6px"><span class="small muted">${f.designId ? `Retool (${money(DCATS[f.cat].facCost * 0.1)}, 3 days)` : 'Assign design'}:</span>
        ${approved.length ? `<div class="seg">${approved.map((x) => btn(esc(x.name), 'assignDesign', f.id, { b: x.id, cls: 'sm ' + (x.id === f.designId ? 'on' : '') })).join('')}</div>` : `<span class="small warn">No approved ${DCATS[f.cat].name.toLowerCase()} yet. Create one in the Design Studio.</span>`}</div>`;
    } else {
      product = `<div class="small" style="margin:8px 0">${recipeLine(RCP[f.good].inputs, GOODS[f.good].icon)}</div>
        <div class="small">In stock: <b>${fmtU(S.goods[f.good].stock)}</b> ${GOODS[f.good].name} · sells for ${money(sellPrice(f.good))}</div>`;
    }
    const pill = f.closed ? `<span class="pill bad">Closed ${f.closed}d</span>` : f.retool ? `<span class="pill warn">Retooling ${f.retool}d</span>` : f.paused ? '<span class="pill warn">Paused</span>' : '<span class="pill good">Running</span>';
    return `<div class="card ${f.safety === 'cut' ? 'danger' : ''}">
      <div class="row between"><div class="row"><span class="big-ico">${f.kind === 'line' ? DCATS[f.cat].icon : GOODS[f.good].icon}</span><div><b>${def.name}</b>
        <div class="small muted">Level ${f.level} · ${rateText(facRate(f))} · ${money(facOpex(f))}/day</div></div></div>${pill}</div>
      ${product}
      ${L ? `<div class="small ${L.note ? 'warn' : 'muted'}">Yesterday: made ${L.made}${L.note ? ' · ' + L.note : ''}</div>` : ''}
      <div class="small" style="margin-top:6px">${siteLabel(f.site)}</div>${billsHtml(f.bills)}
      <div class="row" style="margin-top:10px">
        ${btn(`Auto-buy inputs: ${f.autoBuy ? 'ON' : 'OFF'}`, 'facToggle', f.id, { b: 'autoBuy', cls: 'sm ' + (f.autoBuy ? 'on' : '') })}
        ${btn(`Auto-sell: ${f.autoSell ? 'ON' : 'OFF'}`, 'facToggle', f.id, { b: 'autoSell', cls: 'sm ' + (f.autoSell ? 'on' : '') })}
        ${btn(f.paused ? '▶ Resume' : '⏸ Pause', 'facToggle', f.id, { b: 'paused', cls: 'sm' })}
        ${btn(f.safety === 'cut' ? '⚠️ Safety: cutting corners' : '🦺 Safety: full', 'facSafety', f.id, { cls: 'sm', title: 'Cutting corners saves 30% on costs but risks accidents, fines and audits' })}
      </div>
      <div class="row" style="margin-top:8px">
        ${f.level < 5 ? btn(`⬆ Upgrade (${money(facUpgradeCost(f))})`, 'facUpgrade', f.id, { cls: 'sm', disabled: !canAfford(facUpgradeCost(f)) }) : '<span class="pill">Max level</span>'}
        ${f.site.own ? '' : btn(`🔑 Buy the land (${money(sitePrice(f.site))})`, 'facBuySite', f.id, { cls: 'sm', disabled: !canAfford(sitePrice(f.site)) })}
        ${btn(f.insured ? '🛡️ Insured' : '⚠️ Uninsured', 'facInsure', f.id, { cls: 'sm ' + (f.insured ? 'on' : ''), title: 'Insurance covers most repair costs after accidents' })}
        ${btn('Sell', 'facSell', f.id, { cls: 'sm' })}</div></div>`;
  }).join('')}</div>`;
}

function renderBuild() {
  const tiers = [...new Set(RECIPES.map((r) => GOODS[r.out].tier))];
  const fixed = tiers.map((t) => `<h4>Commodity plants · tier ${t}</h4><div class="grid g3 section">${RECIPES.filter((r) => GOODS[r.out].tier === t).map((r) => {
    const m = estMargin(r);
    return `<div class="card tight"><div class="row"><span class="big-ico">${GOODS[r.out].icon}</span><div class="grow"><b>${r.name}</b>
      <div class="small muted">Makes ${GOODS[r.out].name} · ${rateText(r.rate)}</div></div></div>
      <div class="small" style="margin:6px 0">${recipeLine(r.inputs, GOODS[r.out].icon)}</div>
      <div class="small muted">Workers ${money(r.opex)}/day · power ${PLANT_UTIL[r.out][0]} & water ${PLANT_UTIL[r.out][1]} per unit · lot rent ${money(rentNow(facSiteRent(r.cost)))}/day</div>
      <div class="small">Est. profit before utilities &amp; rent: <b class="${cls(m)}">${signMoney(m)}/day</b></div>
      <div style="margin-top:8px">${btn(`Open from ${money(r.cost + Math.max(1000, r.cost * 0.05) + facSiteRent(r.cost) * DEPOSIT_DAYS)}`, 'buildFactory', r.out, { cls: 'buy sm', disabled: !canAfford(r.cost + Math.max(1000, r.cost * 0.05) + facSiteRent(r.cost) * DEPOSIT_DAYS) })}</div></div>`;
  }).join('')}</div>`).join('');
  const lines = Object.entries(DCATS).map(([k, c]) => `<div class="card tight"><div class="row"><span class="big-ico">${c.icon}</span><div class="grow"><b>${c.factory}</b>
    <div class="small muted">Builds your own ${c.name.toLowerCase()} designs${c.cert ? ` · products need ${c.cert}` : ''}</div></div></div>
    <div class="small muted" style="margin:6px 0">Equipment ${money(c.facCost)} · 📄 ${LINE_PERMIT[k][0]} ${money(LINE_PERMIT[k][1])} · site rent ${money(rentNow(facSiteRent(c.facCost)))}/day · base operating cost ${money(c.opex)}/day${k === 'chip' ? ' · upgrade the fab to unlock smaller process nodes' : ''}</div>
    ${btn(`Open from ${money(c.facCost + LINE_PERMIT[k][1] + facSiteRent(c.facCost) * DEPOSIT_DAYS)}`, 'buildLine', k, { cls: 'buy sm', disabled: !canAfford(c.facCost + LINE_PERMIT[k][1] + facSiteRent(c.facCost) * DEPOSIT_DAYS) })}</div>`).join('');
  return `<h4>Product lines (for your own designs)</h4><div class="grid g3 section">${lines}</div>${fixed}`;
}

function renderStudio() {
  const cat = UI.dzCat, c = DCATS[cat], p = dzParams(cat), r = evalDesign(cat, p);
  const rows = c.params.map(([key, label, opts]) => {
    const options = typeof opts === 'string' ? componentOptions(opts).map((ref) => [ref, `${refIcon(ref)} ${esc(refName(ref))}${isD(ref) ? ' ⭐' : ` (${money(buyPrice(ref))})`}`]) : opts;
    return `<div class="dz-row"><span class="small muted">${label}</span><div class="seg wrap">${options.map(([v, l]) => btn(l, 'dzSet', key, { b: v, cls: 'sm ' + (String(p[key]) === String(v) ? 'on' : '') })).join('')}</div></div>`;
  }).join('');
  const rate = c.rate * r.rateMult;
  const bomRows = Object.entries(r.bom).map(([ref, q]) => `<tr><td>${refIcon(ref)} ${esc(refName(ref))}${isD(ref) ? ' <span class="pill good">yours</span>' : ''}</td><td class="num">${fmtU(q)}</td><td class="num">${isD(ref) ? '<span class="small muted">own production</span>' : money(q * buyPrice(ref))}</td></tr>`).join('');
  const costTotal = r.rnd + (r.cert ? r.cert.cost : 0);
  return `<div class="section" style="overflow-x:auto">${seg(Object.entries(DCATS).map(([k, x]) => [k, `${x.icon} ${x.name}`]), cat, 'dzCat')}</div>
  <div class="grid g2">
    <div class="card"><h3>${c.icon} New ${c.name.replace(/s$/, '').toLowerCase()} design</h3>${rows}
      ${typeof c.params.find((x) => typeof x[2] === 'string') !== 'undefined' ? '<p class="small muted">⭐ = your own approved designs. Use your own parts or buy off-the-shelf ones.</p>' : ''}</div>
    <div class="card ${r.error ? 'danger' : 'hl'}"><h3>📋 Spec sheet</h3>
      ${r.error ? `<div class="banner bad small">${r.error}</div>` : ''}${r.warn ? `<div class="banner warn small">${r.warn}</div>` : ''}
      <p><b>${c.statLine(r.stats)}</b></p>
      <div class="tbl-wrap"><table><thead><tr><th>Bill of materials (per unit)</th><th class="num">Qty</th><th class="num">Cost</th></tr></thead><tbody>${bomRows}</tbody></table></div>
      <div class="grid g2" style="margin-top:10px;gap:8px">
        <div class="kpi"><div class="lbl">Est. sale price</div><div class="val good">${money(r.price * S.dmarket[cat])}</div><div class="small muted">drops if you flood the market</div></div>
        <div class="kpi"><div class="lbl">Est. material cost</div><div class="val">${money(r.unitCost)}</div></div>
        <div class="kpi"><div class="lbl">Output per ${c.factory} (lvl 1)</div><div class="val">${rateText(rate)}</div></div>
        <div class="kpi"><div class="lbl">Line operating cost</div><div class="val">${money(c.opex * r.opexMult)}/day</div></div>
      </div>
      <div class="banner warn small" style="margin-top:10px">
        🧪 R&amp;D: <b>${money(r.rnd)}</b> · ${r.days} days<br>
        ${r.cert ? `📋 ${c.cert}: <b>${money(r.cert.cost)}</b> · ${r.cert.days} days · ${pct(r.cert.pass, 0)} pass chance<br>` : '📋 No certification needed<br>'}
        🏭 Needs a <b>${c.factory}</b> (${money(c.facCost)} equipment + ${LINE_PERMIT[cat][0]} ${money(LINE_PERMIT[cat][1])} + site)${r.minLevel > 1 ? ` at level ${r.minLevel}+` : ''}<br>
        Total before the first unit ships: <b>${money(costTotal + (S.factories.some((f) => f.cat === cat) ? 0 : c.facCost + LINE_PERMIT[cat][1] + facSiteRent(c.facCost) * DEPOSIT_DAYS))}</b>
      </div>
      <div style="margin-top:10px">${btn(`🧪 Start R&D (${money(r.rnd)})`, 'startDesign', '', { cls: 'primary', disabled: !!r.error || !canAfford(r.rnd) })}</div>
    </div>
  </div>`;
}

function renderDesigns() {
  if (!S.designs.length) return '<div class="banner info">No designs yet. Open the <b>Design Studio</b> to design chips, engines, cars, phones or aircraft.</div>';
  return Object.entries(DCATS).filter(([k]) => S.designs.some((d) => d.cat === k)).map(([k, c]) => `<h4>${c.icon} ${c.name}</h4><div class="grid g2 section">${S.designs.filter((d) => d.cat === k).map((d) => {
    const [label, tone] = STATUS[d.status];
    const lines = S.factories.filter((f) => f.designId === d.id).length;
    return `<div class="card"><div class="row between"><div><b>${esc(d.name)}</b> <button class="btn sm" data-act="renameDesign" data-a="${d.id}" title="Rename">✏️</button>
      <div class="small muted">${c.statLine(d.stats)}</div></div><span class="pill ${tone}">${label}${d.left > 0 && (d.status === 'rnd' || d.status === 'certifying') ? ` ${d.left}d` : ''}</span></div>
      ${d.status === 'rnd' || d.status === 'certifying' ? bar((d.total - d.left) / d.total * 100, 'var(--warn)') : ''}
      <div class="small" style="margin-top:8px">${recipeLine(d.bom)}</div>
      <div class="small" style="margin-top:6px">Price now <b>${money(dSellPrice(d))}</b> (list ${money(d.price * S.dmarket[k])}, market demand ${pct(dSat(d), 0)}) · made ${fmtInt(d.made)} · sold ${fmtInt(d.sold)} for ${money(d.revenue)}</div>
      <div class="small muted">In stock ${fmtInt(d.stock)} · ${lines ? `${lines} production line(s)` : 'not in production'}${d.cat === 'chip' ? ` · needs fab level ${d.minLevel}` : ''}</div>
      <div class="row" style="margin-top:8px">
        ${d.status === 'uncertified' ? btn(`📋 Apply for ${c.cert} (${money(d.cert.cost)}, ${pct(d.cert.pass, 0)} pass)`, 'applyCert', d.id, { cls: 'sm primary', disabled: !canAfford(d.cert.cost) }) : ''}
        ${d.stock >= 1 ? btn('Sell spare stock', 'sellDesignStock', d.id, { cls: 'sm sell' }) : ''}
        ${btn('Scrap design', 'deleteDesign', d.id, { cls: 'sm' })}</div></div>`;
  }).join('')}</div>`).join('');
}

function renderGoodsMarket() {
  const row = (g, d) => {
    const st = S.goods[g], h = st.hist, ch = h.length > 1 ? h[h.length - 1] / h[h.length - 2] - 1 : 0;
    return `<tr><td>${d.icon} <b>${d.name}</b></td>
      <td class="num">${fmtU(st.stock)}</td><td class="num">${money(buyPrice(g))}</td><td class="num">${money(sellPrice(g))}</td>
      <td class="num ${cls(ch)}">${signPct(ch)}</td><td class="num">${money(st.stock * sellPrice(g))}</td>
      <td class="nowrap">${btn('Buy', 'buyGood', g, { cls: 'sm buy' })} ${btn('Sell', 'sellGood', g, { cls: 'sm sell', disabled: st.stock <= 0 })}</td></tr>`;
  };
  const head = '<thead><tr><th>Good</th><th class="num">In stock</th><th class="num">Buy</th><th class="num">Sell</th><th class="num">Today</th><th class="num">Stock value</th><th></th></tr></thead>';
  const entries = Object.entries(GOODS);
  return `<div class="card section"><div class="row between section"><h3>Commodity market</h3><div class="row"><span class="small muted">Units per trade</span>
    ${seg([[1, '1'], [10, '10'], [100, '100'], [1000, '1K'], ['all', 'Max']], UI.goodsQty, 'goodsQty')}</div></div>
    <p class="small muted">You buy at market +${pct(SPREAD, 0)} and sell at market −${pct(SPREAD, 0)}. Make your own inputs to skip the markup.</p>
    <div class="tbl-wrap"><table>${head}<tbody>${entries.filter(([, d]) => !d.part).map(([g, d]) => row(g, d)).join('')}</tbody></table></div></div>
  <div class="card"><h3>Off-the-shelf components</h3><p class="small muted">Buy parts instead of designing your own. Handy while your R&amp;D catches up.</p>
    <div class="tbl-wrap"><table>${head}<tbody>${entries.filter(([, d]) => d.part).map(([g, d]) => row(g, d)).join('')}</tbody></table></div></div>`;
}
