// Guía del Korg nanoKONTROL2 en pantalla: un cuadro vertical a la izquierda del domo que muestra
// el modo activo (ESCENAS o el de cada escena) y qué hace cada perilla, fader y botón en ese modo.
//
// Se arma sola con las asignaciones (las de config.js más lo aprendido en el navegador): si
// cambiás de modo o reasignás algo con "aprender", el cuadro cambia también. Aparece y desaparece
// con el panel (tecla G); la tecla K la muestra u oculta sola.
//   - Cada vez que tocás algo del Korg, su casilla se ilumina.
//   - En perillas y faders, la rayita de color es el valor del control. Si el fader todavía no se
//     enganchó (ver midi.js), una rayita blanca muestra dónde está el fader: llevalo hasta la otra.
//   - Lo que está prendido (un pájaro cantando, el mate, la tormenta, el río que se ve, la música)
//     se pone verde, en la guía y en el panel.
//   - Una casilla con borde rojo punteado está asignada a algo que ya no existe en el panel.

// CC de fábrica del nanoKONTROL2 (canal 1). En la guía, cada columna del Korg es un renglón:
// fader | perilla | S | M | R
const KORG_FILAS = [
  { nombre: 'fader ↑↓', cc: 0, continuo: true },
  { nombre: 'perilla ←→', cc: 16, continuo: true },
  { nombre: 'S', cc: 32 },
  { nombre: 'M', cc: 48 },
  { nombre: 'R', cc: 64 },
];
const KORG_TRANSPORTE = [
  [58, 'TRACK ◀'], [59, 'TRACK ▶'], [46, 'CYCLE'], [60, 'SET'], [61, 'MARKER ◀'], [62, 'MARKER ▶'],
  [43, '◀◀'], [44, '▶▶'], [42, '■ STOP'], [41, '▶ PLAY'], [45, '● REC'],
];
// Título de cada columna en cada modo. Es solo un rótulo: si mudás las asignaciones, cambialo acá
const KORG_TITULOS = {
  escenas: ['río real', 'río marrón', 'sauces', 'puente', 'tormenta', 'pájaros', 'pasajes', 'general'],
  rioMarron: ['agua', 'cáusticas', 'movimiento', 'crestas', 'agua', 'el río canta', 'barco · más agua', 'general'],
  rioReal: ['olas', 'viento', 'reflejo', 'luz', 'agua', 'el río canta', 'barco · más agua', 'general'],
  sauces: ['sauces (video)', 'color', 'pájaros', 'coro · saltos', 'colchón', 'todos · espacio', 'conversación', 'general'],
  puente: ['puente', 'pulsos', 'horizonte', 'cámara', 'luces · grosor', 'color', 'pulso (sonido)', 'general'],
  tormenta: ['tormenta', 'gotas', 'lluvia', 'rayos', 'gotas musicales', 'viento · lluvia', 'olas revueltas', 'general'],
};
const KORG_COLOR_MODO = { escenas: '#ffc27a', rioMarron: '#e0a070', rioReal: '#8fc4e8', sauces: '#9ddf7f',
  puente: '#f48fd0', tormenta: '#b6a8ff' };

