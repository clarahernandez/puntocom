// Capa "sauces": estar tirado debajo de los sauces, mirando para arriba. El verde que envuelve
// todo y las líneas que se cruzan: troncos rojizos de corteza surcada que suben desde el borde
// del círculo, ramas finas que atraviesan, y cortinas de hojas largas y angostas que cuelgan y
// se mecen con el viento. En el centro (el cenit) se asoma el cielo claro entre las hojas.
//
// Cómo está hecha (para que no cueste mucho a 2048 × 2048):
//   - Tres planos pintados una sola vez al arrancar (y con "otros sauces"): lejos (desenfocado),
//     medio (los troncos con su corteza y las ramas) y cerca (troncos grandes y hojas fuera de
//     foco en el borde). En cada cuadro solo se giran un poquito, cada uno distinto: profundidad.
//   - Las cortinas que se mueven se dibujan en cada cuadro, colgadas de las ramas del plano medio.
//     Mirando para arriba, lo que cuelga apunta hacia el borde del círculo.
//   - Encima, la luz del momento del día y unos destellos de sol que se cuelan entre las hojas.
//
// Viento: el de la obra ("viento en el agua") y el de la tormenta los mecen más.
// Panel: Capas → sauces. "otros sauces" los vuelve a armar con otra forma.

// sauces: cuántos árboles (1 = los de siempre; 2 = el doble)
// pajaros: cuánto se ve cada canto de los pájaros (una luz que cruza el follaje)
// video: cuánto se ven los videos de los sauces (la base de la escena); dibujo: cuánto de los sauces
// dibujados encima (0 = nada); giro: qué tan rápido gira el video; cieloAzul: tiñe de azul el cielo
// blanco del video (sin tocar los verdes ni los troncos)
// lento: velocidad de los videos (1 = la real, 0.5 = a la mitad); invertir: 0 = colores normales,
// 1 = negativo (en el medio, de a poco). Los destellos de sol y las luces de los cantos, apagados
const SAUCES_DEFECTO = { viento: 1, luz: 1, destellos: 0, cortinas: 180, semilla: 1, sauces: 1, pajaros: 0,
  video: 1, dibujo: 0, giro: 1, cieloAzul: 0.6, lento: 0.5, invertir: 0 };

// Los videos de los sauces (sin sonido): se turnan, con un fundido entre uno y otro
// hasta: el segundo donde se corta (lo que sigue no se muestra nunca). El 1, hasta 0:10
const SAUCES_VIDEOS = [
  { src: '../referencias_visuales/video de los sauces.mp4', hasta: 10 },
  { src: '../referencias_visuales/video de los sauces 2.mp4' },
];
const SAUCES_FUNDIDO_VIDEO = 1.5;   // segundos del fundido entre video y video

function iniciarVideosSauces() {
  Sauces.videos = SAUCES_VIDEOS.map(({ src, hasta }) => {
    const el = document.createElement('video');
    el.src = src;
    el.hasta = hasta;
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    return { el, peso: 0 };
  });
  Sauces.vActual = 0;
  Sauces.videos[0].peso = 1;
}

// Cada cuadro, aunque no se vea: los videos corren solo mientras la escena está prendida
function actualizarVideosSauces() {
  const V = Sauces.videos;
  if (!V) return;
  const prendida = CONFIG.capas.sauces.opacidad > 0.003 && CONFIG.sauces.video > 0.003;
  if (!prendida) { for (const v of V) if (!v.el.paused) v.el.pause(); return; }
  const cur = V[Sauces.vActual], sig = V[(Sauces.vActual + 1) % V.length];
  const lento = Math.max(0.1, Math.min(1, CONFIG.sauces.lento));
  for (const v of V) if (Math.abs(v.el.playbackRate - lento) > 0.001) v.el.playbackRate = lento;
  if (cur.el.paused && !cur.el.ended) cur.el.play().catch(() => {});
  // Lo que le queda, en segundos de verdad (a velocidad lenta, el video dura más)
  const fin = Math.min(cur.el.duration, cur.el.hasta || Infinity);
  const quedan = (fin - cur.el.currentTime) / lento;
  if (isFinite(quedan) && quedan < SAUCES_FUNDIDO_VIDEO) {
    if (sig.el.paused) { sig.el.currentTime = 0; sig.el.play().catch(() => {}); }
    sig.peso = Math.min(1, 1 - quedan / SAUCES_FUNDIDO_VIDEO);
  }
  if (cur.el.ended || (isFinite(quedan) && quedan < 0.05)) {
    cur.el.pause();
    cur.peso = 0;
    sig.peso = 1;
    Sauces.vActual = (Sauces.vActual + 1) % V.length;
  }
}

