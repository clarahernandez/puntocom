// Los relojes del loop: el día (CONFIG.duracion) y la pausa sin luz (CONFIG.pausa).
//
// Hay dos relojes que cuentan los mismos segundos:
//   estado.reloj  mueve las olas: nunca se detiene (salvo con la pausa, tecla espacio)
//   estado.dia    mueve el sol, la luna y los colores: con la tormenta se frena hasta
//                 quedar quieto, y vuelve a andar cuando se calma
// Sin tormenta van juntos.
//
// estado.diaFijo (0 a 1, o null): clava el momento del día (0.74 = el atardecer) y el día no
// avanza; las olas siguen. Lo usa la escena del puente, y se suelta desde el panel (Tiempo).

function duracionLoop() {
  return CONFIG.duracion + CONFIG.pausa;
}

// Momento del día (0 a 1) para un segundo del reloj: en la pausa se queda al final
function progresoDe(r) {
  return Math.min(r / CONFIG.duracion, 0.99999);
}

// Saltar a un momento del día (0 a 1) desde la URL o el panel
function irAlMomento(p) {
  estado.reloj = estado.dia = p * CONFIG.duracion;
}

// Avanza los dos relojes. En la tormenta el día va más lento a medida que se nubla
// y con el cielo cerrado se detiene: el sol y la luna quedan quietos (y tapados).
function avanzarRelojes(dt) {
  const total = duracionLoop();
  if (!estado.pausa) {
    estado.reloj = (estado.reloj + dt) % total;
    estado.dia = (estado.dia + dt * (1 - estado.nublado)) % total;
  }
  if (estado.diaFijo !== null && estado.diaFijo !== undefined) estado.dia = estado.diaFijo * CONFIG.duracion;
  estado.reloj = Math.min(estado.reloj, total);
  estado.dia = Math.min(estado.dia, total);
}

// Cuánta luz hay (0 a 1): entera durante el día; en la pausa se apaga y vuelve
// a encenderse antes de que empiece el día siguiente (fundidos de hasta 2 s)
function luzDelDia() {
  const P = CONFIG.pausa, s = estado.dia - CONFIG.duracion;
  if (P <= 0 || s <= 0) return 1;
  const F = Math.min(2, P / 3);
  return Math.max(1 - suave(0, F, s), 1 - suave(0, F, P - s));
}