// Nombres cortos para la guía; lo que no está acá usa el nombre que tiene en el panel
const KORG_NOMBRES = {
  'Sonido/maestro': 'volumen general',
  'Sonido/silencio': '🔇 silencio',
  'Sonido/pájaros/volumen': 'pájaros botonera (vol)',
  'Sonido/pajaros': 'coro de pájaros (vol)',
  'Sonido/agua': 'agua (vol)',
  'Sonido/mate': 'mate (vol)',
  'Sonido/tocar_mate': '🧉 mate on/off',
  'Garcitas/sonido': '🕊 garcitas cantan al pasar',
  'Capas/flotantes (camalotes, kayaks, garcitas)/escala': 'agrandar flotantes',
  'Estilo/realce': 'brillo y contraste',
  'Agua y oleaje/revuelo': 'tranquila ↔ revoltosa',
  'Agua y oleaje/revoltosa/profundidad': 'valles oscuros',
  'Agua y oleaje/viento': 'viento en el agua',
  'Agua y oleaje/corriente': 'olas avanzan',
  'Agua y oleaje/escala': 'tamaño de las olas',
  'Cáusticas/escala': 'tamaño cáusticas',
  'Cáusticas/brillo': 'brillo cáusticas',
  'Cáusticas/dispersion': 'prisma',
  'Cáusticas/metal': 'metalizado',
  'Tiempo/progreso': 'momento del día',
  'Tiempo/pausa': '⏸ pausa del día',
  'Garcitas/solas': 'garcitas solas',
  'Kayaks/solos': 'kayaks solos',
  'Camalotes/solos': 'camalotes solos',
  'Capas/río real (la playa)/solo_rioReal': 'río real',
  'Capas/río marrón (cáusticas)/solo_rioMarron': 'río marrón',
  'Capas/tormenta (cielo cerrado, lluvia y rayos)/opacidad': 'tormenta (capa)',
  'Capas/tormenta (cielo cerrado, lluvia y rayos)/oscuridad': 'oscurece el cielo',
  'Tormenta/activar': '⛈ activar',
  'Tormenta/calmar': '☀ calmar',
  'Tormenta/rayo': '⚡ rayo',
  'Capas/flotantes (camalotes, kayaks, garcitas)/opacidad': 'flotantes (capa)',
  'Garcitas/largar': '🕊 garcitas',
  'Kayaks/largar': '🛶 kayaks',
  'Camalotes/largar': '🌿 camalotes',
  'Capas/puente flashero (recorrido)/opacidad': 'puente (capa)',
  'Capas/puente flashero (recorrido)/bpm': 'pulsos x min',
  'Capas/puente flashero (recorrido)/destello': '⚡ destello',
  'Capas/puente flashero (recorrido)/escena': 'armar escena',
  'Capas/puente flashero (recorrido)/soltar': 'soltar el día',
  'Capas/sauces (verde inmersivo)/opacidad': 'sauces (capa)',
  'Capas/sauces (verde inmersivo)/viento': 'sauces se mecen',
  'Capas/sauces (verde inmersivo)/solo_sauces': '🌳 pasar a los sauces',
  'Capas/sauces (verde inmersivo)/otra': '🌿 otros sauces',
  'Música/espacio': 'espacio (reverb)',
  'Estilo/negro': '⬛ fundido a negro',
  'Música/río/mover': 'el agua va y viene',
  'Música/río/volumen': 'río que canta (vol)',
  'Música/río/canta': '🎶 el río canta on/off',
  'Música/río/barco': '🚢 barco constante',
  'Música/río/tocarBarco': '🚢 toque de bocina',
  'Música/río/profundo': 'grave profundo',
  'Música/río/conCausticas': 'canta solo con ríos',
  'Música/río/olas': '🌊 olas (crece y baja)',
  'Música/río/burbujas': '🫧 burbujas on/off',
  'Música/río/chapoteo': '💦 chapoteo on/off',
  'Música/pájaros/todosPajaros': '🐦 todos los pájaros (vol)',
  'Música/pájaros/saltos': '↔ saltos entre parlantes',
  'Capas/sauces (verde inmersivo)/lento': 'velocidad del video',
  'Capas/sauces (verde inmersivo)/invertir': '◐ invertir color',
  'Capas/sauces (verde inmersivo)/giro': 'giro del video',
  'Capas/sauces (verde inmersivo)/cieloAzul': 'cielo azul',
  'Capas/sauces (verde inmersivo)/dibujo': 'sauces dibujados',
  'Capas/puente flashero (recorrido)/ritmoPatron': '♬ semi semi corchea negra negra',
  'Capas/puente flashero (recorrido)/ritmoNegras': '♩ negras (parejo)',
  'Capas/puente flashero (recorrido)/forma y lugar/horizonte': 'altura del horizonte',
  'Capas/puente flashero (recorrido)/forma y lugar/alturaCamara': 'altura de la cámara',
  'Música/pájaros/charla': 'cuánto charlan',
  'Música/pájaros/tempo': 'pulso de los pájaros',
  'Música/pájaros/conversacion': '💬 conversan on/off',
  'Música/pájaros/aTiempo': '⏱ a tiempo on/off',
  'Sonido/lluvia': 'lluvia (vol)',
  'Sonido/viento': 'viento (vol)',
  'Capas/transicionCapas': 'segundos de los pasajes',
  'Capas/río real (la playa)/opacidad': 'río real (capa)',
  'Capas/río marrón (cáusticas)/opacidad': 'río marrón (capa)',
  'Capas/puente flashero (recorrido)/solo_puente': '🌉 pasar al puente',
  'Capas/puente flashero (recorrido)/velocidad': 'velocidad',
  'Capas/puente flashero (recorrido)/destellos': 'fuerza pulsos',
  'Capas/puente flashero (recorrido)/tono': 'color',
  'Capas/puente flashero (recorrido)/abanico': 'cuánto cambia el color',
  'Capas/puente flashero (recorrido)/curva': 'cuánto dobla',
  'Capas/puente flashero (recorrido)/grosor': 'grosor',
  'Capas/puente flashero (recorrido)/luces': 'luces tablero',
  'Capas/puente flashero (recorrido)/brillo': 'brillo',
  'Capas/puente flashero (recorrido)/resplandor': 'resplandor horizonte',
  'Capas/puente flashero (recorrido)/calzada': 'calzada oscura',
  'Capas/río real (la playa)/reflejo': 'ancho del reflejo',
  'Capas/río real (la playa)/espejo': 'espejo (cielo)',
  'Capas/río real (la playa)/halo': 'resplandor camino',
  'Capas/río real (la playa)/exposicion': 'exposición',
  'Capas/río real (la playa)/turbidez': 'barro',
  'Capas/río real (la playa)/crepusculo': 'amanecer/atardecer',
  'Capas/sauces (verde inmersivo)/destellos': 'sol entre hojas',
  'Capas/sauces (verde inmersivo)/luz': 'luz sauces',
  'Cáusticas/agitacion': 'agitación cáusticas',
  'Cáusticas/contraste': 'contraste cáusticas',
  'Tormenta/tamanoAros': 'tamaño aros',
  'Tormenta/gotas': 'gotas (cuánto se ven)',
  'Tormenta/frecuencia': 'gotas por segundo',
  'Capas/tormenta (cielo cerrado, lluvia y rayos)/rayas': 'rayitas de lluvia',
  'Tormenta/rayoDesde': 'rayos desde',
  'Tormenta/rayoBrillo': 'luz del rayo',
  'Agua y oleaje/revoltosa/altura': 'altura olas revueltas',
  'Música/agua/filtro': 'bajo el agua ↔ abierta',
  'Música/congelar/activo': '❄ congelar río',
  'Música/congelar/tono': 'tono congelado',
  'Música/congelar/volumen': 'congelado (vol)',
  'Música/pájaros/eco': 'eco pájaros',
  'Música/colchón/activo': '🎹 colchón on/off',
  'Música/colchón/brillo': 'brillo colchón',
  'Música/colchón/volumen': 'colchón (vol)',
  'Música/gotas/activo': '💧 gotas on/off',
  'Música/gotas/cantidad': 'cuántas notas',
  'Música/gotas/volumen': 'gotas (vol)',
  'Música/pulso/activo': '🥁 pulso on/off',
  'Música/pulso/cola': 'seco ↔ largo',
  'Música/pulso/volumen': 'pulso (vol)',
};

