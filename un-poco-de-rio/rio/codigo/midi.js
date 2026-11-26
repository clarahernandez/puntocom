// Controlador MIDI (pensado para el Korg nanoKONTROL2 en modo CC).
//
// Seis modos, cada uno con su mapa (CONFIG.midi.escenas, .rioMarron, etc.):
//   escenas : el general. Cada columna es una escena: el fader la lleva de a poco, la perilla es
//             su sonido principal y S pasa a ella (con un fundido)
//   rioMarron, rioReal, sauces, puente, tormenta : uno por escena, con sus visuales y sus sonidos
// TRACK ◀ y TRACK ▶ recorren los modos; CYCLE vuelve directo a ESCENAS (igual en todos los modos).
// La columna 8 es la misma en todos (MIDI_GENERAL): volumen general, brillo y contraste,
// silencio, pausa del día y fundido a negro. Y ● REC toca la bocina de barco en todos.
//
// Perillas y faders "se enganchan": al cambiar de modo (o al abrir) un fader no hace nada hasta
// que pasás por el valor que tiene el control ahora. Así no hay saltos. La guía en pantalla
// muestra dónde está el fader (rayita blanca) y dónde está el valor (rayita de color).
//
// Los botones de algo que se prende y se apaga (sí/no) cambian con cada apretada.
//
// Modo aprendizaje: en la carpeta "MIDI" del panel activá "aprender", hacé clic en un control
// del panel (queda marcado en rosa) y mové una perilla, un fader o apretá un botón: queda
// asignado en el modo que está activo.
//
// Dónde se guardan las asignaciones:
//   - config.js (CONFIG.midi): la base, la que vale en cualquier navegador y en OBS.
//   - el navegador: los cambios hechos con "aprender" o "borrar" sobre esa base (agregadas y
//     borradas, por modo). Al recargar se suman a config.js, así no se pierden.
//     Para que valgan también en otro navegador u OBS: "Copiar ajustes" y pegar en config.js.
// La clave lleva número: al rearmar el Korg en config.js se cambia, así lo aprendido antes en cada
// navegador deja de valer (21/11/2026: los tres modos).
const MIDI_CLAVE_CAMBIOS = 'un-poco-de-rio:midi-cambios-4';
const MIDI_CLAVES_VIEJAS = ['un-poco-de-rio:midi', 'un-poco-de-rio:midi-cambios', 'un-poco-de-rio:midi-cambios-2',
  'un-poco-de-rio:midi-cambios-3'];

const MIDI_MODOS = ['escenas', 'rioMarron', 'rioReal', 'sauces', 'puente', 'tormenta'];
const MIDI_NOMBRE_MODO = { escenas: 'escenas', rioMarron: 'río marrón', rioReal: 'río real',
  sauces: 'sauces', puente: 'puente', tormenta: 'tormenta' };
const MIDI_CAMBIO_MODO = { '0:58': -1, '0:59': 1 };   // TRACK ◀ y TRACK ▶
const MIDI_IR_A = { '0:46': 'escenas' };            // CYCLE
// La columna 8, la misma en todos los modos
const MIDI_GENERAL = {
  '0:23': 'Sonido/maestro',   // perilla 8: volumen general
  '0:7': 'Estilo/realce',     // fader 8: brillo y contraste
  '0:39': 'Sonido/silencio',  // S8
  '0:55': 'Tiempo/pausa',     // M8: pausa del día
  '0:71': 'Estilo/negro',     // R8: fundido a negro
  '0:45': 'Música/río/tocarBarco',  // ● REC: toque de bocina de barco
};

