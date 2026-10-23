'use strict';
/* =====================================================================
   Extra Design Studio categories:
   - parts: avionics, radar, armor, rotors (usable in your own aircraft too)
   - military: helicopters, tanks, fighter jets, bombers (defense license)
   - space hardware: rocket engines, rockets, satellites, crew capsules
     (needs a space agency, see space.js)
   ===================================================================== */
Object.assign(GOODS, {
  avionicsStd: { name: 'Standard Avionics Suite', icon: '🎛️', base: 250000, tier: 3, part: true, spec: { tech: 1, rel: 0.96 } },
  radarStd: { name: 'Licensed Radar Set (150 km)', icon: '📡', base: 1200000, tier: 3, part: true, spec: { range: 150, tech: 1 } },
  armorStd: { name: 'Steel Armor Kit', icon: '🛡️', base: 40000, tier: 3, part: true, spec: { prot: 1 } },
  rotorStd: { name: 'Licensed Rotor System', icon: '🚁', base: 400000, tier: 3, part: true, spec: { lift: 1, blades: 4 } },
  rocketEngineStd: { name: 'Licensed Kerolox Rocket Engine', icon: '🔥', base: 6000000, tier: 3, part: true, spec: { thrust: 3, eff: 1, rel: 0.97, reusable: false } },
});
Object.assign(COMPONENT_LISTS, { avionicsList: ['avionicsStd'], radars: ['radarStd'], armors: ['armorStd'], rotors: ['rotorStd'], rocketEngines: ['rocketEngineStd'] });
Object.assign(COMPONENT_CAT, { avionicsList: 'avionics', radars: 'radar', armors: 'armor', rotors: 'rotor', rocketEngines: 'rocketEngine' });

const hasDefenseLicense = () => !!(S.legal && S.legal.licenses.defense);
const hasSpaceAgency = () => !!(S.space && S.space.founded);
const DEFENSE_LOCK = { test: hasDefenseLicense, msg: 'Needs a Defense manufacturing license (get it in the ⚖️ Legal tab).' };
const SPACE_LOCK = { test: hasSpaceAgency, msg: 'Needs your own space agency (found it in the 🚀 Space tab).' };

