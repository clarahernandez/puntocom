// Momentos del día, el sol y la luna, y dónde caen en el círculo del domo.

function momentoActual(p) {
  const ks = [...CONFIG.momentos].sort((a, b) => a.pos - b.pos);
  let i = ks.length - 1;
  for (let j = 0; j < ks.length; j++) if (ks[j].pos <= p) i = j;
  const a = ks[i];
  const b = ks[(i + 1) % ks.length];
  let tramo = b.pos - a.pos;
  if (tramo <= 0) tramo += 1;
  const t = fract(p - a.pos) / tramo;

  // Curva Hermite cíclica por los momentos: la velocidad del cambio es continua
  // al pasar por cada uno (el smoothstep por tramo frenaba a cero en cada
  // momento y arrancaba de golpe, y se notaba como saltos).
  const n = ks.length;
  const prev = ks[(i - 1 + n) % n];
  const next = ks[(i + 2) % n];
  const largo = (x, y) => { const d = y.pos - x.pos; return d > 0 ? d : d + 1; };
  const lPrev = largo(prev, a), lNext = largo(b, next);
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  const curva = (vp, va, vb, vn) => {
    const ma = (vb - vp) * tramo / (lPrev + tramo);
    const mb = (vn - va) * tramo / (tramo + lNext);
    return h00 * va + h10 * ma + h01 * vb + h11 * mb;
  };
  const num = (c) => curva(prev[c] ?? 0, a[c] ?? 0, b[c] ?? 0, next[c] ?? 0);
  const m = {
    nombre: t < 0.5 ? a.nombre : b.nombre,
    metal: constrain(num('metal'), 0, 1),
    intensidad: Math.max(num('intensidad'), 0),
  };
  for (const c of COLORES_MOMENTO) {
    const cp = hexARgb(prev[c]), ca = hexARgb(a[c]), cb = hexARgb(b[c]), cn = hexARgb(next[c]);
    m[c] = ca.map((v, k) => constrain(curva(cp[k], v, cb[k], cn[k]), 0, 1));
  }

  // Miramos río abajo: el sol sale a nuestra espalda en 0.25, pasa por
  // arriba (un poco a la derecha, hacia el norte) y se pone de frente, en el
  // horizonte, en 0.75. La luna hace lo mismo de noche: sale atrás en 0.75
  // y se pone de frente en 0.25.
  const ang = TWO_PI * (p - 0.25);
  m.sol = direccion(Math.sin(ang) * 0.3, Math.sin(ang) * 0.9, -Math.cos(ang));
  m.luna = posLuna(p);
  m.solVis = suave(-0.03, 0.04, m.sol[1]);
  m.lunaVis = suave(-0.03, 0.04, m.luna[1]) * (1 - m.solVis);
  return m;
}

// luz: color de la luz (cáusticas y playa). Los demás, de la playa (capa río real): el cielo, el
// horizonte, las islas y el agua de cada momento.
const COLORES_MOMENTO = ['luz', 'cielo', 'horizonte', 'islas', 'agua'];

// Colores de la playa en los cuatro momentos de base (noche, amanecer, mediodía y atardecer).
// Los momentos que no traigan los suyos en CONFIG.momentos (la tarde, la dorada o uno nuevo)
// toman los de su lugar en el día, mezclando los dos momentos de base que tienen al lado.
const MOMENTOS_PLAYA = [
  { pos: 0.00, cielo: '#04060c', horizonte: '#121624', islas: '#030404', agua: '#0a0806', intensidad: 0.5 },
  { pos: 0.25, cielo: '#34446a', horizonte: '#f0a06a', islas: '#16130f', agua: '#4a2600', intensidad: 1 },
  { pos: 0.50, cielo: '#6a9cd0', horizonte: '#d4e0e6', islas: '#2a3622', agua: '#955f20', intensidad: 1 },
  { pos: 0.75, cielo: '#2c3764', horizonte: '#ff8a4c', islas: '#1a120c', agua: '#4a2600', intensidad: 1 },
];

