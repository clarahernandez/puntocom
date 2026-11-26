// Garcitas blancas: bandaditas que cruzan la cúpula volando.
//
// Son siluetas mínimas (cuerpo, cabeza, alas y las patas que cuelgan atrás, como vuelan
// las garzas) dibujadas encima del agua. Se ven desde abajo: al aletear, las alas se
// acortan y se alargan. Cada tanto planean.
//
// Cada bandada entra por el horizonte (el borde del círculo), cruza en línea más o menos
// recta y sale por el otro lado. Cerca del borde se achican (están más lejos).
//
// Panel: carpeta "Garcitas". El botón "largar bandada" se puede asignar al MIDI.
// Modo "blancas": garcitas blancas. Modo "sombras": su sombra sobre el fondo del río.
// Con "sonido", mientras haya garcitas cruzando suena la capa "garcita blanca".

const Garzas = { bandadas: [], proxima: null, sonidoPropio: false };

// Valores por defecto: si config.js no tiene la sección "garzas" (por ejemplo, porque se
// pegó un "Copiar ajustes" de antes de que existieran), se usan estos y la obra no se rompe
CONFIG.garzas = Object.assign({
  solas: false,       // pasan solas cada tanto
  cada: [60, 180],    // segundos entre bandadas, cuando pasan solas
  modo: 'blancas',    // 'blancas' o 'sombras'
  cantidad: 5,        // garcitas por bandada
  tamano: 28,         // envergadura en pixeles, sobre 2048
  velocidad: 0.06,    // qué tan rápido cruzan
  opacidad: 0.85,
  sonido: false,      // prender el sonido de la garcita blanca mientras cruzan
}, CONFIG.garzas);

// Lanza una bandada nueva (botón del panel / MIDI)
function largarGarzas() {
  const G = CONFIG.garzas;
  const n = Math.max(1, Math.round(G.cantidad * (0.6 + 0.4 * Math.random())));
  const ang = Math.random() * TWO_PI;
  const dir = [Math.cos(ang), Math.sin(ang)];
  const perp = [-dir[1], dir[0]];
  // La bandada pasa a cierta distancia del cenit (0 = justo por arriba)
  const desvio = (Math.random() * 2 - 1) * 0.6;
  const aves = [];
  for (let i = 0; i < n; i++) {
    // Formación suelta, un poco en V: las de atrás se abren hacia los costados
    const lado = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
    aves.push({
      atras: Math.abs(lado) * 0.05 + Math.random() * 0.03,
      costado: lado * 0.04 + (Math.random() * 2 - 1) * 0.015,
      fase: Math.random() * TWO_PI,
      ritmo: 0.85 + Math.random() * 0.3,     // cada una aletea a su ritmo
      vaiven: Math.random() * TWO_PI,
      tam: 0.85 + Math.random() * 0.3,
    });
  }
  Garzas.bandadas.push({ dir, perp, desvio, s: -1.25, aves, planeo: Math.random() * 100 });
  if (G.sonido) sonidoGarzas(true);
}

// Prende la capa de sonido "garcita blanca" mientras hay garcitas (si no estaba prendida a mano)
function sonidoGarzas(prender) {
  const c = (typeof Sonido !== 'undefined') && Sonido.capas.find((x) => x.nombre === 'garcita blanca');
  if (!c) return;
  if (prender && !c.encendido) { alternarSonido(c); Garzas.sonidoPropio = c.encendido; }
  if (!prender && Garzas.sonidoPropio) { if (c.encendido) alternarSonido(c); Garzas.sonidoPropio = false; }
}

function actualizarGarzas(dt) {
  const G = CONFIG.garzas;
  // Solas: cada tanto pasa una bandada (no con tormenta fuerte)
  if (G.solas) {
    const ahora = millis() / 1000;
    if (Garzas.proxima === null) Garzas.proxima = ahora + G.cada[0] + Math.random() * (G.cada[1] - G.cada[0]);
    if (ahora >= Garzas.proxima) {
      if (estado.tormenta < 0.3) largarGarzas();
      Garzas.proxima = ahora + G.cada[0] + Math.random() * (G.cada[1] - G.cada[0]);
    }
  } else {
    Garzas.proxima = null;
  }
  for (const b of Garzas.bandadas) {
    b.s += dt * G.velocidad;
    b.planeo += dt;
    for (const a of b.aves) a.fase += dt * TWO_PI * 1.6 * a.ritmo * aleteo(b, a);
  }
  const antes = Garzas.bandadas.length;
  Garzas.bandadas = Garzas.bandadas.filter((b) => b.s < 1.25 + 0.5);
  if (antes && !Garzas.bandadas.length) sonidoGarzas(false);
}

// Cuánto aletea ahora (1 = aleteo pleno, 0 = planeando): ratos largos de aleteo y planeos cortos
function aleteo(b, a) {
  const x = Math.sin(b.planeo * 0.45 + a.vaiven * 0.3) + 0.5 * Math.sin(b.planeo * 1.1 + a.vaiven);
  return constrain(0.35 + x, 0.1, 1);
}

