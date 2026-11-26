// Kayaks: grupos de kayaks de colores que cruzan el río remando, como en la travesía.
//
// Cada kayak es mínimo: el casco en punta (de uno o dos colores), la persona sentada en
// el medio y la pala que va y viene, un lado y el otro. Con cada palada el kayak se
// empuja un poquito, y deja una estela suave detrás.
//
// Un grupo entra por un borde, cruza en la misma dirección (cada uno a su ritmo, con
// algo de desorden) y sale por el otro lado. Cerca del borde del círculo se achican.
//
// Panel: carpeta "Kayaks". El botón "largar grupo" se puede asignar al MIDI.
// Modo "colores": como se ven desde arriba. Modo "sombras": su sombra sobre el fondo del río.

const Kayaks = { grupos: [], proximo: null };

// Valores por defecto (si config.js no tiene la sección "kayaks", la obra no se rompe)
CONFIG.kayaks = Object.assign({
  solos: false,       // pasan solos cada tanto
  cada: [90, 240],    // segundos entre grupos, cuando pasan solos
  modo: 'colores',    // 'colores' o 'sombras'
  cantidad: 12,       // kayaks por grupo
  tamano: 34,         // largo de cada kayak en pixeles, sobre 2048
  velocidad: 0.035,   // qué tan rápido cruzan
  opacidad: 0.95,
  estela: 0.35,       // cuánto se ve la estela (0 = nada)
}, CONFIG.kayaks);

// Colores de la travesía (como en la foto): amarillo, rojo, celeste, blanco, verde, naranja, azul, lima
const KAYAK_COLORES = ['#f2c230', '#e8452c', '#3fa9d6', '#f4f1ea', '#2fb36b', '#f08a24', '#2a4fa3', '#c8e04a'];
const KAYAK_PALAS = ['#f2c230', '#2a4fa3', '#e8452c', '#1d1d1d', '#f4f1ea'];

function largarKayaks() {
  const K = CONFIG.kayaks;
  const n = Math.max(1, Math.round(K.cantidad * (0.7 + 0.3 * Math.random())));
  const ang = Math.random() * TWO_PI;
  const dir = [Math.cos(ang), Math.sin(ang)];
  const perp = [-dir[1], dir[0]];
  const desvio = (Math.random() * 2 - 1) * 0.5;
  // El grupo es una mancha desordenada: más larga que ancha
  const ancho = 0.15 + 0.1 * Math.min(1, n / 15);
  const largo = 0.2 + 0.25 * Math.min(1, n / 15);
  const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];
  const botes = [];
  for (let i = 0; i < n; i++) {
    const casco = elegir(KAYAK_COLORES);
    botes.push({
      atras: Math.random() * largo,
      costado: (Math.random() * 2 - 1) * ancho,
      rumbo: (Math.random() * 2 - 1) * 0.12,       // cada uno apunta un poquito distinto
      ritmo: 0.85 + Math.random() * 0.35,           // paladas por segundo (más o menos)
      fase: Math.random() * TWO_PI,
      rapidez: 0.85 + Math.random() * 0.3,
      avance: 0,
      casco,
      // Algunos son de dos colores: la cubierta de otro
      cubierta: Math.random() < 0.45 ? elegir(KAYAK_COLORES.filter((c) => c !== casco)) : null,
      pala: elegir(KAYAK_PALAS),
      tam: 0.9 + Math.random() * 0.2,
    });
  }
  Kayaks.grupos.push({ dir, perp, desvio, s: -1.2, botes });
}

function actualizarKayaks(dt) {
  const K = CONFIG.kayaks;
  if (K.solos) {
    const ahora = millis() / 1000;
    const espera = () => ahora + K.cada[0] + Math.random() * (K.cada[1] - K.cada[0]);
    if (Kayaks.proximo === null) Kayaks.proximo = espera();
    if (ahora >= Kayaks.proximo) {
      if (estado.tormenta < 0.2) largarKayaks();
      Kayaks.proximo = espera();
    }
  } else {
    Kayaks.proximo = null;
  }
  for (const g of Kayaks.grupos) {
    g.s += dt * K.velocidad;
    for (const b of g.botes) {
      b.fase += dt * TWO_PI * b.ritmo;
      // Cada palada empuja: va un poco más rápido justo después de remar
      const empuje = 1 + 0.3 * Math.abs(Math.sin(b.fase));
      b.avance += dt * K.velocidad * (b.rapidez * empuje - 1);
    }
  }
  Kayaks.grupos = Kayaks.grupos.filter((g) => g.s < 1.2 + 0.8);
}