// El video tapando todo el círculo, girando despacio (como estar tirada mirando para arriba)
function dibujarVideosSauces(g, alfa, entrada) {
  const V = Sauces.videos, S = CONFIG.sauces, { cx, cy } = Sauces.geo;
  if (!V) return;
  // En el domo alcanza con que el lado corto del video cubra el círculo (un círculo que gira
  // sigue ocupando lo mismo); en pantalla común tiene que cubrir la diagonal
  const diag = DOMO ? Math.min(width, height) : Math.hypot(width, height);
  const orden = [V[Sauces.vActual], V[(Sauces.vActual + 1) % V.length]];
  for (const v of orden) {
    if (v.peso <= 0.003 || v.el.readyState < 2) continue;
    const vw = v.el.videoWidth, vh = v.el.videoHeight;
    const esc = diag / Math.min(vw, vh) * entrada * (1.02 + 0.03 * Math.sin(Sauces.t * 0.05));
    g.save();
    g.globalAlpha = alfa * v.peso;
    g.translate(cx, cy);
    g.rotate(Sauces.t * 0.012 * S.giro);
    g.drawImage(v.el, -vw * esc / 2, -vh * esc / 2, vw * esc, vh * esc);
    g.restore();
  }
}

// Colores sacados de los videos de referencia (verde gris oliva y corteza rojiza)
const SAUCE_HOJAS = ['#3c5631', '#52693c', '#6b8450', '#88a068', '#a7b98a'];   // oscuro → claro
const SAUCE_CORTEZA = { base: '#9a5f45', luz: '#c99272', sombra: '#5a3428', surco: '#3a2018' };

const Sauces = { cantos: [], planos: null, cortinas: [], porColor: [], destellos: [], t: 0, ancho: 0, alto: 0 };

function configSauces() {
  CONFIG.sauces = Object.assign({}, SAUCES_DEFECTO, CONFIG.sauces);
  return CONFIG.sauces;
}

// Azar con semilla: la misma semilla arma los mismos sauces
function azarSauces(semilla) {
  let a = Math.floor(semilla * 9973) >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.entre = (x, y) => x + r() * (y - x);
  return r;
}

