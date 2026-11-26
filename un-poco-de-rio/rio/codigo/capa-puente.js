// Capa "puente": un recorrido inmersivo por el puente Rosario–Victoria, en neón. La cámara va
// sobre el tablero y avanza sin parar hacia el infinito: el camino dobla suave, sin fin (la curva
// cambia con la distancia recorrida), una torre tras otra va pasando con su abanico de cables
// por encima y por los costados, y todo se achica y se pierde en el horizonte.
// (Referencias: referencias_visuales/, los puente-*.jpg.)
//
// No es un dibujo plano: el puente está armado en metros, en 3D, y se proyecta con una cámara en
// perspectiva. Por eso la curva, los ángulos de los cables y el achicarse de todo salen solos. La
// cámara es la misma que la del río real (foco y horizonte, y en el domo, su ojo de pez): con las
// dos capas prendidas coinciden, y el cielo y el sol del atardecer son los del río real.
//
// Es una capa de dibujo (líneas con brillo). Arranca apagada y con mezcla "sumar": los colores suman
// luz sobre el río que tenga abajo. "armar la escena" (en su carpeta, o ?escena=puente en la URL)
// deja todo listo: atardecer fijo, río real con el horizonte donde corresponde (y su cielo ajustado) y el puente prendido.
//
// Cómo está armado el dibujo: un punto del puente se ubica con tres números, (d, w, Y): d = metros
// por el camino hacia adelante, w = metros a la derecha del centro del tablero, Y = metros sobre el
// agua. El camino se construye cada cuadro (construirCamino) y de ahí salen las posiciones reales.

const PUENTE_DEFECTO = {
  velocidad: 30,       // metros por segundo que avanza la cámara (30 = 108 km/h)
  curva: 1,            // cuánto dobla el camino (0 = recto, 2 = mucho)
  horizonte: 0.5,      // altura del horizonte en la imagen, de abajo hacia arriba (0.5 = al medio; igual que el río real)
  alturaCamara: 1.8,   // metros sobre el tablero
  alcance: 1800,       // hasta dónde se dibuja, en metros (más lejos = más trabajo para la placa de video)
  cadaTorre: 420,      // metros entre torre y torre
  altoTorre: 90,       // metros
  altoTablero: 28,     // metros sobre el agua
  anchoTablero: 18,    // metros entre los dos planos de cables
  abertura: 14,        // metros entre las patas de cada torre, abajo (arriba se juntan)
  cables: 14,          // cables a cada lado de la torre, en cada plano
  tono: 330,           // color de partida, de 0 a 360 (330 = rosa, 190 = cian, 50 = dorado)
  abanico: 80,         // cuánto cambia el color a lo largo del puente (con el tiempo corre como una ola)
  brillo: 1,
  grosor: 1,
  bpm: 0,              // pulsos de luz por minuto (0 = sin pulso)
  destellos: 1,        // cuánto sube la luz con cada pulso, destello a mano o torre que pasa
  luces: 1,            // luces del tablero y de los postes
  calzada: 0.8,        // cuánto se oscurece el tablero (0 = transparente): se siente que vamos sobre él y el neón resalta
  resplandor: 0.5,     // brillo del horizonte
  pasaje: 6,           // segundos de los pasajes lentos (botones bajo / medio / alto)
  ritmo: 'semi semi corchea negra negra',   // cómo late el pulso (PUENTE_RITMOS); bpm es la velocidad de la negra
};

// Ritmos del pulso, contados en semicorcheas (4 por tiempo). Cada golpe: [dónde empieza,
// cuánto dura, fuerza]. "semi semi corchea negra negra": semicorchea, semicorchea, corchea,
// negra, negra; dura tres tiempos (se siente en 3/4):
//   tiempo:  1 . . .  2 . . .  3 . . .
//   golpe:   X X X .  X . . .  X . . .
// Lo siguen la luz del puente y el golpe grave de la música (musica.js).
const PUENTE_RITMOS = {
  'semi semi corchea negra negra': { largo: 12, golpes: [[0, 1, 1], [1, 1, 0.8], [2, 2, 0.85], [4, 4, 0.95], [8, 4, 0.9]] },
  negras: { largo: 4, golpes: [[0, 4, 1]] },
};