function dibujarKayaks() {
  if (!Kayaks.grupos.length) return;
  const K = CONFIG.kayaks;
  const sombra = K.modo === 'sombras';
  const g = sombra ? empezarSombra() : window;
  if (!sombra) { drawingContext.save(); recortarDomo(); }
  const luz = sombra ? luzDelDia() : 0.3 + 0.7 * luzDelDia();
  const alfa = K.opacidad * luz * (1 - 0.6 * estado.nublado);
  const px = K.tamano * escalaFlotantes() * Math.min(width, height) / 2048;
  for (const grupo of Kayaks.grupos) {
    const base = Math.atan2(grupo.dir[1], grupo.dir[0]);
    for (const b of grupo.botes) {
      const s = grupo.s - b.atras + b.avance;
      const u = grupo.perp[0] * (grupo.desvio + b.costado) + grupo.dir[0] * s;
      const v = grupo.perp[1] * (grupo.desvio + b.costado) + grupo.dir[1] * s;
      const r = Math.hypot(u, v);
      if (r > 1.05) continue;
      const tam = px * b.tam * (0.5 + 0.5 * (1 - r * r));
      const [x, y] = garzaEnPantalla(u, v);   // garzas.js: punto del disco → pantalla
      dibujarKayak(g, x, y, base + b.rumbo + 0.03 * Math.sin(b.fase), tam, b, alfa, sombra, K.estela);
    }
  }
  if (sombra) pegarSombra(K.tamano * escalaFlotantes() * 0.04);
  else drawingContext.restore();
}

// Un kayak mirando hacia +x. t = largo en pixeles.
function dibujarKayak(g, x, y, ang, t, b, alfa, sombra, estela) {
  const a = 255 * alfa;
  g.push();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(t);
  // Estela: dos líneas suaves que se abren detrás
  if (!sombra && estela > 0) {
    g.noFill();
    g.stroke(255, 255, 255, a * estela * 0.6);
    g.strokeWeight(0.025);
    g.line(0.45, 0.02, -1.1, 0.16);
    g.line(0.45, -0.02, -1.1, -0.16);
  }
  g.noStroke();
  const color = (hex, k = 1) => {
    if (sombra) return g.fill(25, 12, 4, a * 0.55 * k);
    const c = hexARgb(hex);
    g.fill(c[0] * 255, c[1] * 255, c[2] * 255, a * k);
  };
  // Casco en punta
  color(b.casco);
  g.beginShape();
  g.vertex(-0.5, 0);
  g.bezierVertex(-0.3, -0.075, 0.25, -0.075, 0.5, 0);
  g.bezierVertex(0.25, 0.075, -0.3, 0.075, -0.5, 0);
  g.endShape(CLOSE);
  if (!sombra) {
    // Cubierta de otro color (en los de dos colores)
    if (b.cubierta) {
      color(b.cubierta);
      g.beginShape();
      g.vertex(-0.42, 0);
      g.bezierVertex(-0.25, -0.035, 0.2, -0.035, 0.42, 0);
      g.bezierVertex(0.2, 0.035, -0.25, 0.035, -0.42, 0);
      g.endShape(CLOSE);
    }
    // Hueco donde va sentada la persona
    g.fill(30, 25, 20, a);
    g.ellipse(-0.02, 0, 0.16, 0.08);
  }
  // Pala: gira de un lado al otro con cada palada
  const giro = 0.5 * Math.sin(b.fase);
  g.push();
  g.translate(0.02, 0);
  g.rotate(HALF_PI + giro);
  if (sombra) g.stroke(25, 12, 4, a * 0.55);
  else { const c = hexARgb(b.pala); g.stroke(c[0] * 255, c[1] * 255, c[2] * 255, a); }
  g.strokeWeight(0.025);
  g.line(-0.2, 0, 0.2, 0);
  g.noStroke();
  color(b.pala);
  g.ellipse(-0.21, 0, 0.07, 0.04);
  g.ellipse(0.21, 0, 0.07, 0.04);
  g.pop();
  // La persona: hombros y cabeza
  if (!sombra) {
    g.fill(40, 32, 28, a);
    g.ellipse(0, 0, 0.07, 0.12);
    g.fill(205, 150, 110, a);
    g.ellipse(0.015, 0, 0.055, 0.055);
  }
  g.pop();
}

// Carpeta "Kayaks" del panel
function kayaksPanel(gui) {
  const K = CONFIG.kayaks;
  const f = gui.addFolder('Kayaks');
  f.add({ largar: largarKayaks }, 'largar').name('🛶 largar grupo');
  f.add(K, 'solos').name('pasan solos cada tanto');
  f.add(K, 'modo', ['colores', 'sombras']).name('cómo se ven');
  f.add(K, 'cantidad', 1, 40, 1).name('kayaks por grupo');
  f.add(K, 'tamano', 8, 120, 1).name('tamaño (px a 2048)');
  f.add(K, 'velocidad', 0.005, 0.2, 0.005).name('velocidad');
  f.add(K, 'opacidad', 0, 1, 0.01).name('opacidad');
  f.add(K, 'estela', 0, 1, 0.01).name('estela');
  f.close();
}