function lienzoSauces(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Copia un lienzo desenfocado (para los planos fuera de foco)
function desenfocarSauces(lienzo, px) {
  if (px <= 0) return lienzo;
  const b = lienzoSauces(lienzo.width, lienzo.height);
  const g = b.getContext('2d');
  g.filter = `blur(${px}px)`;
  g.drawImage(lienzo, 0, 0);
  return b;
}

// ---------- Armado ----------

function armarSauces() {
  const S = configSauces();
  const w = width, h = height;
  Sauces.ancho = w; Sauces.alto = h;
  const geo = { cx: w / 2, cy: h / 2, R: DOMO ? w / 2 : Math.hypot(w, h) / 2, k: Math.min(w, h) / 2048 };
  const azar = azarSauces(S.semilla);
  const anclas = [];

  // Lejos: el cielo, troncos finos apagados y una masa de hojas desenfocada
  const lejos = lienzoSauces(w, h), gl = lejos.getContext('2d');
  const cielo = gl.createRadialGradient(geo.cx, geo.cy, 0, geo.cx, geo.cy, geo.R);
  // Cielo azul: claro en el cenit, más profundo hacia afuera, y verde oscuro en el borde (el follaje)
  cielo.addColorStop(0, '#eaf6ff');
  cielo.addColorStop(0.22, '#8cc6f5');
  cielo.addColorStop(0.55, '#3f8ad8');
  cielo.addColorStop(0.8, '#2f6a9e');
  cielo.addColorStop(1, '#22361d');
  gl.fillStyle = cielo;
  gl.fillRect(0, 0, w, h);
  // (las hojas, en racimos colgados de las ramas; el centro queda más libre: ahí se ve el cielo)
  const anclasLejos = [];
  const cuantos = Math.max(0.3, S.sauces);
  for (let i = 0; i < Math.round(20 * cuantos); i++) {
    const tr = troncoSauce(azar, geo, { r0: 1.1, r1: [0.25, 0.55], ancho: [16, 40] });
    dibujarTronco(gl, tr, azar, geo, { lejos: true });
    ramasDeTronco(gl, tr, azar, geo, anclasLejos, 0.6, '#6e6b58');
  }
  follaje(gl, azar, geo, Math.round(150 * cuantos), ['rgba(70,98,55,1)', 'rgba(95,124,74,1)', 'rgba(120,146,95,1)'], 0.5, anclasLejos);
  hojasEstaticas(gl, azar, geo, Math.round(560 * cuantos), { palette: ['#4f6a3f', '#6b8656', '#8aa271', '#aebf95'], alfa: 0.7, escala: 0.9, anclas: anclasLejos });

  // Medio: los troncos principales con su corteza, las ramas y hojas quietas
  // (primero la estructura aparte, para poner hojas detrás y delante de los troncos)
  const estructura = lienzoSauces(w, h), ge = estructura.getContext('2d');
  for (let i = 0; i < Math.round(13 * cuantos); i++) {
    const tr = troncoSauce(azar, geo, { r0: 1.15, r1: [0.18, 0.55], ancho: [50, 140] });
    dibujarTronco(ge, tr, azar, geo, {});
    ramasDeTronco(ge, tr, azar, geo, anclas, 1, '#5e4636');
  }
  // Líneas largas que cruzan todo: ramas finas sueltas
  for (let i = 0; i < 10; i++) {
    const a = azar() * Math.PI * 2, r = azar.entre(0.7, 1.05) * geo.R;
    const x = geo.cx + Math.cos(a) * r, y = geo.cy + Math.sin(a) * r;
    rama(ge, x, y, a + Math.PI + azar.entre(-0.7, 0.7), azar.entre(0.6, 1.3) * geo.R, azar.entre(2, 5) * geo.k, 1, azar, geo, anclas, '#5a4a38');
  }
  const medio = lienzoSauces(w, h), gm = medio.getContext('2d');
  follaje(gm, azar, geo, Math.round(130 * cuantos), ['rgba(60,86,49,1)', 'rgba(82,105,60,1)', 'rgba(107,132,80,1)'], 0.4, anclas);
  hojasEstaticas(gm, azar, geo, Math.round(300 * cuantos), { palette: SAUCE_HOJAS, alfa: 0.85, escala: 1, anclas });
  gm.drawImage(estructura, 0, 0);
  hojasEstaticas(gm, azar, geo, Math.round(300 * cuantos), { palette: SAUCE_HOJAS, alfa: 0.95, escala: 1, anclas });

  // Cerca: dos o tres troncos enormes en el borde y hojas grandes fuera de foco
  const cerca = lienzoSauces(w, h), gc = cerca.getContext('2d');
  const nCerca = Math.round((3 + Math.floor(azar() * 2)) * cuantos);
  for (let i = 0; i < nCerca; i++) {
    const tr = troncoSauce(azar, geo, { r0: 1.25, r1: [0.5, 0.75], ancho: [180, 280] });
    dibujarTronco(gc, tr, azar, geo, {});
  }
  hojasEstaticas(gc, azar, geo, Math.round(150 * cuantos), { palette: ['#2a3f22', '#3c5631', '#4d6639'], alfa: 0.9, escala: 2.2, borde: true });

  Sauces.planos = [desenfocarSauces(lejos, 6 * geo.k), desenfocarSauces(medio, 0.8 * geo.k), desenfocarSauces(cerca, 7 * geo.k)];

  // Las cortinas que se mueven, colgadas de las ramas del plano medio
  armarCortinas(azar, geo, anclas, S.cortinas);

  // Los destellos de sol: cerca del centro, donde se asoma el cielo
  Sauces.destellos = [];
  for (let i = 0; i < 70; i++) {
    const a = azar() * Math.PI * 2, r = Math.pow(azar(), 1.6) * 0.6 * geo.R;
    Sauces.destellos.push({ x: geo.cx + Math.cos(a) * r, y: geo.cy + Math.sin(a) * r,
      tam: azar.entre(5, 20) * geo.k, f: azar.entre(0.3, 1.2), fase: azar() * 10 });
  }
  Sauces.geo = geo;
}

// Un tronco: sube desde afuera del círculo hacia el centro, inclinado y apenas curvo
function troncoSauce(azar, geo, { r0, r1, ancho }) {
  const a = azar() * Math.PI * 2;
  const inclina = azar.entre(-0.45, 0.45);
  const rb = r0 * geo.R, rt = azar.entre(r1[0], r1[1]) * geo.R;
  const B = [geo.cx + Math.cos(a) * rb, geo.cy + Math.sin(a) * rb];
  const T = [geo.cx + Math.cos(a + inclina) * rt, geo.cy + Math.sin(a + inclina) * rt];
  const curva = azar.entre(-0.12, 0.12) * geo.R;
  const C = [(B[0] + T[0]) / 2 - Math.sin(a) * curva, (B[1] + T[1]) / 2 + Math.cos(a) * curva];
  const wb = azar.entre(ancho[0], ancho[1]) * geo.k, wt = wb * azar.entre(0.08, 0.14);
  const pts = [], anchos = [];
  for (let i = 0; i <= 48; i++) {
    const s = i / 48, u = 1 - s;
    pts.push([u * u * B[0] + 2 * u * s * C[0] + s * s * T[0], u * u * B[1] + 2 * u * s * C[1] + s * s * T[1]]);
    anchos.push(wb + (wt - wb) * Math.pow(s, 0.8));
  }
  return { pts, anchos };
}

// Bordes izquierdo y derecho de una línea con ancho
function bordesSauce(pts, anchos, fraccion = 0.5) {
  const izq = [], der = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l, m = anchos[i] * fraccion;
    izq.push([pts[i][0] + nx * m, pts[i][1] + ny * m]);
    der.push([pts[i][0] - nx * m, pts[i][1] - ny * m]);
  }
  return { izq, der };
}

