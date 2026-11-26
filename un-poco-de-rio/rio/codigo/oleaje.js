// El agua tranquila y el agua revoltosa (CONFIG.oleaje).
//
// El revuelo va de 0 (tranquila) a 1 (revoltosa); en el medio se mezclan los dos
// estados. Lo mueven el fader "tranquila ↔ revoltosa" del panel (asignable al MIDI)
// y la tormenta (con viento y lluvia se revuelve sola): manda el mayor de los dos.
// Así la tormenta se maneja sola, y sin tormenta (o encima de ella) el fader revuelve más.
// El fader "viento" pone el sonido del viento sin tormenta (ver tormenta.js).
//
// Cada estado tiene:
//   agitacion  qué tan movida está la superficie (más = más curvas, más luz en las cáusticas)
//   altura     tamaño de las olas (multiplica su altura, no su largo)
//   velocidad  qué tan rápido suben y bajan
//   rafagas    cuánto agita y calma el viento a lo largo del loop
//
// La velocidad se va sumando cuadro a cuadro (avanzarOndas, en agua.js), así al
// cambiarla las olas se aceleran o se frenan sin saltar.

function actualizarRevuelo() {
  estado.revuelo = constrain(Math.max(CONFIG.oleaje.revuelo, estado.tormenta), 0, 1);
}

// Los valores del agua para el revuelo de ahora
function oleajeActual() {
  const { tranquila, revoltosa } = CONFIG.oleaje;
  const o = {};
  for (const k of Object.keys(tranquila)) o[k] = lerp(tranquila[k], revoltosa[k] ?? tranquila[k], estado.revuelo);
  return o;
}