// ---------- Sombras (las usan garzas, kayaks y camalotes) ----------
// Desenfocar cada figura sobre la imagen de 2048 es carísimo (con muchas figuras se tilda).
// Las sombras se dibujan en una capa a 1/4 de tamaño y se pegan una sola vez, desenfocadas:
// al agrandarse ya quedan suaves.
let capaSombra = null;
function empezarSombra() {
  const w = Math.ceil(width / 4), h = Math.ceil(height / 4);
  if (!capaSombra || capaSombra.width !== w || capaSombra.height !== h) {
    capaSombra = createGraphics(w, h);
    capaSombra.pixelDensity(1);
  }
  capaSombra.clear();
  capaSombra.push();
  capaSombra.scale(w / width);
  capaSombra.noStroke();
  return capaSombra;
}
function pegarSombra(desenfoque) {
  capaSombra.pop();
  const ctx = drawingContext;
  ctx.save();
  recortarDomo();
  ctx.filter = `blur(${Math.max(1, desenfoque)}px)`;
  image(capaSombra, 0, 0, width, height);
  ctx.restore();
}
// En el domo, nada afuera del círculo
function recortarDomo() {
  if (!DOMO) return;
  const ctx = drawingContext;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, width / 2, 0, TWO_PI);
  ctx.clip();
}

// Punto del disco (-1 a 1, el centro es el cenit) → pixel de la pantalla
// (en el domo es el círculo; en pantalla común, la misma cúpula estirada a lo ancho)
function garzaEnPantalla(u, v) {
  return [width / 2 + u * width / 2, height / 2 + v * height / 2];
}

function dibujarGarzas() {
  if (!Garzas.bandadas.length) return;
  const G = CONFIG.garzas;
  const sombra = G.modo === 'sombras';
  const g = sombra ? empezarSombra() : window;
  if (!sombra) { drawingContext.save(); recortarDomo(); }
  // De noche se ven menos (las blancas reflejan la luz que haya)
  const luz = sombra ? luzDelDia() : 0.35 + 0.65 * luzDelDia();
  const alfa = G.opacidad * luz * (1 - 0.7 * estado.nublado);
  if (sombra) g.fill(25, 12, 4, 255 * alfa * 0.6);
  else g.fill(255, 255, 255, 255 * alfa);
  g.noStroke();
  // Escala del panel en pixeles: pensada para 2048 de alto
  const px = G.tamano * escalaFlotantes() * Math.min(width, height) / 2048;
  for (const b of Garzas.bandadas) {
    for (const a of b.aves) {
      const s = b.s - a.atras;
      const vaiven = 0.012 * Math.sin(b.planeo * 0.7 + a.vaiven);
      const u = b.perp[0] * (b.desvio + a.costado + vaiven) + b.dir[0] * s;
      const v = b.perp[1] * (b.desvio + a.costado + vaiven) + b.dir[1] * s;
      const r = Math.hypot(u, v);
      if (r > 1.05) continue;
      // Cerca del horizonte, más lejos: más chicas
      const tam = px * a.tam * (0.45 + 0.55 * (1 - r * r));
      const [x, y] = garzaEnPantalla(u, v);
      dibujarGarza(g, x, y, Math.atan2(b.dir[1], b.dir[0]), tam, a.fase, aleteo(b, a));
    }
  }
  if (sombra) pegarSombra(G.tamano * escalaFlotantes() * 0.06);
  else drawingContext.restore();
}

// Una garcita vista desde abajo, mirando hacia +x. t = tamaño (envergadura) en pixeles.
function dibujarGarza(g, x, y, ang, t, fase, cuanto) {
  // Al aletear, desde abajo las alas se ven más cortas arriba y más largas abajo,
  // y la punta va un poco hacia atrás
  const ala = 1 - cuanto * 0.38 * (0.5 + 0.5 * Math.sin(fase));
  const barrido = cuanto * 0.12 * Math.cos(fase);
  g.push();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(t);
  // Cuerpo, cabeza (el cuello va recogido) y pico
  g.ellipse(0, 0, 0.42, 0.1);
  g.ellipse(0.2, 0, 0.11, 0.09);
  g.triangle(0.24, -0.018, 0.24, 0.018, 0.36, 0);
  // Patas: cuelgan largas hacia atrás
  g.quad(-0.18, -0.02, -0.18, 0.02, -0.5, 0.012, -0.5, -0.012);
  // Alas (anchas y redondeadas, como las de las garzas)
  for (const lado of [-1, 1]) {
    const punta = 0.5 * ala * lado;
    g.beginShape();
    g.vertex(0.08, 0);
    g.bezierVertex(0.1, punta * 0.6, 0.02 - barrido, punta, -0.06 - barrido, punta);
    g.bezierVertex(-0.1 - barrido, punta * 0.9, -0.1, punta * 0.4, -0.1, 0);
    g.endShape(CLOSE);
  }
  g.pop();
}

// Carpeta "Garcitas" del panel
function garzasPanel(gui) {
  const G = CONFIG.garzas;
  const f = gui.addFolder('Garcitas');
  f.add({ largar: largarGarzas }, 'largar').name('🕊 largar bandada');
  f.add(G, 'solas').name('pasan solas cada tanto');
  f.add(G, 'modo', ['blancas', 'sombras']).name('cómo se ven');
  f.add(G, 'cantidad', 1, 12, 1).name('garcitas por bandada');
  f.add(G, 'tamano', 5, 120, 1).name('tamaño (px a 2048)');
  f.add(G, 'velocidad', 0.01, 0.3, 0.005).name('velocidad');
  f.add(G, 'opacidad', 0, 1, 0.01).name('opacidad');
  f.add(G, 'sonido').name('suenan al pasar');
  f.close();
}