function dibujarTronco(g, tr, azar, geo, { lejos }) {
  const { pts, anchos } = tr;
  const { izq, der } = bordesSauce(pts, anchos);
  const forma = new Path2D();
  forma.moveTo(izq[0][0], izq[0][1]);
  for (const p of izq) forma.lineTo(p[0], p[1]);
  for (let i = der.length - 1; i >= 0; i--) forma.lineTo(der[i][0], der[i][1]);
  forma.closePath();

  if (lejos) {
    g.fillStyle = '#6e6b58';
    g.globalAlpha = 0.8;
    g.fill(forma);
    g.globalAlpha = 1;
    return;
  }
  // Volumen: oscuro de un lado, rojizo al medio, más claro del lado del cielo
  const m = Math.floor(pts.length / 2);
  const grad = g.createLinearGradient(izq[m][0], izq[m][1], der[m][0], der[m][1]);
  grad.addColorStop(0, SAUCE_CORTEZA.sombra);
  grad.addColorStop(0.45, SAUCE_CORTEZA.base);
  grad.addColorStop(0.8, SAUCE_CORTEZA.luz);
  grad.addColorStop(1, SAUCE_CORTEZA.base);
  g.fillStyle = grad;
  g.fill(forma);

  // Corteza: surcos a lo largo del tronco, con plaquitas claras entre medio
  g.save();
  g.clip(forma);
  g.lineCap = 'round';
  const surcos = Math.floor(anchos[0] / (3 * geo.k)) + 8;
  for (let j = 0; j < surcos * 2; j++) {
    const claro = j % 3 === 0;
    const u = azar.entre(-0.5, 0.5);
    const i0 = Math.floor(azar() * pts.length * 0.9), largo = Math.floor(azar.entre(4, 22));
    g.beginPath();
    for (let i = i0; i < Math.min(pts.length, i0 + largo); i++) {
      const p = bordesSauce([pts[Math.max(0, i - 1)], pts[i], pts[Math.min(pts.length - 1, i + 1)]],
        [anchos[i], anchos[i], anchos[i]], u).izq[1];
      const temblor = (azar() - 0.5) * 1.5 * geo.k;
      if (i === i0) g.moveTo(p[0] + temblor, p[1] + temblor); else g.lineTo(p[0] + temblor, p[1] + temblor);
    }
    g.strokeStyle = claro ? SAUCE_CORTEZA.luz : SAUCE_CORTEZA.surco;
    g.globalAlpha = claro ? 0.4 : 0.75;
    g.lineWidth = azar.entre(1.5, claro ? 3 : 4.5) * geo.k;
    g.stroke();
  }
  g.restore();
  g.globalAlpha = 0.7;
  g.strokeStyle = SAUCE_CORTEZA.surco;
  g.lineWidth = 2 * geo.k;
  g.stroke(forma);
  g.globalAlpha = 1;
}