const guiaKorg = { div: null, casillas: {}, filas: [], modo: null, visible: true };

function guiaKorgNombre(id) {
  if (KORG_NOMBRES[id]) return KORG_NOMBRES[id];
  // Pasajes lentos del puente: el nombre del botón tal como está en el panel, con una flechita
  if (id.includes('/pasajes lentos/') && midiControles[id]) return '↝ ' + midiControles[id].$name.textContent;
  if (id.startsWith('Sonido/pájaros/tocar_')) return '🐦 ' + id.slice('Sonido/pájaros/tocar_'.length);
  const c = midiControles[id];
  return c ? c.$name.textContent : id.split('/').pop();
}

const guiaKorgEsSonido = (id) => id.startsWith('Sonido/') || id.startsWith('Música/');

// Llena las casillas con lo que hace cada control en el modo activo (la llama midiMarcar)
function guiaKorgArmar() {
  if (!guiaKorg.div) guiaKorgCrear();
  const modo = midiModo;
  guiaKorg.div.style.setProperty('--modo', KORG_COLOR_MODO[modo]);
  guiaKorg.div.querySelector('.gk-modo b').textContent = MIDI_NOMBRE_MODO[modo].toUpperCase();
  guiaKorg.filas.forEach((el, i) => { el.lastChild.textContent = KORG_TITULOS[modo][i]; });
  for (const [clave, el] of Object.entries(guiaKorg.casillas)) {
    const cambio = MIDI_CAMBIO_MODO[clave] || (MIDI_IR_A[clave] ? 2 : 0);
    const id = midiMapa[clave];
    const c = id && midiControles[id];
    el.querySelector('.txt').textContent = cambio ? (cambio === 2 ? '⟲ volver a ESCENAS' : cambio < 0 ? '◀ modo anterior' : 'modo siguiente ▶') : id ? guiaKorgNombre(id) : '';
    el.classList.toggle('cambio', !!cambio);
    el.classList.toggle('libre', !id && !cambio);
    el.classList.toggle('sonido', !!id && guiaKorgEsSonido(id));
    el.classList.toggle('falta', !!id && !c);
    el.classList.remove('suelta');
  }
  guiaKorgRevisar();
}

