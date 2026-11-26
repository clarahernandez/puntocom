// Secuencia de la tormenta del río.
//
// Se activa con el botón "activar tormenta" del panel (asignable al MIDI) y
// avanza sola, en etapas, contando los segundos desde que se aprieta:
//
//   1. se va nublando       (estado.nublado: tapa el sol y la luna y detiene el día;
//                            los colores no cambian)
//   2. entra el viento      (estado.viento: sonido del viento y algo de agitación)
//   3. cae un rayo          (rayo.js), y después de un rato llega su trueno
//   4. empieza a llover     (estado.lluvia), de a poquito y después más intenso
//
// Cuándo pasa cada cosa está en CONFIG.tormenta.secuencia, en segundos.
// "calmar tormenta" lo apaga todo de a poco.
//
// De viento y lluvia sale estado.tormenta (0 a 1): qué tan agitada, rápida y
// con olas grandes está el agua. Necesita rayo.js cargado antes.

const Tormenta = {
  activa: false,
  t: 0,           // segundos desde que se activó
  salida: 0,      // 1 = secuencia completa; baja a 0 al calmarse
  rayoLanzado: false,
};

// Valor de una etapa en el segundo t. claves: pares [segundo, valor] unidos en
// curva suave; antes del primero vale el primer valor, después del último, el último.
function valorSecuencia(claves, t) {
  if (!claves.length) return 0;
  if (t <= claves[0][0]) return claves[0][1];
  for (let i = 0; i < claves.length - 1; i++) {
    const [t0, v0] = claves[i], [t1, v1] = claves[i + 1];
    if (t < t1) {
      const x = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * x * x * (3 - 2 * x);
    }
  }
  return claves[claves.length - 1][1];
}

function activarTormenta() {
  if (Tormenta.activa) return;
  Tormenta.activa = true;
  Tormenta.t = 0;
  Tormenta.salida = 1;
  Tormenta.rayoLanzado = false;
}

function calmarTormenta() {
  Tormenta.activa = false;
}

// Se llama en cada cuadro con los segundos que pasaron
function actualizarTormenta(estado, dt) {
  const T = CONFIG.tormenta, S = T.secuencia;

  if (Tormenta.activa) {
    Tormenta.t += dt;
    if (!Tormenta.rayoLanzado && Tormenta.t >= S.rayoEn) {
      Tormenta.rayoLanzado = true;
      lanzarRayo(S.rayoDistancia);
    }
  } else {
    Tormenta.salida = Math.max(0, Tormenta.salida - dt / Math.max(T.calma, 0.1));
  }

  // Los valores siguen a la secuencia con un poquito de suavizado, así no hay saltos
  // al calmarse ni al volver a activarla a mitad de camino
  const k = 1 - Math.exp(-dt / 0.4);
  for (const etapa of ['nublado', 'viento', 'lluvia']) {
    const objetivo = valorSecuencia(S[etapa], Tormenta.t) * Tormenta.salida;
    const clave = etapa === 'viento' ? 'vientoTormenta' : etapa;
    estado[clave] += (objetivo - estado[clave]) * k;
  }
  estado.tormenta = Math.min(1, 0.55 * estado.vientoTormenta + 0.45 * estado.lluvia);
  // El viento que suena: el de la tormenta o el del fader "viento" (carpeta Agua y oleaje),
  // el mayor. El del fader no cuenta como tormenta: no nubla, no trae rayos ni calla pájaros
  estado.viento = Math.max(estado.vientoTormenta, CONFIG.oleaje.viento || 0);
}