// Ramas que salen de un tronco
function ramasDeTronco(g, tr, azar, geo, anclas, fuerza, color) {
  // La copa: en la punta el tronco se abre en varias ramas (no termina cortado)
  const fin = tr.pts.length - 1, pf = tr.pts[fin], pa = tr.pts[fin - 3];
  const dirFin = Math.atan2(pf[1] - pa[1], pf[0] - pa[0]);
  for (let i = 0; i < 3; i++) {
    rama(g, pf[0], pf[1], dirFin + (i - 1) * azar.entre(0.35, 0.7), azar.entre(0.2, 0.45) * geo.R * fuerza,
      tr.anchos[fin] * 0.9, 0, azar, geo, anclas, color);
  }
  const n = 3 + Math.floor(azar() * 4);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(azar.entre(0.3, 0.95) * (tr.pts.length - 1));
    const p = tr.pts[k], q = tr.pts[Math.min(tr.pts.length - 1, k + 1)];
    const dir = Math.atan2(q[1] - p[1], q[0] - p[0]) + (azar() < 0.5 ? -1 : 1) * azar.entre(0.35, 1.1);
    rama(g, p[0], p[1], dir, azar.entre(0.25, 0.7) * geo.R * fuerza, tr.anchos[k] * 0.2, 0, azar, geo, anclas, color);
  }
}

// Una rama finita y apenas curva, con sus ramitas; guarda de dónde cuelgan las cortinas
function rama(g, x, y, ang, largo, ancho, nivel, azar, geo, anclas, color) {
  const pasos = 14, giro = azar.entre(-0.5, 0.5);
  g.lineCap = 'round';
  g.strokeStyle = color;
  let px = x, py = y, a = ang;
  for (let i = 1; i <= pasos; i++) {
    a += giro / pasos;
    const nx = px + Math.cos(a) * largo / pasos, ny = py + Math.sin(a) * largo / pasos;
    g.lineWidth = Math.max(1.2 * geo.k, ancho * (1 - 0.7 * i / pasos));
    g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
    if (anclas && i % 2 === 0) anclas.push([nx, ny]);
    if (nivel < 2 && i > 3 && azar() < 0.16) {
      rama(g, nx, ny, a + (azar() < 0.5 ? -1 : 1) * azar.entre(0.4, 1), largo * azar.entre(0.35, 0.6),
        ancho * 0.5, nivel + 1, azar, geo, anclas, color);
    }
    px = nx; py = ny;
  }
}

// ---------- Hojas ----------

// Elige de qué rama cuelga una cortina. Las ramas se juntan hacia el centro, así que ahí se
// eligen menos: el centro queda más abierto y se ve el cielo
function elegirAncla(anclas, azar, geo) {
  for (let i = 0; i < 12; i++) {
    const A = anclas[Math.floor(azar() * anclas.length)];
    const r = Math.hypot(A[0] - geo.cx, A[1] - geo.cy) / geo.R;
    if (azar() < Math.min(1, Math.max(0.03, (r - 0.28) / 0.4))) return A;
  }
  return anclas[Math.floor(azar() * anclas.length)];
}

// Una cortina: cuelga de A hacia afuera del círculo, con hojas a los dos lados
function nuevaCortina(azar, geo, A, escala) {
  const haciaAfuera = Math.atan2(A[1] - geo.cy, A[0] - geo.cx) + azar.entre(-0.9, 0.9);
  const largo = azar.entre(160, 460) * geo.k * escala;
  const hojas = [];
  const n = Math.floor(azar.entre(14, 26));
  for (let i = 0; i < n; i++) {
    hojas.push({
      s: (i + azar()) / n,
      lado: i % 2 ? 1 : -1,
      giro: azar.entre(0.2, 0.6),
      l: azar.entre(34, 72) * geo.k * escala,
      w: azar.entre(3, 5.5) * geo.k * escala,
      // más claras las que están cerca del centro (les da el cielo)
      color: Math.max(0, Math.min(SAUCE_HOJAS.length - 1,
        Math.floor(azar() * 3 + 2 * (1 - Math.hypot(A[0] - geo.cx, A[1] - geo.cy) / geo.R)))),
    });
  }
  return { x: A[0], y: A[1], ang: haciaAfuera, largo, hojas, fase: azar() * 10, f: azar.entre(0.6, 1.1) };
}

// Dónde está cada hoja de una cortina en el instante t (meneo = cuánto se mece)
function hojaEnCortina(c, h, t, meneo) {
  const onda = Math.sin(t * c.f + c.fase + h.s * 2.2);
  const lateral = meneo * 0.09 * c.largo * Math.pow(h.s, 1.5) * onda;
  const ca = Math.cos(c.ang), sa = Math.sin(c.ang);
  const x = c.x + ca * c.largo * h.s - sa * lateral;
  const y = c.y + sa * c.largo * h.s + ca * lateral;
  const a = c.ang + 0.14 * meneo * h.s * onda + h.lado * h.giro;
  return [x, y, a];
}

