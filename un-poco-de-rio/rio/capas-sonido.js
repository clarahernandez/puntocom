// Capas de sonido del río. El motor está en ../sonidos/sonido.js.
// Para sumar un sonido: agregá otra capa a la lista (ver las opciones en sonido.js).

// Botonera de pájaros: cada uno tiene su botón en el panel (Sonido → pájaros, asignable al MIDI).
// Lo apretás y canta en loop, lo volvés a apretar y se calla. Con la tormenta se callan.
// Para sumar uno: poné el archivo en sonidos/pajaros/ y agregá una línea [nombre, archivo].
const PAJAROS = [
  ['benteveo', 'pajaro_benteveo.mp3'],
  ['hornero', 'pajaro_hornero.mp3'],
  ['cardenal', 'pajaro_cardenal.mp3'],
  ['zorzal colorado', 'pajaro_zorzal_colorado.mp3'],
  ['zorzal chalchalero', 'pajaro_zorzal_chalchalero.mp3'],
  ['loro barranquero', 'pajaro_loro_barranquero.mp3'],
  ['martín pescador chico', 'pajaro_martin_pescador_chico.mp3'],
  ['chiflón', 'pajaro_chiflon.mp3'],
  ['garza mora', 'pajaro_garza_mora.mp3'],
  ['garza blanca', 'pajaro_garza_blanca.mp3'],
  ['garcita blanca', 'pajaro_garcita_blanca.mp3'],
  ['jacana', 'pajaro_jacana.mp3'],
  ['gallineta', 'pajaro_gallineta.mp3'],
  ['carancho', 'pajaro_carancho.mp3'],
  ['chimango', 'pajaro_chimango.mp3'],
];

// Cuánto se ve una escena (0 a 1, la más visible de las que se nombran). Los sonidos de cada
// escena la siguen: si bajás su fader, bajan con la imagen. Con "los sonidos siguen a las escenas"
// apagado (CONFIG.sonido.siguenEscenas = false), suenan siempre.
// Volumen de todos los pájaros juntos (el coro y la botonera): multiplica al de cada uno
function todosLosPajaros() {
  const v = CONFIG.sonido && CONFIG.sonido.todosPajaros;
  return v === undefined ? 1 : v;
}

function escenaVisible(...ids) {
  if (CONFIG.sonido && CONFIG.sonido.siguenEscenas === false) return 1;
  if (!CONFIG.capas) return 1;
  return Math.max(...ids.map((id) => (CONFIG.capas[id] ? CONFIG.capas[id].opacidad : 0)));
}

const CAPAS_SONIDO = [
  {
    nombre: 'agua',
    escena: () => escenaVisible('rioReal', 'rioMarron'),
    // Sin el rumor grave del viento en el micrófono (graves cortados en 150 Hz). El original: 'sonido de agua.mp4'
    archivo: '../sonidos/sonido de agua (sin viento).wav',
    tipo: 'loop',
    volumen: 0.8,
    // Suena más cuanto más movida está el agua, baja un poco en la pausa sin luz y se va con la tormenta.
    // Su volumen tiene perilla propia en el panel (Sonido → agua)
    nivel: (e, m, agitacion) => Math.min(1, 0.5 + 0.5 * agitacion) * (0.6 + 0.4 * luzDelDia()) * (1 - 0.7 * e.tormenta),
  },
  {
    nombre: 'pajaros',
    escena: () => escenaVisible('sauces') * todosLosPajaros(),
    archivo: '../sonidos/pajaros/pajaros_general.m4a',
    tipo: 'loop',
    volumen: 0.8,
    // Pájaros al amanecer (4 min de la grabación del 9/11). Perilla propia en el panel
    // (Sonido → pajaros) y se callan con la tormenta.
    nivel: (e) => 1 - 0.8 * e.tormenta,
  },
  // La botonera de pájaros va al final (lista PAJAROS, arriba de todo): carpeta Sonido → pájaros del panel
  {
    nombre: 'mate',
    archivo: '../sonidos/sonido_mate.mp4',
    tipo: 'interruptor',
    // Como el benteveo: lo apretás y suena en loop, lo volvés a apretar y se apaga
    // (Sonido → prender mate, asignable al MIDI)
    volumen: 0.7,
  },
  // ---- Tormenta: se activa con el botón del panel y sigue su secuencia (ver tormenta.js) ----
  {
    nombre: 'lluvia',
    escena: () => escenaVisible('tormenta'),
    archivo: '../sonidos/tormenta/lluvia-1.ogg',    // probá también lluvia-2, -3 y -4
    tipo: 'loop',
    volumen: 1,
    suavizado: 0.3,
    // Sigue a la secuencia: primero de a poquito, después más intensa
    nivel: (e) => e.lluvia,
  },
  {
    nombre: 'viento',
    escena: () => escenaVisible('tormenta'),
    archivo: '../sonidos/tormenta/viento.ogg',
    tipo: 'loop',
    volumen: 0.8,
    suavizado: 0.3,
    // Entra de a poco al empezar la tormenta y sopla más fuerte con las ráfagas
    nivel: (e, m, agitacion) => e.viento * Math.min(1, 0.5 + 0.25 * agitacion),
  },
  {
    nombre: 'trueno',
    escena: () => escenaVisible('tormenta'),
    archivo: '../sonidos/tormenta/trueno.ogg',
    tipo: 'evento',
    volumen: 0.9,
    // Truena después de cada rayo (ver rayo.js): más tarde y más bajo cuanto más lejos cae.
    // Su botón del panel lanza un rayo entero, con su destello.
    alTocar: () => lanzarRayo(),
    nivel: () => 1 - 0.5 * Rayo.distancia,
  },
  ...PAJAROS.map(([nombre, archivo]) => ({
    nombre,
    archivo: '../sonidos/pajaros/' + archivo,
    tipo: 'interruptor',
    grupo: 'pájaros',
    escena: () => escenaVisible('sauces') * todosLosPajaros(),
    volumen: 0.8,
    nivel: (e) => 1 - 0.8 * e.tormenta,
  })),
];