let midiModo = 'escenas';
let midiBases = {};       // modo → asignaciones de config.js al abrir
let midiMapas = {};       // modo → { "canal:cc" → id del control del panel }
let midiMapa = {};        // el mapa del modo activo
let midiControles = {};   // id → control de lil-gui
let midiSeleccion = null; // control elegido para asignar
let midiPanel = null;
let midiEnganche = {};    // clave → la perilla o el fader ya agarró al control
let midiFisico = {};      // clave → dónde quedó la perilla o el fader (0 a 1)
let midiPuesto = {};      // clave → el último valor que le puso el Korg al control (0 a 1)
let midiSuave = {};       // clave → { c, objetivo }: hacia dónde va el control, de a poco
// Cómo está el Korg, para la guía: 'buscando', 'listo', 'nada' (no enchufado), 'ocupado' (lo tiene
// otro programa: en Windows el Korg lo usa el primero que lo abre) o 'permiso' (Chrome no dejó)
const midiEstado = { como: 'buscando', nombre: '', ultimo: 0 };
const midiUI = { aprender: false, seleccion: '—', dispositivo: 'buscando…', modo: 'escenas' };

function iniciarMidi(gui) {
  midiPanel = gui;
  midiEstilos();

  // Solo controles que tienen sentido con una perilla o un botón
  for (const c of gui.controllersRecursive()) {
    if (c instanceof lil.NumberController || c instanceof lil.BooleanController ||
        c instanceof lil.FunctionController) {
      midiControles[midiId(c)] = c;
      c.domElement.addEventListener('click', () => midiElegir(c), true);
    }
  }

  try { for (const k of MIDI_CLAVES_VIEJAS) localStorage.removeItem(k); } catch (e) { /* sin guardado */ }
  const base = CONFIG.midi || {};
  const cambios = midiLeerCambios();
  for (const modo of MIDI_MODOS) {
    midiBases[modo] = { ...(base[modo] || {}) };
    const mapa = { ...midiBases[modo] };
    const c = cambios[modo];
    if (c) {
      for (const k of c.borradas || []) delete mapa[k];
      Object.assign(mapa, c.agregadas || {});
    }
    Object.assign(mapa, MIDI_GENERAL);   // la columna 8 siempre es la general
    midiMapas[modo] = mapa;
  }
  midiMudar();
  midiPonerModo('escenas');

  const f = gui.addFolder('MIDI');
  f.add(midiUI, 'dispositivo').name('controlador').listen().disable();
  f.add(midiUI, 'modo', Object.fromEntries(MIDI_MODOS.map((m) => [MIDI_NOMBRE_MODO[m], m]))).name('modo (Tab en el teclado)').listen().onChange(midiPonerModo);
  if (CONFIG.midiSuavidad === undefined) CONFIG.midiSuavidad = 0.4;
  f.add(CONFIG, 'midiSuavidad', 0, 3, 0.05).name('suavidad de perillas y faders (s)');
  f.add(midiUI, 'aprender').name('aprender (clic en un control y apretá una tecla)')
    .onChange((v) => { if (!v) midiElegir(null); });
  f.add(midiUI, 'seleccion').name('esperando para').listen().disable();
  f.add({ borrar: midiBorrarSeleccion }, 'borrar').name('borrar asignación del elegido');
  f.add({ todo: midiBorrarTodo }, 'todo').name('borrar todas las de este modo');

  // El Korg es opcional: se maneja con el teclado (teclado.js). Solo con ?midi en la dirección se
  // busca un controlador MIDI (así Chrome no pide permiso a quien entra a ver la obra)
  if (!new URLSearchParams(location.search).has('midi')) {
    midiUI.dispositivo = 'teclado (?midi para usar el Korg)';
    midiEstado.como = 'teclado';
    return;
  }
  if (!navigator.requestMIDIAccess) {
    midiUI.dispositivo = 'este navegador no tiene MIDI (usá Chrome)';
    midiEstado.como = 'permiso';
    return;
  }
  navigator.requestMIDIAccess().then(midiConectar, () => {
    midiUI.dispositivo = 'permiso MIDI denegado';
    midiEstado.como = 'permiso';
  });
}