// El golpe que está sonando en la semicorchea "semis" (contando desde el principio), y cuánto
// pasó de él (u: 0 recién empieza, 1 terminó). null = silencio.
function golpeRitmo(semis) {
  const R = PUENTE_RITMOS[CONFIG.puente.ritmo] || PUENTE_RITMOS.negras;
  const p = ((semis % R.largo) + R.largo) % R.largo;
  for (const g of R.golpes) if (p >= g[0] && p < g[0] + g[1]) return { inicio: g[0], dura: g[1], fuerza: g[2], u: (p - g[0]) / g[1] };
  return null;
}

const Puente = { t: 0, s: 0, destello: 0, camino: null, soltarDia: null, pasajes: {} };

function iniciarPuente() {
  CONFIG.puente = Object.assign({}, PUENTE_DEFECTO, CONFIG.puente);
}

// Un destello a mano (botón del panel, asignable al MIDI): todo se enciende y se va apagando
function destellarPuente() {
  Puente.destello = 1;
}

// Deja lista la escena del puente: el día clavado en el atardecer, el río real (con el horizonte
// donde lo tiene el puente) y el puente, y el río marrón apagado. inmediato = sin pasaje (para la URL).
function escenaPuente(inmediato) {
  // El cielo del río real, ajustado para que el atardecer se parezca a las fotos: oscuro arriba y naranja
  // junto al horizonte (con los valores de siempre queda muy claro y el neón se lava). Quedan en la
  // carpeta de la capa río real, por si querés volver a los de antes.
  Object.assign(CONFIG.playa, { horizonte: CONFIG.puente.horizonte, cieloAlto: 0.22, cieloGris: 0.1, crepusculo: 0.45, exposicion: 0.75 });
  // El día se clava en el atardecer mientras dura el pasaje y después se suelta solo: sigue
  // corriendo desde el atardecer (no queda trabado)
  estado.diaFijo = 0.74;
  irAlMomento(0.74);
  clearTimeout(Puente.soltarDia);
  Puente.soltarDia = setTimeout(() => { estado.diaFijo = null; }, (inmediato ? 0.5 : CONFIG.transicionCapas + 0.5) * 1000);
  const apagar = (id) => (inmediato ? (CONFIG.capas[id].opacidad = 0) : irOpacidad(id, 0));
  const prender = (id) => (inmediato ? (CONFIG.capas[id].opacidad = 1) : irOpacidad(id, 1));
  prender('rioReal');
  prender('puente');
  apagar('rioMarron');
}

// ---------- El camino ----------

// El camino dobla con dos ondas lentas que se suman: la curvatura (rad/m) depende de cuánto se
// recorrió (s), así que no se repite y nunca termina. rumbo(s) es hacia dónde mira el camino en s.
const CURVATURA = [{ A: 0.00085, L: 300, p: 0 }, { A: 0.0006, L: 121, p: 1.3 }];
function rumbo(s, curva) {
  return CURVATURA.reduce((h, o) => h - curva * o.A * o.L * Math.cos(s / o.L + o.p), 0);
}

// El camino que se ve desde la cámara, de 0 a "alcance" metros: para cada paso, dónde está
// (x a la derecha, z adelante) y hacia dónde mira (phi). Es relativo a la cámara, que mira siempre
// recto en la dirección del camino donde está parada.
function construirCamino(P) {
  const paso = 8, n = Math.ceil(P.alcance / paso) + 2;
  const xs = new Float32Array(n), zs = new Float32Array(n), ph = new Float32Array(n);
  const H0 = rumbo(Puente.s, P.curva);
  let x = 0, z = 0;
  for (let i = 0; i < n; i++) {
    const d = i * paso;
    xs[i] = x; zs[i] = z; ph[i] = rumbo(Puente.s + d, P.curva) - H0;
    const mitad = rumbo(Puente.s + d + paso / 2, P.curva) - H0;
    x += Math.sin(mitad) * paso;
    z += Math.cos(mitad) * paso;
  }
  Puente.camino = { paso, n, xs, zs, ph };
}