// Una hoja de sauce: larga, angosta y con punta
function trazarHoja(g, x, y, a, l, w) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const tx = x + ca * l, ty = y + sa * l;
  const mx = x + ca * l * 0.45, my = y + sa * l * 0.45;
  g.moveTo(x, y);
  g.quadraticCurveTo(mx - sa * w, my + ca * w, tx, ty);
  g.quadraticCurveTo(mx + sa * w, my - ca * w, x, y);
}

// Manchas de follaje: el verde que llena todo entre las hojas sueltas
function follaje(g, azar, geo, cuantas, colores, alfa, anclas) {
  for (let i = 0; i < cuantas; i++) {
    let x, y;
    if (anclas && anclas.length && azar() < 0.7) [x, y] = elegirAncla(anclas, azar, geo);
    else {
      const a = azar() * Math.PI * 2, r = Math.sqrt(azar.entre(0.05, 1.1)) * geo.R;
      x = geo.cx + Math.cos(a) * r; y = geo.cy + Math.sin(a) * r;
    }
    const rad = azar.entre(60, 220) * geo.k;
    const c = colores[Math.floor(azar() * colores.length)];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, c);
    gr.addColorStop(1, c.replace(/[\d.]+\)$/, '0)'));   // el mismo color, transparente
    g.globalAlpha = alfa;
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalAlpha = 1;
}

function hojasEstaticas(g, azar, geo, cuantas, { palette, alfa, escala, anclas, borde }) {
  const cortinas = [];
  for (let i = 0; i < cuantas; i++) {
    let A;
    if (anclas && anclas.length && azar() < 0.92) A = elegirAncla(anclas, azar, geo);
    else {
      const a = azar() * Math.PI * 2;
      const r = (borde ? azar.entre(0.75, 1.05) : Math.sqrt(azar.entre(0.02, 1.1))) * geo.R;
      A = [geo.cx + Math.cos(a) * r, geo.cy + Math.sin(a) * r];
    }
    cortinas.push(nuevaCortina(azar, geo, A, escala));
  }
  g.globalAlpha = alfa;
  for (let k = 0; k < palette.length; k++) {
    g.fillStyle = palette[k];
    g.beginPath();
    for (const c of cortinas) for (const h of c.hojas) {
      if (Math.min(palette.length - 1, h.color) !== k) continue;
      const [x, y, a] = hojaEnCortina(c, h, 0, 0);
      trazarHoja(g, x, y, a, h.l, h.w);
    }
    g.fill();
  }
  g.globalAlpha = 1;
}

function armarCortinas(azar, geo, anclas, cuantas) {
  Sauces.cortinas = [];
  for (let i = 0; i < cuantas && anclas.length; i++) {
    Sauces.cortinas.push(nuevaCortina(azar, geo, elegirAncla(anclas, azar, geo), 1.1));
  }
  // Agrupadas por color: se pinta cada color de una sola vez
  Sauces.porColor = SAUCE_HOJAS.map(() => []);
  for (const c of Sauces.cortinas) for (const h of c.hojas) Sauces.porColor[h.color].push([c, h]);
}

// ---------- Cada cuadro ----------