Object.assign(DCATS, {
  /* ---------------- parts ---------------- */
  avionics: {
    name: 'Avionics', icon: '🎛️', factory: 'Avionics Lab', facCost: 2000000, rate: 0.35, opex: 6000, K: 40000000, order: 2,
    params: [
      ['grade', 'Grade', [['civil', 'Civil'], ['advanced', 'Advanced'], ['military', 'Military-grade']]],
      ['chip', 'Flight computer chip', 'chips'],
    ],
    compute(p) {
      const g = { civil: [1, 0.96, 6, 150000, 1], advanced: [1.5, 0.975, 12, 450000, 1.8], military: [2.2, 0.985, 24, 1200000, 3] }[p.grade];
      const tech = g[0] * (1 + (refSpec(p.chip).perf - 4) / 100);
      return {
        stats: { tech, rel: g[1] }, valueAdd: g[3] * tech, bom: { wire: 20, glass: 4, plastic: 20, [p.chip]: g[2] },
        rateMult: { civil: 1, advanced: 0.45, military: 0.15 }[p.grade], opexMult: g[4] / 1.5, rnd: 1500000 * g[4], days: Math.round(20 + 10 * g[4]),
      };
    },
    autoName: (p) => `Vista ${{ civil: 'C', advanced: 'A', military: 'M' }[p.grade]}-1`,
    statLine: (s) => `Tech ${s.tech.toFixed(2)} · reliability ${pct(s.rel)}`,
  },
  radar: {
    name: 'Radar', icon: '📡', factory: 'Radar Works', facCost: 3000000, rate: 0.2, opex: 8000, K: 60000000, order: 2,
    params: [
      ['range', 'Range', [['short', 'Short (50 km)'], ['medium', 'Medium (150 km)'], ['long', 'Long (400 km)']]],
      ['chip', 'Signal processor', 'chips'],
    ],
    compute(p) {
      const r = { short: [50, 300000, 1, 8], medium: [150, 900000, 1.8, 16], long: [400, 2500000, 3, 32] }[p.range];
      const tech = 1 + (refSpec(p.chip).perf - 4) / 80;
      return {
        stats: { range: r[0], tech }, valueAdd: r[1] * tech, bom: { alu: 20 * r[2], wire: 30 * r[2], [p.chip]: r[3] },
        rateMult: 1 / r[2], opexMult: r[2] / 1.8, rnd: 2000000 * r[2], days: Math.round(20 + 10 * r[2]),
      };
    },
    autoName: (p) => `Hawkeye ${p.range[0].toUpperCase()}R`,
    statLine: (s) => `${s.range} km range · tech ${s.tech.toFixed(2)}`,
  },
  armor: {
    name: 'Armor', icon: '🛡️', factory: 'Armor Foundry', facCost: 1500000, rate: 1, opex: 4000, K: 20000000, order: 2,
    params: [
      ['type', 'Type', [['steel', 'Rolled steel'], ['composite', 'Composite'], ['reactive', 'Reactive']]],
      ['thick', 'Thickness', [['light', 'Light'], ['heavy', 'Heavy']]],
    ],
    compute(p) {
      const t = {
        steel: [1, { steel: 40 }, 20000, 1], composite: [1.8, { steel: 20, alu: 10, plastic: 15, glass: 10 }, 80000, 1.8],
        reactive: [2.6, { steel: 30, alu: 5, wire: 4, plastic: 5 }, 150000, 2.5],
      }[p.type];
      const h = p.thick === 'heavy' ? 1.6 : 1, bom = {};
      for (const [k, v] of Object.entries(t[1])) bom[k] = Math.round(v * h);
      return { stats: { prot: t[0] * h }, valueAdd: t[2] * h, bom, rateMult: 1 / h, opexMult: t[3] / 1.5, rnd: 600000 * t[3], days: Math.round(15 + 5 * t[3]) };
    },
    autoName: (p) => `Bastion ${p.type[0].toUpperCase()}${p.thick === 'heavy' ? 'H' : 'L'}`,
    statLine: (s) => `Protection ${s.prot.toFixed(1)}`,
  },
  rotor: {
    name: 'Rotors', icon: '🌀', factory: 'Rotor Shop', facCost: 1200000, rate: 0.2, opex: 3500, K: 15000000, order: 2,
    params: [
      ['blades', 'Blades', [['2', '2-blade'], ['4', '4-blade'], ['5', '5-blade']]],
      ['mat', 'Material', [['alu', 'Aluminum'], ['comp', 'Composite']]],
    ],
    compute(p) {
      const b = +p.blades, c = p.mat === 'comp';
      const bom = { alu: Math.round(b * 15 * (c ? 0.5 : 1)), steel: b * 5, wire: 4 };
      if (c) bom.plastic = b * 12;
      return { stats: { lift: b / 4 * (c ? 1.25 : 1), blades: b }, valueAdd: 120000 * b * (c ? 1.6 : 1), bom, rateMult: 4 / (b + 2), opexMult: c ? 1.3 : 1, rnd: 500000 * b * (c ? 1.5 : 1), days: 15 + b * 3 };
    },
    autoName: (p) => `Whirl ${p.blades}${p.mat === 'comp' ? 'C' : 'A'}`,
    statLine: (s) => `${s.blades} blades · lift ${s.lift.toFixed(2)}`,
  },

  /* ---------------- military ---------------- */
  helicopter: {
    name: 'Helicopters', icon: '🚁', factory: 'Helicopter Plant', facCost: 40000000, rate: 1, opex: 60000, K: 300000000, order: 4, cert: 'Military acceptance trials', lock: DEFENSE_LOCK,
    params: [
      ['role', 'Role', [['utility', 'Utility'], ['transport', 'Heavy transport'], ['attack', 'Attack']]],
      ['engine', 'Turboshaft engines (×2)', 'jetEngines'], ['rotor', 'Rotor system', 'rotors'],
      ['avionics', 'Avionics', 'avionicsList'], ['armor', 'Armor', 'armors'],
    ],
    compute(p) {
      const r = { utility: [15, 8000000, 1], transport: [28, 20000000, 1.6], attack: [15, 35000000, 2] }[p.role];
      const es = refSpec(p.engine), ro = refSpec(p.rotor), av = refSpec(p.avionics), ar = refSpec(p.armor);
      const have = es.thrust * 2, q = (0.7 + 0.2 * av.tech) * (0.85 + 0.15 * ar.prot) * (0.8 + 0.2 * ro.lift);
      const rel = clamp(es.rel * 0.5 + av.rel * 0.5, 0, 0.995);
      return {
        stats: { role: p.role, q, rel }, valueAdd: r[1] * q,
        bom: { alu: 300 * r[2], steel: 150 * r[2], wire: 100, glass: 20, [p.engine]: 2, [p.rotor]: 1, [p.avionics]: 1, [p.armor]: p.role === 'attack' ? 4 : 1 },
        rateMult: 1 / (8 + 6 * r[2]), opexMult: r[2], rnd: 20000000 * r[2], days: Math.round(40 + 20 * r[2]),
        cert: { cost: 5000000 * r[2], days: 45, pass: clamp(0.4 + (rel - 0.9) * 6, 0.2, 0.95) },
        error: have < r[0] ? `Underpowered: needs ${r[0]}k lbf from 2 engines, has ${have}k.` : '',
      };
    },
    autoName: (p) => `${{ utility: 'Kestrel', transport: 'Atlas', attack: 'Viper' }[p.role]} H-${randInt(1, 9)}`,
    statLine: (s) => `${s.role} · quality ${s.q.toFixed(2)} · reliability ${pct(s.rel)}`,
  },
  tank: {
    name: 'Tanks', icon: '🪖', factory: 'Tank Plant', facCost: 30000000, rate: 1, opex: 40000, K: 200000000, order: 4, cert: 'Military acceptance trials', lock: DEFENSE_LOCK,
    params: [
      ['cls', 'Class', [['light', 'Light tank'], ['mbt', 'Main battle tank'], ['heavy', 'Heavy tank']]],
      ['engine', 'Powerpack', 'carEngines'], ['armor', 'Armor', 'armors'], ['chip', 'Fire-control computer', 'chips'],
    ],
    compute(p) {
      const c = { light: [300, 3000000, 1, 1], mbt: [700, 9000000, 1.8, 2], heavy: [1000, 14000000, 2.5, 2] }[p.cls];
      const es = refSpec(p.engine), ar = refSpec(p.armor), cs = refSpec(p.chip);
      const hp = es.hp * c[3], mob = clamp(hp / c[0], 0.5, 1.2);
      const q = mob * (0.6 + 0.25 * ar.prot) * (1 + (cs.perf - 4) / 200);
      return {
        stats: { cls: p.cls, hp, prot: ar.prot, q }, valueAdd: c[1] * q,
        bom: { steel: 400 * c[2], alu: 40 * c[2], wire: 40, glass: 4, [p.engine]: c[3], [p.armor]: Math.round(6 * c[2]), [p.chip]: 6 },
        rateMult: 1 / (3 + 2 * c[2]), opexMult: c[2], rnd: 8000000 * c[2], days: Math.round(30 + 15 * c[2]),
        cert: { cost: 2000000 * c[2], days: 30, pass: clamp(0.55 + 0.075 * ar.prot, 0.3, 0.95) },
        warn: mob < 0.8 ? 'Underpowered powerpack: the tank is slow and worth less.' : '',
      };
    },
    autoName: (p) => `${{ light: 'Lynx', mbt: 'Warden', heavy: 'Colossus' }[p.cls]} T-${randInt(1, 9)}`,
    statLine: (s) => `${{ light: 'light', mbt: 'main battle', heavy: 'heavy' }[s.cls]} · ${Math.round(s.hp)} hp · protection ${s.prot.toFixed(1)} · quality ${s.q.toFixed(2)}`,
  },
  fighter: {
    name: 'Fighter jets', icon: '🛩️', factory: 'Fighter Jet Plant', facCost: 80000000, rate: 1, opex: 150000, K: 2000000000, order: 4, cert: 'Military acceptance trials', lock: DEFENSE_LOCK,
    params: [
      ['gen', 'Generation', [['g4', '4th gen'], ['g45', '4.5 gen'], ['g5', '5th gen stealth']]],
      ['count', 'Engines', [['1', 'Single'], ['2', 'Twin']]], ['engine', 'Engine', 'jetEngines'],
      ['radar', 'Radar', 'radars'], ['avionics', 'Avionics', 'avionicsList'],
    ],
    compute(p) {
      const g = { g4: [25, 40000000, 1, 1], g45: [30, 70000000, 1.6, 1.5], g5: [40, 110000000, 2.5, 2.2] }[p.gen];
      const n = +p.count, es = refSpec(p.engine), ra = refSpec(p.radar), av = refSpec(p.avionics);
      const have = es.thrust * n;
      const q = (0.7 + 0.3 * Math.min(1.3, have / g[0])) * (0.8 + 0.1 * ra.tech * Math.min(2.5, ra.range / 150)) * (0.8 + 0.15 * av.tech);
      const rel = clamp(es.rel * 0.5 + av.rel * 0.5 + (n === 2 ? 0.01 : 0), 0, 0.995);
      return {
        stats: { gen: p.gen, q, rel }, valueAdd: g[1] * q,
        bom: { alu: 600 * g[2], steel: 150 * g[2], plastic: 100 * g[2], glass: 10, wire: 200, [p.engine]: n, [p.radar]: 1, [p.avionics]: 1 },
        rateMult: 1 / (15 + 10 * g[2]), opexMult: g[2], rnd: 60000000 * g[3], days: Math.round(60 + 30 * g[3]),
        cert: { cost: 20000000 * g[3], days: 60, pass: clamp(0.35 + (rel - 0.9) * 6, 0.2, 0.95) },
        error: have < g[0] * 0.8 ? `Underpowered: needs ~${g[0]}k lbf, engines give ${have}k.` : p.gen === 'g5' && av.tech < 1.5 ? 'Stealth fighters need advanced or military-grade avionics.' : '',
      };
    },
    autoName: (p) => `${pick(['Talon', 'Specter', 'Striker', 'Vortex', 'Wraith'])} F-${randInt(10, 99)}`,
    statLine: (s) => `${{ g4: '4th', g45: '4.5', g5: '5th' }[s.gen]} gen · quality ${s.q.toFixed(2)} · reliability ${pct(s.rel)}`,
  },
  bomber: {
    name: 'Bombers', icon: '✈️', factory: 'Bomber Plant', facCost: 150000000, rate: 1, opex: 300000, K: 3000000000, order: 4, cert: 'Military acceptance trials', lock: DEFENSE_LOCK,
    params: [
      ['type', 'Type', [['tactical', 'Tactical'], ['strategic', 'Strategic'], ['stealth', 'Stealth']]],
      ['count', 'Engines', [['2', 'Twin'], ['4', 'Four']]], ['engine', 'Engine', 'jetEngines'],
      ['radar', 'Radar', 'radars'], ['avionics', 'Avionics', 'avionicsList'],
    ],
    compute(p) {
      const t = { tactical: [50, 120000000, 1], strategic: [120, 300000000, 2], stealth: [100, 700000000, 3] }[p.type];
      const n = +p.count, es = refSpec(p.engine), ra = refSpec(p.radar), av = refSpec(p.avionics);
      const have = es.thrust * n;
      const q = (0.75 + 0.25 * Math.min(1.2, have / t[0])) * (0.85 + 0.075 * ra.tech * Math.min(2.5, ra.range / 150)) * (0.8 + 0.15 * av.tech);
      const rel = clamp(es.rel * 0.5 + av.rel * 0.5 + (n === 4 ? 0.01 : 0), 0, 0.995);
      return {
        stats: { type: p.type, q, rel }, valueAdd: t[1] * q,
        bom: { alu: 2000 * t[2], steel: 600 * t[2], plastic: 300 * t[2], glass: 30, wire: 600, [p.engine]: n, [p.radar]: 1, [p.avionics]: 2 },
        rateMult: 1 / (30 + 15 * t[2]), opexMult: t[2], rnd: 150000000 * t[2], days: Math.round(90 + 30 * t[2]),
        cert: { cost: 50000000 * t[2], days: 90, pass: clamp(0.3 + (rel - 0.9) * 6, 0.2, 0.95) },
        error: have < t[0] ? `Underpowered: needs ${t[0]}k lbf, engines give ${have}k.` : p.type === 'stealth' && av.tech < 1.5 ? 'Stealth bombers need advanced or military-grade avionics.' : '',
      };
    },
    autoName: (p) => `${{ tactical: 'Hammer', strategic: 'Titan', stealth: 'Nightshade' }[p.type]} B-${randInt(1, 9)}`,
    statLine: (s) => `${s.type} · quality ${s.q.toFixed(2)} · reliability ${pct(s.rel)}`,
  },

  /* ---------------- space hardware ---------------- */
  rocketEngine: {
    name: 'Rocket engines', icon: '🔥', factory: 'Rocket Engine Works', facCost: 40000000, rate: 0.6, opex: 40000, K: 500000000, order: 2, cert: 'Engine test-stand certification', lock: SPACE_LOCK,
    params: [
      ['fuel', 'Propellant', [['kerolox', 'Kerosene / LOX'], ['methalox', 'Methane / LOX'], ['hydrolox', 'Hydrogen / LOX']]],
      ['size', 'Size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]],
      ['reuse', 'Reusability', [['no', 'Expendable'], ['yes', 'Reusable']]],
      ['chip', 'Engine controller', 'chips'],
    ],
    compute(p) {
      const f = { kerolox: [1, 0.97, 1], methalox: [1.15, 0.96, 1.3], hydrolox: [1.3, 0.95, 1.6] }[p.fuel];
      const s = { small: [1, 1], medium: [3, 2.2], large: [8, 4.5] }[p.size], re = p.reuse === 'yes';
      const rel = Math.min(0.995, f[1] - (re ? 0.01 : 0) + Math.min(0.02, (refSpec(p.chip).perf - 4) * 0.001));
      return {
        stats: { thrust: s[0], eff: f[0], rel, reusable: re }, valueAdd: s[0] * 1500000 * f[0] * (re ? 1.6 : 1),
        bom: { steel: 40 * s[1], alu: 30 * s[1], wire: 20 * s[1], [p.chip]: 4 },
        rateMult: 1 / (2 + s[1]), opexMult: s[1] / 2, rnd: 5000000 * s[1] * f[2] * (re ? 1.5 : 1), days: Math.round(30 + 10 * s[1] * f[2]),
        cert: { cost: 2000000 * s[1], days: 30, pass: clamp(0.45 + (rel - 0.9) * 7, 0.3, 0.95) },
      };
    },
    autoName: (p) => `${{ kerolox: 'Ember', methalox: 'Blaze', hydrolox: 'Frost' }[p.fuel]} ${p.size[0].toUpperCase()}${p.reuse === 'yes' ? 'R' : ''}`,
    statLine: (s) => `Thrust ${s.thrust} · efficiency ${s.eff.toFixed(2)} · reliability ${pct(s.rel)}${s.reusable ? ' · reusable' : ''}`,
  },
  rocket: {
    name: 'Rockets', icon: '🚀', factory: 'Rocket Assembly Building', facCost: 150000000, rate: 1, opex: 200000, K: 5000000000, order: 3, cert: 'Launch vehicle license', lock: SPACE_LOCK,
    params: [
      ['cls', 'Payload class', [['small', 'Small (1 t)'], ['medium', 'Medium (10 t)'], ['heavy', 'Heavy (30 t)'], ['super', 'Super-heavy (100 t)']]],
      ['engine', 'Rocket engine', 'rocketEngines'],
      ['reuse', 'First stage', [['no', 'Expendable'], ['yes', 'Reusable booster']]],
      ['avionics', 'Avionics', 'avionicsList'],
    ],
    compute(p) {
      const c = { small: [1, 4, 15000000], medium: [10, 12, 60000000], heavy: [30, 30, 150000000], super: [100, 90, 400000000] }[p.cls];
      const es = refSpec(p.engine), av = refSpec(p.avionics), re = p.reuse === 'yes';
      const n = Math.ceil(c[1] / es.thrust);
      const rel = clamp(Math.pow(es.rel, Math.sqrt(n)) * 0.6 + av.rel * 0.4, 0.5, 0.995);
      return {
        stats: { payload: c[0], engines: n, rel, reusable: re }, valueAdd: c[2] * (re ? 1.3 : 1) * (0.8 + 0.2 * es.eff),
        bom: { alu: c[0] * 80 + 200, steel: c[0] * 30 + 100, wire: 100, [p.engine]: n, [p.avionics]: 1 },
        rateMult: 1 / (20 + c[0] / 5), opexMult: 0.5 + c[0] / 60, rnd: 30000000 * Math.sqrt(c[0]) * (re ? 1.5 : 1), days: Math.round(60 + c[0]),
        cert: { cost: 10000000 + c[0] * 500000, days: 60, pass: clamp(0.3 + (rel - 0.85) * 4, 0.2, 0.95) },
        error: re && !es.reusable ? 'A reusable booster needs reusable engines.' : n > 40 ? `This engine is too small: you'd need ${n} of them.` : '',
      };
    },
    autoName: (p) => `${pick(['Odyssey', 'Pathfinder', 'Starlance', 'Aurora', 'Vanguard'])} ${{ small: 'I', medium: 'II', heavy: 'Heavy', super: 'Super Heavy' }[p.cls]}`,
    statLine: (s) => `${s.payload} t to orbit · ${s.engines} engines · reliability ${pct(s.rel)}${s.reusable ? ' · reusable booster' : ''}`,
  },
  satellite: {
    name: 'Satellites', icon: '🛰️', factory: 'Satellite Plant', facCost: 20000000, rate: 0.5, opex: 30000, K: 1000000000, order: 3, cert: 'Spectrum & orbital license', lock: SPACE_LOCK,
    params: [
      ['type', 'Mission', [['comms', 'Communications'], ['eo', 'Earth observation'], ['nav', 'Navigation']]],
      ['size', 'Size', [['small', 'Small (0.5 t)'], ['medium', 'Medium (2 t)'], ['large', 'Large (6 t)']]],
      ['chip', 'Onboard computer', 'chips'],
    ],
    compute(p) {
      const s = { small: [0.5, 1, 2000000], medium: [2, 3, 8000000], large: [6, 7, 25000000] }[p.size];
      const t = { comms: [1, 1], eo: [0.8, 1.1], nav: [0.6, 1.2] }[p.type];
      const cs = refSpec(p.chip);
      return {
        stats: { mass: s[0], type: p.type, income: Math.round(6000 * s[1] * t[0] * (1 + (cs.perf - 4) / 60)), life: 1500 },
        valueAdd: s[2] * t[1], bom: { alu: 40 * s[1], glass: 10 * s[1], battery: 10 * s[1], wire: 20 * s[1], [p.chip]: 8 * s[1] },
        rateMult: 1 / (3 + s[1]), opexMult: s[1] / 3, rnd: 8000000 * s[1], days: Math.round(30 + 8 * s[1]),
        cert: { cost: 1000000 * s[1], days: 20, pass: 0.9 },
      };
    },
    autoName: (p) => `${{ comms: 'LinkSat', eo: 'EarthEye', nav: 'NavStar' }[p.type]} ${p.size[0].toUpperCase()}`,
    statLine: (s) => `${{ comms: 'communications', eo: 'Earth observation', nav: 'navigation' }[s.type]} · ${s.mass} t · ${money(s.income)}/day in orbit`,
  },
  capsule: {
    name: 'Crew capsules', icon: '🧑‍🚀', factory: 'Capsule Works', facCost: 60000000, rate: 0.5, opex: 80000, K: 2000000000, order: 3, cert: 'Human spaceflight certification', lock: SPACE_LOCK,
    params: [
      ['seats', 'Seats', [['3', '3 crew'], ['4', '4 crew'], ['7', '7 crew']]],
      ['shield', 'Heat shield', [['std', 'Standard'], ['adv', 'Advanced (reusable)']]],
      ['avionics', 'Avionics', 'avionicsList'],
    ],
    compute(p) {
      const n = +p.seats, adv = p.shield === 'adv', av = refSpec(p.avionics), mass = 4 + n * 1.2;
      const rel = clamp(av.rel + (adv ? 0.01 : 0), 0, 0.995);
      return {
        stats: { seats: n, mass, rel, reusable: adv }, valueAdd: 20000000 * n * (adv ? 1.3 : 1),
        bom: { alu: Math.round(mass * 60), steel: Math.round(mass * 20), glass: 20, battery: 30, wire: 60, [p.avionics]: 1 },
        rateMult: 1 / (15 + n), opexMult: n / 4, rnd: 10000000 * n * (adv ? 1.4 : 1), days: 90,
        cert: { cost: 20000000, days: 60, pass: clamp(0.35 + (rel - 0.9) * 6, 0.2, 0.9) },
      };
    },
    autoName: (p) => `${pick(['Dragonfly', 'Skylark', 'Voyager', 'Pioneer', 'Starhopper'])} ${p.seats}`,
    statLine: (s) => `${s.seats} seats · ${s.mass.toFixed(1)} t · reliability ${pct(s.rel)}${s.reusable ? ' · reusable' : ''}`,
  },
});
Object.assign(DEFAULT_DZ, {
  avionics: { grade: 'civil', chip: 'chip' }, radar: { range: 'medium', chip: 'chip' }, armor: { type: 'steel', thick: 'light' }, rotor: { blades: '4', mat: 'alu' },
  helicopter: { role: 'utility', engine: 'turbofan', rotor: 'rotorStd', avionics: 'avionicsStd', armor: 'armorStd' },
  tank: { cls: 'mbt', engine: 'gasengine', armor: 'armorStd', chip: 'chip' },
  fighter: { gen: 'g4', count: '1', engine: 'turbofan', radar: 'radarStd', avionics: 'avionicsStd' },
  bomber: { type: 'tactical', count: '2', engine: 'turbofan', radar: 'radarStd', avionics: 'avionicsStd' },
  rocketEngine: { fuel: 'kerolox', size: 'medium', reuse: 'no', chip: 'chip' },
  rocket: { cls: 'medium', engine: 'rocketEngineStd', reuse: 'no', avionics: 'avionicsStd' },
  satellite: { type: 'comms', size: 'medium', chip: 'chip' },
  capsule: { seats: '4', shield: 'std', avionics: 'avionicsStd' },
});
DEFAULT_DZ.aircraft.avionics = 'avionicsStd';
for (const k in DEFAULT_DZ) if (!UI.dz[k]) UI.dz[k] = { ...DEFAULT_DZ[k] };
UI.dz.aircraft.avionics = UI.dz.aircraft.avionics || 'avionicsStd';
Object.assign(LINE_UTIL, { avionics: 0.006, radar: 0.006, armor: 0.01, rotor: 0.006, helicopter: 0.004, tank: 0.005, fighter: 0.003, bomber: 0.003, rocketEngine: 0.005, rocket: 0.003, satellite: 0.005, capsule: 0.004 });
Object.assign(LINE_PERMIT, {
  avionics: ['Electronics & export-control permit', 200000], radar: ['Radio-frequency & export permit', 300000],
  armor: ['Heavy industry permit', 150000], rotor: ['Aviation parts production approval', 200000],
  helicopter: ['Defense production site clearance', 4000000], tank: ['Defense production site clearance', 3000000],
  fighter: ['Defense production site clearance', 8000000], bomber: ['Defense production site clearance', 15000000],
  rocketEngine: ['Rocket test-stand environmental permit', 2000000], rocket: ['Launch vehicle production permit', 10000000],
  satellite: ['Spacecraft cleanroom permit', 1000000], capsule: ['Human-rated spacecraft facility approval', 5000000],
});
