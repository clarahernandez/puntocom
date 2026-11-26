// Gotas de lluvia simuladas.
//
// El agua es una grilla de alturas que vive en la placa de video. En cada paso,
// cada punto se recalcula con sus 4 vecinos (algoritmo de Hugo Elias, como en
// The Coding Train #102 "2D Water Ripple" de Daniel Shiffman):
//
//   nuevo = (suma de los 4 vecinos) / 2 − anterior,   después × amortiguación
//
// Una gota levanta el agua en un punto y el anillo se abre, se apaga y se cruza
// con los otros solo. La grilla cubre un pedazo de agua de GOTAS_TAM × GOTAS_TAM
// que se repite como un mosaico (las ondas que salen por un borde entran por el
// otro). Las cáusticas la leen en coordenadas del agua (gotasSim en el shader).
//
// Las gotas caen al azar. Cuántas por segundo: CONFIG.tormenta.frecuencia × lluvia²,
// así al empezar la tormenta caen pocas y con la lluvia fuerte, muchas. Con más
// lluvia también son más grandes y sus aros duran menos (tamanoSuave/Fuerte,
// duracionSuave/Fuerte): con lluvia suave, pocos aros que se abren lentos y llegan
// lejos; con lluvia fuerte, muchos que se apagan enseguida, uno atrás de otro.

const GOTAS_RES = 2048;     // casilleros de la grilla, de lado
const GOTAS_TAM = 16;       // lado del pedazo de agua que cubre (en las unidades de P del shader) con tamanoAros = 1;
                            // con las cáusticas en "tamaño" 6 la cúpula muestra unas 12 unidades: así no se repite
const GOTAS_PASOS = 60;     // pasos por segundo: la velocidad de las ondas no depende de los fps
const GOTAS_MAX = 48;       // gotas por paso, como mucho

const Gotas = {
  a: null, b: null,         // las dos imágenes que se alternan: se lee una y se escribe la otra
  shader: null,
  acumulado: 0,             // pasos pendientes
  ultima: -Infinity,        // segundo en que cayó la última gota
  t: 0,
  activas: false,           // hay anillos en el agua (si no, ni se simula ni se lee)
  amort: 0.98,              // amortiguación de este momento (sale de la lluvia)
};

const GOTAS_VERT = `
attribute vec3 aPosition;
void main() {
  vec4 p = vec4(aPosition, 1.0);
  p.xy = p.xy * 2.0 - 1.0;   // el rect unitario cubre toda la imagen
  gl_Position = p;
}
`;

const GOTAS_FRAG = `
precision highp float;
#define MAXG ${GOTAS_MAX}
uniform sampler2D uEstado;   // r = altura ahora, g = altura en el paso anterior
uniform float uRes;
uniform float uAmort;
uniform int uN;
uniform float uGx[MAXG];
uniform float uGy[MAXG];
uniform float uGr[MAXG];
uniform float uGa[MAXG];

// Los bordes se tocan (mosaico): fract da la vuelta
float h(vec2 px) { return texture2D(uEstado, fract(px / uRes)).r; }

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 e = texture2D(uEstado, px / uRes).rg;
  float n = (h(px + vec2(1.0, 0.0)) + h(px - vec2(1.0, 0.0)) +
             h(px + vec2(0.0, 1.0)) + h(px - vec2(0.0, 1.0))) / 2.0 - e.g;
  n *= uAmort;

  // Gotas: levantan el agua con forma de campana (también cerca de los bordes, del otro lado)
  vec2 uv = px / uRes;
  for (int i = 0; i < MAXG; i++) {
    if (i >= uN) break;
    vec2 d = uv - vec2(uGx[i], uGy[i]);
    d = (d - floor(d + 0.5)) * uRes;
    n += uGa[i] * exp(-dot(d, d) / (uGr[i] * uGr[i]));
  }

  gl_FragColor = vec4(n, e.r, 0.0, 1.0);
}
`;

// g: el lienzo WEBGL donde se dibuja el agua (las imágenes tienen que vivir en él)
function iniciarGotas(g) {
  const op = { width: GOTAS_RES, height: GOTAS_RES, density: 1, format: FLOAT, textureFiltering: LINEAR, depth: false };
  Gotas.a = g.createFramebuffer(op);
  Gotas.b = g.createFramebuffer(op);
  for (const f of [Gotas.a, Gotas.b]) {
    f.begin(); g.clear(); f.end();
    // Que el shader del agua lea el mosaico sin costura
    try { g._renderer.getTexture(f.color).setWrapMode(REPEAT, REPEAT); } catch (e) { /* se ve igual, con una costura mínima */ }
  }
  Gotas.shader = g.createShader(GOTAS_VERT, GOTAS_FRAG);
}