function guiaKorgCrear() {
  guiaKorgEstilos();
  const casilla = (clave, extra = '', continuo = false) =>
    `<div class="gk-casilla${continuo ? ' continuo' : ''}" data-clave="${clave}">${extra}<span class="txt"></span><span class="barra"></span><span class="fisico"></span></div>`;

  // Vertical, para ocupar el alto de la pantalla al costado del domo: cada columna del Korg
  // es un renglón, con sus perilla, S, M, R y fader uno al lado del otro
  let html = `<div class="gk-titulo">teclado · 1–8 elige la columna · Shift + flecha = paso largo</div>
    <div class="gk-modo">modo <b></b> <span>Tab ▶ · ⇧Tab ◀ · 0 = escenas</span></div>
    <div class="gk-korg"></div>
    <div class="gk-ref"><i class="sonido"></i>sonido <i></i>imagen <i class="verde"></i>prendido · K oculta · G panel</div>
    <div class="gk-grilla"><div></div>${KORG_FILAS.map((f) => `<div class="gk-col">${f.nombre}</div>`).join('')}`;
  for (let i = 0; i < 8; i++) {
    html += `<div class="gk-fila"><span>${i + 1}</span>${''}</div>`;
    for (const fila of KORG_FILAS) html += casilla(`0:${fila.cc + i}`, '', fila.continuo);
  }
  const tecla = (cc) => (typeof TECLADO_NOMBRE_TRANSPORTE !== 'undefined' && TECLADO_NOMBRE_TRANSPORTE[cc]) || '';
  html += `</div><div class="gk-transporte">${KORG_TRANSPORTE.map(([cc, n]) => casilla(`0:${cc}`, `<b><kbd>${tecla(cc)}</kbd> ${n}</b>`)).join('')}</div>`;

  const div = document.createElement('div');
  div.className = 'guia-korg';
  div.innerHTML = html;
  document.body.appendChild(div);
  for (const el of div.querySelectorAll('[data-clave]')) guiaKorg.casillas[el.dataset.clave] = el;
  guiaKorg.filas = [...div.querySelectorAll('.gk-fila')];
  for (const el of guiaKorg.filas) el.appendChild(document.createTextNode(''));
  guiaKorg.div = div;
  guiaKorgColumna(typeof teclado !== 'undefined' ? teclado.columna : 0);
  guiaKorgMostrar(guiaKorg.visible);
  setInterval(guiaKorgRevisar, 200);
}

// ¿Lo que hace este botón está prendido ahora? (para resaltarlo en la guía y en el panel)
function guiaKorgEncendido(id, c) {
  if (c instanceof lil.BooleanController) return !!c.getValue();
  const toca = id.match(/^Sonido\/(?:.+\/)?tocar_(.+)$/);
  if (toca) {
    const s = typeof Sonido !== 'undefined' && Sonido.capas && Sonido.capas.find((x) => x.nombre === toca[1]);
    return !!(s && s.interruptor && s.encendido);
  }
  if (id === 'Tormenta/activar') return Tormenta.activa;
  const solo = id.match(/\/solo_(\w+)$/);
  if (solo) return (CONFIG.capas[solo[1]] || {}).opacidad > 0.5;
  return false;
}

