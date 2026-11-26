// Camalotes: islas de jacinto de agua que bajan flotando con la corriente del río.
//
// Cada isla es un manchón de plantas (rosetas): hojas redondeadas de varios verdes
// alrededor de un centro, y de a ratos una flor lila. Las islas bajan despacio, todas
// para el mismo lado (el de la corriente), girando apenas, y se mecen con el agua.
//
// "largar camalotes" suelta un tren de islas de distintos tamaños, como cuando el río
// crece y baja el camalotal. Cerca del borde del círculo se achican.
//
// Panel: carpeta "Camalotes" (el botón se puede asignar al MIDI).
// Modo "colores": verdes y lilas. Modo "sombras": su sombra sobre el fondo del río.

const Camalotes = { islas: [], proximo: null };

// Valores por defecto (si config.js no tiene la sección "camalotes", la obra no se rompe)
CONFIG.camalotes = Object.assign({
  solos: false,       // bajan solos cada tanto
  cada: [120, 300],   // segundos entre trenes de islas, cuando bajan solos
  modo: 'colores',    // 'colores' o 'sombras'
  cantidad: 4,        // islas por tren
  tamano: 70,         // radio de una isla mediana en pixeles, sobre 2048
  velocidad: 0.012,   // qué tan rápido baja la corriente
  rumbo: 30,          // hacia dónde corre el río (grados)
  flores: 0.3,        // cuántas plantas tienen flor (0 a 1)
  opacidad: 0.95,
}, CONFIG.camalotes);

const CAMALOTE_VERDES = ['#2f6624', '#3f7d2c', '#4f8f33', '#5f9e3a', '#77ad45', '#356f2a'];
const CAMALOTE_FLORES = ['#b9a3e3', '#a58fd8', '#c9b6ee'];

// Una isla: rosetas desparramadas en una mancha irregular (más plantas en el centro)
function nuevaIsla(radio) {
  const plantas = [];
  const n = Math.round(6 + radio * radio * 30);
  const lobulos = [Math.random() * TWO_PI, Math.random() * TWO_PI];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TWO_PI;
    // Borde irregular: la isla no es un círculo
    const borde = 1 + 0.25 * Math.sin(2 * a + lobulos[0]) + 0.15 * Math.sin(3 * a + lobulos[1]);
    const d = Math.sqrt(Math.random()) * borde;
    const hojas = [];
    const nh = 5 + Math.floor(Math.random() * 4);
    const giro = Math.random() * TWO_PI;
    for (let h = 0; h < nh; h++) {
      hojas.push({
        a: giro + (h / nh) * TWO_PI + (Math.random() - 0.5) * 0.5,
        largo: 0.75 + Math.random() * 0.45,
        color: CAMALOTE_VERDES[Math.floor(Math.random() * CAMALOTE_VERDES.length)],
      });
    }
    plantas.push({
      x: Math.cos(a) * d, y: Math.sin(a) * d,
      tam: (0.16 + Math.random() * 0.1) * (1.1 - 0.3 * d),
      hojas,
      flor: Math.random() < CONFIG.camalotes.flores,
      florA: Math.random() * TWO_PI,
      mece: Math.random() * TWO_PI,
    });
  }
  // Las de abajo primero, así las del centro (más altas) quedan arriba
  plantas.sort((p, q) => Math.hypot(q.x, q.y) - Math.hypot(p.x, p.y));
  return plantas;
}

function largarCamalotes() {
  const C = CONFIG.camalotes;
  const n = Math.max(1, Math.round(C.cantidad * (0.6 + 0.6 * Math.random())));
  // Entran por el lado de arriba del río y se reparten a lo ancho y a lo largo
  for (let i = 0; i < n; i++) {
    const radio = 0.6 + Math.random() * 0.8;   // relativo a "tamano"
    Camalotes.islas.push({
      costado: (Math.random() * 2 - 1) * 0.75,
      s: -1.2 - i * (0.15 + Math.random() * 0.25),
      radio,
      plantas: nuevaIsla(radio),
      giro: Math.random() * TWO_PI,
      girando: (Math.random() - 0.5) * 0.04,      // giran apenas mientras bajan
      rapidez: 0.85 + Math.random() * 0.3,
    });
  }
}

function actualizarCamalotes(dt) {
  const C = CONFIG.camalotes;
  if (C.solos) {
    const ahora = millis() / 1000;
    const espera = () => ahora + C.cada[0] + Math.random() * (C.cada[1] - C.cada[0]);
    if (Camalotes.proximo === null) Camalotes.proximo = espera();
    if (ahora >= Camalotes.proximo) { largarCamalotes(); Camalotes.proximo = espera(); }
  } else {
    Camalotes.proximo = null;
  }
  // Con el agua revuelta la corriente los lleva un poco más rápido
  const corriente = C.velocidad * (1 + 0.8 * estado.revuelo);
  for (const isla of Camalotes.islas) {
    isla.s += dt * corriente * isla.rapidez;
    isla.giro += dt * isla.girando;
  }
  Camalotes.islas = Camalotes.islas.filter((i) => i.s < 1.6);
}

