// Capa "río real": el río visto desde la playa, con cielo, islas, olas en perspectiva,
// reflejos del sol y la luna y los anillos de las gotas de lluvia. En el domo se ve a
// través de un ojo de pez. Lo recuperé de la versión anterior al 17/11, con dos cambios:
// las olas leen su fase acumulada (uPFase, la suma capa-rio-real.js cuadro a cuadro, como
// las cáusticas) y la lluvia y el rayo ya no se dibujan acá sino en la capa de tormenta.
//
// Es un shader aparte del de las cáusticas (cada capa tiene el suyo). Se pega así:
//   GLSL_PLAYA_VARIABLES  lo que llega desde capa-rio-real.js
//   GLSL_PLAYA            cielo, olas, escena y ojo de pez
//   FRAG_PLAYA            main()
// Necesita cargados antes comun.js (NUM_ONDAS y VERT).

const GLSL_PLAYA_VARIABLES = `
precision highp float;
#define NW ${NUM_ONDAS}

const float F = 1.2;          // distancia focal de la "cámara"
const float ALTO = 1.0;       // altura de los ojos sobre el agua

varying vec2 vUv;
uniform vec2 uRes;
uniform float uFase;          // 2π × progreso del loop

uniform float uDx[NW];        // dirección de cada onda
uniform float uDy[NW];
uniform float uK[NW];         // frecuencia espacial
uniform float uAmp[NW];       // curvatura
uniform float uPFase[NW];     // fase de cada onda (0 a 2π), la suma capa-rio-real.js
uniform float uDes[NW];       // desfase inicial
uniform float uGotas;          // cuánto se ven las gotas
uniform sampler2D uGotasSim;   // gotas simuladas (gotas.js): r = altura del agua
uniform float uGotasTam;       // lado del pedazo de agua que cubre la simulación (se repite)
uniform float uGotasRes;       // casilleros de la simulación, de lado
uniform float uGotasActivas;   // 0 = no hay anillos en el agua
uniform float uTormenta;      // 0 = calma, 1 = revuelta: las arrugas finas cubren toda el agua
uniform float uCorriente;     // 0 = suben y bajan en su lugar, 1 = avanzan hacia la orilla
uniform float uCubierto;      // 0 a 1: cielo cubierto por la tormenta: tapa la luz directa del sol y la luna

uniform float uD;             // agitación
uniform float uNitidez;
uniform float uEspejo;        // reflejo mínimo del cielo en el agua
uniform float uCieloGris;     // cuánto se apaga el azul del cielo alto (0 = color pleno, 1 = gris)
uniform float uCieloAlto;     // altura hasta la que el cielo se aclara hacia el horizonte
uniform float uDispersion;
uniform float uTurbidez;
uniform float uExpo;
uniform float uVineta;

uniform float uHorizonte;     // altura del horizonte en pantalla (0 abajo, 1 arriba)
uniform float uIslas;         // altura de las islas
uniform float uReflejo;       // exponente del brillo: más alto = camino de luz más angosto
uniform float uHalo;          // resplandor ancho alrededor del camino del sol / la luna
uniform float uFacetas;       // cuánto se encienden las caras de las olas que miran al sol / la luna
uniform float uCrep;          // refuerzo de amanecer y atardecer (0 = ninguno)
uniform float uOrilla;        // cuánto fondo se ve en la orilla

uniform float uPerspectiva;   // 0 = olas del mismo tamaño en todo el cuadro, 1 = perspectiva real
uniform float uOrganico;      // cuánto se deforman las ondas
uniform float uCapas;         // cantidad de tonos (0 = degradé continuo)
uniform float uBorde;         // suavidad del borde entre tonos

uniform vec3 uAgua;
uniform vec3 uLuz;
uniform float uInt;
uniform vec3 uColCielo;
uniform vec3 uColHorizonte;
uniform vec3 uColIslas;
uniform vec3 uSol;            // dirección del sol
uniform vec3 uLuna;
uniform float uSolVis;
uniform float uLunaVis;

uniform float uDomo;          // 1 = versión domo
uniform float uDomoCampo;     // ángulo (radianes) que se ve del centro al borde del círculo

// Cuánta luz llega al fondo según la curvatura del agua (H) y la agitación (D)
float luzEn(vec3 H, float D) {
  float det = (1.0 + D * H.x) * (1.0 + D * H.y) - D * D * H.z * H.z;
  return 1.0 / (abs(det) + 0.06);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Gotas de lluvia en el punto P del agua, leídas de la simulación (gotas.js). Devuelve:
//   xy: la pendiente que agrega la onda: dobla los reflejos
//   z : la cresta del anillo (0 a 1)
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
  float curva = hd + hi + ha + hb - 4.0 * h;
  vec4 r;
  r.xy = pend * GOTAS_PENDIENTE;
  r.z = clamp(-curva * GOTAS_CRESTA, 0.0, 1.0);
  return r * lejos;
}
`;