// Cuántas gotas caen en un paso: al azar, con ese promedio (proceso de Poisson)
function cuantasGotas(promedio) {
  if (promedio <= 0) return 0;
  if (promedio > 20) return Math.max(0, Math.round(promedio + Math.sqrt(promedio) * randomGaussian()));
  const L = Math.exp(-promedio);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

// Se llama en cada cuadro. lluvia: 0 a 1 (de la secuencia de la tormenta). Con más
// lluvia, más gotas, más grandes, y aros que se apagan antes (se ven más seguidos).
function actualizarGotas(g, dt, lluvia) {
  const T = CONFIG.tormenta;
  Gotas.t += dt;
  Gotas.acumulado = Math.min(Gotas.acumulado + dt * GOTAS_PASOS, 4);   // si la compu se atrasa, no más de 4 pasos por cuadro
  // La frecuencia cuenta gotas por segundo en un pedazo de agua de 8 × 8 (el que se ve en la
  // cúpula con las cáusticas en tamaño 2): la grilla cubre más, así que caen proporcionalmente
  // más, y la densidad no cambia con el tamaño de los aros
  const lado = GOTAS_TAM * Math.max(T.tamanoAros ?? 1, 0.05);
  const porPaso = T.frecuencia * lluvia * lluvia * (lado / 8) ** 2 / GOTAS_PASOS;
  // Cuánto duran los aros: más con lluvia suave, menos con lluvia fuerte (así se ven más seguidos)
  Gotas.amort = lerp(T.duracionSuave, T.duracionFuerte, lluvia);

  // Sin lluvia y sin anillos que se estén apagando, no hace falta simular
  Gotas.activas = porPaso > 0.0001 || Gotas.t - Gotas.ultima < 8;
  if (!Gotas.activas) { Gotas.acumulado = 0; return; }

  while (Gotas.acumulado >= 1) {
    Gotas.acumulado -= 1;
    const lista = [];
    const n = Math.min(cuantasGotas(porPaso), GOTAS_MAX);
    for (let i = 0; i < n; i++) {
      // Con lluvia suave, gotas chicas y débiles; con lluvia fuerte, más grandes y variadas
      lista.push({
        x: Math.random(), y: Math.random(),
        r: lerp(T.tamanoSuave, T.tamanoFuerte, lluvia * (0.5 + 0.5 * Math.random())),
        a: lerp(0.4, 0.6, lluvia) * (0.6 + 0.6 * Math.random()),
      });
    }
    if (n > 0) Gotas.ultima = Gotas.t;
    // Cada gota puede tocar una nota (musica.js, si las gotas musicales están prendidas)
    if (typeof gotaMusical === 'function') for (const d of lista) gotaMusical(d.x, d.y, d.r);
    pasoGotas(g, lista);
  }
}

function pasoGotas(g, lista) {
  const gx = new Array(GOTAS_MAX).fill(0), gy = gx.slice(), gr = gx.slice().fill(1), ga = gx.slice();
  lista.forEach((o, i) => { gx[i] = o.x; gy[i] = o.y; gr[i] = o.r; ga[i] = o.a; });

  const sh = Gotas.shader;
  Gotas.b.begin();
  g.shader(sh);
  sh.setUniform('uEstado', Gotas.a);
  sh.setUniform('uRes', GOTAS_RES);
  sh.setUniform('uAmort', Gotas.amort);
  sh.setUniform('uN', lista.length);
  sh.setUniform('uGx', gx);
  sh.setUniform('uGy', gy);
  sh.setUniform('uGr', gr);
  sh.setUniform('uGa', ga);
  g.rect(0, 0, 1, 1);
  Gotas.b.end();
  [Gotas.a, Gotas.b] = [Gotas.b, Gotas.a];
}

// Lo que necesita el shader del agua para leer las gotas
function pasarGotas(sh) {
  sh.setUniform('uGotasSim', Gotas.a);
  // tamanoAros achica el aro entero (la gota y lo que se expande): la grilla se lee más apretada
  sh.setUniform('uGotasTam', GOTAS_TAM * Math.max(CONFIG.tormenta.tamanoAros ?? 1, 0.05));
  sh.setUniform('uGotasRes', GOTAS_RES);
  sh.setUniform('uGotasActivas', Gotas.activas ? 1 : 0);
}
