// Rayos del río.
//
// Un rayo es un destello de luz que cubre toda la imagen (Rayo.brillo, de 0 a
// más de 1, que el shader suma a todo) y, un rato después, el trueno: cuanto
// más lejos cae el rayo, más tarda el trueno y más bajo suena.
//
// El primero lo lanza la secuencia de la tormenta (tormenta.js); los
// siguientes, con tormenta mayor a CONFIG.tormenta.rayoDesde, caen solos, cada
// vez más seguido cuanto más fuerte es. También se pueden lanzar a mano
// (botón "lanzar rayo" del panel, asignable al MIDI).
//
// Necesita sonidos/sonido.js cargado antes (para el trueno).

const Rayo = {
  brillo: 0,        // cuánta luz suma el rayo en este cuadro
  destellos: [],    // destellos programados: { t (ms), a (altura), tau (ms) }
  distancia: 0,     // 0 = justo encima, 1 = lejísimos
  proximo: undefined,
};

function azar(a, b) {
  return a + Math.random() * (b - a);
}

// distancia (0 a 1) es opcional: si no se da, cae a una distancia al azar
function lanzarRayo(distancia) {
  const T = CONFIG.tormenta;
  const ahora = performance.now();

  // Un rayo parpadea: un destello fuerte y dos o tres más débiles enseguida
  const n = 2 + Math.floor(Math.random() * 3);
  let t = 0;
  for (let i = 0; i < n; i++) {
    Rayo.destellos.push({ t: ahora + t * 1000, a: i === 0 ? 1 : azar(0.4, 0.9), tau: azar(0.06, 0.14) * 1000 });
    t += azar(0.08, 0.25);
  }

  // El trueno llega después: la luz viaja más rápido que el sonido
  Rayo.distancia = distancia ?? Math.random();
  const retraso = T.truenoRetraso[0] + Rayo.distancia * (T.truenoRetraso[1] - T.truenoRetraso[0]);
  setTimeout(() => {
    const trueno = Sonido.capas.find((c) => c.nombre === 'trueno');
    if (trueno) tocarSonido(trueno);
  }, retraso * 1000);
}

// Se llama en cada cuadro, antes de dibujar
function actualizarRayo(estado) {
  const T = CONFIG.tormenta;
  const ahora = performance.now();

  let b = 0;
  Rayo.destellos = Rayo.destellos.filter((d) => ahora - d.t < d.tau * 8);
  for (const d of Rayo.destellos) {
    if (ahora >= d.t) b = Math.max(b, d.a * Math.exp(-(ahora - d.t) / d.tau));
  }
  Rayo.brillo = b * T.rayoBrillo;

  if (estado.tormenta > T.rayoDesde && !estado.pausa) {
    const espera = () => (1000 * azar(T.rayoCada[0], T.rayoCada[1])) / (0.5 + estado.tormenta);
    if (Rayo.proximo === undefined) Rayo.proximo = ahora + espera();
    if (ahora >= Rayo.proximo) {
      lanzarRayo();
      Rayo.proximo = ahora + espera();
    }
  } else {
    Rayo.proximo = undefined;
  }
}