function midiConectar(acceso) {
  const enlazar = () => {
    const entradas = [...acceso.inputs.values()];
    for (const entrada of entradas) entrada.onmidimessage = midiMensaje;
    if (!entradas.length) {
      midiUI.dispositivo = 'ninguno conectado';
      midiEstado.como = 'nada'; midiEstado.nombre = '';
      return;
    }
    midiUI.dispositivo = entradas.map((e) => e.name).join(', ');
    midiEstado.nombre = entradas.map((e) => e.name).join(', ');
    // Abrirlo a propósito: si otro programa lo tiene, Windows no deja y acá se sabe
    Promise.all(entradas.map((e) => e.open().then(() => true, () => false))).then((ok) => {
      midiEstado.como = ok.some(Boolean) ? 'listo' : 'ocupado';
      if (midiEstado.como === 'ocupado') midiUI.dispositivo = midiEstado.nombre + ' (ocupado por otro programa)';
    });
  };
  acceso.onstatechange = enlazar;
  enlazar();
}

function midiPonerModo(modo) {
  midiModo = modo;
  midiUI.modo = modo;
  midiMapa = midiMapas[modo];
  midiEnganche = {};   // con el modo nuevo, cada fader se vuelve a enganchar
  CONFIG.midi = JSON.parse(JSON.stringify(midiMapas));   // así "Copiar ajustes" lleva los tres
  midiMarcar();
}

function midiCambiarModo(paso) {
  const i = MIDI_MODOS.indexOf(midiModo);
  // Sin cartel en pantalla (se vería en el domo): el modo lo muestra la guía
  midiPonerModo(MIDI_MODOS[(i + paso + MIDI_MODOS.length) % MIDI_MODOS.length]);
}

function midiMensaje(e) {
  const [estado, cc, valor] = e.data;
  if ((estado & 0xf0) !== 0xb0) return;   // solo control change
  // Cualquier canal MIDI cuenta como el 1 (por si el Korg quedó configurado en otro canal)
  const clave = `0:${cc}`;
  midiEstado.ultimo = performance.now();
  if (midiEstado.como !== 'listo') midiEstado.como = 'listo';
  midiControl(clave, valor);
}

// Lo que hace un control del Korg (o la tecla que lo reemplaza, teclado.js). valor: 0 a 127.
// Desde el teclado, las perillas y faders se mueven desde donde está el control: no hay que engancharlos.
function midiControl(clave, valor, desdeTeclado = false) {
  const cc = clave.split(':')[1];
  if (clave in MIDI_CAMBIO_MODO || clave in MIDI_IR_A) {
    if (valor >= 64) {
      if (clave in MIDI_IR_A) midiPonerModo(MIDI_IR_A[clave]);
      else midiCambiarModo(MIDI_CAMBIO_MODO[clave]);
    }
    guiaKorgDestello(clave, valor, true);
    return;
  }

  if (midiUI.aprender && midiSeleccion) {
    for (const k of Object.keys(midiMapa)) {
      if (midiMapa[k] === midiId(midiSeleccion)) delete midiMapa[k];
    }
    midiMapa[clave] = midiId(midiSeleccion);
    const nombre = desdeTeclado && typeof tecladoNombre === 'function' ? tecladoNombre(clave) : `CC ${cc}`;
    aviso(`${midiSeleccion.$name.textContent} ← ${nombre} (modo ${MIDI_NOMBRE_MODO[midiModo]})`);
    midiGuardar();
    midiElegir(null);
    guiaKorgDestello(clave, valor, true);
    return;
  }

  const c = midiControles[midiMapa[clave]];
  let enganchado = true;
  if (!c) {
    // nada asignado en este modo
  } else if (c instanceof lil.FunctionController) {
    if (valor >= 64) c.object[c.property]();
  } else if (c instanceof lil.BooleanController) {
    if (valor >= 64) c.setValue(!c.getValue());   // cada apretada prende o apaga
  } else {
    enganchado = midiMover(c, clave, valor / 127, desdeTeclado);
  }
  guiaKorgDestello(clave, valor, enganchado);
}

