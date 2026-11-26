// Las capas: cada visual es una capa que se puede prender, apagar y superponer con las
// demás, con su opacidad y su modo de mezcla.
//
// De abajo hacia arriba (el orden en que se cargan los capa-*.js en index.html):
//   rioReal     la playa: cielo, islas, reflejos           (shader)
//   rioMarron   el río marrón con las cáusticas            (shader)
//   flotantes   camalotes, kayaks y garcitas               (dibujo 2D)
//   sauces      debajo de los sauces, el verde inmersivo   (dibujo 2D, escena: se turna con los ríos)
//   puente      el puente, visual flashera                 (dibujo 2D)
//   tormenta    cielo cerrado, lluvia y rayos              (dibujo 2D, solo se ve con tormenta)
//
// Cómo se dibuja: hay un solo lienzo WEBGL (agua) donde los shaders dibujan de a uno; cada
// capa de shader se copia enseguida al lienzo principal (2D) con su opacidad y su mezcla,
// y las capas de dibujo dibujan directo sobre él. Las capas con opacidad 0 no se calculan,
// así que el costo es el de las que se ven: cada capa de shader recorre todos los píxeles
// del lienzo en cada cuadro (la GPU es el límite). "Resolución" del panel achica ese lienzo
// WEBGL si hace falta.
//
// Para sumar una capa: un archivo capa-algo.js que llame a registrarCapa({...}) con:
//   id, nombre, tipo ('shader' o 'dibujo'), defecto: { opacidad, mezcla }
//   grupo                     opcional: las capas de un grupo se turnan con "dejar solo esta capa"
//   iniciar()                 opcional: se llama una vez, al arrancar
//   actualizar(ctx)           opcional: se llama en cada cuadro, aunque la capa no se vea
//   dibujarShader(ctx)        (tipo shader) dibuja en el lienzo WEBGL "agua"
//   dibujar(ctx)              (tipo dibujo) dibuja sobre el lienzo principal
//   visible()                 opcional: false = no hace falta dibujarla ahora
//   panel(carpeta)            opcional: sus controles propios, dentro de su carpeta
//   vacia                     true = todavía no dibuja nada (no cuesta nada)
// ctx = { m (momento del día), o (oleaje), agitacion, rafaga, dt }.

// Cómo se mezcla cada capa con lo que tiene abajo
const MEZCLAS = {
  normal: 'source-over',
  sumar: 'lighter',          // suma luz: ideal para destellos y neón
  pantalla: 'screen',        // aclara sin pasarse
  multiplicar: 'multiply',   // oscurece
};

const CAPAS = [];
const Capas = { transiciones: {}, shaders: 0, activas: 0, t: 0, cuadros: 0, info: '' };

function registrarCapa(def) {
  CAPAS.push(def);
}

// Los ajustes que falten (por ejemplo, si se pegó una config.js de antes de las capas)
// se completan con los de cada capa; lo que ya está en CONFIG manda.
function completarConfigCapas() {
  CONFIG.capas = CONFIG.capas || {};
  for (const c of CAPAS) CONFIG.capas[c.id] = Object.assign({}, c.defecto, CONFIG.capas[c.id]);
  if (CONFIG.transicionCapas === undefined) CONFIG.transicionCapas = 4;
  if (CONFIG.calidad === undefined) CONFIG.calidad = 1;
}

function iniciarCapas() {
  completarConfigCapas();
  completarMomentos();   // cielo.js: colores del cielo y el agua de la playa para cada momento
  for (const c of CAPAS) if (c.iniciar) c.iniciar();
}

// ---------- Pasajes: prender, apagar o dejar una sola capa, de a poco ----------

function irOpacidad(id, hasta) {
  Capas.transiciones[id] = { desde: CONFIG.capas[id].opacidad, hasta, t: 0 };
}

// Deja esta capa y apaga las demás de su grupo, en CONFIG.transicionCapas segundos. Las escenas
// (río real, río marrón y sauces) son un grupo ('rio'): pasar de una a otra no toca la tormenta
// ni los flotantes, pero sí apaga el puente (si no, quedaba encima y no había cómo salir).
// Una capa sin grupo queda realmente sola: las demás se apagan.
function soloCapa(id) {
  const grupo = CAPAS.find((c) => c.id === id).grupo;
  for (const c of CAPAS) {
    if (!grupo || c.grupo === grupo || (grupo === 'rio' && c.id === 'puente')) irOpacidad(c.id, c.id === id ? 1 : 0);
  }
}

// Prende la capa si está apagada o la apaga si está prendida
function alternarCapa(id) {
  irOpacidad(id, CONFIG.capas[id].opacidad > 0.5 ? 0 : 1);
}