// Un punto (d, w, Y) → [X, Y, Z] relativo a la cámara. Detrás de la cámara el camino sigue recto.
function mundo(d, w, Y) {
  const c = Puente.camino;
  if (d <= 0) return [w, Y, d];
  const f = Math.min(d / c.paso, c.n - 1.001);
  const i = Math.floor(f), u = f - i;
  const x = c.xs[i] + (c.xs[i + 1] - c.xs[i]) * u;
  const z = c.zs[i] + (c.zs[i + 1] - c.zs[i]) * u;
  const phi = c.ph[i] + (c.ph[i + 1] - c.ph[i]) * u;
  return [x + w * Math.cos(phi), Y, z - w * Math.sin(phi)];
}

// ---------- Cámara ----------

const Z_CERCA = 2.5;   // lo que está más cerca que esto (o atrás) no se dibuja

// Un punto del mundo → pixel de una imagen en perspectiva (antes del ojo de pez). Es la misma
// cámara que la del río real: foco 1,2 (de la altura de la imagen) y el horizonte donde lo pone él.
function aImagen([X, Y, Z], g) {
  return [g.cx + g.F * X / Z, g.hy + g.F * (g.ojoY - Y) / Z];
}

// Pixel de la imagen en perspectiva → pixel de la pantalla. En el domo, la misma lente de
// ojo de pez que usa el río real (shaders/playa.js, ojoDePez)
function aPantalla([x, y], g) {
  if (!DOMO) return [x, y];
  const sx = (x - g.cx) / (width / 2), sy = (y - g.cy) / (height / 2);
  const rho = Math.hypot(sx, sy);
  if (rho < 1e-6) return [g.cx, g.cy];
  const r = Math.atan(rho * g.tanCampo) / g.campo;
  return [g.cx + sx / rho * r * width / 2, g.cy + sy / rho * r * height / 2];
}

// Una línea de puntos del mundo → puntos de pantalla, cortada donde se pasa por detrás de la cámara.
// En el domo la línea se parte en tramos cortos, porque el ojo de pez la curva.
function camino3(puntos, g) {
  const v = [];
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i], ant = puntos[i - 1];
    if (p[2] >= Z_CERCA) {
      if (ant && ant[2] < Z_CERCA) v.push(cortar(ant, p));
      v.push(p);
    } else if (ant && ant[2] >= Z_CERCA) {
      v.push(cortar(p, ant));
      break;
    }
  }
  if (v.length < 2) return [];
  const imagen = v.map((p) => aImagen(p, g));
  if (!DOMO) return imagen;
  const salida = [aPantalla(imagen[0], g)];
  for (let i = 1; i < imagen.length; i++) {
    const a = imagen[i - 1], b = imagen[i];
    const n = Math.min(30, Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 48)));
    for (let k = 1; k <= n; k++) salida.push(aPantalla([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n], g));
  }
  return salida;
}

// Donde el segmento de a (cerca) a b cruza el plano de Z_CERCA
function cortar(a, b) {
  const t = (Z_CERCA - a[2]) / (b[2] - a[2]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Z_CERCA];
}

// ---------- Dibujo ----------

const hsla = (h, s, l, a) => `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${Math.max(0, Math.min(1, a))})`;

// Las líneas de neón no se pintan una por una (miles de trazos, cada uno con su color convertido a texto,
// son carísimos): se juntan en lotes por color, transparencia y grosor, y se pintan de a un lote al final
// (vaciarLotes). Las que quedan fuera de la imagen se descartan. Cada lote se pinta en tres pasadas: un
// halo ancho y tenue, otro más angosto y el núcleo casi blanco. "fino" saltea el halo ancho.
const Lotes = { neon: new Map(), brillos: new Map() };