// El estado del Korg, arriba de la guía (para saber enseguida si anda)
const KORG_ESTADOS = {
  teclado: ['⌨ con el teclado (para el Korg, abrí con ?midi)', 'gris'],
  buscando: ['buscando el Korg…', 'gris'],
  listo: ['● Korg conectado', 'verde'],
  nada: ['● Korg no encontrado: enchufalo (directo, sin hub)', 'rojo'],
  ocupado: ['● Korg ocupado por otro programa: cerrá OBS-navegador, otras ventanas de la obra o programas de música, y volvé a abrir', 'rojo'],
  permiso: ['● Chrome no dejó usar el Korg (permiso MIDI): abrí con abrir-para-obs.bat y aceptá', 'rojo'],
};

function guiaKorgEstado() {
  const el = guiaKorg.div && guiaKorg.div.querySelector('.gk-korg');
  if (!el || typeof midiEstado === 'undefined') return;
  const [texto, color] = KORG_ESTADOS[midiEstado.como] || KORG_ESTADOS.buscando;
  el.textContent = texto + (midiEstado.como === 'listo' && midiEstado.nombre ? ' (' + midiEstado.nombre + ')' : '');
  el.className = 'gk-korg ' + color + (performance.now() - midiEstado.ultimo < 250 ? ' recibe' : '');
}

// Cinco veces por segundo: resalta lo prendido y pone las rayitas en el valor de cada control
function guiaKorgRevisar() {
  guiaKorgEstado();
  for (const [clave, el] of Object.entries(guiaKorg.casillas)) {
    const id = midiMapa[clave];
    const c = id && midiControles[id];
    const si = !!c && guiaKorgEncendido(id, c);
    el.classList.toggle('encendida', si);
    if (c instanceof lil.NumberController) {
      el.style.setProperty('--valor', (c.getValue() - c._min) / (c._max - c._min));
    }
  }
  // En el panel, solo lo del modo activo
  for (const c of Object.values(midiControles)) c.domElement.classList.remove('midi-encendido');
  for (const id of Object.values(midiMapa)) {
    const c = midiControles[id];
    if (c && guiaKorgEncendido(id, c)) c.domElement.classList.add('midi-encendido');
  }
}

// Marca la columna que manejan las flechas y S M R (teclado.js)
function guiaKorgColumna(i) {
  if (!guiaKorg.div) return;
  guiaKorg.filas.forEach((el, j) => el.classList.toggle('elegida', j === i));
  for (const [clave, el] of Object.entries(guiaKorg.casillas)) {
    const cc = +clave.split(':')[1];
    el.classList.toggle('en-columna', cc < 80 && cc % 16 === i && !el.closest('.gk-transporte'));
  }
}

function guiaKorgMostrar(si) {
  guiaKorg.visible = si;
  if (guiaKorg.div) guiaKorg.div.style.display = si ? '' : 'none';
}

// Ilumina la casilla del control que se acaba de tocar (la llama midiMensaje). Si es un fader
// que todavía no se enganchó, muestra dónde está con una rayita blanca.
function guiaKorgDestello(clave, valor, enganchado = true) {
  const el = guiaKorg.casillas[clave];
  if (!el) return;
  if (el.classList.contains('continuo')) {
    el.style.setProperty('--fisico', valor / 127);
    el.classList.toggle('suelta', !enganchado);
  }
  el.classList.add('activa');
  clearTimeout(el._apagar);
  el._apagar = setTimeout(() => el.classList.remove('activa'), 300);
}