// Cambia de golpe (para la URL): "rioReal" hace lo de soloCapa pero sin pasaje; "rioReal:0.5,rioMarron:1"
// fija cada opacidad
function capasDesdeUrl(texto) {
  if (!texto.includes(':') && CONFIG.capas[texto]) {
    const grupo = CAPAS.find((c) => c.id === texto).grupo;
    for (const c of CAPAS) {
      if (!grupo || c.grupo === grupo) CONFIG.capas[c.id].opacidad = c.id === texto ? 1 : 0;
    }
    return;
  }
  for (const par of texto.split(',')) {
    const [id, valor] = par.split(':');
    if (CONFIG.capas[id]) CONFIG.capas[id].opacidad = constrain(parseFloat(valor) || 0, 0, 1);
  }
}

function moverTransiciones(dt) {
  const dur = Math.max(CONFIG.transicionCapas, 0.05);
  for (const id of Object.keys(Capas.transiciones)) {
    const tr = Capas.transiciones[id];
    tr.t = Math.min(1, tr.t + dt / dur);
    CONFIG.capas[id].opacidad = lerp(tr.desde, tr.hasta, suave(0, 1, tr.t));
    if (tr.t >= 1) delete Capas.transiciones[id];
  }
}

// ---------- Composición ----------

function componerCapas(ctx) {
  const c2d = drawingContext;
  c2d.save();
  c2d.globalAlpha = 1;
  c2d.globalCompositeOperation = 'source-over';
  c2d.fillStyle = '#000';
  c2d.fillRect(0, 0, width, height);
  c2d.restore();

  Capas.shaders = 0;
  Capas.activas = 0;
  for (const capa of CAPAS) {
    if (capa.actualizar) capa.actualizar(ctx);
    const cfg = CONFIG.capas[capa.id];
    if (capa.vacia || cfg.opacidad < 0.003) continue;
    if (capa.visible && !capa.visible()) continue;

    c2d.save();
    c2d.globalAlpha = constrain(cfg.opacidad, 0, 1);
    c2d.globalCompositeOperation = MEZCLAS[cfg.mezcla] || 'source-over';
    if (capa.tipo === 'shader') {
      capa.dibujarShader(ctx);
      c2d.drawImage(agua.elt, 0, 0, width, height);
      Capas.shaders++;
    } else {
      capa.dibujar(ctx);
    }
    c2d.restore();
    Capas.activas++;
  }
}

// Cuadros por segundo y cuántas capas se están calculando (se muestra en el panel)
function medirRendimiento(dt) {
  Capas.t += dt;
  Capas.cuadros++;
  if (Capas.t < 0.5) return;
  Capas.info = `${Math.round(Capas.cuadros / Capas.t)} fps · ${Capas.activas} capas (${Capas.shaders} de shader)`;
  Capas.t = 0;
  Capas.cuadros = 0;
}

// Achica o agranda el lienzo WEBGL donde dibujan los shaders (CONFIG.calidad: 1 = completo).
// Se copia al lienzo principal estirado: menos píxeles que calcular, algo menos de detalle.
function tamanoAgua() {
  const q = constrain(CONFIG.calidad, 0.25, 1);
  return [Math.round(width * q), Math.round(height * q)];
}

function aplicarCalidad() {
  const [w, h] = tamanoAgua();
  agua.resizeCanvas(w, h);
}

// ---------- Panel ----------

function capasPanel(gui) {
  const f = gui.addFolder('Capas');
  f.add(CONFIG, 'transicionCapas', 0.2, 30, 0.1).name('segundos de los pasajes');
  f.add(CONFIG, 'calidad', 0.25, 1, 0.05).name('resolución de los shaders (1 = completa)').onFinishChange(aplicarCalidad);
  f.add(Capas, 'info').name('rendimiento').listen().disable();
  for (const capa of CAPAS) {
    const cfg = CONFIG.capas[capa.id];
    const g = f.addFolder(capa.nombre);
    g.add(cfg, 'opacidad', 0, 1, 0.01).name('opacidad').listen().onChange(() => { delete Capas.transiciones[capa.id]; });
    g.add(cfg, 'mezcla', Object.keys(MEZCLAS)).name('mezcla');
    const solo = 'solo_' + capa.id, alternar = 'alternar_' + capa.id;
    g.add({ [solo]: () => soloCapa(capa.id) }, solo).name(capa.grupo ? 'pasar a esta escena (apaga las otras)' : 'dejar solo esta capa');
    g.add({ [alternar]: () => alternarCapa(capa.id) }, alternar).name('prender / apagar');
    if (capa.panel) capa.panel(g);
    g.close();
  }
}
