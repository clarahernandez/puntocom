// Las cáusticas: las figuras de luz que hacen las olas sobre el fondo del río.
// Las olas son las de la versión domo de solo-agua.

const GLSL_CAUSTICAS = `
// Pendiente (g), curvatura (Hs) y altura (h, de -1 a 1 aprox.: valle a cresta) del agua en el punto P.
// fp = tamaño de un pixel en el agua: las ondas más chicas que eso se apagan para que no titile.
void olasCau(vec2 P, float fp, out vec2 g, out vec3 Hs, out float h) {
  g = vec2(0.0);
  Hs = vec3(0.0);
  h = 0.0;
  float hMax = 0.0;
  for (int i = 0; i < NW; i++) {
    vec2 d = vec2(uCDx[i], uCDy[i]);
    float k = uCK[i];
    float filtro = clamp(1.0 - k * fp * 1.5, 0.0, 1.0);
    float x = k * dot(d, P) + uCDes[i];
    float t = uCFase[i] + uCDes[i] * 1.7;
    float s = mix(sin(x) * cos(t) * 1.41, sin(x + t), uCorriente);
    float c = mix(cos(x) * cos(t) * 1.41, cos(x + t), uCorriente);
    float a = uCAmp[i] * filtro;
    g += a / k * c * d;
    Hs -= a * s * vec3(d.x * d.x, d.y * d.y, d.x * d.y);
    // La altura es la suma de cada ola (curvatura / k²); se normaliza por la más alta posible
    h += a / (k * k) * s;
    hMax += a / (k * k);
  }
  h /= max(hMax, 1e-6);
}

// En el domo las cáusticas cubren toda la cúpula: el fondo del río se reparte
// parejo según el ángulo (fisheye equidistante), así las figuras tienen el mismo
// tamaño en el cenit y cerca del horizonte. En pantalla común se ve la misma
// cúpula de arriba a abajo, estirada a lo ancho (sin círculo).
vec3 causticas() {
  vec2 c = (vUv - 0.5) * 2.0;
  float r = length(c);
  float px = 2.0 / uRes.y;
  if (uDomo > 0.5) {
    if (r > 1.0 + px) return vec3(0.0);
  } else {
    c.x *= uRes.x / uRes.y;
  }

  vec2 P = c * uCauEscala;
  vec2 w = vec2(sin(P.y * 1.7 + sin(P.x * 0.8 + uFase)),
                sin(P.x * 1.3 - cos(P.y * 1.1 - 2.0 * uFase)));
  P += uOrganico * 0.35 * w;

  // Las gotas intervienen el agua: la onda corre las olas de lugar (gotas simuladas, gotas.js)
  vec4 gt = gotasSim(P, uCauEscala * px);
  P += gt.xy * 0.08 * uGotas;

  vec2 g; vec3 Hs; float h;
  olasCau(P, uCauEscala * px, g, Hs, h);
  float anillo = clamp(gt.z * uGotas, 0.0, 1.0);   // cresta de la onda de una gota
  float banda = clamp(gt.w * uGotas, 0.0, 1.0);    // por dónde pasa

  vec3 l = vec3(
    luzEn(Hs, uDCau * (1.0 - uDispersion)),
    luzEn(Hs, uDCau),
    luzEn(Hs, uDCau * (1.0 + uDispersion))
  );

  // Alto contraste: el agua quieta (l cerca de 1) queda en el color de fondo
  // y solo las líneas donde la luz se concentra suben hasta el brillo máximo.
  vec3 v = 1.0 - exp(-max(l - 1.0, 0.0) * uCauBrillo);
  v = pow(v, vec3(uCauContraste * uNitidez));

  // No hay un foco: la luz del sol (o de la luna) llega pareja a toda el agua, desde una
  // dirección (uLuzDir: xy hacia dónde está en el cielo, z su altura). Las líneas de luz
  // tienen la fuerza de la luz del momento (de noche, la de la luna; en la pausa, casi nada).
  // Con el cielo cubierto (tormenta) no hay luz directa: las líneas quedan parejas y tenues.
  float directa = 1.0 - uCubierto;
  float fuerza = mix(uLuzFuerza, 0.6, uCubierto);
  v *= mix(0.08, 1.0, fuerza) * mix(1.0, 0.5, uCubierto);

  // Donde pasa la onda de una gota, las cáusticas se borran y queda el agua lisa...
  v *= 1.0 - 0.95 * banda;
  // ...salvo la cresta del anillo, que funciona como una lente y junta luz: una línea clara
  v = max(v, vec3(anillo * mix(0.3, 1.0, fuerza)));

  // Las crestas cambian de color según hacia dónde miran: las caras que miran hacia la luz
  // toman su color y las que le dan la espalda quedan en sombra, con un poco del azul-gris
  // del cielo. Con el sol bajo la luz llega de costado y el contraste es fuerte; con el sol
  // alto viene de arriba y es suave. A lo largo del día la luz gira y las crestas encendidas
  // van rotando por toda la cúpula.
  vec2 haciaLuz = normalize(uLuzDir.xy + 1e-5);
  float rasante = 1.0 - 0.6 * clamp(uLuzDir.z, 0.0, 1.0);
  float cara = -dot(g, haciaLuz) * uCauEscala * rasante;
  float mira = smoothstep(0.01, 0.1, cara) * fuerza * directa;        // mira hacia la luz
  float espalda = smoothstep(0.01, 0.1, -cara) * fuerza * directa;    // le da la espalda
  vec3 sombra = mix(uCauFondo * 0.45, uCauColCielo * 0.5, uCauCielo);
  vec3 fondo = mix(uCauFondo, uCauLuz * 0.85, mira * uCrestas);
  fondo = mix(fondo, sombra, espalda * uSombra);

  vec3 col = mix(fondo, uCauLuz, v);

  // Metalizado: con el sol bajo el agua brilla como metal martillado. La base
  // se oscurece (y refleja un poco el cielo), las caras que miran a la luz se
  // encienden en bandas, el color de la luz se satura y las líneas más fuertes
  // llegan al blanco.
  if (uCauMetal > 0.001) {
    vec3 luzSat = pow(uCauLuzMetal, vec3(2.0));
    float faceta = smoothstep(0.02, 0.12, cara) * fuerza * directa;
    vec3 base = mix(uCauFondo * 0.45, uCauColCielo * 0.6, uCauCielo);
    vec3 metal = mix(base, luzSat * 0.85, faceta);
    metal = mix(metal, luzSat, v);
    metal = mix(metal, vec3(1.0), smoothstep(0.6, 1.0, v));
    col = mix(col, metal, uCauMetal);
  }

  // Profundidad de las olas: el agua barrosa se come la luz, así que en los valles (más agua
  // entre la luz y el fondo) todo se oscurece y en las crestas se aclara. Con el agua revoltosa
  // (oleaje) los valles se ven hondos; tranquila, casi no se nota
  col *= exp(uProfundidad * h * 1.5);

  if (uCauCapas > 0.5) {
    float lum = max(dot(col, vec3(0.299, 0.587, 0.114)), 0.001);
    float f = lum * uCauCapas;
    float q = (floor(f) + smoothstep(0.5 - uBorde, 0.5 + uBorde, fract(f))) / uCauCapas;
    col *= q / lum;
  }

  // Borde del círculo sin serrucho
  return uDomo > 0.5 ? col * smoothstep(1.0 + px, 1.0 - px, r) : col;
}
`;