function enLote(mapa, tono, a, gro, pts, extra) {
  if (pts.length < 2 || a < 0.01) return;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < -30 || x0 > width + 30 || y1 < -30 || y0 > height + 30) return;
  const t = Math.round(tono / 10) * 10, aa = Math.round(a * 10) / 10, gg = Math.round(gro * 2) / 2 || 0.5;
  const clave = t + '|' + aa + '|' + gg + '|' + extra;
  let lote = mapa.get(clave);
  if (!lote) mapa.set(clave, (lote = { tono: t, a: aa, gro: gg, fino: extra === 1, lineas: [] }));
  lote.lineas.push(pts);
}

function neon(c, pts, tono, a, g, fino) {
  enLote(Lotes.neon, tono, a, g, pts, fino ? 1 : 0);
}

// Un destello que corre por la línea: un tramo corto de la línea, en la posición u (0 a 1) de su largo
function paquete(pts, tono, a, g, u) {
  if (pts.length < 2) return;
  const acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acum[acum.length - 1];
  if (total < 40) return;
  const a0 = fract(u) * total * 0.93, a1 = a0 + total * 0.07;
  const punto = (largo) => {
    let i = 1;
    while (i < acum.length - 1 && acum[i] < largo) i++;
    const k = (largo - acum[i - 1]) / Math.max(acum[i] - acum[i - 1], 1e-6);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  };
  enLote(Lotes.brillos, tono, a, g, [punto(a0), punto(a1)], 0);
}

function pintarLote(c, lote, pasadas) {
  c.beginPath();
  for (const pts of lote.lineas) {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  }
  for (const [ancho, sat, luz, alfa] of pasadas) {
    c.lineWidth = lote.gro * ancho;
    c.strokeStyle = hsla(lote.tono, sat, luz, alfa * lote.a);
    c.stroke();
  }
}

function vaciarLotes(c) {
  for (const lote of Lotes.neon.values()) {
    pintarLote(c, lote, lote.fino
      ? [[2.2, 100, 60, 0.28], [0.9, 55, 88, 0.95]]
      : [[5, 100, 55, 0.1], [2.2, 100, 60, 0.28], [0.9, 55, 88, 0.95]]);
  }
  c.lineCap = 'round';
  for (const lote of Lotes.brillos.values()) pintarLote(c, lote, [[1.7, 40, 94, 1]]);
  c.lineCap = 'butt';
  Lotes.neon.clear();
  Lotes.brillos.clear();
}

// Una línea a lo largo del camino (w a un costado, Y de alto) que se va apagando con la distancia:
// lejos, las líneas del tablero se juntan en el horizonte y sumadas harían un bloque de luz
function neonLejos(c, g, P, tramo, w, Y, tono, a, gro) {
  for (let i = 0; i < tramo.length - 1; i += 9) {
    const trozo = tramo.slice(i, i + 10);
    const medio = trozo[trozo.length >> 1];
    const f = 1 - 0.95 * Math.pow(medio / P.alcance, 0.45);
    neon(c, camino3(trozo.map((d) => mundo(d, w, Y)), g), tono, a * f, gro);
  }
}

// El color de un lugar del camino: cambia a lo largo (y con el tiempo, corre como una ola)
function tonoEn(P, s) {
  return P.tono + P.abanico * (0.5 + 0.5 * Math.sin(s / 170 - Puente.t * 0.7));
}