const GLSL_PLAYA = `
// Islas bajas y chatas, con el borde irregular de los árboles
float perfilIslas(float x) {
  float monte = 0.004 * sin(x * 3.0 + 1.3) + 0.003 * sin(x * 7.0 + 0.4);
  // Copas de árboles: lomitas redondeadas de distinto tamaño
  float copas = 0.005 * abs(sin(x * 19.0 + 2.1)) * (0.6 + 0.4 * sin(x * 4.3))
              + 0.003 * abs(sin(x * 47.0 + 1.0))
              + 0.0015 * abs(sin(x * 113.0));
  return uIslas * (0.016 + monte + copas);
}

// Lo que se ve mirando en la dirección dir (cielo, sol, luna, islas).
// pesoIslas < 1 aclara las islas (para sus reflejos en las olas cercanas).
vec3 cielo(vec3 dir, float pesoIslas) {
  dir = normalize(dir);
  vec2 s = dir.xy / max(dir.z, 0.001) * F;    // posición en pantalla
  vec3 alto = mix(uColCielo, vec3(dot(uColCielo, vec3(0.299, 0.587, 0.114))), uCieloGris);
  vec3 col = mix(uColHorizonte * (1.0 + uCrep * 0.8), alto, smoothstep(0.0, uCieloAlto, dir.y));

  // Resplandor del cielo alrededor del sol y la luna (es parte del color del momento: queda
  // con tormenta) y el disco (con tormenta se tapa: uCubierto)
  float ds = dot(dir, uSol);
  col += uLuz * uInt * (pow(max(ds, 0.0), 12.0) * 0.35 + smoothstep(0.99975, 0.9999, ds) * 2.5 * (1.0 - uCubierto)) * uSolVis;
  float dm = dot(dir, uLuna);
  col += vec3(0.9, 0.93, 1.0) * (pow(max(dm, 0.0), 60.0) * 0.12 + smoothstep(0.99965, 0.9998, dm) * 1.2 * (1.0 - uCubierto)) * uLunaVis;

  col = mix(col, uColIslas, smoothstep(0.004, -0.002, s.y - perfilIslas(s.x)) * pesoIslas);
  return col;
}

// Pendiente (g) y curvatura (Hs) de la superficie en el punto P del agua.
// fp = tamaño de un pixel en el agua: las ondas más chicas que eso se apagan
// para que a lo lejos no titile.
// Parches de viento: las arrugas finas aparecen donde pega una racha y se
// calman entre medio. Vueltas enteras por loop, así sigue cerrando.
float parche(vec2 P) {
  float a = sin(P.x * 1.1 + 1.7 * sin(P.y * 0.8 + uFase) + 2.0)
          * sin(P.y * 0.9 - 1.3 * sin(P.x * 0.7 - uFase) + 0.5);
  return mix(0.3, 1.0, smoothstep(-0.35, 0.5, a));
}

void olas(vec2 P, float fp, out vec2 g, out vec3 Hs) {
  g = vec2(0.0);
  Hs = vec3(0.0);
  float racha = mix(parche(P), 1.0, uTormenta);
  for (int i = 0; i < NW; i++) {
    vec2 d = vec2(uDx[i], uDy[i]);
    float k = uK[i];
    float filtro = clamp(1.0 - k * fp * 0.6, 0.0, 1.0);
    float x = k * dot(d, P) + uDes[i];
    float t = uPFase[i] + uDes[i] * 1.7;
    float s = mix(sin(x) * cos(t) * 1.41, sin(x + t), uCorriente);
    float c = mix(cos(x) * cos(t) * 1.41, cos(x + t), uCorriente);
    float a = uAmp[i] * filtro * mix(1.0, racha, smoothstep(5.0, 11.0, k));
    g += a / k * c * d;
    Hs -= a * s * vec3(d.x * d.x, d.y * d.y, d.x * d.y);
  }
}

// La imagen del formato normal: uv de 0 a 1 (y hacia abajo), aspecto = ancho / alto.
// kfp agranda el filtro de las olas cuando la imagen se comprime (ojo de pez).
vec3 escena(vec2 uv, float aspecto, float kfp) {
  vec3 rayo = vec3((uv.x - 0.5) * aspecto, uv.y - uHorizonte, F);
  vec3 col;
  float anillos = 0.0;

  if (rayo.y >= 0.0) {
    col = cielo(rayo, 1.0);
  } else {
    // Punto del agua que se ve en este pixel
    float dy = -rayo.y;
    float zReal = ALTO * F / dy;
    vec2 Preal = vec2(rayo.x * zReal / F, zReal);
    // Versión plana: las olas no se achican hacia arriba, solo se estiran a lo ancho
    float zCerca = ALTO * F / uHorizonte;
    vec2 Pplano = vec2(rayo.x * 1.8, zCerca + uv.y * 3.0);
    vec2 P = mix(Pplano, Preal, uPerspectiva);
    float z = P.y;
    float fp = mix(3.0 / uRes.y, zReal * zReal / (ALTO * F) / uRes.y, uPerspectiva) * kfp;

    // Deformación orgánica (vueltas enteras por loop, así sigue cerrando)
    vec2 w = vec2(sin(P.y * 1.7 + sin(P.x * 0.8 + uFase)),
                  sin(P.x * 1.3 - cos(P.y * 1.1 - 2.0 * uFase)));
    P += uOrganico * 0.35 * w;

    vec2 g; vec3 Hs;
    olas(P, fp, g, Hs);
    g *= 0.4 * uD;

    // La lluvia abre anillos sobre el agua (gotas simuladas, gotas.js)
    vec4 gt = gotasSim(P, fp);
    g += gt.xy * uGotas * 0.35;
    anillos = gt.z;

    vec3 V = normalize(rayo);
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 R = reflect(V, N);
    R.y = abs(R.y);
    float fresnel = mix(0.02 + 0.98 * pow(1.0 - max(dot(-V, N), 0.0), 5.0), 1.0, uEspejo);

    // Luz directa del sol y la luna sobre el agua: con tormenta queda tapada
    float directa = 1.0 - uCubierto;

    // Camino de luz del sol / la luna
    float brillo = (pow(max(dot(R, uSol), 0.0), uReflejo) * uSolVis
                 + pow(max(dot(R, uLuna), 0.0), uReflejo * 1.5) * uLunaVis * 0.6) * directa;
    // Con capas, el brillo es una mancha plana de luz en vez de un lustre
    if (uCapas > 0.5) brillo = smoothstep(0.3, 0.32 + uBorde * 0.6, brillo) * 0.6;

    // Fondo de la orilla con cáusticas, se pierde en el agua barrosa
    float claridad = uOrilla * exp(-(z - zCerca) * (0.6 + 2.5 * uTurbidez));
    vec3 l = vec3(
      luzEn(Hs, uD * (1.0 - uDispersion)),
      luzEn(Hs, uD),
      luzEn(Hs, uD * (1.0 + uDispersion))
    );
    l = pow(mix(l, vec3(1.0), uTurbidez), vec3(uNitidez));
    vec3 fondo = uAgua * 1.3 + uLuz * uInt * 0.3 * l;
    vec3 adentro = mix(uAgua, fondo, claridad);

    float pesoIslas = mix(0.35, 1.0, smoothstep(4.0, 14.0, z));
    // Resplandor ancho: las olas lo rompen en trazos y se ve el camino de luz
    float haloLuz = (pow(max(dot(R, uSol), 0.0), uReflejo * 0.06) * uSolVis
                   + pow(max(dot(R, uLuna), 0.0), uReflejo * 0.09) * uLunaVis * 0.5) * uHalo;
    // (el resplandor ancho es el color del momento sobre el agua: queda con tormenta;
    // se tapan el camino de luz nítido y los destellos de las olas)
    // Caras de las olas inclinadas hacia el sol o la luna (también con el sol a la espalda)
    float facetas = (smoothstep(0.03, 0.15, dot(N, uSol) - uSol.y) * uSolVis * min(uCrep, 1.0)
                   + smoothstep(0.03, 0.15, dot(N, uLuna) - uLuna.y) * uLunaVis * 0.4) * uFacetas * directa;
    float refuerzo = 1.0 + uCrep * 1.5;
    col = mix(adentro, cielo(R, pesoIslas), fresnel)
        + uLuz * uInt * (brillo * 3.0 + (haloLuz * 0.5 + facetas * 0.6) * refuerzo);
    col += vec3(0.5, 0.55, 0.6) * anillos * uGotas * 0.25;
  }

  col = 1.0 - exp(-col * uExpo * 1.6);

  // Pocas capas de tono con borde, como un grabado o papel recortado
  if (uCapas > 0.5) {
    float lum = max(dot(col, vec3(0.299, 0.587, 0.114)), 0.001);
    float f = lum * uCapas;
    float q = (floor(f) + smoothstep(0.5 - uBorde, 0.5 + uBorde, fract(f)) + 0.3) / (uCapas + 0.3);
    col *= q / lum;
  }
  return col;
}

// El domo: la misma imagen del formato normal, vista como si el círculo fuera
// la lente de un ojo de pez. Cada pixel mira a un ángulo desde el centro y se
// pinta con lo que el formato normal tiene en esa dirección (proyección
// rectilínea): el centro queda ampliado y los bordes se aprietan.
vec3 ojoDePez() {
  vec2 c = (vUv - 0.5) * 2.0;
  float r = length(c);
  float px = 2.0 / uRes.y;
  if (r > 1.0 + px) return vec3(0.0);

  float th = min(r, 1.0) * uDomoCampo;
  float tope = tan(uDomoCampo);
  float rho = tan(th) / tope;
  float kfp = uDomoCampo / (cos(th) * cos(th) * tope);
  vec2 src = r > 1e-4 ? c / r * rho : vec2(0.0);
  vec3 col = escena(vec2(0.5 + 0.5 * src.x, 0.5 - 0.5 * src.y), 1.0, kfp);
  return col * smoothstep(1.0 + px, 1.0 - px, r);
}

// La playa, en pantalla común o en ojo de pez
vec3 playa() {
  if (uDomo > 0.5) return ojoDePez();
  float aspecto = uRes.x / uRes.y;
  vec3 col = escena(vec2(vUv.x, 1.0 - vUv.y), aspecto, 1.0);
  float v = smoothstep(1.15, 0.35, length((vUv - 0.5) * vec2(aspecto, 1.0)) * 1.1);
  return col * mix(1.0, v, uVineta);
}
`;

const FRAG_PLAYA = GLSL_PLAYA_VARIABLES + GLSL_PLAYA + `
void main() {
  vec3 col = playa();

  // Un poquito de grano para que no se vean escalones en el proyector
  col += (hash(gl_FragCoord.xy + fract(uFase * 7.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;
