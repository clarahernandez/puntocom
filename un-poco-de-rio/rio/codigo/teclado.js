// El teclado reemplaza al Korg nanoKONTROL2: cada tecla hace lo que haría un control del Korg,
// con las mismas asignaciones (config.js, CONFIG.midi) y los mismos seis modos.
//
//   1 a 8        elegir la columna (la guía la marca)
//   ↑ ↓          fader de esa columna (mantener apretado para que siga; con Shift, de a pasos largos)
//   ← →          perilla de esa columna
//   S  M  R      los tres botones de esa columna
//   Tab          modo siguiente (Shift+Tab: el anterior) · 0: volver a ESCENAS
//   Z X C V B N  SET, MARKER ◀, MARKER ▶, ◀◀, ▶▶, ■ STOP
//   P            ▶ PLAY
//   Enter        ● REC (bocina de barco, en todos los modos)
//
// Las de antes siguen igual: G panel, K guía, F pantalla completa, espacio pausa.
// Con "aprender" (carpeta MIDI del panel): clic en un control y apretá una de estas teclas.

const TECLADO_PASO = 0.02;        // cuánto mueve cada toque de flecha (de 0 a 1)
const TECLADO_PASO_LARGO = 0.1;   // con Shift

// Tecla → CC del Korg (los botones de transporte, iguales en todas las columnas)
const TECLADO_TRANSPORTE = {
  z: 60, x: 61, c: 62, v: 43, b: 44, n: 42, p: 41, enter: 45,
};
// Lo que se muestra en la guía para cada CC de transporte
const TECLADO_NOMBRE_TRANSPORTE = { 58: '⇧Tab', 59: 'Tab', 46: '0', 60: 'Z', 61: 'X', 62: 'C',
  43: 'V', 44: 'B', 42: 'N', 41: 'P', 45: 'Enter' };

const teclado = { columna: 0 };

function tecladoNombre(clave) {
  const cc = +clave.split(':')[1];
  if (TECLADO_NOMBRE_TRANSPORTE[cc]) return TECLADO_NOMBRE_TRANSPORTE[cc];
  const col = (cc % 16) + 1;
  const tipo = cc < 16 ? '↑↓' : cc < 32 ? '←→' : cc < 48 ? 'S' : cc < 64 ? 'M' : 'R';
  return `${col} + ${tipo}`;
}

function tecladoElegirColumna(i) {
  teclado.columna = i;
  if (typeof guiaKorgColumna === 'function') guiaKorgColumna(i);
}

// Mueve un fader o una perilla desde donde está el control (o desde donde va yendo, si se está moviendo)
function tecladoMover(clave, delta) {
  const c = midiControles[midiMapa[clave]];
  if (midiUI.aprender && midiSeleccion) return midiControl(clave, 0, true);
  if (!(c instanceof lil.NumberController)) return midiControl(clave, 0, true);   // nada asignado: solo destella
  const rango = c._max - c._min;
  const desde = midiSuave[clave] ? midiSuave[clave].objetivo : (c.getValue() - c._min) / rango;
  const v = Math.min(1, Math.max(0, desde + delta));
  midiControl(clave, v * 127, true);
}

function tecladoBoton(cc) {
  const clave = `0:${cc}`;
  midiControl(clave, 127, true);
}

window.addEventListener('keydown', (e) => {
  // Si se está escribiendo en el panel (un número, una lista), el teclado es del panel
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (typeof midiMapa === 'undefined' || !midiPanel) return;   // el panel todavía no arrancó

  const k = e.key.toLowerCase();
  const col = teclado.columna;
  let usada = true;

  if (k >= '1' && k <= '8') tecladoElegirColumna(+k - 1);
  else if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
    const paso = (e.shiftKey ? TECLADO_PASO_LARGO : TECLADO_PASO) * (k === 'arrowup' || k === 'arrowright' ? 1 : -1);
    const base = k === 'arrowup' || k === 'arrowdown' ? 0 : 16;   // fader o perilla
    tecladoMover(`0:${base + col}`, paso);
  } else if (e.repeat) {
    usada = k === 'tab';   // los botones no se repiten al dejar la tecla apretada
  } else if (k === 's') tecladoBoton(32 + col);
  else if (k === 'm') tecladoBoton(48 + col);
  else if (k === 'r') tecladoBoton(64 + col);
  else if (k === 'tab') { midiCambiarModo(e.shiftKey ? -1 : 1); guiaKorgDestello(e.shiftKey ? '0:58' : '0:59', 127); }
  else if (k === '0') { midiPonerModo('escenas'); guiaKorgDestello('0:46', 127); }
  else if (k in TECLADO_TRANSPORTE) tecladoBoton(TECLADO_TRANSPORTE[k]);
  else usada = false;

  if (usada) e.preventDefault();   // que las flechas no muevan la página ni Tab el foco
}, true);