// Una torre con su abanico de cables. dT = a cuántos metros adelante está (si es negativo, ya la pasamos).
function dibujarTorre(c, g, P, luz, sT, dT) {
  const deck = P.altoTablero, Yt = P.altoTorre, hw = P.anchoTablero / 2 + 1.5;
  const s0 = P.abertura, s1 = 1.5;
  const sepA = (Y) => s0 + (s1 - s0) * (Y / Yt);   // separación de las patas a esa altura
  const lejos = Math.max(0, dT) / P.alcance;
  const desvanece = 1 - 0.97 * Math.pow(lejos, 0.5);
  // Al pasar por debajo de una torre, un destello: se enciende toda y se va apagando
  const pasaje = 1 + 1.4 * P.destellos * Math.exp(-Math.abs(dT) / 70);
  const a = desvanece * luz * pasaje;
  const gro = g.grosor * (1.4 - 0.6 * lejos);
  const tono0 = tonoEn(P, sT);

  // Las patas (dos por plano), abiertas abajo y juntas arriba, y las vigas que las unen
  for (const plano of [-1, 1]) {
    for (const lado of [-1, 1]) {
      neon(c, camino3([mundo(dT + lado * s0, plano * hw, 0), mundo(dT + lado * s1, plano * hw, Yt)], g), tono0, a, gro * 1.5);
    }
    for (const Y of [Yt * 0.92, deck - 6]) {
      neon(c, camino3([mundo(dT - sepA(Y), plano * hw, Y), mundo(dT + sepA(Y), plano * hw, Y)], g), tono0 + 20, 0.9 * a, gro);
    }
  }
  neon(c, camino3([mundo(dT, -hw, Yt * 0.92), mundo(dT, hw, Yt * 0.92)], g), tono0 + 20, 0.9 * a, gro);   // la viga entre planos

  // El abanico: de la torre al tablero, a los dos lados y en los dos planos. Los más largos agarran
  // más arriba. Lejos se dibujan menos cables (no se distinguen) para no gastar de más.
  const n = Math.max(1, Math.round(P.cables));
  const paso = lejos > 0.45 ? 3 : lejos > 0.2 ? 2 : 1;
  for (const lado of [-1, 1]) {
    for (const plano of [-1, 1]) {
      for (let i = 0; i < n; i += paso) {
        const u = n > 1 ? i / (n - 1) : 0;
        const dA = dT + lado * (26 + i * 15);                   // dónde agarra en el tablero
        const Ya = Yt * (0.55 + 0.43 * u);                       // dónde agarra en la torre
        const tono = tonoEn(P, sT + lado * (26 + i * 15)) + (lado > 0 ? 18 : 0);
        const parpadeo = 0.82 + 0.18 * Math.sin(Puente.t * 6 + i * 1.9 + plano + lado);
        const pts = camino3([mundo(dT + lado * sepA(Ya), plano * hw, Ya), mundo(dA, plano * hw, deck)], g);
        neon(c, pts, tono, 0.8 * parpadeo * a, gro * 0.8, true);
        // Destellos que suben y bajan por los cables más cercanos
        if (lejos < 0.3) {
          const sentido = lado > 0 ? 1 : -1;
          paquete(pts, tono, 0.9 * a, g.grosor, Puente.t * 0.35 * sentido + i * 0.137);
          paquete(pts, tono, 0.9 * a, g.grosor, Puente.t * 0.35 * sentido + i * 0.137 + 0.5);
        }
      }
    }
  }
}