function dibujarSauces({ m, dt, rafaga }) {
  const S = CONFIG.sauces;
  if (!Sauces.planos || Sauces.ancho !== width || Sauces.alto !== height) armarSauces();
  Sauces.t += dt;
  const t = Sauces.t, g = drawingContext, { cx, cy } = Sauces.geo;
  const viento = (CONFIG.oleaje && CONFIG.oleaje.viento) || 0;
  const meneo = S.viento * (0.6 + 1.4 * viento + 2.2 * (estado.vientoTormenta || 0)) * (rafaga || 1);

  g.save();
  recortarDomo();
  // La opacidad de la capa (el fundido al entrar o salir): todo lo de acá la respeta
  const base = g.globalAlpha;
  // Al entrar, la escena llega con un acercamiento suave (y se aleja al irse)
  const op = CONFIG.capas.sauces.opacidad;
  const entrada = 1 + 0.16 * (1 - op) * (1 - op);

  // El video, de base (si no hay video, el cielo de los sauces dibujados)
  if (S.video > 0.003) dibujarVideosSauces(g, base * S.video, entrada);
  // Los sauces dibujados, encima y cuanto se pida (si no hay video, enteros)
  const dibujo = S.video > 0.003 ? S.dibujo : 1;
  if (dibujo > 0.003) {
    // Cada plano se mece distinto: el de cerca, más (así se siente la profundidad)
    const mecer = [0.002, 0.004, 0.009], ritmo = [0.21, 0.27, 0.33];
    const plano = (i, extra) => {
      g.save();
      g.globalAlpha = base * dibujo;
      g.translate(cx, cy);
      g.rotate(meneo * mecer[i] * Math.sin(t * ritmo[i] + i * 1.7));
      const e = (1.035 + 0.004 * Math.sin(t * 0.17 + i)) * entrada;
      g.scale(e, e);
      g.translate(-cx, -cy);
      g.drawImage(Sauces.planos[i], 0, 0);
      if (extra) extra();
      g.restore();
    };
    // Con video, el plano lejano (que es el cielo y tapa todo) no va: se ve el video
    if (S.video <= 0.003) plano(0);
    plano(1, () => dibujarCortinas(g, t, meneo));
    plano(2);
  }
  g.globalAlpha = base;

  // El cielo del video es blanco: "darken" lo vuelve azul y deja como están los verdes y los troncos
  if (S.video > 0.003 && S.cieloAzul > 0) {
    g.globalCompositeOperation = 'darken';
    g.globalAlpha = base * S.cieloAzul;
    const az = g.createRadialGradient(cx, cy, 0, cx, cy, Sauces.geo.R);
    az.addColorStop(0, '#b4dcfb');
    az.addColorStop(1, '#86bdf0');
    g.fillStyle = az;
    g.fillRect(0, 0, width, height);
    g.globalAlpha = base;
    g.globalCompositeOperation = 'source-over';
  }

  // La luz: el color del momento del día y lo que oscurece la noche o el cielo nublado
  const luz = Math.max(0, luzDelDia() * (1 - 0.45 * (estado.nublado || 0)) * S.luz);
  const tinte = (m && m.luz ? m.luz : [1, 1, 1]).map((v) => 0.82 + 0.18 * v);
  const k = Math.min(1, 0.2 + 0.8 * luz);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgb(${tinte.map((v) => Math.round(255 * v * k)).join(',')})`;
  g.fillRect(0, 0, width, height);
  if (luz > 1) {
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(200, 230, 170, ${Math.min(0.4, (luz - 1) * 0.25)})`;
    g.fillRect(0, 0, width, height);
  }
  // El sol que se cuela entre las hojas
  if (S.destellos > 0 && luz > 0.05) {
    g.globalCompositeOperation = 'lighter';
    const [r, gg, b] = tinte.map((v) => Math.round(255 * v));
    for (const d of Sauces.destellos) {
      const a = Math.pow(Math.max(0, Math.sin(t * d.f + d.fase)), 8) * 0.7 * S.destellos * Math.min(1, luz);
      if (a < 0.01) continue;
      const rad = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.tam);
      rad.addColorStop(0, `rgba(${r},${gg},${b},${a})`);
      rad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = rad;
      g.fillRect(d.x - d.tam, d.y - d.tam, d.tam * 2, d.tam * 2);
    }
  }
  dibujarCantosSauces(g, t);
  // Invertir el color (negativo): se copia la imagen ya armada sobre sí misma con el filtro invert
  // del navegador (en 1 es el negativo; en el medio, a mitad de camino). Solo adentro del círculo.
  if (S.invertir > 0.003) {
    g.filter = `invert(${Math.min(1, S.invertir)})`;
    g.globalAlpha = base;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(g.canvas, 0, 0, width, height);
    g.filter = 'none';
  }
  g.restore();
}

// Cada canto de un pájaro (musica.js) se ve como una luz que cruza el follaje, del lado donde
// suena (p0 → p1: de -1 a 1, el mismo lado que en el sonido)
function sauceCanto(p0, p1, retraso, dur) {
  if (!Sauces.geo || Sauces.cantos.length > 40) return;
  const base = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;   // arriba en la pantalla, más o menos
  Sauces.cantos.push({
    t0: Sauces.t + retraso, dur: Math.max(0.3, dur),
    a0: base + p0 * 1.6, a1: base + p1 * 1.6,
    r0: 0.3 + Math.random() * 0.5, r1: 0.3 + Math.random() * 0.5,
  });
}

