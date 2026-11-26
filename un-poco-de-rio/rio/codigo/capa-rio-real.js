// Capa "río real": la playa. Cielo, islas, olas en perspectiva y reflejos del sol y la
// luna. El shader está en shaders/playa.js; acá, sus olas y todo lo que se le pasa.
//
// Usa el mismo oleaje que las cáusticas (tranquila ↔ revoltosa, oleaje.js), pero sus
// propias olas: las de tres escalas de antes (ola larga, intermedia y arrugas finas).

let shaderPlaya;
let ondasPlaya = [];
const fasesPlaya = [];

const PLAYA_DEFECTO = {
  horizonte: 1.12,    // altura del horizonte, más de 1 = fuera de cuadro
  reflejo: 0.5,       // ancho del camino de luz del sol y la luna sobre el agua
  halo: 0.4,          // resplandor ancho alrededor de ese camino: las olas lo rompen en trazos de luz
  facetas: 0.5,       // cuánto se encienden las caras de las olas que miran al sol o la luna
  crepusculo: 1.0,    // refuerzo de amanecer y atardecer (usa "metal" de cada momento)
  orilla: 0,          // cuánto se ve el fondo con cáusticas cerca de la playa
  perspectiva: 0.3,   // 0 = olas del mismo tamaño en todo el cuadro, 1 = perspectiva real
  capas: 5,           // tonos de la playa; 0 = degradé continuo (más 3D)
  olaLarga: 1.0,      // tamaño de la ola larga e intermedia (más = más grandes)
  arrugas: 1.0,       // tamaño de las arrugas finas que dan los trazos de luz (más = más grandes)
  espejo: 0.35,       // cuánto refleja el cielo el agua aun mirándola de arriba
  cieloAlto: 0.8,     // hasta qué altura el cielo reflejado es claro
  cieloGris: 0.7,     // cuánto se apaga el azul del cielo alto reflejado
  turbidez: 0.3,      // barro del Paraná: cuánto se ve el fondo de la orilla
  exposicion: 1.0,
  vineta: 0.25,       // oscurece los bordes (fuera del domo)
  campo: 60,          // domo: grados que se ven del centro al borde del círculo (más = más ojo de pez)
};

function iniciarRioReal() {
  CONFIG.playa = Object.assign({}, PLAYA_DEFECTO, CONFIG.playa);
  shaderPlaya = agua.createShader(VERT, FRAG_PLAYA);
  generarOndasPlaya();
}

// Tres escalas, como el agua del río: una ola larga y lenta con las crestas bien paralelas,
// una intermedia y arrugas finas que cruzan en cualquier dirección y dan los trazos de luz.
// "pend" es la pendiente de cada onda. Salen de la semilla: otra semilla = otro dibujo.
function generarOndasPlaya() {
  const r = mulberry32(CONFIG.agua.semilla);
  ondasPlaya = [];
  const escalas = [
    { n: 3, k: [8, 20], pend: 1.0, giro: 0.6 },
    { n: 4, k: [30, 50], pend: 0.45, giro: 0.7 },
    { n: 4, k: [90, 150], pend: 0.4, giro: 0.8, fina: true },
    { n: NUM_ONDAS - 11, k: [220, 380], pend: 0.45, giro: 0.8, fina: true },
  ];
  for (const e of escalas) {
    for (let i = 0; i < e.n; i++) {
      ondasPlaya.push({
        giro: (r() * 2 - 1) * e.giro,    // relativo a la apertura
        k: e.k[0] + r() * (e.k[1] - e.k[0]),
        pend: e.pend,
        fina: !!e.fina,    // arrugas finas (el resto es la ola larga y la intermedia)
        des: r() * TWO_PI,
      });
    }
  }
  // Normalizar para que "agitación" signifique lo mismo con cualquier semilla
  const energia = Math.sqrt(ondasPlaya.reduce((s, o) => s + o.pend * o.pend, 0) / 2);
  for (const o of ondasPlaya) o.pend /= energia;
}

// Frecuencia de cada ola con el tamaño que le dan "escala", "ola larga" y "arrugas"
function kDePlaya(onda) {
  const P = CONFIG.playa;
  return onda.k * CONFIG.agua.escala / (onda.fina ? P.arrugas : P.olaLarga);
}

// Fase de cada ola: se va sumando cuadro a cuadro según la velocidad de ahora (como en las
// cáusticas), así cambiar la velocidad o el revuelo no hace saltar la imagen
function avanzarOndasPlaya(o, dt) {
  const vel = o.velocidad * (DOMO ? CONFIG.domo.velocidad : 1);
  ondasPlaya.forEach((onda, i) => {
    const vueltasPorSegundo = 1.4 * Math.sqrt(kDePlaya(onda)) * vel / 60;
    fasesPlaya[i] = ((fasesPlaya[i] || 0) + dt * TWO_PI * vueltasPorSegundo) % TWO_PI;
  });
}