function dibujarPuente({ dt }) {
  const P = CONFIG.puente, c = drawingContext;
  Puente.t += dt;
  Puente.s += P.velocidad * dt;
  Puente.destello *= Math.exp(-dt * 4);
  construirCamino(P);

  // Cuánta luz hay ahora: la base, más los pulsos (bpm) y los destellos a mano
  // En semicorcheas; con sonido, el reloj del sonido manda (así luz y golpe van juntos)
  const fase = typeof fasePulso === 'function' ? fasePulso() : null;
  const golpe = P.bpm > 0 ? golpeRitmo((fase ?? Puente.t * P.bpm / 60) * 4) : null;
  const pulso = golpe ? golpe.fuerza * Math.pow(1 - golpe.u, 4) : 0;
  const luz = Math.max(0, P.brillo) * (1 + P.destellos * Math.max(pulso, Puente.destello));

  // La cámara: la del río real (foco 1,2 de la altura de la imagen), con el horizonte de acá
  const deck = P.altoTablero, hw = P.anchoTablero / 2;
  const g = {
    cx: width / 2, cy: height / 2, F: 1.2 * height, hy: (1 - P.horizonte) * height,
    ojoY: deck + P.alturaCamara,
    grosor: Math.max(1, width / 1300) * P.grosor,
    campo: radians(constrain(CONFIG.playa ? CONFIG.playa.campo : 60, 5, 85)),
  };
  g.tanCampo = Math.tan(g.campo);

  c.save();
  recortarDomo();
  c.lineJoin = 'round';

  // Resplandor del horizonte: una franja de luz del color del puente
  if (P.resplandor > 0.01) {
    const ancho = height * 0.2;
    const grad = c.createLinearGradient(0, g.hy - ancho, 0, g.hy + ancho);
    const col = (a) => hsla(P.tono + P.abanico * 0.3, 100, 55, a * P.resplandor * Math.min(1.5, luz));
    grad.addColorStop(0, col(0));
    grad.addColorStop(0.5, col(0.3));
    grad.addColorStop(1, col(0));
    c.fillStyle = grad;
    c.fillRect(0, g.hy - ancho, width, ancho * 2);
  }

  // El tablero: los dos bordes (de cerca hasta el horizonte, con los puntos cada vez más separados),
  // las barandas y las rayas del centro, que pasan una tras otra y dan la sensación de velocidad
  const tramo = [];
  for (let i = 0; i <= 90; i++) tramo.push(2.5 * Math.pow(P.alcance / 2.5, i / 90));

  // La calzada: la superficie del tablero, oscura (con tinta, no con luz, aunque la capa sume), más
  // tenue hacia el horizonte. Es lo que hace sentir que vamos andando sobre el puente.
  if (P.calzada > 0.01) {
    const izq = camino3(tramo.map((d) => mundo(d, -hw, deck)), g);
    const der = camino3(tramo.map((d) => mundo(d, hw, deck)), g);
    if (izq.length > 1 && der.length > 1) {
      const grad = c.createLinearGradient(0, height, 0, g.hy);
      grad.addColorStop(0, `rgba(12, 7, 22, ${0.85 * P.calzada})`);
      grad.addColorStop(1, `rgba(12, 7, 22, ${0.15 * P.calzada})`);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = grad;
      // Lo más cercano (los primeros 2,5 m, que no se dibujan) sigue hasta abajo del cuadro: con el
      // horizonte alto (la cámara mira para abajo) el borde cercano se veía como una línea recta
      c.beginPath();
      c.moveTo(izq[0][0] - width, height * 2);
      izq.forEach(([x, y]) => c.lineTo(x, y));
      for (let i = der.length - 1; i >= 0; i--) c.lineTo(der[i][0], der[i][1]);
      c.lineTo(der[0][0] + width, height * 2);
      c.closePath();
      c.fill();
      c.globalCompositeOperation = MEZCLAS[CONFIG.capas.puente.mezcla] || 'source-over';
    }
  }
  const tonoD = tonoEn(P, Puente.s + 200);
  neonLejos(c, g, P, tramo, -hw, deck, tonoD, 0.9 * luz, g.grosor);
  neonLejos(c, g, P, tramo, hw, deck, tonoD, 0.9 * luz, g.grosor);
  neonLejos(c, g, P, tramo, -hw - 0.8, deck + 1.1, tonoD + 15, 0.5 * luz, g.grosor * 0.8);
  neonLejos(c, g, P, tramo, hw + 0.8, deck + 1.1, tonoD + 15, 0.5 * luz, g.grosor * 0.8);

  // Rayas del centro: cada 9 m, un trazo de 3 m. Se mueven con lo que avanzamos.
  const rayaMax = Math.min(P.alcance, 450);
  for (let sk = Math.floor(Puente.s / 9) * 9; sk - Puente.s < rayaMax; sk += 9) {
    const d = sk - Puente.s;
    if (d < 3) continue;
    const a = (1 - Math.pow(d / rayaMax, 0.7)) * 0.8 * luz;
    neon(c, camino3([mundo(d, 0, deck), mundo(d + 3, 0, deck)], g), tonoEn(P, sk), a, g.grosor * 0.8, true);
  }

  // Postes de luz, cada 36 m a los dos lados, con su lámpara en la punta
  if (P.luces > 0.01) {
    const posteMax = Math.min(P.alcance, 1000);
    for (let sk = Math.floor(Puente.s / 36) * 36; sk - Puente.s < posteMax; sk += 36) {
      const d = sk - Puente.s;
      if (d < 4) continue;
      const a = (1 - Math.pow(d / posteMax, 0.6)) * 0.85 * luz * P.luces;
      const tono = tonoEn(P, sk) + 40;
      for (const lado of [-1, 1]) {
        const w = lado * (hw + 1.2);
        neon(c, camino3([mundo(d, w, deck), mundo(d, w, deck + 11), mundo(d, w * 0.55, deck + 11.6)], g), tono, a, g.grosor * 0.8, true);
        const lampara = camino3([mundo(d, w * 0.55, deck + 11.6), mundo(d + 0.01, w * 0.55, deck + 11.6)], g);
        if (lampara.length) {
          const [x, y] = lampara[0];
          const r = Math.max(1.2, g.grosor * 3.2 * (1 - d / posteMax));
          c.fillStyle = hsla(tono - 20, 90, 82, a);
          c.fillRect(x - r / 2, y - r / 2, r, r);
        }
      }
    }
  }

  // Las torres: una cada "cadaTorre" metros. Se dibujan las que están adelante (y las que acabamos de pasar,
  // que siguen un rato encima nuestro)
  const kMin = Math.ceil((Puente.s - 240) / P.cadaTorre), kMax = Math.floor((Puente.s + P.alcance) / P.cadaTorre);
  for (let k = kMax; k >= kMin; k--) dibujarTorre(c, g, P, luz, k * P.cadaTorre, k * P.cadaTorre - Puente.s);

  vaciarLotes(c);   // se pinta todo junto, por lotes de color
  c.restore();
}