// Suavidad: las perillas y los faders no mueven el control de golpe; el control los sigue de a
// poco, como con un amortiguador (CONFIG.midiSuavidad: segundos que tarda en llegar a casi todo
// el camino; 0 = directo). Así el horizonte, las opacidades, etc. no saltan.
function midiSuavizar(ahora) {
  const dt = Math.min(0.1, (ahora - (midiSuavizar.antes || ahora)) / 1000);
  midiSuavizar.antes = ahora;
  const tau = Math.max(0.001, (CONFIG.midiSuavidad ?? 0.4) / 3);
  const k = 1 - Math.exp(-dt / tau);
  for (const [clave, s] of Object.entries(midiSuave)) {
    const c = s.c, rango = c._max - c._min;
    const antes = c.getValue(), actual = (antes - c._min) / rango;
    let nuevo = actual + (s.objetivo - actual) * k;
    const llego = Math.abs(s.objetivo - nuevo) < 0.002;
    if (llego) nuevo = s.objetivo;
    c.setValue(c._min + nuevo * rango);
    // Los de paso entero (por ejemplo, pulsos por minuto) se trabarían de a poquito: van directo
    if (!llego && c.getValue() === antes) c.setValue(c._min + s.objetivo * rango);
    midiPuesto[clave] = (c.getValue() - c._min) / rango;
    if (llego || c.getValue() !== antes && Math.abs((c.getValue() - c._min) / rango - s.objetivo) < 0.002) delete midiSuave[clave];
  }
  requestAnimationFrame(midiSuavizar);
}
requestAnimationFrame(midiSuavizar);

// Mueve un control con una perilla o un fader, si está enganchado (ver arriba)
function midiMover(c, clave, v, forzar = false) {
  const rango = c._max - c._min;
  const actual = (c.getValue() - c._min) / rango;
  const antes = midiFisico[clave];
  midiFisico[clave] = v;
  if (forzar) { midiEnganche[clave] = true; midiPuesto[clave] = actual; }
  // Si el control cambió por otro lado (el mouse, una transición), hay que volver a engancharlo
  if (midiEnganche[clave] && Math.abs(actual - midiPuesto[clave]) > 0.02) midiEnganche[clave] = false;
  if (!midiEnganche[clave]) {
    const cruzo = antes !== undefined && (antes - actual) * (v - actual) <= 0;
    if (Math.abs(v - actual) > 0.03 && !cruzo) return false;
    midiEnganche[clave] = true;
  }
  if (!((CONFIG.midiSuavidad ?? 0.4) > 0)) {
    c.setValue(c._min + v * rango);
    midiPuesto[clave] = (c.getValue() - c._min) / rango;
  } else {
    midiSuave[clave] = { c, objetivo: v };   // el control lo va siguiendo (midiSuavizar)
    if (midiPuesto[clave] === undefined) midiPuesto[clave] = actual;
  }
  return true;
}

function midiElegir(c) {
  if (c && !midiUI.aprender) return;
  if (midiSeleccion) midiSeleccion.domElement.classList.remove('midi-elegido');
  midiSeleccion = c;
  if (c) c.domElement.classList.add('midi-elegido');
  midiUI.seleccion = c ? c.$name.textContent : '—';
}

function midiBorrarSeleccion() {
  if (!midiSeleccion) return aviso('Primero elegí un control del panel (con "aprender" activo)');
  for (const k of Object.keys(midiMapa)) {
    if (midiMapa[k] === midiId(midiSeleccion)) delete midiMapa[k];
  }
  midiGuardar();
}

function midiBorrarTodo() {
  for (const k of Object.keys(midiMapa)) delete midiMapa[k];
  midiGuardar();
}

function midiGuardar() {
  CONFIG.midi = JSON.parse(JSON.stringify(midiMapas));
  midiGuardarCambios();
  midiMarcar();
}

function midiLeerCambios() {
  try { return JSON.parse(localStorage.getItem(MIDI_CLAVE_CAMBIOS)) || {}; } catch (e) { return {}; }
}

// Guarda en el navegador solo lo que difiere de config.js, modo por modo
function midiGuardarCambios() {
  const todos = {};
  for (const modo of MIDI_MODOS) {
    const base = midiBases[modo], mapa = midiMapas[modo];
    const agregadas = {}, borradas = [];
    for (const [k, id] of Object.entries(mapa)) if (base[k] !== id) agregadas[k] = id;
    for (const k of Object.keys(base)) if (!(k in mapa)) borradas.push(k);
    todos[modo] = { agregadas, borradas };
  }
  try { localStorage.setItem(MIDI_CLAVE_CAMBIOS, JSON.stringify(todos)); } catch (e) { /* sin guardado */ }
}