// Completa en cada momento lo que le falte de la playa (se llama al arrancar, capas.js)
function completarMomentos() {
  for (const m of CONFIG.momentos) {
    const i = MOMENTOS_PLAYA.findIndex((b) => b.pos > m.pos);
    const b = MOMENTOS_PLAYA[i < 0 ? 0 : i];
    const a = MOMENTOS_PLAYA[(i < 0 ? MOMENTOS_PLAYA.length : i) - 1];
    let tramo = b.pos - a.pos;
    if (tramo <= 0) tramo += 1;
    const t = constrain(fract(m.pos - a.pos) / tramo, 0, 1);
    for (const c of ['cielo', 'horizonte', 'islas', 'agua']) {
      if (m[c]) continue;
      const ca = hexARgb(a[c]), cb = hexARgb(b[c]);
      m[c] = rgbAHex(ca.map((v, k) => lerp(v, cb[k], t)));
    }
    if (m.intensidad === undefined) m.intensidad = lerp(a.intensidad, b.intensidad, t);
  }
}

// Color de luz para el metalizado: la de los momentos metalizados cercanos (amanecer, la
// tarde que se va dorando, el atardecer), mezclada según la distancia y cuánto metal tiene
// cada uno, así cambia de a poco. Solo de esos momentos, para que el metal no tome el azul
// de la luna. Estirado al brillo máximo.
function luzDelMetal(p) {
  const suma = [0, 0, 0];
  let peso = 0;
  for (const m of CONFIG.momentos) {
    if (!(m.metal > 0)) continue;
    const d = Math.min(Math.abs(p - m.pos), 1 - Math.abs(p - m.pos));
    const w = m.metal * Math.exp(-(d * d) / (2 * 0.04 * 0.04)) + 1e-9;
    hexARgb(m.luz).forEach((v, n) => { suma[n] += v * w; });
    peso += w;
  }
  const luz = peso > 0 ? suma.map((v) => v / peso) : hexARgb(CONFIG.causticas.luz);
  const tope = Math.max(...luz, 0.001);
  return luz.map((v) => v / tope);
}

function posLuna(p) {
  const ang = TWO_PI * (p - 0.25);
  return direccion(-Math.sin(ang) * 0.3, -Math.sin(ang) * 0.7, Math.cos(ang));
}

// De dónde viene la luz y cuánta hay. No es un foco: la luz llega pareja a toda el agua
// desde la dirección del sol (o de la luna, de noche). dir = [x, y, z]: xy es hacia dónde
// está en la cúpula (la misma orientación que enDomo) y z su altura (0 = horizonte,
// 1 = cenit). Entre el sol y la luna se mezcla según cuánto se ve cada uno, así no salta.
// fuerza: 1 con el sol, 0,6 con la luna, 0 en la pausa sin luz.
function direccionDeLaLuz(m) {
  const plano = (d) => { const l = Math.hypot(d[0], d[2]) || 1; return [d[0] / l, d[2] / l]; };
  const ps = plano(m.sol), pl = plano(m.luna);
  const ws = m.solVis, wl = m.lunaVis * 0.6;
  const x = ps[0] * ws + pl[0] * wl, y = ps[1] * ws + pl[1] * wl;
  const l = Math.hypot(x, y) || 1;
  const alto = (Math.max(m.sol[1], 0) * ws + Math.max(m.luna[1], 0) * wl) / Math.max(ws + wl, 1e-6);
  return { dir: [x / l, y / l, alto], fuerza: constrain(ws + wl, 0, 1) };
}

// Dirección en el cielo → punto del fisheye: el cenit en el centro, el
// horizonte en el borde (y bajo el horizonte, afuera del círculo).
function enDomo(dir) {
  const r = 1 - Math.asin(constrain(dir[1], -1, 1)) / HALF_PI;
  const az = Math.atan2(dir[0], dir[2]);
  return [r * Math.sin(az), r * Math.cos(az)];
}