function dibujarCantosSauces(g, t) {
  const S = CONFIG.sauces, { cx, cy, R, k } = Sauces.geo;
  Sauces.cantos = Sauces.cantos.filter((c) => t < c.t0 + c.dur + 0.6);
  if (!S.pajaros) return;
  g.globalCompositeOperation = 'lighter';
  for (const c of Sauces.cantos) {
    const u = (t - c.t0) / c.dur;
    if (u < 0) continue;
    // aparece, cruza y se apaga (con un poquito de cola después del canto)
    const fuerza = S.pajaros * (u < 1 ? Math.sin(Math.PI * Math.min(1, u * 1.3)) * 0.6 + 0.4 : Math.max(0, 1 - (u - 1) * c.dur / 0.6)) ;
    for (let j = 0; j < 5; j++) {   // la luz y su estela
      const v = Math.max(0, Math.min(1, u - j * 0.06));
      const a = c.a0 + (c.a1 - c.a0) * v, r = (c.r0 + (c.r1 - c.r0) * v) * R;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const tam = (j ? 26 : 64) * k * (1 - j * 0.12);
      const alfa = Math.min(1, fuerza * (j ? 0.35 : 0.8) * (1 - j * 0.15));
      if (alfa < 0.01) continue;
      const rad = g.createRadialGradient(x, y, 0, x, y, tam);
      rad.addColorStop(0, `rgba(255, 244, 205, ${alfa})`);
      rad.addColorStop(0.4, `rgba(255, 220, 150, ${alfa * 0.45})`);
      rad.addColorStop(1, 'rgba(255, 210, 140, 0)');
      g.fillStyle = rad;
      g.fillRect(x - tam, y - tam, tam * 2, tam * 2);
    }
  }
  g.globalCompositeOperation = 'source-over';
}

function dibujarCortinas(g, t, meneo) {
  // Los tallitos de las cortinas (con la opacidad que traiga, así respetan el fundido)
  const base = g.globalAlpha;
  g.strokeStyle = '#59633f';
  g.globalAlpha = base * 0.7;
  g.lineWidth = 1.2 * Sauces.geo.k;
  g.beginPath();
  for (const c of Sauces.cortinas) {
    for (let i = 0; i <= 6; i++) {
      const [x, y] = hojaEnCortina(c, { s: i / 6, lado: 0, giro: 0 }, t, meneo);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
  }
  g.stroke();
  g.globalAlpha = base;
  // Las hojas, de a un color por vez
  for (let k = 0; k < SAUCE_HOJAS.length; k++) {
    g.fillStyle = SAUCE_HOJAS[k];
    g.beginPath();
    for (const [c, h] of Sauces.porColor[k]) {
      const [x, y, a] = hojaEnCortina(c, h, t, meneo);
      trazarHoja(g, x, y, a, h.l, h.w);
    }
    g.fill();
  }
}

function panelSauces(g) {
  const S = configSauces();
  g.add(S, 'video', 0, 1, 0.01).name('videos de los sauces');
  g.add(S, 'lento', 0.1, 1, 0.01).name('velocidad del video (1 = real)');
  g.add(S, 'invertir', 0, 1, 0.01).name('invertir el color');
  g.add(S, 'giro', 0, 4, 0.01).name('cuánto gira el video');
  g.add(S, 'cieloAzul', 0, 1, 0.01).name('cielo azul (sobre el video)');
  g.add(S, 'dibujo', 0, 1, 0.01).name('sauces dibujados encima');
  g.add(S, 'viento', 0, 3, 0.01).name('cuánto se mecen (los dibujados)');
  g.add(S, 'luz', 0.3, 2, 0.01).name('luz');
  g.add(S, 'destellos', 0, 2, 0.01).name('sol entre las hojas');
  g.add(S, 'pajaros', 0, 2, 0.01).name('luz de los cantos de pájaros');
  g.add(S, 'sauces', 0.3, 2.5, 0.05).name('cuántos sauces').onFinishChange(armarSauces);
  g.add(S, 'cortinas', 20, 400, 1).name('cortinas que se mueven').onFinishChange(armarSauces);
  g.add({ otra: () => { S.semilla++; armarSauces(); } }, 'otra').name('🌿 otros sauces (otra forma)');
}

registrarCapa({
  id: 'sauces',
  nombre: 'sauces (verde inmersivo)',   // (no cambiar: el Korg los encuentra por este nombre)
  tipo: 'dibujo',
  // Es una escena entera (tapa lo de abajo): se turna con los ríos, y arranca apagada
  grupo: 'rio',
  defecto: { opacidad: 0, mezcla: 'normal' },
  iniciar: () => { configSauces(); armarSauces(); iniciarVideosSauces(); },
  actualizar: actualizarVideosSauces,
  dibujar: dibujarSauces,
  panel: panelSauces,
});