function dibujarCamalotes() {
  if (!Camalotes.islas.length) return;
  const C = CONFIG.camalotes;
  const sombra = C.modo === 'sombras';
  const g = sombra ? empezarSombra() : window;
  if (!sombra) { drawingContext.save(); recortarDomo(); }
  const luz = sombra ? luzDelDia() : 0.3 + 0.7 * luzDelDia();
  const alfa = 255 * C.opacidad * luz * (1 - 0.5 * estado.nublado);
  g.noStroke();
  const ang = radians(C.rumbo);
  const dir = [Math.cos(ang), Math.sin(ang)], perp = [-dir[1], dir[0]];
  const px = C.tamano * escalaFlotantes() * Math.min(width, height) / 2048;
  const t = millis() / 1000;
  for (const isla of Camalotes.islas) {
    const u = perp[0] * isla.costado + dir[0] * isla.s;
    const v = perp[1] * isla.costado + dir[1] * isla.s;
    const r = Math.hypot(u, v);
    if (r > 1.3) continue;
    const escala = px * isla.radio * (0.5 + 0.5 * Math.max(0, 1 - r * r));
    const [x, y] = garzaEnPantalla(u, v);   // garzas.js: punto del disco → pantalla
    g.push();
    g.translate(x, y);
    g.rotate(isla.giro);
    g.scale(escala);
    for (const p of isla.plantas) dibujarPlanta(g, p, t, alfa, sombra);
    g.pop();
  }
  if (sombra) pegarSombra(C.tamano * escalaFlotantes() * 0.03);
  else drawingContext.restore();
}

// Una roseta de camalote: hojas redondeadas alrededor del centro y, a veces, una flor
function dibujarPlanta(g, p, t, alfa, sombra) {
  const mece = 1 + 0.04 * Math.sin(t * 0.8 + p.mece);
  g.push();
  g.translate(p.x, p.y);
  g.scale(p.tam * mece);
  for (const h of p.hojas) {
    g.push();
    g.rotate(h.a);
    if (sombra) g.fill(25, 12, 4, alfa * 0.5);
    else { const c = hexARgb(h.color); g.fill(c[0] * 255, c[1] * 255, c[2] * 255, alfa); }
    // Hoja redonda (como las del camalote) al final de su tallito
    g.ellipse(0.55 * h.largo, 0, 0.75 * h.largo, 0.62 * h.largo);
    if (!sombra) {
      // Brillo de la hoja
      g.fill(255, 255, 230, alfa * 0.18);
      g.ellipse(0.62 * h.largo, -0.08, 0.3 * h.largo, 0.18 * h.largo);
    }
    g.pop();
  }
  if (!sombra) {
    // Centro de la roseta, más oscuro
    g.fill(35, 70, 25, alfa);
    g.ellipse(0, 0, 0.35, 0.35);
    if (p.flor) {
      // Flor lila: un racimito de pétalos con su manchita amarilla
      const fx = 0.15 * Math.cos(p.florA), fy = 0.15 * Math.sin(p.florA);
      for (let i = 0; i < 6; i++) {
        const a = p.florA + (i / 6) * TWO_PI;
        const c = hexARgb(CAMALOTE_FLORES[i % CAMALOTE_FLORES.length]);
        g.fill(c[0] * 255, c[1] * 255, c[2] * 255, alfa);
        g.ellipse(fx + 0.17 * Math.cos(a), fy + 0.17 * Math.sin(a), 0.22, 0.22);
      }
      g.fill(240, 210, 80, alfa);
      g.ellipse(fx, fy, 0.09, 0.09);
    }
  }
  g.pop();
}

// Carpeta "Camalotes" del panel
function camalotesPanel(gui) {
  const C = CONFIG.camalotes;
  const f = gui.addFolder('Camalotes');
  f.add({ largar: largarCamalotes }, 'largar').name('🌿 largar camalotes');
  f.add(C, 'solos').name('bajan solos cada tanto');
  f.add(C, 'modo', ['colores', 'sombras']).name('cómo se ven');
  f.add(C, 'cantidad', 1, 12, 1).name('islas por tren');
  f.add(C, 'tamano', 10, 250, 1).name('tamaño (px a 2048)');
  f.add(C, 'velocidad', 0.002, 0.08, 0.001).name('velocidad de la corriente');
  f.add(C, 'rumbo', 0, 360, 1).name('hacia dónde corre (°)');
  f.add(C, 'flores', 0, 1, 0.01).name('flores (para los próximos)');
  f.add(C, 'opacidad', 0, 1, 0.01).name('opacidad');
  f.close();
}