// ---------- Pasajes lentos ----------

// Los botones bajo / medio / alto (S, M y R en el Korg) llevan un ajuste de a poco hasta ese
// valor, en CONFIG.puente.pasaje segundos. Si mientras tanto movés ese control a mano (o con
// una perilla), el pasaje se corta y manda lo tuyo.
const PUENTE_PASAJES = {
  horizonte: { nombre: 'horizonte', valores: [0.3, 0.5, 0.75] },
  alturaCamara: { nombre: 'cámara', valores: [0.8, 1.8, 15] },
  grosor: { nombre: 'grosor', valores: [0.5, 1, 2.2] },
  tono: { nombre: 'color', valores: [35, 330, 195], circular: true, niveles: ['dorado', 'rosa', 'cian'] },
  altoTorre: { nombre: 'torres', valores: [55, 90, 160] },
  cadaTorre: { nombre: 'entre torres', valores: [200, 420, 800], niveles: ['juntas', 'normal', 'separadas'] },
};
const PUENTE_NIVELES = ['bajo', 'medio', 'alto'];

function pasajePuente(prop, i) {
  const P = CONFIG.puente, def = PUENTE_PASAJES[prop];
  const desde = P[prop];
  let hasta = def.valores[i];
  // El color da la vuelta por el lado más corto (de rosa a dorado pasa por el rojo, no por el verde)
  if (def.circular) hasta = desde + ((((hasta - desde) % 360) + 540) % 360 - 180);
  Puente.pasajes[prop] = { desde, hasta, t: 0, dur: Math.max(0.2, P.pasaje) };
}

function moverPasajesPuente(dt) {
  const P = CONFIG.puente;
  for (const [prop, p] of Object.entries(Puente.pasajes)) {
    p.t += dt;
    const u = Math.min(1, p.t / p.dur), suave = u * u * (3 - 2 * u);
    let v = p.desde + (p.hasta - p.desde) * suave;
    if (PUENTE_PASAJES[prop].circular) v = ((v % 360) + 360) % 360;
    P[prop] = v;
    if (prop === 'horizonte') horizonteJunto(v);
    if (u >= 1) delete Puente.pasajes[prop];
  }
}

// El río real tiene que tener el mismo horizonte que el puente (si no, el agua se despega)
function horizonteJunto(v) {
  if (CONFIG.capas.puente.opacidad > 0.01 && CONFIG.playa) CONFIG.playa.horizonte = v;
}