// m: el momento del día (cielo.js); o: el oleaje de ahora (oleaje.js); rafaga: el viento del loop
function dibujarRioReal(m, o, rafaga) {
  const A = CONFIG.agua, P = CONFIG.playa, E = CONFIG.estilo, sh = shaderPlaya;

  agua.shader(sh);
  pasarGotas(sh);
  sh.setUniform('uRes', [agua.width, agua.height]);
  // Las olas siguen el reloj (no el momento del día), así se mueven también en la pausa
  sh.setUniform('uFase', TWO_PI * estado.reloj / duracionLoop());

  // Olas: la curvatura es pendiente × k, y más altas cuanto más revuelta (oleaje.js)
  const dx = [], dy = [], k = [], amp = [], fase = [], des = [];
  ondasPlaya.forEach((onda, i) => {
    const ang = radians(A.rumbo) + onda.giro * radians(A.apertura);
    const kk = kDePlaya(onda);
    dx.push(Math.cos(ang));
    dy.push(Math.sin(ang));
    k.push(kk * 0.35);   // en el agua, medido en "alturas de los ojos"
    amp.push(onda.pend * kk * 0.35 * o.altura);
    fase.push(fasesPlaya[i] || 0);
    des.push(onda.des);
  });
  sh.setUniform('uDx', dx);
  sh.setUniform('uDy', dy);
  sh.setUniform('uK', k);
  sh.setUniform('uAmp', amp);
  sh.setUniform('uPFase', fase);
  sh.setUniform('uDes', des);
  sh.setUniform('uCorriente', A.corriente);
  sh.setUniform('uTormenta', estado.revuelo);   // revuelta, las arrugas finas cubren toda el agua

  sh.setUniform('uD', 1.5 * Math.max(0, o.agitacion * rafaga));
  sh.setUniform('uNitidez', A.nitidez);
  sh.setUniform('uEspejo', P.espejo);
  sh.setUniform('uCieloAlto', P.cieloAlto);
  sh.setUniform('uCieloGris', P.cieloGris);
  sh.setUniform('uDispersion', A.dispersion);
  sh.setUniform('uTurbidez', P.turbidez);
  sh.setUniform('uExpo', P.exposicion);
  sh.setUniform('uVineta', P.vineta);

  // El momento del día
  sh.setUniform('uAgua', m.agua);
  sh.setUniform('uLuz', m.luz);
  sh.setUniform('uInt', m.intensidad);
  sh.setUniform('uColCielo', m.cielo);
  sh.setUniform('uColHorizonte', m.horizonte);
  sh.setUniform('uColIslas', m.islas);
  sh.setUniform('uSol', m.sol);
  sh.setUniform('uLuna', m.luna);
  sh.setUniform('uSolVis', m.solVis);
  sh.setUniform('uLunaVis', m.lunaVis);

  sh.setUniform('uHorizonte', P.horizonte);
  sh.setUniform('uIslas', 0);   // sin islas
  sh.setUniform('uReflejo', Math.pow(2000, 1 - P.reflejo) * Math.pow(20, P.reflejo));
  sh.setUniform('uOrilla', P.orilla);
  sh.setUniform('uHalo', P.halo);
  sh.setUniform('uFacetas', P.facetas);
  sh.setUniform('uCrep', P.crepusculo * m.metal * m.metal);
  sh.setUniform('uPerspectiva', P.perspectiva);
  sh.setUniform('uOrganico', E.organico);
  sh.setUniform('uCapas', P.capas);
  sh.setUniform('uBorde', E.borde);

  // Tormenta y domo
  sh.setUniform('uGotas', CONFIG.tormenta.gotas);
  sh.setUniform('uCubierto', estado.nublado);
  sh.setUniform('uDomo', DOMO ? 1 : 0);
  sh.setUniform('uDomoCampo', radians(constrain(P.campo, 5, 85)));

  agua.rect(-agua.width / 2, -agua.height / 2, agua.width, agua.height);
}

function panelRioReal(g) {
  const P = CONFIG.playa;
  g.add(P, 'horizonte', 0.5, 1.5, 0.01).name('altura del horizonte');
  g.add(P, 'perspectiva', 0, 1, 0.01);
  g.add(P, 'capas', 0, 10, 1).name('capas de tono (0 = no)');
  g.add(P, 'reflejo', 0, 1, 0.01).name('ancho del reflejo');
  g.add(P, 'halo', 0, 2, 0.01).name('resplandor del camino');
  g.add(P, 'facetas', 0, 2, 0.01).name('caras de olas iluminadas');
  g.add(P, 'crepusculo', 0, 2, 0.01).name('intensidad amanecer/atardecer');
  g.add(P, 'olaLarga', 0.4, 3, 0.01).name('tamaño de la ola larga');
  g.add(P, 'arrugas', 0.4, 3, 0.01).name('tamaño de las arrugas');
  g.add(P, 'espejo', 0, 1, 0.01).name('espejo (reflejo del cielo)');
  g.add(P, 'cieloAlto', 0.2, 2, 0.01).name('cielo claro hasta (altura)');
  g.add(P, 'cieloGris', 0, 1, 0.01).name('cielo alto apagado');
  g.add(P, 'turbidez', 0, 1, 0.01).name('turbidez (barro)');
  g.add(P, 'exposicion', 0.2, 3, 0.01).name('exposición');
  g.add(P, 'vineta', 0, 1, 0.01).name('viñeta');
  g.add(P, 'campo', 10, 85, 1).name('domo: ojo de pez, campo (°)');
}

registrarCapa({
  id: 'rioReal',
  nombre: 'río real (la playa)',
  tipo: 'shader',
  grupo: 'rio',
  defecto: { opacidad: 0, mezcla: 'normal' },
  iniciar: iniciarRioReal,
  actualizar: ({ o, dt }) => { if (!estado.pausa) avanzarOndasPlaya(o, dt); },
  dibujarShader: ({ m, o, rafaga }) => dibujarRioReal(m, o, rafaga),
  panel: panelRioReal,
});