// Si un control se mudó de carpeta (por ejemplo "Agua/nitidez" → "Cáusticas/nitidez",
// o los de "Domo" del río abstracto → "Cáusticas/…"), la asignación vieja lo sigue
// Controles que se mudaron a la carpeta Oleaje (lo que era "agua" pasó a la tranquila
// y lo que sumaba la tormenta, a la revoltosa)
const MIDI_MUDANZAS = {
  'Agua/agitacion': 'Oleaje/tranquila/agitacion',
  'Agua/velocidad': 'Oleaje/tranquila/velocidad',
  'Agua/rafagas': 'Oleaje/tranquila/rafagas',
  'Tormenta/agitacion': 'Oleaje/revoltosa/agitacion',
  'Tormenta/olas': 'Oleaje/revoltosa/altura',
  'Tormenta/velocidad': 'Oleaje/revoltosa/velocidad',
  // Gotas: el tamaño era una lista [suave, fuerte] y la duración, un solo valor
  'Tormenta/0': 'Tormenta/tamanoSuave',
  'Tormenta/1': 'Tormenta/tamanoFuerte',
  'Tormenta/duracionAnillos': 'Tormenta/duracionFuerte',
};

// Las carpetas "Agua" y "Oleaje" se unieron en "Agua y oleaje"
function midiCarpetaNueva(id) {
  return id && id.replace(/^(Agua|Oleaje)\//, 'Agua y oleaje/');
}

function midiMudar() {
  let cambio = false;
  const ids = Object.keys(midiControles);
  for (const mapa of Object.values(midiMapas)) {
    for (const [clave, id] of Object.entries(mapa)) {
      if (midiControles[id]) continue;
      const mudado = [MIDI_MUDANZAS[id], id].map(midiCarpetaNueva).find((n) => midiControles[n]);
      if (mudado) { mapa[clave] = mudado; cambio = true; continue; }
      const prop = '/' + id.split('/').pop();
      const nuevo = ids.find((n) => n.startsWith('Cáusticas/') && n.endsWith(prop));
      if (nuevo) { mapa[clave] = nuevo; cambio = true; }
    }
  }
  if (cambio) midiGuardarCambios();
}

// Pone "CC n" al lado del nombre de cada control asignado en el modo activo
function midiMarcar() {
  for (const c of Object.values(midiControles)) delete c.domElement.dataset.cc;
  for (const [clave, id] of Object.entries(midiMapa)) {
    if (midiControles[id]) midiControles[id].domElement.dataset.cc = 'CC ' + clave.split(':')[1];
  }
  for (const f of midiPanel.foldersRecursive()) {
    const hay = f.controllersRecursive().some((c) => c.domElement.dataset.cc);
    f.domElement.classList.toggle('midi-con-asignados', hay);
  }
  guiaKorgArmar();   // el cuadro de la guía sigue a las asignaciones (guia-korg.js)
}

// Carpeta/nombre: "Agua/agitacion" (los momentos del día repiten nombres, la carpeta los distingue)
function midiId(c) {
  const ruta = [];
  for (let f = c.parent; f && f.parent; f = f.parent) ruta.unshift(f._title);
  return ruta.concat(c.property).join('/');
}

function midiEstilos() {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .lil-gui .controller.midi-elegido { outline: 2px solid #ff4d6d; outline-offset: -2px; }
    .lil-gui .controller[data-cc] { background: rgba(255, 159, 67, 0.22); box-shadow: inset 4px 0 0 #ff9f43; }
    .lil-gui .controller[data-cc] .name { color: #ffc27a; font-weight: bold; }
    .lil-gui .controller[data-cc] .name::after { content: ' · ' attr(data-cc); font-size: 10px; }
    .lil-gui .controller.midi-elegido { background: rgba(255, 77, 109, 0.25); }
    /* carpetas cerradas que esconden controles asignados */
    .lil-gui.midi-con-asignados > .title { color: #ffc27a; box-shadow: inset 4px 0 0 #ff9f43; }
  `;
  document.head.appendChild(estilo);
}