function guiaKorgEstilos() {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .guia-korg {
      --modo: #ffc27a;
      position: fixed; left: 12px; top: 12px; z-index: 5; cursor: default;
      /* el ancho de la franja negra a la izquierda del domo (entre 260 y 420 px), todo el alto */
      width: clamp(260px, calc((100vw - 100vh) / 2 - 24px), 420px); height: calc(100vh - 24px);
      box-sizing: border-box; padding: 10px; display: flex; flex-direction: column;
      background: rgba(10, 12, 16, 0.85); color: #e8e2d6; border-radius: 8px;
      border-top: 3px solid var(--modo);
      font: 11px/1.2 system-ui, sans-serif;
    }
    .gk-titulo { font-weight: 600; font-size: 11px; color: #9a9488; }
    .gk-modo { font-size: 12px; color: #9a9488; margin-top: 2px; }
    .gk-modo b { font-size: 20px; letter-spacing: 0.06em; color: var(--modo); margin: 0 6px 0 2px; }
    .gk-modo span { font-size: 10px; }
    .gk-ref { font-size: 10px; color: #9a9488; margin: 4px 0 8px; }
    .gk-korg { font-size: 11px; font-weight: 600; margin-top: 4px; padding: 3px 6px; border-radius: 4px; }
    .gk-korg.gris { color: #9a9488; }
    .gk-korg.verde { color: #9dffb0; background: rgba(90, 220, 120, 0.12); }
    .gk-korg.rojo { color: #fff; background: rgba(220, 60, 60, 0.75); }
    .gk-korg.recibe { box-shadow: inset 0 0 0 2px #9dffb0; }
    .gk-ref i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin: 0 3px 0 0;
      vertical-align: -1px; background: rgba(255, 159, 67, 0.5); }
    .gk-ref i:not(:first-child) { margin-left: 6px; }
    .gk-ref i.sonido { background: rgba(80, 180, 220, 0.55); }
    .gk-ref i.verde { background: rgba(90, 220, 120, 0.8); }
    .gk-grilla { flex: 1; display: grid; grid-template-columns: 46px repeat(5, minmax(0, 1fr));
      grid-template-rows: auto repeat(8, 1fr); gap: 3px; min-height: 0; }
    .gk-col { text-align: center; font-size: 10px; color: #9a9488; }
    .gk-fila { align-self: center; font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.03em; color: var(--modo); }
    .gk-fila span { display: block; font-size: 15px; color: #e8e2d6; }
    .gk-fila.elegida span { color: #000; background: var(--modo); border-radius: 3px; text-align: center; width: 22px; }
    .gk-casilla.en-columna { box-shadow: inset 0 0 0 1px var(--modo); }
    .gk-transporte kbd { font: inherit; color: var(--modo); }
    .gk-casilla { position: relative; overflow: hidden; padding: 4px 4px;
      overflow-wrap: anywhere; hyphens: auto;   /* en franjas angostas parte las palabras con guion */
      border-radius: 4px; background: rgba(255, 159, 67, 0.16); transition: background 0.4s; }
    .gk-casilla.sonido { background: rgba(80, 180, 220, 0.18); }
    .gk-casilla.libre { background: rgba(255, 255, 255, 0.03); }
    .gk-casilla.cambio { background: rgba(255, 255, 255, 0.12); color: var(--modo); font-weight: 700; }
    .gk-casilla.falta { outline: 1px dashed #ff4d6d; outline-offset: -1px; }
    /* prendido (un pájaro cantando, el mate, la tormenta, el río que se ve, la música) */
    .gk-casilla.encendida { background: rgba(90, 220, 120, 0.55); box-shadow: inset 0 0 0 2px #9dffb0;
      color: #fff; font-weight: 700; }
    .lil-gui .controller.midi-encendido { background: rgba(90, 220, 120, 0.35); box-shadow: inset 4px 0 0 #9dffb0; }
    .lil-gui .controller.midi-encendido .name { color: #c9ffd4; font-weight: bold; }
    .gk-casilla.activa { background: rgba(255, 240, 210, 0.55); transition: none; }
    .gk-casilla .barra { position: absolute; left: 0; bottom: 0; height: 3px; display: none;
      width: calc(var(--valor, 0) * 100%); background: #ffc27a; }
    .gk-casilla.continuo:not(.libre) .barra { display: block; }
    .gk-casilla.sonido .barra { background: #7fd0ef; }
    /* fader sin enganchar: dónde está la palanca */
    .gk-casilla .fisico { position: absolute; bottom: 0; width: 3px; height: 9px; display: none;
      left: calc(var(--fisico, 0) * (100% - 3px)); background: #fff; }
    .gk-casilla.suelta .fisico { display: block; }
    .gk-casilla.suelta { outline: 1px dashed rgba(255, 255, 255, 0.6); outline-offset: -1px; }
    .gk-transporte { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin-top: 8px; }
    .gk-transporte .gk-casilla { min-height: 34px; }
    .gk-transporte b { display: block; font-size: 9px; font-weight: 600; color: #9a9488; }
  `;
  document.head.appendChild(estilo);
}
