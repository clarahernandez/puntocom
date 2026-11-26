// Shader del río: las cáusticas, las figuras de luz que hacen las olas al funcionar
// como lentes sobre el fondo marrón del río. La luz del sol o de la luna llega pareja
// desde una dirección, y las crestas cambian de color según hacia dónde miran.
//
// Estilo: para que no se vea como 3D pulido, las ondas se deforman (orgánico) y los
// tonos se agrupan en pocas capas con borde (como un grabado).
//
// Las ondas suben y bajan en su lugar (ondas estacionarias). Con "corriente" mayor
// a 0 además avanzan. La fase de cada onda (uCFase) la va sumando agua.js cuadro a
// cuadro, así cambiar la velocidad la acelera o la frena sin saltos.
//
// Versión domo (uDomo = 1): círculo para el planetario. El centro es el cenit y el
// borde, el horizonte; afuera del círculo queda negro. Las cáusticas cubren toda la
// cúpula. En pantalla común se ve la misma cúpula estirada a lo ancho.
//
// El shader está en tres partes, que se pegan en este orden (shaders/principal.js):
//   comun.js      las variables que llegan desde agua.js, la luz y las gotas
//   causticas.js  las olas y el dibujo de las cáusticas
//   principal.js  main()

const NUM_ONDAS = 16;

const VERT = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
`;

// Variables que llegan desde agua.js y funciones que usan las cáusticas
const GLSL_COMUN = `
precision highp float;
#define NW ${NUM_ONDAS}

varying vec2 vUv;
uniform vec2 uRes;
uniform float uFase;          // 2π × progreso del loop
uniform float uDomo;          // 1 = versión domo

// Olas (las de la versión domo de solo-agua)
uniform float uCDx[NW];       // dirección de cada onda
uniform float uCDy[NW];
uniform float uCK[NW];        // frecuencia espacial
uniform float uCAmp[NW];      // curvatura
uniform float uCFase[NW];     // fase de cada onda (0 a 2π), la suma agua.js
uniform float uCDes[NW];      // desfase inicial
uniform float uCorriente;     // 0 = suben y bajan en su lugar, 1 = avanzan
uniform float uOrganico;      // cuánto se deforman las ondas
uniform float uProfundidad;   // cuánto se oscurecen los valles y se aclaran las crestas (oleaje)

// Tormenta
uniform float uGotas;          // cuánto se ven las gotas
uniform sampler2D uGotasSim;   // gotas simuladas (gotas.js): r = altura del agua
uniform float uGotasTam;       // lado del pedazo de agua que cubre la simulación (se repite)
uniform float uGotasRes;       // casilleros de la simulación, de lado
uniform float uGotasActivas;   // 0 = no hay anillos en el agua
uniform float uCubierto;       // 0 a 1: cielo cubierto por la tormenta: tapa la luz directa del sol y la luna

// Cómo se ven
uniform float uDCau;          // agitación (cuánto se curva el agua: más = líneas más finas y marcadas)
uniform float uNitidez;       // contraste de las líneas
uniform float uDispersion;    // separación de colores (como un prisma)
uniform float uCauEscala;     // cuánto fondo entra en la imagen (más = cáusticas más chicas)
uniform float uCauBrillo;     // cuánto se encienden las líneas de luz
uniform float uCauContraste;  // más = el agua quieta queda más oscura
uniform float uCauCapas;      // cantidad de tonos (0 = degradé continuo)
uniform float uBorde;         // suavidad del borde entre tonos
uniform vec3 uCauFondo;
uniform vec3 uCauLuz;
uniform vec3 uLuzDir;         // de dónde viene la luz: xy hacia dónde está el sol / la luna en la cúpula, z su altura (0 = horizonte, 1 = cenit)
uniform float uLuzFuerza;     // cuánta luz hay (sol = 1, luna = 0,6, pausa sin luz = 0)
uniform float uCrestas;       // cuánto toman el color de la luz las crestas que la miran
uniform float uSombra;        // cuánto se oscurecen las que le dan la espalda
uniform float uCauMetal;      // metalizado (amanecer / atardecer): brillos de metal martillado
uniform vec3 uCauLuzMetal;    // color del sol para el metalizado (no toma el azul de la luna)
uniform float uCauCielo;      // cuánto refleja el cielo el metal (lo que no mira al sol)
uniform vec3 uCauColCielo;

// Cuánta luz llega al fondo según la curvatura del agua (H) y la agitación (D)
float luzEn(vec3 H, float D) {
  float det = (1.0 + D * H.x) * (1.0 + D * H.y) - D * D * H.z * H.z;
  return 1.0 / (abs(det) + 0.06);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Gotas de lluvia en el punto P del agua, leídas de la simulación (gotas.js). Devuelve:
//   xy: la pendiente que agrega la onda: corre las cáusticas
//   z : la cresta del anillo (0 a 1)
//   w : la banda por donde pasa la onda (0 a 1): ahí la gota borra las cáusticas
// fp = tamaño de un pixel en el agua: los anillos se apagan donde ya no se distinguen.
const float GOTAS_PENDIENTE = 25.0;   // cuánto doblan la luz
const float GOTAS_CRESTA = 30.0;      // cuánto se marca la línea del anillo
vec4 gotasSim(vec2 P, float fp) {
  if (uGotasActivas < 0.5) return vec4(0.0);
  float lejos = 1.0 - smoothstep(0.012, 0.04, fp);
  if (lejos <= 0.0) return vec4(0.0);
  vec2 uv = fract(P / uGotasTam);
  float t = 1.0 / uGotasRes;
  float h = texture2D(uGotasSim, uv).r;
  float hd = texture2D(uGotasSim, uv + vec2(t, 0.0)).r, hi = texture2D(uGotasSim, uv - vec2(t, 0.0)).r;
  float ha = texture2D(uGotasSim, uv + vec2(0.0, t)).r, hb = texture2D(uGotasSim, uv - vec2(0.0, t)).r;
  vec2 pend = 0.5 * vec2(hd - hi, ha - hb);
  // Curvatura: donde el agua se curva hacia abajo (la cresta) la línea del anillo es fina y nítida
  float curva = hd + hi + ha + hb - 4.0 * h;
  vec4 r;
  r.xy = pend * GOTAS_PENDIENTE;
  r.z = clamp(-curva * GOTAS_CRESTA, 0.0, 1.0);
  r.w = smoothstep(0.015, 0.1, abs(h));
  return r * lejos;
}
`;