function panelPuente(g) {
  const P = CONFIG.puente;
  // Los que tienen pasaje lento: se ven moverse, y si los tocás se corta el pasaje
  const conPasaje = (c, prop) => c.listen().onChange(() => { delete Puente.pasajes[prop]; if (prop === 'horizonte') horizonteJunto(P.horizonte); });
  g.add({ escena: () => escenaPuente(false) }, 'escena').name('armar la escena (atardecer + río real + puente)');
  g.add({ soltar: () => { clearTimeout(Puente.soltarDia); estado.diaFijo = null; } }, 'soltar').name('soltar el día (que avance de nuevo)');
  g.add({ destello: destellarPuente }, 'destello').name('⚡ destello');
  g.add(P, 'velocidad', 0, 120, 0.5).name('velocidad (m/s)');
  g.add(P, 'curva', 0, 3, 0.01).name('cuánto dobla el camino');
  g.add(P, 'brillo', 0, 3, 0.01);
  g.add(P, 'bpm', 0, 240, 1).name('pulsos por minuto (0 = sin pulso)');
  g.add(P, 'ritmo', Object.keys(PUENTE_RITMOS)).name('ritmo del pulso').listen();
  g.add({ ritmoPatron: () => { P.ritmo = 'semi semi corchea negra negra'; } }, 'ritmoPatron').name('ritmo: semi semi corchea negra negra');
  g.add({ ritmoNegras: () => { P.ritmo = 'negras'; } }, 'ritmoNegras').name('ritmo: negras (parejo)');
  g.add(P, 'destellos', 0, 3, 0.01).name('fuerza de los pulsos y destellos');
  conPasaje(g.add(P, 'tono', 0, 360, 1).name('color (tono)'), 'tono');
  g.add(P, 'abanico', 0, 360, 1).name('cuánto cambia el color');
  conPasaje(g.add(P, 'grosor', 0.3, 4, 0.01), 'grosor');
  g.add(P, 'luces', 0, 2, 0.01).name('luces del tablero y postes');
  g.add(P, 'calzada', 0, 1, 0.01).name('calzada oscura');
  g.add(P, 'resplandor', 0, 2, 0.01).name('resplandor del horizonte');
  const f = g.addFolder('forma y lugar');
  conPasaje(f.add(P, 'horizonte', 0.2, 1.5, 0.005).name('altura del horizonte (el río real la sigue)'), 'horizonte');
  conPasaje(f.add(P, 'alturaCamara', 0.5, 40, 0.1).name('altura de la cámara (m)'), 'alturaCamara');
  conPasaje(f.add(P, 'cadaTorre', 120, 1200, 5).name('metros entre torres'), 'cadaTorre');
  conPasaje(f.add(P, 'altoTorre', 30, 200, 1).name('alto de la torre (m)'), 'altoTorre');
  f.add(P, 'altoTablero', 10, 60, 1).name('alto del tablero (m)');
  f.add(P, 'anchoTablero', 6, 40, 0.5).name('ancho del tablero (m)');
  f.add(P, 'abertura', 2, 40, 0.5).name('abertura de las patas (m)');
  f.add(P, 'cables', 3, 24, 1).name('cables por lado');
  f.add(P, 'alcance', 600, 5000, 50).name('hasta dónde se ve (m)');
  f.close();
  // Los botones de los pasajes (en el Korg: S = bajo, M = medio, R = alto)
  const p = g.addFolder('pasajes lentos');
  p.add(P, 'pasaje', 1, 30, 0.5).name('segundos del pasaje');
  for (const [prop, def] of Object.entries(PUENTE_PASAJES)) {
    PUENTE_NIVELES.forEach((nivel, i) => {
      p.add({ [prop + '_' + nivel]: () => pasajePuente(prop, i) }, prop + '_' + nivel)
        .name(def.nombre + ': ' + (def.niveles ? def.niveles[i] : nivel));
    });
  }
  p.close();
}

registrarCapa({
  id: 'puente',
  nombre: 'puente flashero (recorrido)',
  tipo: 'dibujo',
  defecto: { opacidad: 0, mezcla: 'sumar' },
  iniciar: iniciarPuente,
  actualizar: ({ dt }) => moverPasajesPuente(dt),   // los pasajes siguen aunque el puente no se vea
  dibujar: dibujarPuente,
  panel: panelPuente,
});
